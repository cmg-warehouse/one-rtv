import { bi } from '../i18n';
import type { Box, Carrier, Channel, CnType, DocType, Hold, Hub, Role, Rtv, SaleType, Step } from './types';

export type StepMode = 'MANUAL' | 'AUTO' | 'SKIPPED';
export interface StepDef { step: Step; label: string; role: Role; mode: StepMode }

export const STEP_LABELS: Record<Step, string> = bi<Step>({
  1: ['เปิดคำสั่งแล้ว', 'Order opened'],
  2: ['CS รับเรื่อง / จัดขนส่งแล้ว', 'CS accepted / carrier assigned'],
  3: ['ออกใบแจ้งเก็บแล้ว', 'Pickup slip issued'],
  4: ['ขนส่งรับงานแล้ว', 'Carrier accepted job'],
  5: ['เก็บสินค้าแล้ว', 'Goods collected'],
  6: ['SCDC รับเข้าแล้ว', 'Received at SCDC'],
  7: ['SCDC ส่งต่อ CMG แล้ว', 'SCDC forwarded to CMG'],
  8: ['CMG รับสินค้าแล้ว', 'Received at CMG'],
  9: ['ตรวจนับเสร็จ', 'Count completed'],
  10: ['ออก CN แล้ว (ปิดงาน)', 'CN issued (closed)'],
});

