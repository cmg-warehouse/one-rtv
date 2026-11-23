import { bi, tr } from '../i18n';
import type { Channel, Hub, Role } from '../domain/types';
import { MASTER_BRANDS } from './brandMaster';

/** `id` is the CMG brand code ("Brand In Article"). */
export interface Brand { id: string; name: string; group: string }
/** `venue`: an event venue for promotion pickups (งานเก็บโปร), not a store a Brand opens a normal RTV from. */
export interface Store { id: string; readonly name: string; channel: Channel; readonly province: string; venue?: boolean }

/** Brands the seed data uses, by index (index 0 is the brand the demo user works for). */
const SEED_BRAND_CODES = ['LA', 'CR', 'CE', 'CS', 'GS', 'DY'];

const toBrand = (b: (typeof MASTER_BRANDS)[number]): Brand => ({ id: b.code, name: b.name, group: b.group });

/** All active CMG brands from the Poolfleet brand master; the six seed brands come first (seed.ts indexes them). */
export const BRANDS: Brand[] = [
  ...SEED_BRAND_CODES.map(code => toBrand(MASTER_BRANDS.find(b => b.code === code)!)),
  ...MASTER_BRANDS.filter(b => !SEED_BRAND_CODES.includes(b.code)).map(toBrand),
];

/** Brand groups (CMG Group) in master order, for grouped pickers. */
export const BRAND_GROUPS: string[] = [...new Set(MASTER_BRANDS.map(b => b.group))];

export const STORES: Store[] = [
  { id: 'store-01', get name() { return tr('สาขาตัวอย่าง ลาดพร้าว (Shop)', 'Sample store Lat Phrao (Shop)'); }, channel: 'SHOP', get province() { return tr('กรุงเทพฯ', 'Bangkok'); } },
  { id: 'store-02', get name() { return tr('สาขาตัวอย่าง อ่อนนุช (Shop)', 'Sample store On Nut (Shop)'); }, channel: 'SHOP', get province() { return tr('กรุงเทพฯ', 'Bangkok'); } },
  { id: 'store-03', get name() { return tr('สาขาตัวอย่าง เชียงใหม่ (Shop)', 'Sample store Chiang Mai (Shop)'); }, channel: 'SHOP', get province() { return tr('เชียงใหม่', 'Chiang Mai'); } },
  { id: 'store-04', get name() { return tr('สาขาตัวอย่าง รังสิต (Temp shop)', 'Sample store Rangsit (Temp shop)'); }, channel: 'TEMP_SHOP', get province() { return tr('ปทุมธานี', 'Pathum Thani'); } },
  { id: 'store-05', get name() { return tr('สาขาตัวอย่าง บางนา (Temp shop)', 'Sample store Bang Na (Temp shop)'); }, channel: 'TEMP_SHOP', get province() { return tr('กรุงเทพฯ', 'Bangkok'); } },
  { id: 'store-06', get name() { return tr('สาขาตัวอย่าง ขอนแก่น (Temp shop)', 'Sample store Khon Kaen (Temp shop)'); }, channel: 'TEMP_SHOP', get province() { return tr('ขอนแก่น', 'Khon Kaen'); } },
  { id: 'store-07', get name() { return tr('สาขาตัวอย่าง พระราม 9 (Consign)', 'Sample store Rama 9 (Consign)'); }, channel: 'CONSIGN', get province() { return tr('กรุงเทพฯ', 'Bangkok'); } },
  { id: 'store-08', get name() { return tr('สาขาตัวอย่าง ภูเก็ต (Consign)', 'Sample store Phuket (Consign)'); }, channel: 'CONSIGN', get province() { return tr('ภูเก็ต', 'Phuket'); } },
  { id: 'store-09', get name() { return tr('สาขาตัวอย่าง นครราชสีมา (Consign)', 'Sample store Nakhon Ratchasima (Consign)'); }, channel: 'CONSIGN', get province() { return tr('นครราชสีมา', 'Nakhon Ratchasima'); } },
  { id: 'store-10', get name() { return tr('ห้างท้องถิ่นตัวอย่าง สุราษฎร์ธานี', 'Sample local mall Surat Thani'); }, channel: 'LOCAL_MALL', get province() { return tr('สุราษฎร์ธานี', 'Surat Thani'); } },
  { id: 'store-11', get name() { return tr('ห้างท้องถิ่นตัวอย่าง อุดรธานี', 'Sample local mall Udon Thani'); }, channel: 'LOCAL_MALL', get province() { return tr('อุดรธานี', 'Udon Thani'); } },
  { id: 'store-12', get name() { return tr('ห้างท้องถิ่นตัวอย่าง หาดใหญ่', 'Sample local mall Hat Yai'); }, channel: 'LOCAL_MALL', get province() { return tr('สงขลา', 'Songkhla'); } },
  { id: 'venue-01', get name() { return tr('แฟชั่นไอส์แลนด์ (ลานจัดงาน)', 'Fashion Island (event venue)'); }, channel: 'TEMP_SHOP', get province() { return tr('กรุงเทพฯ', 'Bangkok'); }, venue: true },
  { id: 'venue-02', get name() { return tr('เซ็นทรัลเวิลด์ (ลานจัดงาน)', 'Central World (event venue)'); }, channel: 'TEMP_SHOP', get province() { return tr('กรุงเทพฯ', 'Bangkok'); }, venue: true },
  { id: 'venue-03', get name() { return tr('เซ็นทรัล เวสต์เกต (ลานจัดงาน)', 'Central Westgate (event venue)'); }, channel: 'TEMP_SHOP', get province() { return tr('นนทบุรี', 'Nonthaburi'); }, venue: true },
  { id: 'venue-04', get name() { return tr('เมกาบางนา (ลานจัดงาน)', 'Mega Bangna (event venue)'); }, channel: 'TEMP_SHOP', get province() { return tr('สมุทรปราการ', 'Samut Prakan'); }, venue: true },
];

