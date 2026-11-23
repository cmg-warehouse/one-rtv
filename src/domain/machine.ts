import {
  allowedCarriers, BRAND_DOC_TYPES, canCancel, cnType, DOC_LABELS, hasDoc, holds, HOLD_LABELS, isClosed, nextStep, requiredDocs, stepsOf,
} from './rules';
import type { Box, Carrier, Channel, DocRef, DocType, EventKind, Role, Rtv, RtvEvent, SaleType } from './types';
import { tr } from '../i18n';

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
  /** MIM per box, aligned with boxPcs; blank = not known yet. */
  boxMims?: string[];
}
export type StepPayload =
  | { step: 2; carrier: Carrier; pickupDate: string; carrierRef?: string }
  | { step: 3 } | { step: 4 } | { step: 7 }
  | { step: 5 | 6 | 8; boxes: number }
  | { step: 9; tk: string; counts: number[] }
  | { step: 10; docs: Partial<Record<DocType, string>> };

const wrongRole = () => tr('ขั้นนี้ไม่ใช่หน้าที่ของบทบาทนี้', 'Not your step');

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
  if (rtv.cancelled) throw new FlowError(tr('รายการนี้ถูกยกเลิกแล้ว', 'This return order has been cancelled'));
  if (isClosed(rtv)) throw new FlowError(tr('รายการนี้ปิดงานแล้ว', 'This return order is already closed'));
}

function requireRole(ctx: Ctx, ...roles: Role[]): void {
  if (!roles.includes(ctx.role)) throw new FlowError(wrongRole());
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
  if (!input.brandId || !input.storeId) throw new FlowError(tr('กรุณาเลือก Brand และสาขา', 'Please select a Brand and a store'));
  if (input.boxPcs.length < 1 || input.boxPcs.some(n => !Number.isInteger(n) || n < 1)) {
    throw new FlowError(tr('จำนวนกล่องและจำนวนชิ้นต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ขึ้นไป', 'Boxes and pieces must be whole numbers, 1 or more'));
  }
  const id = rtvId(seq, ctx.now);
  // An RTV-level MIM (older input shape) fills every box that has none of its own.
  const sharedMim = input.docs.find(d => d.type === 'MIM')?.value.trim() || undefined;
  const boxes: Box[] = input.boxPcs.map((pcs, i) => {
    const mim = (input.boxMims?.[i] ?? '').trim() || sharedMim;
    return { no: `${id}-B${String(i + 1).padStart(2, '0')}`, expectedPcs: pcs, ...(mim ? { mim } : {}) };
  });
  const base: Rtv = {
    id, brandId: input.brandId, storeId: input.storeId, channel: input.channel, saleType: input.saleType,
    carrier: null, boxes, docs: input.docs.filter(d => d.type !== 'MIM').map(d => ({ ...d })),
    step: 1, shortBoxes: 0, qtyConfirmed: false, promoConfirmed: false,
    createdAt: ctx.now, events: [ev(ctx, 'STEP', { step: 1 })],
  };
  if (input.channel === 'CONSIGN') {
    return next(base, { carrier: 'CG_NETWORK', step: 2 }, [
      { at: ctx.now, role: 'CS', actor: tr('ระบบ', 'System'), kind: 'STEP', step: 2, auto: true, note: tr('อัตโนมัติ: เข้ารอบรถ CG Network', 'Automatic: joined the CG Network truck round') },
    ]);
  }
  return base;
}

function checkBoxes(rtv: Rtv, boxes: number): void {
  if (!Number.isInteger(boxes) || boxes < 1 || boxes > rtv.boxes.length) {
    throw new FlowError(tr(`จำนวนกล่องต้องเป็นเลขจำนวนเต็มตั้งแต่ 1 ถึง ${rtv.boxes.length}`, `Boxes must be a whole number from 1 to ${rtv.boxes.length}`));
  }
}

