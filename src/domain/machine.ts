import { allowedCarriers, cnType, holds, isClosed, nextStep, requiredDocs, stepsFor, DOC_LABELS } from './rules';
import type { Box, Carrier, Channel, DocRef, DocType, EventKind, Role, Rtv, RtvEvent, SaleType } from './types';

export class FlowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FlowError';
  }
}

export interface Ctx { role: Role; actor: string; now: string }
export interface NewRtvInput {
  brandId: string; storeId: string; channel: Channel; saleType: SaleType;
  boxPcs: number[]; docs: DocRef[];
}
export type StepPayload =
  | { step: 2; carrier: Carrier; pickupDate: string; carrierRef?: string }
  | { step: 3 } | { step: 4 } | { step: 7 }
  | { step: 5 | 6 | 8; boxes: number }
  | { step: 9; tk: string; counts: number[] }
  | { step: 10; docs: Partial<Record<DocType, string>> };

const WRONG_ROLE = 'ขั้นนี้ไม่ใช่หน้าที่ของบทบาทนี้';
const BRAND_DOC_TYPES: DocType[] = ['MIM', 'RTV_NOTE', 'SD10'];

export function rtvId(seq: number, now: string): string {
  const bkk = new Date(Date.parse(now) + 7 * 3600 * 1000);
  const yy = String(bkk.getUTCFullYear() % 100).padStart(2, '0');
  const mm = String(bkk.getUTCMonth() + 1).padStart(2, '0');
  return `RTV-CMG-${yy}${mm}-${String(seq).padStart(5, '0')}`;
}

function ev(ctx: Ctx, kind: EventKind, extra: Partial<RtvEvent> = {}): RtvEvent {
  return { at: ctx.now, role: ctx.role, actor: ctx.actor, kind, ...extra };
}

function next(rtv: Rtv, patch: Partial<Rtv>, events: RtvEvent[]): Rtv {
  return {
    ...rtv,
    boxes: rtv.boxes.map(b => ({ ...b })),
    docs: rtv.docs.map(d => ({ ...d })),
    ...patch,
    events: [...rtv.events, ...events],
  };
}

function requireOpen(rtv: Rtv): void {
  if (rtv.cancelled) throw new FlowError('รายการนี้ถูกยกเลิกแล้ว');
  if (isClosed(rtv)) throw new FlowError('รายการนี้ปิดงานแล้ว');
}

function requireRole(ctx: Ctx, ...roles: Role[]): void {
  if (!roles.includes(ctx.role)) throw new FlowError(WRONG_ROLE);
}

function requireText(value: string | undefined, message: string): string {
  const v = (value ?? '').trim();
  if (!v) throw new FlowError(message);
  return v;
}

function withDoc(docs: DocRef[], doc: DocRef): DocRef[] {
  return [...docs.filter(d => d.type !== doc.type), doc];
}

export function createRtv(input: NewRtvInput, seq: number, ctx: Ctx): Rtv {
  requireRole(ctx, 'BRAND');
  if (!input.brandId || !input.storeId) throw new FlowError('กรุณาเลือก Brand และสาขา');
  if (input.boxPcs.length < 1 || input.boxPcs.some(n => !Number.isInteger(n) || n < 1)) {
    throw new FlowError('จำนวนกล่องและจำนวนชิ้นต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ขึ้นไป');
  }
  const id = rtvId(seq, ctx.now);
  const boxes: Box[] = input.boxPcs.map((pcs, i) => ({
    no: `${id}-B${String(i + 1).padStart(2, '0')}`,
    expectedPcs: pcs,
  }));
  const base: Rtv = {
    id, brandId: input.brandId, storeId: input.storeId, channel: input.channel, saleType: input.saleType,
    carrier: null, boxes, docs: input.docs.map(d => ({ ...d })),
    step: 1, shortBoxes: 0, qtyConfirmed: false, promoConfirmed: false,
    createdAt: ctx.now, events: [ev(ctx, 'STEP', { step: 1 })],
  };
  if (input.channel === 'CONSIGN') {
    return next(base, { carrier: 'CG_NETWORK', step: 2 }, [
      { at: ctx.now, role: 'CS', actor: 'ระบบ', kind: 'STEP', step: 2, auto: true, note: 'อัตโนมัติ: เข้ารอบรถ CG Network' },
    ]);
  }
  return base;
}

