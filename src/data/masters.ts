import type { Channel, Role } from '../domain/types';

export interface Brand { id: string; name: string }
export interface Store { id: string; name: string; channel: Channel; province: string }

export const BRANDS: Brand[] = [
  { id: 'brand-a', name: 'แบรนด์ตัวอย่าง A' },
  { id: 'brand-b', name: 'แบรนด์ตัวอย่าง B' },
  { id: 'brand-c', name: 'แบรนด์ตัวอย่าง C' },
  { id: 'brand-d', name: 'แบรนด์ตัวอย่าง D' },
  { id: 'brand-e', name: 'แบรนด์ตัวอย่าง E' },
  { id: 'brand-f', name: 'แบรนด์ตัวอย่าง F' },
];

export const STORES: Store[] = [
  { id: 'store-01', name: 'สาขาตัวอย่าง ลาดพร้าว (Shop)', channel: 'SHOP', province: 'กรุงเทพฯ' },
  { id: 'store-02', name: 'สาขาตัวอย่าง อ่อนนุช (Shop)', channel: 'SHOP', province: 'กรุงเทพฯ' },
  { id: 'store-03', name: 'สาขาตัวอย่าง เชียงใหม่ (Shop)', channel: 'SHOP', province: 'เชียงใหม่' },
  { id: 'store-04', name: 'สาขาตัวอย่าง รังสิต (Temp shop)', channel: 'TEMP_SHOP', province: 'ปทุมธานี' },
  { id: 'store-05', name: 'สาขาตัวอย่าง บางนา (Temp shop)', channel: 'TEMP_SHOP', province: 'กรุงเทพฯ' },
  { id: 'store-06', name: 'สาขาตัวอย่าง ขอนแก่น (Temp shop)', channel: 'TEMP_SHOP', province: 'ขอนแก่น' },
  { id: 'store-07', name: 'สาขาตัวอย่าง พระราม 9 (Consign)', channel: 'CONSIGN', province: 'กรุงเทพฯ' },
  { id: 'store-08', name: 'สาขาตัวอย่าง ภูเก็ต (Consign)', channel: 'CONSIGN', province: 'ภูเก็ต' },
  { id: 'store-09', name: 'สาขาตัวอย่าง นครราชสีมา (Consign)', channel: 'CONSIGN', province: 'นครราชสีมา' },
  { id: 'store-10', name: 'ห้างท้องถิ่นตัวอย่าง สุราษฎร์ธานี', channel: 'LOCAL_MALL', province: 'สุราษฎร์ธานี' },
  { id: 'store-11', name: 'ห้างท้องถิ่นตัวอย่าง อุดรธานี', channel: 'LOCAL_MALL', province: 'อุดรธานี' },
  { id: 'store-12', name: 'ห้างท้องถิ่นตัวอย่าง หาดใหญ่', channel: 'LOCAL_MALL', province: 'สงขลา' },
];

export const ACTORS: Record<Role, string> = {
  BRAND: 'คุณเอ (ฝ่ายขาย แบรนด์ A)',
  CS: 'คุณบี (CS คลัง)',
  CARRIER: 'คุณซี (เจ้าหน้าที่ขนส่ง)',
  SCDC: 'คุณดี (SCDC)',
  WH: 'คุณอี (คลัง CMG)',
  ADMIN_CN: 'คุณเอฟ (Admin CN)',
  VIEWER: 'คุณจี (ผู้ดูภาพรวม)',
};

/** Sales contact of each brand, aligned with BRANDS (index 0 equals ACTORS.BRAND). */
export const BRAND_ACTORS: string[] = [
  ACTORS.BRAND,
  'คุณเอช (ฝ่ายขาย แบรนด์ B)',
  'คุณไอ (ฝ่ายขาย แบรนด์ C)',
  'คุณเจ (ฝ่ายขาย แบรนด์ D)',
  'คุณเค (ฝ่ายขาย แบรนด์ E)',
  'คุณแอล (ฝ่ายขาย แบรนด์ F)',
];

export const DEMO_BRAND_ID = BRANDS[0].id;
