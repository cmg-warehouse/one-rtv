import { hubOf } from '../data/masters';
import { bi, tr } from '../i18n';
import { FlowError, rtvId, type Ctx } from './machine';
import type {
  Box, Hub, PromoEvent, PromoExtra, PromoLine, PromoLog, Role, Rtv, RtvEvent, Step, TruckType, Vehicle,
} from './types';

/**
 * งานเก็บโปร: the promotion coordinator announces one pickup at an event venue for many brands (replacing the
 * "แจ้งรายชื่อ" e-mail), CS forwards it to the carrier, the carrier confirms trucks and plates (replacing the
 * "ยืนยันรถเก็บโปร" e-mail) and records what each brand actually handed over. Every brand gets its own RTV, which
 * then follows the normal flow (SCDC or CMG-CDS, count, Brand documents, CN).
 */

export const PROMO_STATUS_LABELS: Record<PromoEvent['status'], string> = bi({
  REQUESTED: ['แจ้งงานแล้ว รอ CS ส่งต่อขนส่ง', 'Announced, waiting for CS to forward to carrier'],
  FORWARDED: ['ส่งต่อขนส่งแล้ว รอยืนยันรถ', 'Forwarded to carrier, waiting for truck confirmation'],
  CONFIRMED: ['ยืนยันรถแล้ว รอวันเก็บ', 'Trucks confirmed, waiting for pickup day'],
  PICKED: ['เก็บสินค้าแล้ว', 'Goods collected'],
});

export const PROMO_STAGES: { status: PromoEvent['status']; label: string; role: Role }[] = [
  { status: 'REQUESTED', get label() { return tr('ผู้ประสานงานแจ้งงาน', 'Coordinator announces the job'); }, role: 'PROMO' },
  { status: 'FORWARDED', get label() { return tr('CS ส่งต่อขนส่ง', 'CS forwards to carrier'); }, role: 'CS' },
  { status: 'CONFIRMED', get label() { return tr('ขนส่งยืนยันรถ', 'Carrier confirms trucks'); }, role: 'CARRIER' },
  { status: 'PICKED', get label() { return tr('เก็บสินค้าที่หน้างาน', 'Collect goods on site'); }, role: 'CARRIER' },
];

export const TRUCK_TYPES: TruckType[] = ['4W', '6W', '10W'];
/** Rough pallets per truck, for the coordinator's estimate only. */
export const PALLETS_PER_TRUCK: Record<TruckType, number> = { '4W': 4, '6W': 12, '10W': 20 };

export function suggestTrucks(pallets: number): { type: TruckType; count: number } {
  if (pallets <= PALLETS_PER_TRUCK['4W']) return { type: '4W', count: 1 };
  return { type: '6W', count: Math.max(1, Math.ceil(pallets / PALLETS_PER_TRUCK['6W'])) };
}

export interface PromoInput {
  name: string; storeId: string; pickupAt: string;
  contact: { name: string; phone: string };
  /** `hub`: the coordinator's choice; omitted = the brand's default (hubOf). */
  lines: { brandId: string; boxes: number; pallets: number; hub?: Hub }[];
  extras: { label: string; pallets: number }[];
  estimate: { type: TruckType; count: number };
}

export interface PromoResult { event: PromoEvent; rtvs: Rtv[] }

export function promoId(seq: number, now: string): string {
  return rtvId(seq, now).replace(/^RTV-CMG-/, 'PRO-').replace(/-0*(\d+)$/, (_, n: string) => `-${n.padStart(4, '0')}`);
}

export const slipOf = (event: PromoEvent): string => `PS-${event.id}`;

export const totals = (e: PromoEvent) => ({
  boxes: e.lines.reduce((n, l) => n + l.boxes, 0),
  pallets: e.lines.reduce((n, l) => n + l.pallets, 0) + e.extras.reduce((n, x) => n + x.pallets, 0),
  pickedBoxes: e.lines.reduce((n, l) => n + (l.pickedBoxes ?? 0), 0),
  pickedPallets: e.lines.reduce((n, l) => n + (l.pickedPallets ?? 0), 0) + e.extras.reduce((n, x) => n + (x.pickedPallets ?? 0), 0),
});