export function advance(rtv: Rtv, payload: StepPayload, ctx: Ctx): Rtv {
  requireOpen(rtv);
  const def = nextStep(rtv);
  if (!def || def.step !== payload.step || def.role !== ctx.role) throw new FlowError(wrongRole());

  const events: RtvEvent[] = [ev(ctx, 'STEP', { step: def.step })];
  const patch: Partial<Rtv> = { step: def.step };

  switch (payload.step) {
    case 2: {
      if (!payload.carrier) throw new FlowError(tr('กรุณาเลือกขนส่ง', 'Please select a carrier'));
      if (!allowedCarriers(rtv.channel).includes(payload.carrier)) {
        throw new FlowError(tr('ขนส่งนี้ใช้ไม่ได้กับช่องทางนี้', 'This carrier cannot be used for this channel'));
      }
      const pickupDate = requireText(payload.pickupDate, tr('กรุณาระบุวันที่เข้ารับ', 'Please enter the pickup date'));
      let docs = rtv.docs.filter(d => d.type !== 'CARRIER_REF');
      if (payload.carrier === 'PARCEL') {
        const ref = requireText(payload.carrierRef, tr('กรุณากรอกเลขพัสดุ', 'Please enter the tracking number'));
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
        events.push(ev(ctx, 'SHORT_BOX', { step: def.step, note: tr(`ได้รับ ${payload.boxes} จาก ${rtv.boxes.length} กล่อง`, `Received ${payload.boxes} of ${rtv.boxes.length} boxes`) }));
      }
      break;
    case 9: {
      const tk = requireText(payload.tk, tr('กรุณากรอกเลข TK', 'Please enter the TK number'));
      if (payload.counts.length !== rtv.boxes.length
        || payload.counts.some(n => !Number.isInteger(n) || n < 0)) {
        throw new FlowError(tr('จำนวนชิ้นที่นับต้องครบทุกกล่อง และเป็นเลขจำนวนเต็มตั้งแต่ 0 ขึ้นไป', 'Counted pieces are required for every box, as whole numbers from 0'));
      }
      patch.boxes = rtv.boxes.map((b, i) => ({ ...b, countedPcs: payload.counts[i] }));
      patch.docs = withDoc(rtv.docs, { type: 'TK', value: tk });
      if (payload.counts.some((n, i) => n !== rtv.boxes[i].expectedPcs)) {
        events.push(ev(ctx, 'QTY_MISMATCH', { step: 9, note: tr('จำนวนชิ้นที่นับไม่ตรงกับที่แจ้ง', 'Counted pieces do not match the declared quantity') }));
      }
      break;
    }
    case 10: {
      const open = holds(rtv);
      if (open.length > 0) throw new FlowError(tr(`ยังออก CN ไม่ได้: ${open.map(h => HOLD_LABELS[h]).join(', ')}`, `Cannot issue CN yet: ${open.map(h => HOLD_LABELS[h]).join(', ')}`));
      const req = requiredDocs(cnType(rtv.channel, rtv.saleType));
      const missingBefore = req.before.filter(t => !hasDoc(rtv, t));
      if (missingBefore.length > 0) {
        throw new FlowError(tr(`เอกสารยังไม่ครบ: ${missingBefore.map(t => DOC_LABELS[t]).join(', ')}`, `Documents incomplete: ${missingBefore.map(t => DOC_LABELS[t]).join(', ')}`));
      }
      const missingAtCn = req.atCn.filter(t => !(payload.docs[t] ?? '').trim());
      if (missingAtCn.length > 0) {
        throw new FlowError(tr(`กรุณากรอกเอกสาร: ${missingAtCn.map(t => DOC_LABELS[t]).join(', ')}`, `Please enter the documents: ${missingAtCn.map(t => DOC_LABELS[t]).join(', ')}`));
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
  const pickupRole = stepsOf(rtv).find(s => s.step === 4)?.role;
  if (ctx.role !== pickupRole || ![2, 3, 4].includes(rtv.step)) throw new FlowError(wrongRole());
  const note = requireText(reason, tr('กรุณาระบุเหตุผล', 'Please enter a reason'));
  const patch: Partial<Rtv> = rtv.channel === 'CONSIGN' ? {} : { step: 1 };
  return next(rtv, patch, [ev(ctx, 'PICKUP_FAILED', { step: rtv.step, note })]);
}

export function clearShortFlag(rtv: Rtv, note: string, ctx: Ctx): Rtv {
  requireOpen(rtv);
  requireRole(ctx, 'CS');
  if (rtv.shortBoxes === 0) throw new FlowError(tr('ไม่มีกล่องขาดที่ต้องปิด', 'No short boxes to close'));
  const text = requireText(note, tr('กรุณากรอกหมายเหตุ', 'Please enter a note'));
  return next(rtv, { shortBoxes: 0 }, [ev(ctx, 'FLAG_CLEARED', { note: text })]);
}

function requireStep9Brand(rtv: Rtv, ctx: Ctx): void {
  requireOpen(rtv);
  requireRole(ctx, 'BRAND');
  if (rtv.step !== 9) throw new FlowError(wrongRole());
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
  if (!BRAND_DOC_TYPES.includes(doc.type)) throw new FlowError(wrongRole());
  const value = requireText(doc.value, tr('กรุณากรอกเลขเอกสาร', 'Please enter the document number'));
  return next(rtv, { docs: withDoc(rtv.docs, { type: doc.type, value }) },
    [ev(ctx, 'DOC_ADDED', { note: `${DOC_LABELS[doc.type]}: ${value}` })]);
}

/** Brand fills in MIM numbers box by box (keys are box numbers). */
export function setBoxMims(rtv: Rtv, mims: Record<string, string>, ctx: Ctx): Rtv {
  requireOpen(rtv);
  requireRole(ctx, 'BRAND');
  const entries = Object.entries(mims).map(([no, v]) => [no, (v ?? '').trim()] as const).filter(([, v]) => v);
  if (entries.length === 0) throw new FlowError(tr('กรุณากรอกเลข MIM อย่างน้อย 1 กล่อง', 'Please enter a MIM number for at least 1 box'));
  const unknown = entries.find(([no]) => !rtv.boxes.some(b => b.no === no));
  if (unknown) throw new FlowError(tr(`ไม่พบกล่อง ${unknown[0]} ในรายการนี้`, `Box ${unknown[0]} not found in this return order`));
  const byNo = new Map(entries);
  const boxes = rtv.boxes.map(b => (byNo.has(b.no) ? { ...b, mim: byNo.get(b.no) } : { ...b }));
  const note = entries.map(([no, v]) => `${no.slice(-3)}: ${v}`).join(', ');
  return next(rtv, { boxes }, [ev(ctx, 'DOC_ADDED', { note: `MIM ${note}` })]);
}

export function cancel(rtv: Rtv, reason: string, ctx: Ctx): Rtv {
  requireOpen(rtv);
  requireRole(ctx, 'BRAND', 'CS');
  if (!canCancel(rtv)) throw new FlowError(tr('ยกเลิกไม่ได้ เพราะขนส่งเก็บสินค้าแล้ว', 'Cannot cancel: the carrier has already collected the goods'));
  const note = requireText(reason, tr('กรุณาระบุเหตุผล', 'Please enter a reason'));
  return next(rtv, { cancelled: { reason: note } }, [ev(ctx, 'CANCELLED', { note })]);
}
