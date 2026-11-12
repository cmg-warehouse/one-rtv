import { describe, expect, test } from 'vitest';
import {
  FlowError, addDoc, advance, brandConfirmQty, brandRequestRecount, cancel, clearShortFlag,
  confirmPromo, createRtv, failPickup, rtvId,
} from './machine';
import type { Ctx } from './machine';
import { consignInput, toStep } from './testing';
import type { Role } from './types';

const at = '2026-11-12T03:00:00Z';
const as = (role: Role): Ctx => ({ role, actor: 'ทดสอบ', now: at });
const shop = () => createRtv({ brandId: 'B1', storeId: 'S1', channel: 'SHOP', saleType: 'NORMAL',
  boxPcs: [10, 12], docs: [{ type: 'MIM', value: '26000123' }] }, 42, as('BRAND'));

test('id and box numbers', () => {
  const r = shop();
  expect(r.id).toBe('RTV-CMG-2611-00042');
  expect(r.boxes.map(b => b.no)).toEqual(['RTV-CMG-2611-00042-B01', 'RTV-CMG-2611-00042-B02']);
  expect(r.step).toBe(1);
});
test('id uses Bangkok month', () => {
  expect(rtvId(7, '2026-11-30T18:00:00Z')).toBe('RTV-CMG-2612-00007');
});
test('only Brand creates', () => {
  expect(() => createRtv({ brandId: 'B1', storeId: 'S1', channel: 'SHOP', saleType: 'NORMAL',
    boxPcs: [1], docs: [] }, 1, as('CS'))).toThrow(FlowError);
});
test('consign is routed automatically', () => {
  const r = createRtv({ ...consignInput }, 1, as('BRAND'));
  expect([r.step, r.carrier]).toEqual([2, 'CG_NETWORK']);
  expect(r.events.at(-1)).toMatchObject({ step: 2, auto: true, note: 'อัตโนมัติ: เข้ารอบรถ CG Network' });
});
test('happy path shop via 4W Plaza closes at step 10', () => {
  let r = shop();
  r = advance(r, { step: 2, carrier: 'PLAZA_4W', pickupDate: '2026-11-13' }, as('CS'));
  r = advance(r, { step: 3 }, as('CS'));
  expect(r.docs).toContainEqual({ type: 'PICKUP_SLIP', value: 'PS-CMG-2611-00042' });
  r = advance(r, { step: 4 }, as('CARRIER'));
  r = advance(r, { step: 5, boxes: 2 }, as('CARRIER'));
  r = advance(r, { step: 8, boxes: 2 }, as('WH'));
  r = advance(r, { step: 9, tk: 'TK0001', counts: [10, 12] }, as('WH'));
  r = advance(r, { step: 10, docs: { MATDOC: '5250000001' } }, as('ADMIN_CN'));
  expect(r.step).toBe(10);
  expect(r.events.filter(e => e.kind === 'STEP')).toHaveLength(8);
});
test('consign happy path via CG Network with SCDC steps', () => {
  const r = toStep(createRtv({ ...consignInput }, 3, as('BRAND')), 10);
  expect(r.step).toBe(10);
  expect(r.events.filter(e => e.kind === 'STEP').map(e => e.step)).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 10]);
});
test('wrong role or wrong step is refused', () => {
  expect(() => advance(shop(), { step: 2, carrier: 'PLAZA_4W', pickupDate: '2026-11-13' }, as('WH')))
    .toThrow('ขั้นนี้ไม่ใช่หน้าที่ของบทบาทนี้');
  expect(() => advance(shop(), { step: 4 }, as('CARRIER'))).toThrow(FlowError);
});
test('carrier must be allowed for the channel', () => {
  expect(() => advance(shop(), { step: 2, carrier: 'AGREED', pickupDate: '2026-11-13' }, as('CS'))).toThrow(FlowError);
});
test.each([0, -1, 3, 1.5, NaN])('box count %s is refused', n => {
  const r = toStep(shop(), 4);
  expect(() => advance(r, { step: 5, boxes: n }, as('CARRIER'))).toThrow('จำนวนกล่อง');
});
test('short box flags but does not stop', () => {
  const r = advance(toStep(shop(), 5), { step: 8, boxes: 1 }, as('WH'));
  expect([r.step, r.shortBoxes]).toEqual([8, 1]);
  expect(r.events.some(e => e.kind === 'SHORT_BOX')).toBe(true);
  expect(clearShortFlag(r, 'พบกล่องที่สาขา', as('CS')).shortBoxes).toBe(0);
  expect(() => clearShortFlag(r, 'x', as('WH'))).toThrow(FlowError);
});
test('count validation at step 9', () => {
  const r = toStep(shop(), 8);
  const wh = as('WH');
  expect(() => advance(r, { step: 9, tk: '', counts: [10, 12] }, wh)).toThrow(FlowError);
  expect(() => advance(r, { step: 9, tk: 'T', counts: [10] }, wh)).toThrow(FlowError);
  expect(() => advance(r, { step: 9, tk: 'T', counts: [10, -1] }, wh)).toThrow(FlowError);
  expect(() => advance(r, { step: 9, tk: 'T', counts: [10, 1.5] }, wh)).toThrow(FlowError);
});
test('piece mismatch blocks CN until Brand confirms', () => {
  let r = advance(toStep(shop(), 8), { step: 9, tk: 'TK1', counts: [10, 9] }, as('WH'));
  expect(r.events.some(e => e.kind === 'QTY_MISMATCH')).toBe(true);
  expect(() => advance(r, { step: 10, docs: { MATDOC: '525' } }, as('ADMIN_CN'))).toThrow(FlowError);
  r = brandConfirmQty(r, as('BRAND'));
  expect(advance(r, { step: 10, docs: { MATDOC: '525' } }, as('ADMIN_CN')).step).toBe(10);
});
test('recount sends it back to the warehouse', () => {
  const r = brandRequestRecount(advance(toStep(shop(), 8), { step: 9, tk: 'TK1', counts: [10, 9] }, as('WH')), as('BRAND'));
  expect(r.step).toBe(8);
  expect(r.boxes.every(b => b.countedPcs === undefined)).toBe(true);
  const again = advance(r, { step: 9, tk: 'TK2', counts: [10, 12] }, as('WH'));
  expect(again.docs.filter(d => d.type === 'TK')).toEqual([{ type: 'TK', value: 'TK2' }]);
});
test('brand actions only at step 9 and only by Brand', () => {
  expect(() => brandConfirmQty(shop(), as('BRAND'))).toThrow(FlowError);
  expect(() => brandConfirmQty(toStep(shop(), 9), as('CS'))).toThrow(FlowError);
});
test('consign waits for RTV Note (ห้าง) and promo needs confirmation', () => {
  let r = toStep(createRtv({ ...consignInput, saleType: 'PROMO' }, 1, as('BRAND')), 9);
  expect(() => advance(r, { step: 10, docs: {} }, as('ADMIN_CN'))).toThrow(FlowError);
  r = addDoc(r, { type: 'RTV_NOTE', value: 'RN1' }, as('BRAND'));
  expect(() => advance(r, { step: 10, docs: { INVOICE_REF: 'I', SALE_RETURN: 'S', DELIVERY: 'D', CN: 'C' } }, as('ADMIN_CN'))).toThrow(FlowError);
  r = confirmPromo(r, as('BRAND'));
  expect(advance(r, { step: 10, docs: { INVOICE_REF: 'I', SALE_RETURN: 'S', DELIVERY: 'D', CN: 'C' } }, as('ADMIN_CN')).step).toBe(10);
});
test('missing CN documents are refused', () =>
  expect(() => advance(toStep(shop(), 9), { step: 10, docs: {} }, as('ADMIN_CN'))).toThrow(FlowError));
