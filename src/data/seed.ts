import {
  addDoc, advance, brandConfirmQty, brandRequestRecount, cancel, clearShortFlag, confirmPromo, createRtv, failPickup,
} from '../domain/machine';
import type { Ctx, StepPayload } from '../domain/machine';
import { holds, isMallGroup, nextStep, stepsFor } from '../domain/rules';
import type { Carrier, Channel, DocRef, DocType, Role, Rtv, SaleType, Step } from '../domain/types';
import { ACTORS, BRANDS, BRAND_ACTORS, STORES } from './masters';

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const BKK = 7 * HOUR;
/** The seed spans at most this many days before `now`. */
const MAX_AGE_DAYS = 29;
const FIRST_SEQ = 101;

interface Spec {
  brand: number;                       // index into BRANDS / BRAND_ACTORS
  store: string;
  upTo: Step;                          // last completed step to reach
  wait: number;                        // days since the last event
  sale?: SaleType;
  carrier?: Carrier;
  boxes?: number;
  sd10?: boolean;
  rtvNote?: 'create' | 'late' | 'none'; // Consign / Local mall only; default 'late'
  failAt?: Step;                       // pickup fails right after this step
  short?: { at: 5 | 6 | 8; clear?: boolean };
  mismatch?: boolean;                  // counted pcs differ at step 9
  confirm?: boolean;                   // Brand confirms the counted quantity
  promoOk?: boolean;
  recount?: boolean;                   // Brand asks for a recount after step 9
  cancel?: { by: 'BRAND' | 'CS'; reason: string };
}

const s = (brand: number, store: string, upTo: Step, wait: number, opts: Partial<Spec> = {}): Spec =>
  ({ brand, store, upTo, wait, ...opts });

const SPECS: Spec[] = [
  // step 1
  s(0, 'store-01', 1, 1.2),
  s(1, 'store-04', 1, 3),
  s(2, 'store-11', 1, 0.5),
  s(3, 'store-03', 1, 17),
  // step 2
  s(0, 'store-01', 2, 1.5, { carrier: 'PLAZA_4W' }),
  s(0, 'store-07', 2, 2),
  s(1, 'store-02', 2, 2, { carrier: 'PARCEL' }),
  s(4, 'store-12', 2, 1),
  // step 3 (one with a failed first pickup)
  s(0, 'store-02', 3, 1, { carrier: 'PLAZA_4W', failAt: 3 }),
  s(0, 'store-05', 3, 1, { carrier: 'PLAZA_4W' }),
  s(2, 'store-03', 3, 2.5, { carrier: 'CG_NETWORK' }),
  s(5, 'store-01', 3, 1.5, { carrier: 'CG_NETWORK' }),
  // step 4
  s(0, 'store-02', 4, 2, { carrier: 'PLAZA_4W' }),
  s(0, 'store-08', 4, 1.5),
  s(3, 'store-06', 4, 3, { carrier: 'CG_NETWORK' }),
  s(1, 'store-11', 4, 4),
  s(0, 'store-01', 4, 2, { carrier: 'PARCEL' }),
  // step 5
  s(0, 'store-04', 5, 1, { carrier: 'PLAZA_4W', boxes: 3 }),
  s(0, 'store-03', 5, 5, { carrier: 'CG_NETWORK', boxes: 2, short: { at: 5 } }),
  s(2, 'store-09', 5, 2),
  s(4, 'store-10', 5, 3),
  // step 6
  s(0, 'store-02', 6, 2.5, { carrier: 'CG_NETWORK', boxes: 3, short: { at: 5, clear: true } }),
  s(3, 'store-06', 6, 6, { carrier: 'CG_NETWORK' }),
  s(1, 'store-08', 6, 2),
  // step 7
  s(0, 'store-01', 7, 1, { carrier: 'CG_NETWORK' }),
  s(5, 'store-09', 7, 3),
  s(2, 'store-03', 7, 15, { carrier: 'CG_NETWORK' }),
  // step 8
  s(0, 'store-02', 8, 1.5, { carrier: 'PLAZA_4W' }),
  s(0, 'store-07', 8, 2),
  s(3, 'store-11', 8, 4),
  s(1, 'store-01', 8, 7, { carrier: 'CG_NETWORK', boxes: 3, short: { at: 8 } }),
  // step 9: free to close, and the three holds
  s(0, 'store-01', 9, 1, { carrier: 'PLAZA_4W' }),
  s(0, 'store-07', 9, 2, { rtvNote: 'create' }),
  s(0, 'store-08', 9, 7, { rtvNote: 'none' }),
  s(0, 'store-02', 9, 5, { carrier: 'CG_NETWORK', mismatch: true }),
  s(0, 'store-05', 9, 6, { carrier: 'PLAZA_4W', sale: 'PROMO' }),
  s(2, 'store-11', 9, 16, { mismatch: true, rtvNote: 'none' }),
  s(4, 'store-09', 9, 9, { sale: 'PROMO', rtvNote: 'none' }),
  s(1, 'store-02', 9, 3, { carrier: 'PLAZA_4W', mismatch: true, recount: true }),
  // step 10: closed
  s(0, 'store-01', 10, 4, { carrier: 'PLAZA_4W' }),
  s(0, 'store-04', 10, 6, { carrier: 'CG_NETWORK', sale: 'PROMO' }),
  s(1, 'store-08', 10, 3),
  s(3, 'store-10', 10, 8, { sale: 'PROMO', mismatch: true, confirm: true }),
  s(0, 'store-07', 10, 1, { mismatch: true, confirm: true }),
  // cancelled
  s(0, 'store-03', 1, 6, { cancel: { by: 'BRAND', reason: 'สาขาแจ้งว่าสินค้าถูกนำกลับไปขายต่อ' } }),
  s(2, 'store-12', 3, 8, { cancel: { by: 'CS', reason: 'Brand แจ้งขอยกเลิก เพราะใบแจ้งข้อมูลไม่ถูกต้อง' } }),
];

