import type { Rtv } from './types';

export function rtv(overrides: Partial<Rtv> = {}): Rtv {
  return {
    id: 'RTV-TEST-001',
    brandId: 'brand-1',
    storeId: 'store-1',
    channel: 'SHOP',
    saleType: 'NORMAL',
    carrier: null,
    boxes: [{ no: 'x-B01', expectedPcs: 10 }],
    docs: [],
    step: 1,
    shortBoxes: 0,
    qtyConfirmed: false,
    promoConfirmed: false,
    createdAt: '2026-11-12T03:00:00.000Z',
    events: [],
    ...overrides,
  };
}