function checkBoxes(rtv: Rtv, boxes: number): void {
  if (!Number.isInteger(boxes) || boxes < 1 || boxes > rtv.boxes.length) {
    throw new FlowError(`จำนวนกล่องต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ถึง ${rtv.boxes.length}`);
  }
}

export function advance(rtv: Rtv, payload: StepPayload, ctx: Ctx): Rtv {
  requireOpen(rtv);
  const def = nextStep(rtv);
  if (!def || def.step !== payload.step || def.role !== ctx.role) throw new FlowError(WRONG_ROLE);

  const events: RtvEvent[] = [ev(ctx, 'STEP', { step: def.step })];
  const patch: Partial<Rtv> = { step: def.step };

  switch (payload.step) {
    case 2: {
      if (!allowedCarriers(rtv.channel).includes(payload.carrier)) {
        throw new FlowError('ขนส่งนี้ใช้ไม่ได้กับช่องทางนี้');
      }
      const pickupDate = requireText(payload.pickupDate, 'กรุณาระบุวันที่เข้ารับ');
      let docs = rtv.docs.filter(d => d.type !== 'CARRIER_REF');
      if (payload.carrier === 'PARCEL') {
        const ref = requireText(payload.carrierRef, 'กรุณากรอกเลขพัสดุ');
        docs = withDoc(docs, { type: 'CARRIER_REF', value: ref });
      }
      patch.carrier = payload.carrier;
      patch.pickupDate = pickupDate;
      patch.docs = docs;
      break;
    }
    case 3:
      if (!rtv.docs.some(d => d.type === 'PICKUP_SLIP')) {
        patch.docs = withDoc(rtv.docs, { type: 'PICKUP_SLIP', value: `PS-${rtv.id.replace(/^RTV-/, '')}` });
      }
      break;
    case 5:
    case 6:
    case 8:
      checkBoxes(rtv, payload.boxes);
      if (payload.boxes < rtv.boxes.length) {
        const missing = rtv.boxes.length - payload.boxes;
        patch.shortBoxes = missing;
        events.push(ev(ctx, 'SHORT_BOX', { step: def.step, note: `ได้รับ ${payload.boxes} จาก ${rtv.boxes.length} กล่อง` }));
      }
      break;
    case 9: {
      const tk = requireText(payload.tk, 'กรุณากรอกเลข TK');
      if (payload.counts.length !== rtv.boxes.length
        || payload.counts.some(n => !Number.isInteger(n) || n < 0)) {
        throw new FlowError('จำนวนชิ้นที่นับต้องครบทุกกล่อง และเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป');
      }
      patch.boxes = rtv.boxes.map((b, i) => ({ ...b, countedPcs: payload.counts[i] }));
      patch.docs = withDoc(rtv.docs, { type: 'TK', value: tk });
      if (payload.counts.some((n, i) => n !== rtv.boxes[i].expectedPcs)) {
        events.push(ev(ctx, 'QTY_MISMATCH', { step: 9, note: 'จำนวนชิ้นที่นับไม่ตรงกับที่แจ้ง' }));
      }
      break;
    }
    case 10: {
      const open = holds(rtv);
      if (open.length > 0) throw new FlowError('ยังมีรายการที่รอดำเนินการ จึงออก CN ไม่ได้');
      const req = requiredDocs(cnType(rtv.channel, rtv.saleType));
      const missingBefore = req.before.filter(t => !rtv.docs.some(d => d.type === t));
      if (missingBefore.length > 0) {
        throw new FlowError(`เอกสารยังไม่ครบ: ${missingBefore.map(t => DOC_LABELS[t]).join(', ')}`);
      }
      const missingAtCn = req.atCn.filter(t => !(payload.docs[t] ?? '').trim());
      if (missingAtCn.length > 0) {
        throw new FlowError(`กรุณากรอกเอกสาร: ${missingAtCn.map(t => DOC_LABELS[t]).join(', ')}`);
      }
      patch.docs = req.atCn.reduce((docs, t) => withDoc(docs, { type: t, value: (payload.docs[t] as string).trim() }), rtv.docs);
      break;
    }
    default:
      break;
  }
  return next(rtv, patch, events);
}

