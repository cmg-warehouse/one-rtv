import { describe, expect, test } from 'vitest';
import type { Carrier, Channel, SaleType } from './types';
import {
  allowedCarriers, canAct, canSeeCnForm, cnType, holds, isClosed, matchesIdentity, nextStep, owner, requiredDocs, stepsFor,
  STEP_LABELS, HOLD_LABELS, type Identity,
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
    const r = rtv({ carrier: 'CG_NETWORK', step: 9, docs: [{ type: 'MIM', value: '26000111' }],
      boxes: [{ no: 'x-B01', expectedPcs: 10, countedPcs: 10 }] });
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

describe('identity scoping', () => {
  const me: Identity = { brandId: 'brand-1', carrier: 'PLAZA_4W' };
  const onHold = rtv({ channel: 'CONSIGN', carrier: 'CG_NETWORK', step: 9,
    boxes: [{ no: 'x-B01', expectedPcs: 10, countedPcs: 10 }] });   // waits for the mall note: owner BRAND

  test('Brand acts only on its own brand', () => {
    expect(owner(onHold)).toBe('BRAND');
    expect(canAct(onHold, 'BRAND', me)).toBe(true);
    expect(canAct({ ...onHold, brandId: 'brand-2' }, 'BRAND', me)).toBe(false);
  });
  test('carrier acts only on its own carrier company', () => {
    const job = rtv({ channel: 'SHOP', carrier: 'PLAZA_4W', step: 3 });
    expect(owner(job)).toBe('CARRIER');
    expect(canAct(job, 'CARRIER', me)).toBe(true);
    expect(canAct({ ...job, carrier: 'CG_NETWORK' }, 'CARRIER', me)).toBe(false);
    expect(canAct({ ...job, carrier: 'AGREED' }, 'CARRIER', { ...me, carrier: 'AGREED' })).toBe(true);
  });
  test('other roles need only the role match', () => {
    const r = rtv({ step: 1 });
    expect(canAct(r, 'CS', me)).toBe(true);
    expect(canAct(r, 'WH', me)).toBe(false);
    expect(matchesIdentity(r, 'CS', { brandId: 'zzz', carrier: 'AGREED' })).toBe(true);
  });
  test('Admin CN sees the CN form at step 9 during holds, but does not own the RTV', () => {
    expect(canSeeCnForm(onHold, 'ADMIN_CN')).toBe(true);
    expect(canAct(onHold, 'ADMIN_CN', me)).toBe(false);
    expect(canSeeCnForm(onHold, 'BRAND')).toBe(false);
    expect(canSeeCnForm({ ...onHold, step: 8 }, 'ADMIN_CN')).toBe(false);
    expect(canSeeCnForm({ ...onHold, docs: [{ type: 'RTV_NOTE', value: 'n' }] }, 'ADMIN_CN')).toBe(false);
  });
});

describe('WAIT_MIM', () => {
  const counted = [{ no: 'x-B01', expectedPcs: 10, countedPcs: 10 }];
  const shopNoMim = rtv({ channel: 'SHOP', carrier: 'CG_NETWORK', step: 9, boxes: counted });

  test('a Shop / Temp shop order at step 9 without MIM waits for it, owned by Brand', () => {
    expect(holds(shopNoMim)).toEqual(['WAIT_MIM']);
    expect(owner(shopNoMim)).toBe('BRAND');
    expect(holds({ ...shopNoMim, channel: 'TEMP_SHOP', saleType: 'PROMO' })).toEqual(['WAIT_MIM', 'WAIT_PROMO']);
    expect(holds({ ...shopNoMim, docs: [{ type: 'MIM', value: '26000111' }] })).toEqual([]);
  });
  test('not before step 9, and never for the mall group (their CN needs RTV Note, not MIM)', () => {
    expect(holds({ ...shopNoMim, step: 8 })).toEqual([]);
    expect(holds({ ...shopNoMim, channel: 'CONSIGN' })).toEqual(['WAIT_RTV_NOTE']);
  });
  test('hold order is qty, note, MIM, promo', () => {
    const r = rtv({ channel: 'SHOP', saleType: 'PROMO', carrier: 'CG_NETWORK', step: 9,
      boxes: [{ no: 'x-B01', expectedPcs: 10, countedPcs: 8 }] });
    expect(holds(r)).toEqual(['WAIT_BRAND_QTY', 'WAIT_MIM', 'WAIT_PROMO']);
    expect(HOLD_LABELS.WAIT_MIM).toBe('รอเลข MIM');
  });
});