function requireRole(ctx: Ctx, role: Role): void {
  if (ctx.role !== role) throw new FlowError(tr('ขั้นนี้ไม่ใช่หน้าที่ของบทบาทนี้', 'This step is not for this role'));
}

const isCount = (n: number, min: number) => Number.isInteger(n) && n >= min;
const log = (ctx: Ctx, text: string): PromoLog => ({ at: ctx.now, role: ctx.role, actor: ctx.actor, text });
const rtvEv = (ctx: Ctx, step: Step, note: string, extra: Partial<RtvEvent> = {}): RtvEvent =>
  ({ at: ctx.now, role: ctx.role, actor: ctx.actor, kind: 'STEP', step, note, ...extra });
const boxNo = (id: string, i: number) => `${id}-B${String(i + 1).padStart(2, '0')}`;

function stepRtv(rtv: Rtv, patch: Partial<Rtv>, events: RtvEvent[]): Rtv {
  return { ...rtv, boxes: rtv.boxes.map(b => ({ ...b })), docs: rtv.docs.map(d => ({ ...d })), ...patch, events: [...rtv.events, ...events] };
}

function requireStatus(e: PromoEvent, ...ok: PromoEvent['status'][]): void {
  if (!ok.includes(e.status)) throw new FlowError(tr(`งานนี้อยู่ในสถานะ "${PROMO_STATUS_LABELS[e.status]}" ทำขั้นนี้ไม่ได้`, `This job is in status "${PROMO_STATUS_LABELS[e.status]}", so this step is not possible`));
}

/** The coordinator opens the pickup; each brand line becomes an RTV at step 1 (no documents yet, piece counts unknown). */
export function createPromo(input: PromoInput, seq: number, firstRtvSeq: number, ctx: Ctx): PromoResult {
  requireRole(ctx, 'PROMO');
  const name = input.name.trim();
  if (!name) throw new FlowError(tr('กรุณาตั้งชื่องาน', 'Please name the job'));
  if (!input.storeId) throw new FlowError(tr('กรุณาเลือกสถานที่เก็บ', 'Please choose the pickup venue'));
  if (!input.pickupAt || Number.isNaN(Date.parse(input.pickupAt))) throw new FlowError(tr('กรุณาระบุวันและเวลาเก็บ', 'Please enter the pickup date and time'));
  if (!input.contact.name.trim() || !input.contact.phone.trim()) throw new FlowError(tr('กรุณากรอกชื่อและเบอร์ผู้ประสานงานหน้างาน', 'Please enter the on-site coordinator name and phone'));
  if (input.lines.length === 0) throw new FlowError(tr('กรุณาเพิ่มแบรนด์อย่างน้อย 1 แบรนด์', 'Please add at least 1 brand'));
  const seen = new Set<string>();
  for (const l of input.lines) {
    if (!l.brandId) throw new FlowError(tr('กรุณาเลือกแบรนด์ให้ครบทุกแถว', 'Please choose a brand for every row'));
    if (seen.has(l.brandId)) throw new FlowError(tr(`แบรนด์ ${l.brandId} ซ้ำ รวมเป็นแถวเดียว`, `Brand ${l.brandId} is duplicated, merge into one row`));
    seen.add(l.brandId);
    if (!isCount(l.boxes, 1) || !isCount(l.pallets, 0)) throw new FlowError(tr(`แบรนด์ ${l.brandId}: จำนวนกล่องต้องตั้งแต่ 1 และพาเลทตั้งแต่ 0`, `Brand ${l.brandId}: boxes must be at least 1 and pallets at least 0`));
  }
  const extras: PromoExtra[] = input.extras
    .filter(x => x.label.trim())
    .map(x => {
      if (!isCount(x.pallets, 1)) throw new FlowError(tr(`${x.label}: จำนวนพาเลทต้องตั้งแต่ 1`, `${x.label}: pallets must be at least 1`));
      return { label: x.label.trim(), pallets: x.pallets };
    });
  if (!isCount(input.estimate.count, 1)) throw new FlowError(tr('จำนวนรถต้องตั้งแต่ 1 คัน', 'At least 1 truck is required'));

  const id = promoId(seq, ctx.now);
  const hubs = input.lines.map(l => l.hub ?? hubOf(l.brandId));
  const rtvs: Rtv[] = input.lines.map((l, i) => {
    const rid = rtvId(firstRtvSeq + i, ctx.now);
    const boxes: Box[] = Array.from({ length: l.boxes }, (_, k) => ({ no: boxNo(rid, k), expectedPcs: 0 }));
    return {
      id: rid, brandId: l.brandId, storeId: input.storeId, channel: 'TEMP_SHOP', saleType: 'PROMO',
      carrier: null, boxes, docs: [], step: 1, shortBoxes: 0, qtyConfirmed: false, promoConfirmed: false,
      createdAt: ctx.now, promoId: id, hub: hubs[i],
      events: [rtvEv(ctx, 1, tr(`งานเก็บโปร ${id}: แจ้ง ${l.boxes} กล่อง / ${l.pallets} พาเลท`, `Promo pickup ${id}: announced ${l.boxes} boxes / ${l.pallets} pallets`))],
    };
  });
  const lines: PromoLine[] = input.lines.map((l, i) => ({ brandId: l.brandId, boxes: l.boxes, pallets: l.pallets, hub: hubs[i], rtvId: rtvs[i].id }));
  const event: PromoEvent = {
    id, name, storeId: input.storeId, pickupAt: input.pickupAt,
    contact: { name: input.contact.name.trim(), phone: input.contact.phone.trim() },
    lines, extras, estimate: { ...input.estimate }, vehicles: [],
    status: 'REQUESTED', createdAt: ctx.now,
    log: [log(ctx, tr(`แจ้งงานเก็บโปร ${lines.length} แบรนด์ · ประมาณรถ ${input.estimate.type} × ${input.estimate.count}`, `Announced promo pickup, ${lines.length} brands · estimated trucks ${input.estimate.type} × ${input.estimate.count}`))],
  };
  return { event, rtvs };
}

