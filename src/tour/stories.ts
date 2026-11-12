import { act, type Action } from '../api';
import { DEMO_BRAND_ID } from '../data/masters';
import type { NewRtvInput } from '../domain/machine';
import type { DocType, Role } from '../domain/types';

export interface TourStep {
  role: Role;
  title: string;
  narration: string;
  route: (rtvId: string) => string;
  run: (rtvId: string, ctx: { role: Role; actor: string }) => Promise<void>;
}

export interface Story {
  id: 'shop' | 'consign' | 'temp-promo' | 'failed-pickup';
  title: string;
  summary: string;
  create: NewRtvInput;
  steps: TourStep[];
}

const DAY = 86_400_000;
const BKK = 7 * 3_600_000;
const pickupIn = (days: number) => new Date(Date.now() + BKK + days * DAY).toISOString().slice(0, 10);

type Payload = Extract<Action, { type: 'advance' }>['payload'];
const adv = (payload: Payload): Action => ({ type: 'advance', payload });

/** One tour step: every step runs one API action as the role it names and shows the RTV detail page. */
const step = (role: Role, title: string, narration: string, action: Action): TourStep => ({
  role, title, narration,
  route: (rtvId) => `/rtv/${rtvId}`,
  run: async (rtvId, ctx) => { await act(rtvId, action, ctx); },
});

const assign4w = (days: number) => step('CS', 'CS จัดขนส่ง 4W Plaza',
  'CS เลือกขนส่ง 4W Plaza และวันนัดเก็บ ระบบบันทึกลงเลข One RTV เดียวกัน ไม่ต้องเปิดเลขใหม่',
  adv({ step: 2, carrier: 'PLAZA_4W', pickupDate: pickupIn(days) }));

const slip = (title: string, narration: string) => step('CS', title, narration, adv({ step: 3 }));

const accept = (role: 'CARRIER' | 'CS' = 'CARRIER') => step(role,
  role === 'CARRIER' ? 'ขนส่งรับงาน' : 'CS บันทึกว่าขนส่งรับงาน',
  role === 'CARRIER'
    ? 'เจ้าหน้าที่ขนส่งเปิดงานบนมือถือและกด “รับงาน” สถานะของเลข RTV นี้เปลี่ยนเป็นขนส่งรับงานแล้ว'
    : 'พัสดุไม่ผ่านแอปขนส่ง CS จึงบันทึกแทนว่าขนส่งรับงานแล้ว สถานะของเลข RTV นี้ขยับตามทันที',
  adv({ step: 4 }));

const collect = (role: 'CARRIER' | 'CS', boxes: number) => step(role,
  role === 'CARRIER' ? 'ขนส่งเก็บสินค้า' : 'CS บันทึกว่าเก็บสินค้าแล้ว',
  role === 'CARRIER'
    ? `ขนส่งไปเก็บสินค้าที่สาขาและบันทึกจำนวน ${boxes} กล่อง ตรงกับกล่องที่ Brand แจ้งไว้`
    : `CS บันทึกว่าเก็บสินค้าได้ ${boxes} กล่อง ระบบผูกกล่องกับเลข RTV เดิม`,
  adv({ step: 5, boxes }));

const whReceive = (boxes: number) => step('WH', 'คลัง CMG รับสินค้า',
  `คลัง CMG รับสินค้าเข้าคลังครบ ${boxes} กล่อง ทุกกล่องมีเลขกล่องต่อท้ายเลข RTV เดียวกัน`,
  adv({ step: 8, boxes }));

const whCount = (narration: string, tk: string, counts: number[]) =>
  step('WH', 'คลัง CMG ตรวจนับ', narration, adv({ step: 9, tk, counts }));

const issueCn = (narration: string, docs: Partial<Record<DocType, string>>) =>
  step('ADMIN_CN', 'Admin CN ออก CN', narration, adv({ step: 10, docs }));