test('addDoc replaces, refuses empty and non-Brand types', () => {
  const r = addDoc(shop(), { type: 'MIM', value: '999' }, as('BRAND'));
  expect(r.docs.filter(d => d.type === 'MIM')).toEqual([{ type: 'MIM', value: '999' }]);
  expect(() => addDoc(shop(), { type: 'MIM', value: ' ' }, as('BRAND'))).toThrow(FlowError);
  expect(() => addDoc(shop(), { type: 'TK', value: 'x' }, as('BRAND'))).toThrow(FlowError);
  expect(() => addDoc(shop(), { type: 'MIM', value: '1' }, as('CS'))).toThrow(FlowError);
});
test('failed pickup returns to CS and keeps the slip', () => {
  const r = failPickup(toStep(shop(), 4), 'ร้านปิด', as('CARRIER'));
  expect(r.step).toBe(1);
  expect(r.events.at(-1)).toMatchObject({ kind: 'PICKUP_FAILED', note: 'ร้านปิด' });
  expect(r.docs.filter(d => d.type === 'PICKUP_SLIP')).toHaveLength(1);
  const again = advance(advance(r, { step: 2, carrier: 'PLAZA_4W', pickupDate: '2026-11-14' }, as('CS')), { step: 3 }, as('CS'));
  expect(again.docs.filter(d => d.type === 'PICKUP_SLIP')).toHaveLength(1);
});
test('failed pickup needs a reason, the right role and an early step', () => {
  expect(() => failPickup(toStep(shop(), 4), ' ', as('CARRIER'))).toThrow('เหตุผล');
  expect(() => failPickup(toStep(shop(), 4), 'x', as('CS'))).toThrow(FlowError);
  expect(() => failPickup(toStep(shop(), 5), 'x', as('CARRIER'))).toThrow(FlowError);
});
test('failed pickup on consign keeps the step', () => {
  const r = failPickup(createRtv({ ...consignInput }, 1, as('BRAND')), 'ร้านปิด', as('CARRIER'));
  expect(r.step).toBe(2);
});
test('parcel needs a tracking number and CS records the pickup', () => {
  expect(() => advance(shop(), { step: 2, carrier: 'PARCEL', pickupDate: '2026-11-13' }, as('CS'))).toThrow('เลขพัสดุ');
  let r = advance(shop(), { step: 2, carrier: 'PARCEL', pickupDate: '2026-11-13', carrierRef: 'KEX123' }, as('CS'));
  expect(r.docs).toContainEqual({ type: 'CARRIER_REF', value: 'KEX123' });
  r = advance(r, { step: 4 }, as('CS'));
  expect(r.step).toBe(4);
  expect(failPickup(r, 'ผู้รับไม่อยู่', as('CS')).step).toBe(1);
});
test('cancel only before pickup', () => {
  expect(cancel(shop(), 'เปิดซ้ำ', as('BRAND')).cancelled).toEqual({ reason: 'เปิดซ้ำ' });
  expect(() => cancel(toStep(shop(), 5), 'x', as('CS'))).toThrow(FlowError);
  expect(() => cancel(shop(), '', as('BRAND'))).toThrow('เหตุผล');
  expect(() => cancel(shop(), 'x', as('WH'))).toThrow(FlowError);
});
test('cancelled and closed RTVs accept no transitions', () => {
  const c = cancel(shop(), 'เปิดซ้ำ', as('BRAND'));
  expect(() => advance(c, { step: 2, carrier: 'PLAZA_4W', pickupDate: '2026-11-13' }, as('CS'))).toThrow(FlowError);
  expect(() => addDoc(c, { type: 'MIM', value: '1' }, as('BRAND'))).toThrow(FlowError);
  const done = toStep(shop(), 10);
  expect(() => addDoc(done, { type: 'MIM', value: '1' }, as('BRAND'))).toThrow(FlowError);
  expect(() => cancel(done, 'x', as('BRAND'))).toThrow(FlowError);
});
describe('purity', () => {
  test('transitions do not mutate their input', () => {
    const r = shop(); const snapshot = structuredClone(r);
    advance(r, { step: 2, carrier: 'PLAZA_4W', pickupDate: '2026-11-13' }, as('CS'));
    cancel(r, 'x', as('BRAND'));
    addDoc(r, { type: 'SD10', value: '1' }, as('BRAND'));
    expect(r).toEqual(snapshot);
  });
});