export function failPickup(rtv: Rtv, reason: string, ctx: Ctx): Rtv {
  requireOpen(rtv);
  const pickupRole = stepsFor(rtv.channel, rtv.carrier).find(s => s.step === 4)?.role;
  if (ctx.role !== pickupRole || ![2, 3, 4].includes(rtv.step)) throw new FlowError(WRONG_ROLE);
  const note = requireText(reason, 'กรุณาระบุเหตุผล');
  const patch: Partial<Rtv> = rtv.channel === 'CONSIGN' ? {} : { step: 1 };
  return next(rtv, patch, [ev(ctx, 'PICKUP_FAILED', { step: rtv.step, note })]);
}

export function clearShortFlag(rtv: Rtv, note: string, ctx: Ctx): Rtv {
  requireOpen(rtv);
  requireRole(ctx, 'CS');
  if (rtv.shortBoxes === 0) throw new FlowError('ไม่มีกล่องขาดที่ต้องปิด');
  const text = requireText(note, 'กรุณากรอกหมายเหตุ');
  return next(rtv, { shortBoxes: 0 }, [ev(ctx, 'FLAG_CLEARED', { note: text })]);
}

function requireStep9Brand(rtv: Rtv, ctx: Ctx): void {
  requireOpen(rtv);
  requireRole(ctx, 'BRAND');
  if (rtv.step !== 9) throw new FlowError(WRONG_ROLE);
}

export function brandConfirmQty(rtv: Rtv, ctx: Ctx): Rtv {
  requireStep9Brand(rtv, ctx);
  return next(rtv, { qtyConfirmed: true }, [ev(ctx, 'BRAND_CONFIRMED', { step: 9 })]);
}

export function brandRequestRecount(rtv: Rtv, ctx: Ctx): Rtv {
  requireStep9Brand(rtv, ctx);
  return next(rtv, {
    step: 8,
    qtyConfirmed: false,
    boxes: rtv.boxes.map(b => ({ no: b.no, expectedPcs: b.expectedPcs })),
  }, [ev(ctx, 'RECOUNT_REQUESTED', { step: 9 })]);
}

export function confirmPromo(rtv: Rtv, ctx: Ctx): Rtv {
  requireStep9Brand(rtv, ctx);
  return next(rtv, { promoConfirmed: true }, [ev(ctx, 'PROMO_CONFIRMED', { step: 9 })]);
}

export function addDoc(rtv: Rtv, doc: DocRef, ctx: Ctx): Rtv {
  requireOpen(rtv);
  requireRole(ctx, 'BRAND');
  if (!BRAND_DOC_TYPES.includes(doc.type)) throw new FlowError(WRONG_ROLE);
  const value = requireText(doc.value, 'กรุณากรอกเลขเอกสาร');
  return next(rtv, { docs: withDoc(rtv.docs, { type: doc.type, value }) },
    [ev(ctx, 'DOC_ADDED', { note: `${DOC_LABELS[doc.type]}: ${value}` })]);
}

export function cancel(rtv: Rtv, reason: string, ctx: Ctx): Rtv {
  requireOpen(rtv);
  requireRole(ctx, 'BRAND', 'CS');
  if (rtv.step >= 5) throw new FlowError('ยกเลิกไม่ได้ เพราะขนส่งเก็บสินค้าแล้ว');
  const note = requireText(reason, 'กรุณาระบุเหตุผล');
  return next(rtv, { cancelled: { reason: note } }, [ev(ctx, 'CANCELLED', { note })]);
}