const scdcIn = (boxes: number) => step('SCDC', 'SCDC รับเข้า',
  `SCDC รับสินค้าเข้าศูนย์ ${boxes} กล่อง ระบบบันทึกว่าของอยู่ที่ SCDC แล้ว`, adv({ step: 6, boxes }));
const scdcOut = () => step('SCDC', 'SCDC ส่งต่อ CMG',
  'SCDC ส่งสินค้าต่อไปคลัง CMG ผู้ติดตามเห็นว่ากล่องอยู่ระหว่างทาง บนเลข RTV เดิม', adv({ step: 7 }));

const shop: Story = {
  id: 'shop',
  title: 'Shop ปกติ (ขนส่ง 4W Plaza)',
  summary: 'สาขา Shop ใน กทม. ส่งคืนสินค้า ใช้รถ 4W Plaza ผ่านครบทุกบทบาทจนออก CN',
  create: {
    brandId: DEMO_BRAND_ID, storeId: 'store-01', channel: 'SHOP', saleType: 'NORMAL',
    boxPcs: [12, 8], docs: [{ type: 'MIM', value: '26104521' }],
  },
  steps: [
    assign4w(1),
    slip('CS ออกใบแจ้งเก็บ', 'CS กดออกใบแจ้งเก็บ ระบบสร้างเลขใบแจ้งเก็บผูกกับเลข RTV เดียวกัน พิมพ์ส่งให้ขนส่งได้ทันที'),
    accept(),
    collect('CARRIER', 2),
    whReceive(2),
    whCount('คลังนับสินค้าและกรอกเลข TK ตัวเลขตรงกับที่ Brand แจ้ง จึงไม่มีอะไรให้ Brand ต้องยืนยันเพิ่ม', 'TK2600412', [12, 8]),
    issueCn('เอกสารครบ (MIM และ TK) Admin CN กรอกเลข Matdoc แล้วออก CN งานปิดด้วยเลข RTV เดิมตั้งแต่ต้นจนจบ',
      { MATDOC: '5250001234' }),
  ],
};

const consign: Story = {
  id: 'consign',
  title: 'Consign (CG Network) ของขาดและรอ RTV Note',
  summary: 'สาขา Consign ใช้ CG Network ผ่าน SCDC นับเจอขาด 1 ชิ้น Brand ต้องยืนยันยอดและเพิ่ม RTV Note (ห้าง) ก่อนออก CN',
  create: {
    brandId: DEMO_BRAND_ID, storeId: 'store-07', channel: 'CONSIGN', saleType: 'NORMAL',
    boxPcs: [10, 6], docs: [{ type: 'MIM', value: '26104688' }],
  },
  steps: [
    accept(),
    collect('CARRIER', 2),
    scdcIn(2),
    scdcOut(),
    whReceive(2),
    whCount('คลังนับสินค้าได้น้อยกว่าที่แจ้ง 1 ชิ้น และยังไม่มี RTV Note (ห้าง) ระบบจึงหยุดรอ Brand 2 เรื่อง', 'TK2600455', [10, 5]),
    step('BRAND', 'Brand ยืนยันยอด', 'Brand ตรวจแล้วยอมรับยอดที่คลังนับได้ ระบบปลดเงื่อนไขข้อแรก', { type: 'brandConfirmQty' }),
    step('BRAND', 'Brand เพิ่ม RTV Note (ห้าง)',
      'Brand กรอกเลข RTV Note (ห้าง) ที่ห้างออกให้ ระบบปลดเงื่อนไขข้อสุดท้าย ตอนนี้ออก CN ได้',
      { type: 'addDoc', doc: { type: 'RTV_NOTE', value: 'RN-260718' } }),
    issueCn('เอกสารครบแล้ว Admin CN กรอก Sale Return, Delivery และเลข CN เพื่อปิดงาน',
      { SALE_RETURN: 'SR2600731', DELIVERY: '8000045612', CN: 'CN2600731' }),
  ],
};