export const STEPS: Step[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const HOLDS: Hold[] = ['WAIT_BRAND_QTY', 'WAIT_RTV_NOTE', 'WAIT_MIM', 'WAIT_PROMO'];

/** RTV-level documents a Brand may add by hand. MIM is per box (see setBoxMims), not one number for the RTV. */
export const BRAND_DOC_TYPES: DocType[] = ['SD10', 'RTV_NOTE'];

/** Boxes still without their own MIM number. */
export function boxesMissingMim(rtv: Rtv): Box[] {
  return rtv.boxes.filter(b => !(b.mim ?? '').trim());
}

/** Is this document held? MIM counts only when every box has its MIM. */
export function hasDoc(rtv: Rtv, type: DocType): boolean {
  if (type === 'MIM') return rtv.boxes.length > 0 && boxesMissingMim(rtv).length === 0;
  return rtv.docs.some(d => d.type === type);
}

/** Consign and Local mall orders go through the mall's own RTV Note (ห้าง). */
export function isMallGroup(channel: Channel): boolean {
  return channel === 'CONSIGN' || channel === 'LOCAL_MALL';
}

export const CHANNEL_LABELS: Record<Channel, string> = {
  CONSIGN: 'Consign',
  SHOP: 'Shop',
  TEMP_SHOP: 'Temp shop',
  LOCAL_MALL: 'Local mall',
};

export const CARRIER_LABELS: Record<Carrier, string> = bi<Carrier>({
  CG_NETWORK: ['GIC (CG Network)', 'GIC (CG Network)'],
  PLAZA_4W: ['งานสาย (Route) – 4W Plaza', 'Route – 4W Plaza'],
  PARCEL: ['Parcel (ขนส่งนอก)', 'Parcel (outside courier)'],
  AGREED: ['งานจองรถ (เก็บตรง)', 'Booked truck (direct pickup)'],
});

export const CN_LABELS: Record<CnType, string> = {
  MIM_SHOP: 'MIM Shop',
  TEMP_SHOP: 'Temp Shop',
  ETAX_CONSIGN: 'E-tax Consign',
  ETAX_CREDIT: 'E-tax Credit',
};

export const HOLD_LABELS: Record<Hold, string> = bi<Hold>({
  WAIT_BRAND_QTY: ['รอ Brand ยืนยันยอด', 'Waiting for Brand to confirm qty'],
  WAIT_RTV_NOTE: ['รอ RTV Note', 'Waiting for RTV Note'],
  WAIT_MIM: ['รอเลข MIM', 'Waiting for MIM no.'],
  WAIT_PROMO: ['รอยืนยัน Promotion', 'Waiting for Promotion confirmation'],
});

export const DOC_LABELS: Record<DocType, string> = bi<DocType>({
  MIM: ['MIM', 'MIM'],
  RTV_NOTE: ['RTV Note (ห้าง)', 'RTV Note (mall)'],
  SD10: ['SD10 / RTV Form', 'SD10 / RTV Form'],
  PICKUP_SLIP: ['ใบแจ้งเก็บ', 'Pickup slip'],
  CARRIER_REF: ['เลขพัสดุ / Slip ขนส่ง', 'Tracking no. / carrier slip'],
  TK: ['TK', 'TK'],
  MATDOC: ['Matdoc', 'Matdoc'],
  GEN104: ['เลข 104', 'No. 104'],
  PROMO_NO: ['เลข Promotion', 'Promotion no.'],
  SALE_RETURN: ['Sale Return', 'Sale Return'],
  DELIVERY: ['Delivery', 'Delivery'],
  INVOICE_REF: ['Invoice อ้างอิง', 'Reference invoice'],
  CN: ['CN', 'CN'],
});

export function cnType(channel: Channel, saleType: SaleType): CnType {
  if (isMallGroup(channel)) {
    return saleType === 'PROMO' ? 'ETAX_CREDIT' : 'ETAX_CONSIGN';
  }
  return saleType === 'PROMO' ? 'TEMP_SHOP' : 'MIM_SHOP';
}

export function allowedCarriers(channel: Channel): Carrier[] {
  switch (channel) {
    case 'CONSIGN': return ['CG_NETWORK'];
    case 'LOCAL_MALL': return ['AGREED'];
    default: return ['CG_NETWORK', 'PLAZA_4W', 'PARCEL'];
  }
}

const BASE_ROLES: Record<Step, Role> = {
  1: 'BRAND', 2: 'CS', 3: 'CS', 4: 'CARRIER', 5: 'CARRIER',
  6: 'SCDC', 7: 'SCDC', 8: 'WH', 9: 'WH', 10: 'ADMIN_CN',
};


/** `hub` (promotion pickups): the brand's fulfilment decides whether the goods go through SCDC. */
export function stepsFor(channel: Channel, carrier: Carrier | null, hub?: Hub): StepDef[] {
  return STEPS.map((step): StepDef => {
    let role = BASE_ROLES[step];
    let mode: StepMode = 'MANUAL';
    if (channel === 'CONSIGN') {
      if (step === 2) mode = 'AUTO';
      if (step === 3) mode = 'SKIPPED';
    }
    if (carrier === 'PARCEL') {
      if (step === 3) mode = 'SKIPPED';
      if (step === 4 || step === 5) role = 'CS';
    }
    if ((carrier === 'PLAZA_4W' || carrier === 'AGREED') && (step === 6 || step === 7)) {
      mode = 'SKIPPED';
    }
    if (hub && (step === 6 || step === 7)) mode = hub === 'SCDC' ? 'MANUAL' : 'SKIPPED';
    return { step, label: STEP_LABELS[step], role, mode };
  });
}

export function stepsOf(rtv: Rtv): StepDef[] {
  return stepsFor(rtv.channel, rtv.carrier, rtv.hub);
}

export function isClosed(rtv: Rtv): boolean {
  return rtv.step === 10 || !!rtv.cancelled;
}

/** An order can be cancelled until the carrier has collected the goods. */
export function canCancel(rtv: Rtv): boolean {
  return !isClosed(rtv) && rtv.step < 5;
}

export function nextStep(rtv: Rtv): StepDef | null {
  if (isClosed(rtv)) return null;
  return stepsOf(rtv).find(s => s.step > rtv.step && s.mode !== 'SKIPPED') ?? null;
}

export function holds(rtv: Rtv): Hold[] {
  if (rtv.step !== 9) return [];
  const out: Hold[] = [];
  if (!rtv.qtyConfirmed && rtv.boxes.some(b => b.countedPcs !== b.expectedPcs)) out.push('WAIT_BRAND_QTY');
  if (isMallGroup(rtv.channel)
    && !rtv.docs.some(d => d.type === 'RTV_NOTE')) out.push('WAIT_RTV_NOTE');
  if (requiredDocs(cnType(rtv.channel, rtv.saleType)).before.includes('MIM') && !hasDoc(rtv, 'MIM')) out.push('WAIT_MIM');
  if (rtv.saleType === 'PROMO' && !rtv.promoConfirmed) out.push('WAIT_PROMO');
  return out;
}

export function owner(rtv: Rtv): Role | null {
  if (isClosed(rtv)) return null;
  if (holds(rtv).length > 0) return 'BRAND';
  return nextStep(rtv)?.role ?? null;
}

export function requiredDocs(cn: CnType): { before: DocType[]; atCn: DocType[] } {
  switch (cn) {
    case 'MIM_SHOP': return { before: ['MIM', 'TK'], atCn: ['MATDOC'] };
    case 'TEMP_SHOP': return { before: ['MIM', 'TK'], atCn: ['GEN104', 'PROMO_NO', 'MATDOC', 'CN'] };
    case 'ETAX_CONSIGN': return { before: ['RTV_NOTE', 'TK'], atCn: ['SALE_RETURN', 'DELIVERY', 'CN'] };
    case 'ETAX_CREDIT':
      return { before: ['RTV_NOTE', 'TK'], atCn: ['INVOICE_REF', 'SALE_RETURN', 'DELIVERY', 'CN'] };
  }
}

/** Who the demo user is acting as: the Brand's own id and the carrier company (UI-only scoping). */
export interface Identity { brandId: string; carrier: Carrier }

/** Does the RTV belong to this role's identity? Brand sees only its own, a carrier only its own jobs. */
export function matchesIdentity(rtv: Rtv, role: Role, identity: Identity): boolean {
  if (role === 'BRAND') return rtv.brandId === identity.brandId;
  if (role === 'CARRIER') return rtv.carrier === identity.carrier;
  if (role === 'PROMO') return !!rtv.promoId;
  return true;
}

/** The role must act on this RTV now, and the identity matches (own brand / own carrier). */
export function canAct(rtv: Rtv, role: Role, identity: Identity): boolean {
  return owner(rtv) === role && matchesIdentity(rtv, role, identity);
}

/** Admin CN also sees the (disabled) CN form at step 9 while Brand holds are open. */
export function canSeeCnForm(rtv: Rtv, role: Role): boolean {
  return role === 'ADMIN_CN' && !isClosed(rtv) && rtv.step === 9 && holds(rtv).length > 0;
}