const live = (rtvs: Rtv[], e: PromoEvent) => rtvs.filter(r => r.promoId === e.id);

/** CS hands the job to the carrier as a booked truck (งานจองรถ); every RTV gets steps 2 and 3 (one slip for the event). */
export function forwardPromo(e: PromoEvent, rtvs: Rtv[], ctx: Ctx): PromoResult {
  requireRole(ctx, 'CS');
  requireStatus(e, 'REQUESTED');
  const slip = slipOf(e);
  const out = live(rtvs, e).map(r => (r.cancelled ? r : stepRtv(r,
    { step: 3, carrier: 'AGREED', pickupDate: e.pickupAt, docs: [...r.docs.filter(d => d.type !== 'PICKUP_SLIP'), { type: 'PICKUP_SLIP', value: slip }] },
    [rtvEv(ctx, 2, tr(`งานเก็บโปร ${e.id}: ส่งต่อขนส่ง (งานจองรถ)`, `Promo pickup ${e.id}: forwarded to carrier (booked truck)`)), rtvEv(ctx, 3, tr(`ใบแจ้งเก็บรวมของงาน ${slip}`, `Combined pickup slip for the job ${slip}`), { auto: true, actor: tr('ระบบ', 'System') })])));
  return { event: { ...e, status: 'FORWARDED', log: [...e.log, log(ctx, tr(`ส่งต่อขนส่ง (งานจองรถ) · ใบแจ้งเก็บ ${slip}`, `Forwarded to carrier (booked truck) · pickup slip ${slip}`))] }, rtvs: out };
}

