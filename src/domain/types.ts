export type Role = 'BRAND' | 'CS' | 'CARRIER' | 'SCDC' | 'WH' | 'ADMIN_CN' | 'VIEWER';
export type Channel = 'CONSIGN' | 'SHOP' | 'TEMP_SHOP' | 'LOCAL_MALL';
export type SaleType = 'NORMAL' | 'PROMO';
export type Carrier = 'CG_NETWORK' | 'PLAZA_4W' | 'PARCEL' | 'AGREED';
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type CnType = 'MIM_SHOP' | 'TEMP_SHOP' | 'ETAX_CONSIGN' | 'ETAX_CREDIT';
export type DocType = 'MIM' | 'RTV_NOTE' | 'SD10' | 'PICKUP_SLIP' | 'CARRIER_REF' | 'TK'
  | 'MATDOC' | 'GEN104' | 'PROMO_NO' | 'SALE_RETURN' | 'DELIVERY' | 'INVOICE_REF' | 'CN';
export type Hold = 'WAIT_BRAND_QTY' | 'WAIT_RTV_NOTE' | 'WAIT_PROMO';
export type EventKind = 'STEP' | 'PICKUP_FAILED' | 'SHORT_BOX' | 'FLAG_CLEARED' | 'QTY_MISMATCH'
  | 'BRAND_CONFIRMED' | 'RECOUNT_REQUESTED' | 'DOC_ADDED' | 'PROMO_CONFIRMED' | 'CANCELLED';
export interface Box { no: string; expectedPcs: number; countedPcs?: number }
export interface DocRef { type: DocType; value: string }
export interface RtvEvent { at: string; role: Role; actor: string; kind: EventKind; step?: Step; auto?: boolean; note?: string }
export interface Rtv {
  id: string; brandId: string; storeId: string; channel: Channel; saleType: SaleType;
  carrier: Carrier | null; pickupDate?: string;
  boxes: Box[]; docs: DocRef[];
  step: Step;                 // last completed step
  shortBoxes: number;         // open "กล่องขาด" flag, 0 = none
  qtyConfirmed: boolean;      // Brand accepted the counted quantity
  promoConfirmed: boolean;
  cancelled?: { reason: string };
  createdAt: string; events: RtvEvent[];
}
