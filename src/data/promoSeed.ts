import { advance, type Ctx, type StepPayload } from '../domain/machine';
import { confirmVehicles, createPromo, forwardPromo, recordPickup, type PromoInput } from '../domain/promo';
import { nextStep } from '../domain/rules';
import type { PromoEvent, Role, Rtv, Step } from '../domain/types';
import { tr } from '../i18n';
import { ACTORS } from './masters';

const DAY = 24 * 3600 * 1000;
const seqOf = (id: string): number => Number(id.split('-').pop()) || 0;

/** A Bangkok wall-clock time `days` from `now` (10:00 by default), as ISO. */
function bkkAt(now: Date, days: number, hour = 10): string {
  const d = new Date(now.getTime() + days * DAY + 7 * 3600 * 1000);
  d.setUTCHours(hour, 0, 0, 0);
  return new Date(d.getTime() - 7 * 3600 * 1000).toISOString();
}

interface Plan {
  input: Omit<PromoInput, 'pickupAt'>;
  pickupIn: number;           // days from now
  createdIn: number;          // days from now (negative = past)
  upTo: 'REQUESTED' | 'FORWARDED' | 'CONFIRMED' | 'PICKED';
  vehicles?: { type: '4W' | '6W' | '10W'; plate: string; driver: string; phone: string }[];
  picked?: Record<string, [number, number]>;
  /** After the pickup: the step each brand's RTV has reached. */
  after?: Record<string, Step>;
}

const PLANS: Plan[] = [
  {
    // The e-mail "ยืนยันรถเก็บโปร แฟชั่นไอส์แลนด์": 21 pallets, two 6-wheel trucks.
    input: {
      get name() { return tr('Event CMG @ แฟชั่นไอส์แลนด์', 'Event CMG @ Fashion Island'); }, storeId: 'venue-01',
      contact: { get name() { return tr('คุณนก', 'Khun Nok'); }, phone: '081-000-1234' },
      lines: [
        { brandId: 'CW', boxes: 10, pallets: 1 }, { brandId: 'JH', boxes: 50, pallets: 2 },
        { brandId: 'KU', boxes: 15, pallets: 1 }, { brandId: 'WR', boxes: 95, pallets: 4 },
        { brandId: 'HU', boxes: 35, pallets: 2 }, { brandId: 'CJ', boxes: 70, pallets: 3 },
        { brandId: 'JU', boxes: 10, pallets: 1 }, { brandId: 'CM', boxes: 15, pallets: 1 },
        { brandId: 'HP', boxes: 80, pallets: 5 },
      ],
      extras: [{ get label() { return tr('ถุง', 'Bags'); }, pallets: 1 }],
      estimate: { type: '6W', count: 2 },
    },
    pickupIn: 2, createdIn: -3, upTo: 'CONFIRMED',
    vehicles: [
      { type: '6W', plate: '70-1234 กทม.', get driver() { return tr('คุณสมชาย', 'Khun Somchai'); }, phone: '089-000-1111' },
      { type: '6W', plate: '70-5678 กทม.', get driver() { return tr('คุณประสิทธิ์', 'Khun Prasit'); }, phone: '089-000-2222' },
    ],
  },
  {
    input: {
      get name() { return tr('Mid Month Sale @ เซ็นทรัลเวิลด์', 'Mid Month Sale @ Central World'); }, storeId: 'venue-02',
      contact: { get name() { return tr('คุณแพร', 'Khun Prae'); }, phone: '081-000-5678' },
      lines: [
        { brandId: 'LA', boxes: 20, pallets: 1 }, { brandId: 'GS', boxes: 30, pallets: 2 },
        { brandId: 'CR', boxes: 12, pallets: 1 }, { brandId: 'SK', boxes: 8, pallets: 1 },
      ],
      extras: [],
      estimate: { type: '6W', count: 1 },
    },
    pickupIn: -6, createdIn: -10, upTo: 'PICKED',
    vehicles: [{ type: '6W', plate: '71-2468 กทม.', get driver() { return tr('คุณวิชัย', 'Khun Wichai'); }, phone: '089-000-3333' }],
    picked: { LA: [22, 1], GS: [30, 2], CR: [10, 1], SK: [8, 1] },
    after: { LA: 9, GS: 8, CR: 9, SK: 7 },
  },
  {
    input: {
      get name() { return tr('Year End Sale @ เซ็นทรัล เวสต์เกต', 'Year End Sale @ Central WestGate'); }, storeId: 'venue-03',
      contact: { get name() { return tr('คุณต้น', 'Khun Ton'); }, phone: '081-000-9012' },
      lines: [{ brandId: 'E7', boxes: 25, pallets: 1 }, { brandId: 'TH', boxes: 40, pallets: 2 }],
      extras: [],
      estimate: { type: '4W', count: 1 },
    },
    pickupIn: 5, createdIn: -0.2, upTo: 'REQUESTED',
  },
];

const ctxAt = (role: Role, at: number): Ctx => ({ role, actor: ACTORS[role], now: new Date(at).toISOString() });

/** Walk an RTV forward with the normal machine until `target` (counts at step 9 are plausible piece numbers). */
function walk(r: Rtv, target: Step, from: number, index: number): Rtv {
  let t = from;
  while (r.step < target) {
    const def = nextStep(r);
    if (!def) break;
    t += 0.4 * DAY;
    let payload: StepPayload;
    if (def.step === 6 || def.step === 8) payload = { step: def.step, boxes: r.boxes.length };
    else if (def.step === 9) payload = { step: 9, tk: `TK26${String(7000 + index).padStart(6, '0')}`, counts: r.boxes.map((_, k) => 6 + ((k + index) % 5)) };
    else payload = { step: def.step as 7 };
    r = advance(r, payload, ctxAt(def.role, t));
  }
  return r;
}

/** Promotion pickups for the demo, built with the real promo transitions on top of the normal seed. */
export function buildPromoSeed(base: Rtv[], now: Date): { events: PromoEvent[]; rtvs: Rtv[] } {
  let rtvSeq = Math.max(0, ...base.map(r => seqOf(r.id))) + 1;
  const events: PromoEvent[] = [];
  const rtvs: Rtv[] = [];
  PLANS.forEach((plan, i) => {
    const t0 = now.getTime() + plan.createdIn * DAY;
    const pickupAt = bkkAt(now, plan.pickupIn);
    let res = createPromo({ ...plan.input, pickupAt }, i + 1, rtvSeq, ctxAt('PROMO', t0));
    rtvSeq += res.rtvs.length;
    if (plan.upTo !== 'REQUESTED') res = forwardPromo(res.event, res.rtvs, ctxAt('CS', t0 + 0.2 * DAY));
    if (plan.upTo === 'CONFIRMED' || plan.upTo === 'PICKED') {
      res = confirmVehicles(res.event, res.rtvs, plan.vehicles!, ctxAt('CARRIER', t0 + 0.8 * DAY));
    }
    if (plan.upTo === 'PICKED') {
      const at = Date.parse(pickupAt);
      const lines = Object.fromEntries(Object.entries(plan.picked!).map(([b, [boxes, pallets]]) => [b, { boxes, pallets }]));
      res = recordPickup(res.event, res.rtvs, { lines, extras: [] }, ctxAt('CARRIER', at));
      res = { ...res, rtvs: res.rtvs.map((r, k) => (r.cancelled ? r : walk(r, plan.after?.[r.brandId] ?? 5, at, k))) };
    }
    events.push(res.event);
    rtvs.push(...res.rtvs);
  });
  return { events, rtvs };
}