const tempPromo: Story = {
  id: 'temp-promo',
  title: 'Temp shop โปรโมชัน (ส่งพัสดุ)',
  summary: 'สาขา Temp shop ส่งสินค้าโปรโมชันกลับทางพัสดุ CS บันทึกแทนขนส่ง และ Brand ต้องยืนยัน Promotion ก่อนออก CN',
  create: {
    brandId: DEMO_BRAND_ID, storeId: 'store-04', channel: 'TEMP_SHOP', saleType: 'PROMO',
    boxPcs: [15, 9], docs: [{ type: 'MIM', value: '26104702' }],
  },
  steps: [
    step('CS', 'CS จัดขนส่ง Parcel',
      'CS เลือกส่งเป็นพัสดุและกรอกเลขพัสดุ ระบบข้ามใบแจ้งเก็บให้เพราะใช้ไม่ได้กับพัสดุ',
      adv({ step: 2, carrier: 'PARCEL', pickupDate: pickupIn(1), carrierRef: 'KEX1234567890' })),
    accept('CS'),
    collect('CS', 2),
    scdcIn(2),
    scdcOut(),
    whReceive(2),
    whCount('คลังนับสินค้าและกรอกเลข TK ยอดตรงกัน แต่เป็นงานโปรโมชัน ระบบจึงรอ Brand ยืนยัน Promotion', 'TK2600501', [15, 9]),
    step('BRAND', 'Brand ยืนยัน Promotion', 'Brand ยืนยันว่าสินค้านี้เป็นโปรโมชันจริง ระบบปลดเงื่อนไขให้ออก CN ได้', { type: 'confirmPromo' }),
    issueCn('Admin CN กรอกเลข 104, เลข Promotion, Matdoc และเลข CN ของ Temp Shop แล้วปิดงาน',
      { GEN104: '1040005512', PROMO_NO: 'PRO-0418', MATDOC: '5250001301', CN: 'CN2600802' }),
  ],
};

const failedPickup: Story = {
  id: 'failed-pickup',
  title: 'ขนส่งเก็บไม่สำเร็จ (ร้านปิด)',
  summary: 'ขนส่งไปถึงแล้วร้านปิด งานย้อนกลับไปให้ CS นัดใหม่ แล้วเก็บได้ในรอบถัดไป ใช้ใบแจ้งเก็บเลขเดิม',
  create: {
    brandId: DEMO_BRAND_ID, storeId: 'store-02', channel: 'SHOP', saleType: 'NORMAL',
    boxPcs: [7, 5], docs: [{ type: 'MIM', value: '26104755' }],
  },
  steps: [
    assign4w(1),
    slip('CS ออกใบแจ้งเก็บ', 'CS ออกใบแจ้งเก็บ ระบบสร้างเลขใบแจ้งเก็บผูกกับเลข RTV เดียวกัน'),
    accept(),
    step('CARRIER', 'ขนส่งเก็บไม่สำเร็จ',
      'ขนส่งไปถึงสาขาแต่ร้านปิด จึงกดเก็บไม่สำเร็จพร้อมเหตุผล งานย้อนกลับไปให้ CS นัดใหม่ และเหตุการณ์นี้ถูกบันทึกในประวัติ',
      { type: 'failPickup', reason: 'ร้านปิด' }),
    step('CS', 'CS นัดขนส่งใหม่', 'CS นัดวันเก็บใหม่ให้ขนส่ง เลข RTV ยังเป็นเลขเดิม ประวัติรอบก่อนไม่หาย',
      adv({ step: 2, carrier: 'PLAZA_4W', pickupDate: pickupIn(3) })),
    slip('CS ยืนยันใบแจ้งเก็บอีกครั้ง', 'CS ยืนยันใบแจ้งเก็บอีกครั้ง ระบบใช้ใบแจ้งเก็บเลขเดิม ไม่ออกเลขใหม่ ขนส่งถือใบเดิมไปได้เลย'),
    accept(),
    collect('CARRIER', 2),
  ],
};

export const STORIES: Story[] = [shop, consign, tempPromo, failedPickup];
