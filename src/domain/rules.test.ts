import { describe, expect, test } from 'vitest';
import type { Carrier, Channel, SaleType } from './types';
import {
  allowedCarriers, cnType, holds, isClosed, nextStep, owner, requiredDocs, stepsFor, STEP_LABELS,
} from './rules';
import { rtv } from './testing';

test.each([
  ['SHOP', 'NORMAL', 'MIM_SHOP'], ['TEMP_SHOP', 'NORMAL', 'MIM_SHOP'],
  ['SHOP', 'PROMO', 'TEMP_SHOP'], ['TEMP_SHOP', 'PROMO', 'TEMP_SHOP'],
  ['CONSIGN', 'NORMAL', 'ETAX_CONSIGN'], ['LOCAL_MALL', 'NORMAL', 'ETAX_CONSIGN'],
  ['CONSIGN', 'PROMO', 'ETAX_CREDIT'], ['LOCAL_MALL', 'PROMO', 'ETAX_CREDIT'],
])('cnType(%s,%s) = %s', (c, s, cn) => expect(cnType(c as Channel, s as SaleType)).toBe(cn));

test('allowedCarriers per channel', () => {
  expect(allowedCarriers('CONSIGN')).toEqual(['CG_NETWORK']);
  expect(allowedCarriers('SHOP')).toEqual(['CG_NETWORK', 'PLAZA_4W', 'PARCEL']);
  expect(allowedCarriers('TEMP_SHOP')).toEqual(['CG_NETWORK', 'PLAZA_4W', 'PARCEL']);
  expect(allowedCarriers('LOCAL_MALL')).toEqual(['AGREED']);
});

const modes = (c: Channel, k: Carrier | null) => stepsFor(c, k).map(s => s.mode[0]).join('');
test('skips per channel and carrier', () => {
  expect(modes('CONSIGN', 'CG_NETWORK')).toBe('MASMMMMMMM');
  expect(modes('SHOP', 'CG_NETWORK')).toBe('MMMMMMMMMM');
  expect(modes('SHOP', 'PLAZA_4W')).toBe('MMMMMSSMMM');
  expect(modes('TEMP_SHOP', 'PARCEL')).toBe('MMSMMMMMMM');
  expect(modes('LOCAL_MALL', 'AGREED')).toBe('MMMMMSSMMM');
  expect(modes('SHOP', null)).toBe('MMMMMMMMMM');
});

test('stepsFor has 10 entries with default roles and labels', () => {
  const s = stepsFor('SHOP', 'CG_NETWORK');
  expect(s).toHaveLength(10);
  expect(s.map(x => x.role)).toEqual(
    ['BRAND', 'CS', 'CS', 'CARRIER', 'CARRIER', 'SCDC', 'SCDC', 'WH', 'WH', 'ADMIN_CN']);
  expect(s.map(x => x.label)).toEqual(Object.values(STEP_LABELS));
});

test('parcel pickup steps belong to CS', () => {
  const s = stepsFor('SHOP', 'PARCEL');
  expect([s[3].role, s[4].role]).toEqual(['CS', 'CS']);
});

test('nextStep jumps over skipped steps', () => {
  expect(nextStep(rtv({ channel: 'SHOP', carrier: 'PLAZA_4W', step: 5 }))!.step).toBe(8);
  expect(nextStep(rtv({ step: 10 }))).toBeNull();
  expect(nextStep(rtv({ step: 3, cancelled: { reason: 'x' } }))).toBeNull();
  expect(nextStep(rtv({ channel: 'CONSIGN', carrier: 'CG_NETWORK', step: 1 }))!.step).toBe(2);
});

test('holds and owner at step 9', () => {
  const r = rtv({ channel: 'CONSIGN', saleType: 'PROMO', carrier: 'CG_NETWORK', step: 9,
    boxes: [{ no: 'x-B01', expectedPcs: 10, countedPcs: 8 }] });
  expect(holds(r)).toEqual(['WAIT_BRAND_QTY', 'WAIT_RTV_NOTE', 'WAIT_PROMO']);
  expect(owner(r)).toBe('BRAND');
  expect(holds({ ...r, step: 8 })).toEqual([]);
});

describe('holds clear', () => {
  const base = rtv({ channel: 'LOCAL_MALL', saleType: 'PROMO', carrier: 'AGREED', step: 9,
    boxes: [{ no: 'x-B01', expectedPcs: 10, countedPcs: 8 }] });
  test('each one independently', () => {
    expect(holds({ ...base, qtyConfirmed: true })).toEqual(['WAIT_RTV_NOTE', 'WAIT_PROMO']);
    expect(holds({ ...base, docs: [{ type: 'RTV_NOTE', value: 'n' }] }))
      .toEqual(['WAIT_BRAND_QTY', 'WAIT_PROMO']);
    expect(holds({ ...base, promoConfirmed: true })).toEqual(['WAIT_BRAND_QTY', 'WAIT_RTV_NOTE']);
  });
  test('matching count, SHOP normal has no holds; owner is the next role', () => {
    const r = rtv({ carrier: 'CG_NETWORK', step: 9, boxes: [{ no: 'x-B01', expectedPcs: 10, countedPcs: 10 }] });
    expect(holds(r)).toEqual([]);
    expect(owner(r)).toBe('ADMIN_CN');
  });
});

test('owner and isClosed', () => {
  expect(owner(rtv({ step: 1 }))).toBe('CS');
  expect(owner(rtv({ step: 10 }))).toBeNull();
  expect(isClosed(rtv({ step: 10 }))).toBe(true);
  expect(isClosed(rtv({ step: 2, cancelled: { reason: 'x' } }))).toBe(true);
  expect(owner(rtv({ step: 2, cancelled: { reason: 'x' } }))).toBeNull();
  expect(isClosed(rtv({ step: 2 }))).toBe(false);
});

test('requiredDocs', () => {
  expect(requiredDocs('MIM_SHOP')).toEqual({ before: ['MIM', 'TK'], atCn: ['MATDOC'] });
  expect(requiredDocs('TEMP_SHOP')).toEqual({ before: ['MIM', 'TK'], atCn: ['GEN104', 'PROMO_NO', 'MATDOC', 'CN'] });
  expect(requiredDocs('ETAX_CONSIGN')).toEqual({ before: ['RTV_NOTE', 'TK'], atCn: ['SALE_RETURN', 'DELIVERY', 'CN'] });
  expect(requiredDocs('ETAX_CREDIT').atCn).toEqual(['INVOICE_REF', 'SALE_RETURN', 'DELIVERY', 'CN']);
});