/** The carrier confirms the trucks: plates, drivers, phones. Can be changed again until the pickup. */
export function confirmVehicles(e: PromoEvent, rtvs: Rtv[], vehicles: Vehicle[], ctx: Ctx): PromoResult {
  requireRole(ctx, 'CARRIER');
  requireStatus(e, 'FORWARDED', 'CONFIRMED');
  const clean = vehicles.map(v => ({ type: v.type, plate: v.plate.trim(), driver: v.driver.trim(), phone: v.phone.trim() }));
  if (clean.length === 0) throw new FlowError(tr('กรุณาเพิ่มรถอย่างน้อย 1 คัน', 'Please add at least 1 truck'));
  if (clean.some(v => !v.plate || !v.driver)) throw new FlowError(tr('กรุณากรอกทะเบียนรถและชื่อคนขับให้ครบทุกคัน', 'Please enter the plate and driver name for every truck'));
  const text = clean.map(v => `${v.type} ${v.plate}`).join(', ');
  const first = e.status === 'FORWARDED';
  const out = live(rtvs, e).map(r => (r.cancelled || r.step !== 3 ? r
    : stepRtv(r, { step: 4 }, [rtvEv(ctx, 4, tr(`ยืนยันรถเก็บโปร: ${text}`, `Promo pickup trucks confirmed: ${text}`))])));
  return {
    event: { ...e, status: 'CONFIRMED', vehicles: clean, log: [...e.log, log(ctx, `${first ? tr('ยืนยันรถ', 'Trucks confirmed') : tr('แก้ไขรถ', 'Trucks edited')}: ${text}`)] },
    rtvs: out,
  };
}

export interface PickupInput {
  /** By brand id: boxes and pallets actually handed over (may differ from the announcement). */
  lines: Record<string, { boxes: number; pallets: number }>;
  extras: number[];
}

/**
 * The driver records what each brand handed over. The announced numbers were estimates, so the RTV's boxes become
 * the collected ones (fewer or more); a brand with nothing to collect has its RTV cancelled.
 */
export function recordPickup(e: PromoEvent, rtvs: Rtv[], input: PickupInput, ctx: Ctx): PromoResult {
  requireRole(ctx, 'CARRIER');
  requireStatus(e, 'CONFIRMED');
  for (const l of e.lines) {
    const p = input.lines[l.brandId];
    if (!p || !isCount(p.boxes, 0) || !isCount(p.pallets, 0)) throw new FlowError(tr(`แบรนด์ ${l.brandId}: กรอกจำนวนกล่องและพาเลทที่เก็บได้จริง`, `Brand ${l.brandId}: enter the boxes and pallets actually collected`));
  }
  const lines = e.lines.map(l => ({ ...l, pickedBoxes: input.lines[l.brandId].boxes, pickedPallets: input.lines[l.brandId].pallets }));
  const extras = e.extras.map((x, i) => ({ ...x, pickedPallets: Math.max(0, input.extras[i] ?? 0) }));
  const out = live(rtvs, e).map(r => {
    const l = lines.find(x => x.rtvId === r.id);
    if (!l || r.cancelled || r.step !== 4) return r;
    const got = l.pickedBoxes!;
    if (got === 0) {
      const reason = tr('งานเก็บโปร: หน้างานไม่มีสินค้าของแบรนด์นี้', 'Promo pickup: no goods of this brand on site');
      return stepRtv(r, { cancelled: { reason } }, [{ at: ctx.now, role: ctx.role, actor: ctx.actor, kind: 'CANCELLED', note: reason }]);
    }
    const diff = got - l.boxes;
    const boxes: Box[] = Array.from({ length: got }, (_, k) => r.boxes[k] ? { ...r.boxes[k] } : { no: boxNo(r.id, k), expectedPcs: 0 });
    const note = tr(`เก็บได้ ${got} กล่อง / ${l.pickedPallets} พาเลท`, `Collected ${got} boxes / ${l.pickedPallets} pallets`)
      + (diff === 0 ? tr(' ตรงตามที่แจ้ง', ' as announced')
        : tr(` (แจ้งไว้ ${l.boxes} กล่อง ${diff > 0 ? `เกิน ${diff}` : `ขาด ${-diff}`})`, ` (announced ${l.boxes} boxes, ${diff > 0 ? `over ${diff}` : `short ${-diff}`})`));
    return stepRtv(r, { step: 5, boxes }, [rtvEv(ctx, 5, note)]);
  });
  const t = totals({ ...e, lines, extras });
  return {
    event: { ...e, lines, extras, status: 'PICKED', log: [...e.log, log(ctx, tr(`เก็บสินค้าแล้ว ${t.pickedBoxes} กล่อง / ${t.pickedPallets} พาเลท (แจ้งไว้ ${t.boxes} / ${t.pallets})`, `Goods collected: ${t.pickedBoxes} boxes / ${t.pickedPallets} pallets (announced ${t.boxes} / ${t.pallets})`))] },
    rtvs: out,
  };
}
