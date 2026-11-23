import { expect, test } from 'vitest';
import { advance, type Ctx } from './machine';
import { confirmVehicles, createPromo, forwardPromo, promoId, recordPickup, suggestTrucks, type PromoInput } from './promo';
import { holds, nextStep, stepsOf } from './rules';
import type { Role } from './types';

const ctx = (role: Role): Ctx => ({ role, actor: role, now: '2026-11-12T03:00:00.000Z' });

const input: PromoInput = {
  name: 'Event CMG @ แฟชั่นไอส์แลนด์', storeId: 'venue-01', pickupAt: '2026-11-15T03:00:00.000Z',
  contact: { name: 'คุณนก', phone: '081-000-1234' },
  lines: [{ brandId: 'SK', boxes: 10, pallets: 1 }, { brandId: 'WR', boxes: 95, pallets: 4 }],
  extras: [{ label: 'ถุง', pallets: 1 }],
  estimate: { type: '6W', count: 1 },
};

const confirmed = () => {
  const made = createPromo(input, 1, 200, ctx('PROMO'));
  const fwd = forwardPromo(made.event, made.rtvs, ctx('CS'));
  return confirmVehicles(fwd.event, fwd.rtvs, [{ type: '6W', plate: '70-1234', driver: 'สมชาย', phone: '089' }], ctx('CARRIER'));
};

test('the coordinator opens one pickup and every brand gets its own promotion RTV, routed by its fulfilment', () => {
  const { event, rtvs } = createPromo(input, 1, 200, ctx('PROMO'));
  expect(event.id).toBe('PRO-2611-0001');
  expect(promoId(12, '2026-11-12T03:00:00.000Z')).toBe('PRO-2611-0012');
  expect(rtvs.map(r => r.id)).toEqual(['RTV-CMG-2611-00200', 'RTV-CMG-2611-00201']);
  expect(event.lines.map(l => l.rtvId)).toEqual(rtvs.map(r => r.id));
  for (const r of rtvs) {
    expect(r).toMatchObject({ saleType: 'PROMO', channel: 'TEMP_SHOP', step: 1, promoId: event.id, docs: [] });
  }
  expect(rtvs[1].boxes).toHaveLength(95);
  // Default by fulfilment: Skechers (Ex-D&L) through SCDC, Wrangler straight to CMG.
  expect(rtvs.map(r => r.hub)).toEqual(['SCDC', 'CMG']);
  // The coordinator can override the default per brand.
  const moved = createPromo({ ...input, lines: [{ ...input.lines[0], hub: 'CMG' }, { ...input.lines[1], hub: 'SCDC' }] }, 1, 200, ctx('PROMO'));
  expect(moved.rtvs.map(r => r.hub)).toEqual(['CMG', 'SCDC']);
  expect(moved.event.lines.map(l => l.hub)).toEqual(['CMG', 'SCDC']);
  expect(event.status).toBe('REQUESTED');
});

test('only the coordinator opens a pickup, and the brand list is checked', () => {
  expect(() => createPromo(input, 1, 200, ctx('BRAND'))).toThrow('ไม่ใช่หน้าที่');
  expect(() => createPromo({ ...input, lines: [] }, 1, 200, ctx('PROMO'))).toThrow('อย่างน้อย 1 แบรนด์');
  expect(() => createPromo({ ...input, lines: [input.lines[0], input.lines[0]] }, 1, 200, ctx('PROMO'))).toThrow('ซ้ำ');
  expect(() => createPromo({ ...input, contact: { name: '', phone: '' } }, 1, 200, ctx('PROMO'))).toThrow('ผู้ประสานงาน');
});

test('CS forwards to a booked truck with one slip for the event; the carrier confirms plates', () => {
  const made = createPromo(input, 1, 200, ctx('PROMO'));
  expect(() => confirmVehicles(made.event, made.rtvs, [], ctx('CARRIER'))).toThrow('สถานะ');
  const fwd = forwardPromo(made.event, made.rtvs, ctx('CS'));
  expect(fwd.event.status).toBe('FORWARDED');
  for (const r of fwd.rtvs) {
    expect(r).toMatchObject({ step: 3, carrier: 'AGREED', pickupDate: input.pickupAt });
    expect(r.docs).toContainEqual({ type: 'PICKUP_SLIP', value: 'PS-PRO-2611-0001' });
  }
  expect(() => confirmVehicles(fwd.event, fwd.rtvs, [{ type: '6W', plate: '', driver: 'x', phone: '' }], ctx('CARRIER'))).toThrow('ทะเบียน');
  const ok = confirmed();
  expect(ok.event.status).toBe('CONFIRMED');
  expect(ok.event.vehicles[0].plate).toBe('70-1234');
  expect(ok.rtvs.every(r => r.step === 4)).toBe(true);
  // Plates can still be changed before the pickup; the RTVs stay at step 4.
  const again = confirmVehicles(ok.event, ok.rtvs, [{ type: '10W', plate: '80-9', driver: 'ก', phone: '' }], ctx('CARRIER'));
  expect(again.event.vehicles).toHaveLength(1);
  expect(again.rtvs.every(r => r.step === 4)).toBe(true);
});

test('the driver records what was really collected: more, fewer, or nothing', () => {
  const ok = confirmed();
  const three = { ...input, lines: [...input.lines, { brandId: 'HP', boxes: 5, pallets: 1 }] };
  const made = createPromo(three, 1, 200, ctx('PROMO'));
  const fwd = forwardPromo(made.event, made.rtvs, ctx('CS'));
  const conf = confirmVehicles(fwd.event, fwd.rtvs, ok.event.vehicles, ctx('CARRIER'));
  const res = recordPickup(conf.event, conf.rtvs, {
    lines: { SK: { boxes: 12, pallets: 1 }, WR: { boxes: 90, pallets: 4 }, HP: { boxes: 0, pallets: 0 } },
    extras: [1],
  }, ctx('CARRIER'));
  expect(res.event.status).toBe('PICKED');
  const [cw, wr, hp] = res.rtvs;
  expect(cw.step).toBe(5);
  expect(cw.boxes).toHaveLength(12);
  expect(cw.events.at(-1)?.note).toContain('เกิน 2');
  expect(wr.boxes).toHaveLength(90);
  expect(wr.events.at(-1)?.note).toContain('ขาด 5');
  expect(hp.cancelled?.reason).toContain('ไม่มีสินค้า');
  // After the pickup each RTV follows its own route.
  expect(nextStep(cw)?.step).toBe(6);
  expect(nextStep(wr)?.step).toBe(8);
  expect(stepsOf(wr).find(s => s.step === 6)?.mode).toBe('SKIPPED');
});

test('a promotion RTV has no declared piece counts, so Brand confirms what the warehouse counted', () => {
  const ok = confirmed();
  const res = recordPickup(ok.event, ok.rtvs, {
    lines: { SK: { boxes: 1, pallets: 1 }, WR: { boxes: 1, pallets: 1 } }, extras: [1],
  }, ctx('CARRIER'));
  let r = res.rtvs[1];
  r = advance(r, { step: 8, boxes: 1 }, ctx('WH'));
  r = advance(r, { step: 9, tk: 'TK1', counts: [7] }, ctx('WH'));
  expect(holds(r)).toEqual(expect.arrayContaining(['WAIT_BRAND_QTY', 'WAIT_MIM', 'WAIT_PROMO']));
});

test('truck suggestion from pallets', () => {
  expect(suggestTrucks(3)).toEqual({ type: '4W', count: 1 });
  expect(suggestTrucks(21)).toEqual({ type: '6W', count: 2 });
});
