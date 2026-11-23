export type Role = 'BRAND' | 'PROMO' | 'CS' | 'CARRIER' | 'SCDC' | 'WH' | 'ADMIN_CN' | 'VIEWER';
export type Channel = 'CONSIGN' | 'SHOP' | 'TEMP_SHOP' | 'LOCAL_MALL';
export type SaleType = 'NORMAL' | 'PROMO';
export type Carrier = 'CG_NETWORK' | 'PLAZA_4W' | 'PARCEL' | 'AGREED';
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type CnType = 'MIM_SHOP' | 'TEMP_SHOP' | 'ETAX_CONSIGN' | 'ETAX_CREDIT';
export type DocType = 'MIM' | 'RTV_NOTE' | 'SD10' | 'PICKUP_SLIP' | 'CARRIER_REF' | 'TK'
  | 'MATDOC' | 'GEN104' | 'PROMO_NO' | 'SALE_RETURN' | 'DELIVERY' | 'INVOICE_REF' | 'CN';
export type Hold = 'WAIT_BRAND_QTY' | 'WAIT_RTV_NOTE' | 'WAIT_MIM' | 'WAIT_PROMO';
export type EventKind = 'STEP' | 'PICKUP_FAILED' | 'SHORT_BOX' | 'FLAG_CLEARED' | 'QTY_MISMATCH'
  | 'BRAND_CONFIRMED' | 'RECOUNT_REQUESTED' | 'DOC_ADDED' | 'PROMO_CONFIRMED' | 'CANCELLED';
/** `mim`: each box normally carries its own MIM (Shop / Temp shop). */
export interface Box { no: string; expectedPcs: number; countedPcs?: number; mim?: string }
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
  /** Part of a promotion pickup (งานเก็บโปร). */
  promoId?: string;
  /** Destination fixed by the brand's fulfilment: SCDC first, or straight to CMG-CDS. Unset: decided by the carrier. */
  hub?: Hub;
}

export type Hub = 'SCDC' | 'CMG';
export type TruckType = '4W' | '6W' | '10W';
export type PromoStatus = 'REQUESTED' | 'FORWARDED' | 'CONFIRMED' | 'PICKED';
/** One brand at the event: what the coordinator announced, and what the driver actually collected. */
export interface PromoLine { brandId: string; boxes: number; pallets: number; hub: Hub; rtvId: string; pickedBoxes?: number; pickedPallets?: number }
/** Goods with no brand of their own (shopping bags, fixtures): carried, but no RTV. */
export interface PromoExtra { label: string; pallets: number; pickedPallets?: number }
export interface Vehicle { type: TruckType; plate: string; driver: string; phone: string }
export interface PromoLog { at: string; role: Role; actor: string; text: string }
/** งานเก็บโปร: one pickup at an event venue for many brands, replacing the coordinator's e-mail thread. */
export interface PromoEvent {
  id: string; name: string; storeId: string; pickupAt: string;
  contact: { name: string; phone: string };
  lines: PromoLine[]; extras: PromoExtra[];
  estimate: { type: TruckType; count: number };
  vehicles: Vehicle[];
  status: PromoStatus; createdAt: string; log: PromoLog[];
}
