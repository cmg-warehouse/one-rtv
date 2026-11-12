import type { Carrier, Channel, CnType, DocType, Hold, Role, Rtv, SaleType, Step } from './types';

export type StepMode = 'MANUAL' | 'AUTO' | 'SKIPPED';
export interface StepDef { step: Step; label: string; role: Role; mode: StepMode }

export const STEP_LABELS: Record<Step, string> = {
  1: 'เปิดคำสั่งแล้ว',
  2: 'CS รับเรื่อง / จัดขนส่งแล้ว',
  3: 'ออกใบแจ้งเก็บแล้ว',
  4: 'ขนส่งรับงานแล้ว',
  5: 'เก็บสินค้าแล้ว',
  6: 'SCDC รับเข้าแล้ว',
  7: 'SCDC ส่งต่อ CMG แล้ว',
  8: 'CMG รับสินค้าแล้ว',
  9: 'ตรวจนับเสร็จ',
  10: 'ออก CN แล้ว (ปิดงาน)',
};

export const STEPS: Step[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const HOLDS: Hold[] = ['WAIT_BRAND_QTY', 'WAIT_RTV_NOTE', 'WAIT_PROMO'];

/** Documents a Brand may add by hand. */
export const BRAND_DOC_TYPES: DocType[] = ['MIM', 'SD10', 'RTV_NOTE'];

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

export const CARRIER_LABELS: Record<Carrier, string> = {
  CG_NETWORK: 'CG Network',
  PLAZA_4W: '4W Plaza',
  PARCEL: 'Parcel',
  AGREED: 'ขนส่งตามตกลง',
};

export const CN_LABELS: Record<CnType, string> = {
  MIM_SHOP: 'MIM Shop',
  TEMP_SHOP: 'Temp Shop',
  ETAX_CONSIGN: 'E-tax Consign',
  ETAX_CREDIT: 'E-tax Credit',
};

export const HOLD_LABELS: Record<Hold, string> = {
  WAIT_BRAND_QTY: 'รอ Brand ยืนยันยอด',
  WAIT_RTV_NOTE: 'รอ RTV Note',
  WAIT_PROMO: 'รอยืนยัน Promotion',
};

export const DOC_LABELS: Record<DocType, string> = {
  MIM: 'MIM',
  RTV_NOTE: 'RTV Note (ห้าง)',
  SD10: 'SD10 / RTV Form',
  PICKUP_SLIP: 'ใบแจ้งเก็บ',
  CARRIER_REF: 'เลขพัสดุ / Slip ขนส่ง',
  TK: 'TK',
  MATDOC: 'Matdoc',
  GEN104: 'เลข 104',
  PROMO_NO: 'เลข Promotion',
  SALE_RETURN: 'Sale Return',
  DELIVERY: 'Delivery',
  INVOICE_REF: 'Invoice อ้างอิง',
  CN: 'CN',
};

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


export function stepsFor(channel: Channel, carrier: Carrier | null): StepDef[] {
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
    return { step, label: STEP_LABELS[step], role, mode };
  });
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
  return stepsFor(rtv.channel, rtv.carrier).find(s => s.step > rtv.step && s.mode !== 'SKIPPED') ?? null;
}

export function holds(rtv: Rtv): Hold[] {
  if (rtv.step !== 9) return [];
  const out: Hold[] = [];
  if (!rtv.qtyConfirmed && rtv.boxes.some(b => b.countedPcs !== b.expectedPcs)) out.push('WAIT_BRAND_QTY');
  if (isMallGroup(rtv.channel)
    && !rtv.docs.some(d => d.type === 'RTV_NOTE')) out.push('WAIT_RTV_NOTE');
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
