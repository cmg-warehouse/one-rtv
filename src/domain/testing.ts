import { addDoc, advance, confirmPromo, setBoxMims } from './machine';
import type { Ctx, NewRtvInput, StepPayload } from './machine';
import { allowedCarriers, boxesMissingMim, cnType, holds, nextStep, requiredDocs } from './rules';
import type { DocType, Role, Rtv, Step } from './types';
import { tr } from '../i18n';

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

export const consignInput: NewRtvInput = {
  brandId: 'B1', storeId: 'S1', channel: 'CONSIGN', saleType: 'NORMAL',
  boxPcs: [8, 5], docs: [{ type: 'MIM', value: '26000200' }],
};

export const shopInput: NewRtvInput = {
  brandId: 'B1', storeId: 'S1', channel: 'SHOP', saleType: 'NORMAL',
  boxPcs: [10, 6], docs: [{ type: 'MIM', value: '26000100' }],
};

const ctxFor = (role: Role): Ctx => ({ role, actor: tr('ทดสอบ', 'Test'), now: '2026-11-12T03:00:00Z' });

/** Advance along the happy path until the RTV has completed `step`. */
export function toStep(start: Rtv, step: Step): Rtv {
  let r = start;
  while (r.step < step) {
    const def = nextStep(r);
    if (!def) break;
    const ctx = ctxFor(def.role);
    let payload: StepPayload;
    switch (def.step) {
      case 2: {
        const allowed = allowedCarriers(r.channel);
        const carrier = r.carrier ?? (allowed.includes('PLAZA_4W') ? 'PLAZA_4W' : allowed[0]);
        payload = { step: 2, carrier, pickupDate: '2026-11-13', carrierRef: carrier === 'PARCEL' ? 'KEX-TEST' : undefined };
        break;
      }
      case 5: case 6: case 8: payload = { step: def.step, boxes: r.boxes.length }; break;
      case 9: payload = { step: 9, tk: 'TK-TEST', counts: r.boxes.map(b => b.expectedPcs) }; break;
      case 10: {
        if (!r.docs.some(d => d.type === 'RTV_NOTE') && requiredDocs(cnType(r.channel, r.saleType)).before.includes('RTV_NOTE')) {
          r = addDoc(r, { type: 'RTV_NOTE', value: 'RN-TEST' }, ctxFor('BRAND'));
        }
        if (holds(r).includes('WAIT_MIM')) {
          r = setBoxMims(r, Object.fromEntries(boxesMissingMim(r).map(b => [b.no, 'MIM-TEST'])), ctxFor('BRAND'));
        }
        if (r.saleType === 'PROMO' && !r.promoConfirmed) r = confirmPromo(r, ctxFor('BRAND'));
        if (holds(r).length > 0) throw new Error('toStep: RTV is on hold');
        const docs: Partial<Record<DocType, string>> = {};
        for (const t of requiredDocs(cnType(r.channel, r.saleType)).atCn) docs[t] = `TEST-${t}`;
        payload = { step: 10, docs };
        break;
      }
      default: payload = { step: def.step as 3 | 4 | 7 };
    }
    r = advance(r, payload, ctx);
  }
  return r;
}