// [prefix, base, step] -> prefix + (base + (index + 1) * step); unique per seeded RTV.
const DOC_FORMAT: Record<DocType, [string, number, number]> = {
  MIM: ['26', 100000, 137],
  RTV_NOTE: ['RN-', 200000, 53],
  SD10: ['RF26', 10000, 61],
  PICKUP_SLIP: ['PS-', 0, 1],
  CARRIER_REF: ['TH', 4500000000, 7717],
  TK: ['TK26', 10000, 71],
  MATDOC: ['525', 1000000, 7919],
  GEN104: ['104', 2000000, 613],
  PROMO_NO: ['PM26', 10000, 17],
  SALE_RETURN: ['SR26', 20000, 23],
  DELIVERY: ['80', 500000, 311],
  INVOICE_REF: ['IV26', 40000, 19],
  CN: ['CN26', 30000, 29],
};

function docNo(type: DocType, index: number): string {
  const [prefix, base, step] = DOC_FORMAT[type];
  return `${prefix}${base + (index + 1) * step}`;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Squeeze any instant into working hours (09:00–17:30 Bangkok); monotone, so event order is kept. */
function workHours(ms: number): number {
  const bkk = ms + BKK;
  const day = Math.floor(bkk / DAY) * DAY;
  const mapped = day + 9 * HOUR + ((bkk - day) / DAY) * 8.5 * HOUR;
  return Math.round((mapped - BKK) / 60000) * 60000;
}

const CHANNEL_OF = new Map<string, Channel>(STORES.map(st => [st.id, st.channel]));

function defaultCarrier(channel: Channel): Carrier {
  if (channel === 'CONSIGN') return 'CG_NETWORK';
  if (channel === 'LOCAL_MALL') return 'AGREED';
  return 'PLAZA_4W';
}

function simulate(spec: Spec, index: number, origin: number, seq: number, scale: number): { rtv: Rtv; span: number } {
  const rng = mulberry32(7001 + index * 101);
  const channel = CHANNEL_OF.get(spec.store) as Channel;
  const carrier = spec.carrier ?? defaultCarrier(channel);
  const rtvNote = spec.rtvNote ?? 'late';
  const mall = isMallGroup(channel);

  let raw = origin;
  const lead = () => { raw += (0.5 + rng() ** 2 * 3.5) * DAY * scale; };
  const ctx = (role: Role): Ctx => ({
    role,
    actor: role === 'BRAND' ? BRAND_ACTORS[spec.brand] : ACTORS[role],
    now: new Date(workHours(raw)).toISOString(),
  });
  const pickupDate = () => new Date(workHours(raw) + BKK + DAY).toISOString().slice(0, 10);

  const boxCount = spec.boxes ?? 1 + Math.floor(rng() * 3);
  const boxPcs = Array.from({ length: boxCount }, () => 6 + Math.floor(rng() * 35));
  const docs: DocRef[] = [];
  if (!mall) docs.push({ type: 'MIM', value: docNo('MIM', index) });
  if (spec.sd10) docs.push({ type: 'SD10', value: docNo('SD10', index) });
  if (mall && rtvNote === 'create') docs.push({ type: 'RTV_NOTE', value: docNo('RTV_NOTE', index) });

  let r = createRtv(
    { brandId: BRANDS[spec.brand].id, storeId: spec.store, channel, saleType: spec.sale ?? 'NORMAL', boxPcs, docs },
    seq, ctx('BRAND'),
  );

  const resolve = (force: boolean) => {
    if (r.step !== 9) return;
    if ((force || spec.confirm) && holds(r).includes('WAIT_BRAND_QTY')) {
      lead(); r = brandConfirmQty(r, ctx('BRAND'));
    }
    if ((force || spec.promoOk) && holds(r).includes('WAIT_PROMO')) {
      lead(); r = confirmPromo(r, ctx('BRAND'));
    }
    if ((force || rtvNote === 'late') && holds(r).includes('WAIT_RTV_NOTE')) {
      lead(); r = addDoc(r, { type: 'RTV_NOTE', value: docNo('RTV_NOTE', index) }, ctx('BRAND'));
    }
  };

  let failed = false;
  while (r.step < spec.upTo) {
    const def = nextStep(r);
    if (!def) break;
    lead();
    if (def.step === 10) { resolve(true); lead(); }
    const c = ctx(def.role);
    let payload: StepPayload;
    switch (def.step) {
      case 2:
        payload = {
          step: 2, carrier, pickupDate: pickupDate(),
          carrierRef: carrier === 'PARCEL' ? docNo('CARRIER_REF', index) : undefined,
        };
        break;
      case 5: case 6: case 8:
        payload = { step: def.step, boxes: spec.short?.at === def.step ? r.boxes.length - 1 : r.boxes.length };
        break;
      case 9: {
        const counts = r.boxes.map((b, k) => (spec.mismatch && k === 0
          ? Math.max(0, b.expectedPcs - (1 + Math.floor(rng() * 3))) : b.expectedPcs));
        payload = { step: 9, tk: docNo('TK', index), counts };
        break;
      }
      case 10: {
        const done = new Set(r.docs.map(d => d.type));
        const atCn: DocType[] = ['MATDOC', 'GEN104', 'PROMO_NO', 'SALE_RETURN', 'DELIVERY', 'INVOICE_REF', 'CN'];
        const out: Partial<Record<DocType, string>> = {};
        for (const t of atCn) if (!done.has(t)) out[t] = docNo(t, index);
        payload = { step: 10, docs: out };
        break;
      }
      default: payload = { step: def.step as 3 | 4 | 7 };
    }
    r = advance(r, payload, c);
    if (def.step === 6 && spec.short?.clear) {
      lead(); r = clearShortFlag(r, 'ตรวจสอบกับ SCDC แล้ว ได้รับกล่องที่ขาดครบ', ctx('CS'));
    }
    if (spec.failAt === r.step && !failed) {
      failed = true;
      lead();
      const pickupRole = stepsFor(r.channel, r.carrier).find(d => d.step === 4)!.role;
      r = failPickup(r, 'ผู้รับสินค้าที่สาขาไม่อยู่ ติดต่อไม่ได้', ctx(pickupRole));
    }
  }

  if (spec.cancel) {
    lead(); r = cancel(r, spec.cancel.reason, ctx(spec.cancel.by));
  } else if (r.step === 9) {
    resolve(false);
    if (spec.recount) { lead(); r = brandRequestRecount(r, ctx('BRAND')); }
  }
  return { rtv: r, span: raw - origin };
}

/** Deterministic for a given `now`; every RTV is produced by real machine transitions with back-dated timestamps. */
export function buildSeed(now: Date): Rtv[] {
  const plans = SPECS.map((spec, index) => {
    const base = simulate(spec, index, 0, 0, 1).span;
    const room = (MAX_AGE_DAYS - spec.wait) * DAY;
    const scale = base > room ? Math.max(0.3, room / base) : 1;
    const target = now.getTime() - spec.wait * DAY;
    let origin = target - simulate(spec, index, 0, 0, scale).span;
    for (;;) {
      const events = simulate(spec, index, origin, 0, scale).rtv.events;
      if (Date.parse(events[events.length - 1].at) <= target) break;
      origin -= HOUR;
    }
    return { spec, index, origin, scale, createdAt: workHours(origin) };
  });
  plans.sort((a, b) => a.createdAt - b.createdAt || a.index - b.index);
  return plans.map((p, rank) => simulate(p.spec, p.index, p.origin, FIRST_SEQ + rank, p.scale).rtv);
}