export const VENUES: Store[] = STORES.filter(s => s.venue);

/**
 * Brands SCDC fulfils (Ex-D&L and Fitflop): their promotion returns go to SCDC คลองส่งน้ำ by default; the rest go to
 * CMG กม.20. Only a default — the coordinator can change it per pickup. FA is not in the Poolfleet brand master yet.
 */
export const SCDC_FULFILLED: string[] = ['FF', 'HD', 'CS', 'SK', 'FA'];

/** Default destination of a brand's promotion returns. */
export function hubOf(brandId: string): Hub {
  return SCDC_FULFILLED.includes(brandId) ? 'SCDC' : 'CMG';
}

export const ACTORS: Record<Role, string> = bi({
  BRAND: ['คุณเอ (ฝ่ายขาย Lacoste)', 'Khun A (Lacoste sales)'],
  PROMO: ['คุณโอ (ผู้ประสานงานโปร CMG)', 'Khun O (CMG promo coordinator)'],
  CS: ['คุณบี (CS คลัง)', 'Khun B (Warehouse CS)'],
  CARRIER: ['คุณซี (เจ้าหน้าที่ขนส่ง)', 'Khun C (Carrier staff)'],
  SCDC: ['คุณดี (SCDC)', 'Khun D (SCDC)'],
  WH: ['คุณอี (คลัง CMG)', 'Khun E (CMG warehouse)'],
  ADMIN_CN: ['คุณเอฟ (Admin CN)', 'Khun F (Admin CN)'],
  VIEWER: ['คุณจี (ผู้ดูภาพรวม)', 'Khun G (Viewer)'],
});

/** Sales contact of each brand, aligned with BRANDS (index 0 equals ACTORS.BRAND). */
export const BRAND_ACTORS: string[] = Object.defineProperties([] as string[], {
  0: { enumerable: true, get: () => ACTORS.BRAND },
  1: { enumerable: true, get: () => tr('คุณเอช (ฝ่ายขาย Clarins)', 'Khun H (Clarins sales)') },
  2: { enumerable: true, get: () => tr('คุณไอ (ฝ่ายขาย Casio Watch)', 'Khun I (Casio Watch sales)') },
  3: { enumerable: true, get: () => tr('คุณเจ (ฝ่ายขาย Crocs)', 'Khun J (Crocs sales)') },
  4: { enumerable: true, get: () => tr('คุณเค (ฝ่ายขาย Guess)', 'Khun K (Guess sales)') },
  5: { enumerable: true, get: () => tr('คุณแอล (ฝ่ายขาย Dyson)', 'Khun L (Dyson sales)') },
});

export const DEMO_BRAND_ID = BRANDS[0].id;
