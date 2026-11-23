import { act, actPromo, getRtv, type Action, type PromoAction } from '../api';
import { DEMO_BRAND_ID } from '../data/masters';
import type { NewRtvInput } from '../domain/machine';
import type { PromoInput } from '../domain/promo';
import type { DocType, Role } from '../domain/types';
import { tr } from '../i18n';

type T = readonly [th: string, en: string];

/** What a tour follows: the RTV, and for a promotion pickup also the pickup it belongs to. */
export interface TourIds { rtvId: string; promoId?: string }

export interface TourStep {
  role: Role;
  title: string;
  narration: string;
  route: (ids: TourIds) => string;
  run: (ids: TourIds, ctx: { role: Role; actor: string }) => Promise<void>;
}

export interface Story {
  id: 'shop' | 'consign' | 'temp-promo' | 'failed-pickup' | 'promo-event';
  title: string;
  summary: string;
  /** Opened by Brand as one RTV ... */
  create?: NewRtvInput;
  /** ... or a promotion pickup opened by the coordinator; the tour follows the demo brand's RTV in it. */
  promo?: Omit<PromoInput, 'pickupAt'> & { pickupInDays: number };
  steps: TourStep[];
}

const DAY = 86_400_000;
const BKK = 7 * 3_600_000;
const pickupIn = (days: number) => new Date(Date.now() + BKK + days * DAY).toISOString().slice(0, 10);

type Payload = Extract<Action, { type: 'advance' }>['payload'];
const adv = (payload: Payload): Action => ({ type: 'advance', payload });

/** One tour step: every step runs one API action as the role it names and shows the RTV detail page. */
const step = (role: Role, title: T, narration: T, action: Action): TourStep => ({
  role,
  get title() { return tr(title[0], title[1]); },
  get narration() { return tr(narration[0], narration[1]); },
  route: ({ rtvId }) => `/rtv/${rtvId}`,
  run: async ({ rtvId }, ctx) => { await act(rtvId, action, ctx); },
});

/** A step done once for the whole promotion pickup, shown on `page` of the pickup. */
const promoStep = (role: Role, title: T, narration: T, action: PromoAction, page = ''): TourStep => ({
  role,
  get title() { return tr(title[0], title[1]); },
  get narration() { return tr(narration[0], narration[1]); },
  route: ({ promoId }) => `/promo/${promoId}${page}`,
  run: async ({ promoId }, ctx) => { await actPromo(promoId!, action, ctx); },
});

const assign4w = (days: number) => step('CS', ['CS จัดขนส่งงานสาย (4W Plaza)', 'CS assigns the Route carrier (4W Plaza)'],
  ['CS เลือกขนส่งงานสาย (Route) – 4W Plaza และวันนัดเก็บ ระบบบันทึกลงเลข One RTV เดียวกัน ไม่ต้องเปิดเลขใหม่',
    'CS picks the Route carrier (4W Plaza) and the pickup date. It is recorded on the same One RTV number, no new number needed.'],
  adv({ step: 2, carrier: 'PLAZA_4W', pickupDate: pickupIn(days) }));

const slip = (title: T, narration: T) => step('CS', title, narration, adv({ step: 3 }));

const accept = (role: 'CARRIER' | 'CS' = 'CARRIER') => step(role,
  role === 'CARRIER' ? ['ขนส่งรับงาน', 'Carrier accepts the job'] : ['CS บันทึกว่าขนส่งรับงาน', 'CS records that the carrier accepted'],
  role === 'CARRIER'
    ? ['เจ้าหน้าที่ขนส่งเปิดงานบนมือถือและกด “รับงาน” สถานะของเลข RTV นี้เปลี่ยนเป็นขนส่งรับงานแล้ว',
      'The carrier opens the job on their phone and taps “Accept”. This RTV number is now marked as accepted by the carrier.']
    : ['พัสดุไม่ผ่านแอปขนส่ง CS จึงบันทึกแทนว่าขนส่งรับงานแล้ว สถานะของเลข RTV นี้ขยับตามทันที',
      'Parcels do not go through the carrier app, so CS records on their behalf that the carrier accepted. The status of this RTV number moves at once.'],
  adv({ step: 4 }));

const collect = (role: 'CARRIER' | 'CS', boxes: number) => step(role,
  role === 'CARRIER' ? ['ขนส่งเก็บสินค้า', 'Carrier collects the goods'] : ['CS บันทึกว่าเก็บสินค้าแล้ว', 'CS records that the goods were collected'],
  role === 'CARRIER'
    ? [`ขนส่งไปเก็บสินค้าที่สาขาและบันทึกจำนวน ${boxes} กล่อง ตรงกับกล่องที่ Brand แจ้งไว้`,
      `The carrier collects the goods at the store and records ${boxes} boxes, matching what Brand declared.`]
    : [`CS บันทึกว่าเก็บสินค้าได้ ${boxes} กล่อง ระบบผูกกล่องกับเลข RTV เดิม`,
      `CS records ${boxes} boxes collected. The boxes are tied to the same RTV number.`],
  adv({ step: 5, boxes }));

const whReceive = (boxes: number) => step('WH', ['คลัง CMG รับสินค้า', 'CMG warehouse receives the goods'],
  [`คลัง CMG รับสินค้าเข้าคลังครบ ${boxes} กล่อง ทุกกล่องมีเลขกล่องต่อท้ายเลข RTV เดียวกัน`,
    `The CMG warehouse receives all ${boxes} boxes. Every box has a box number appended to the same RTV number.`],
  adv({ step: 8, boxes }));

const whCount = (narration: T, tk: string, counts: number[]) =>
  step('WH', ['คลัง CMG ตรวจนับ', 'CMG warehouse counts'], narration, adv({ step: 9, tk, counts }));

const issueCn = (narration: T, docs: Partial<Record<DocType, string>>) =>
  step('ADMIN_CN', ['Admin CN ออก CN', 'Admin CN issues the CN'], narration, adv({ step: 10, docs }));

const scdcIn = (boxes: number) => step('SCDC', ['SCDC รับเข้า', 'SCDC receives'],
  [`SCDC รับสินค้าเข้าศูนย์ ${boxes} กล่อง ระบบบันทึกว่าของอยู่ที่ SCDC แล้ว`,
    `SCDC receives ${boxes} boxes at the center. The system records the goods as being at SCDC.`], adv({ step: 6, boxes }));
const scdcOut = () => step('SCDC', ['SCDC ส่งต่อ CMG', 'SCDC forwards to CMG'],
  ['SCDC ส่งสินค้าต่อไปคลัง CMG ผู้ติดตามเห็นว่ากล่องอยู่ระหว่างทาง บนเลข RTV เดิม',
    'SCDC sends the goods on to the CMG warehouse. Anyone tracking sees the boxes in transit, on the same RTV number.'], adv({ step: 7 }));

/** Titles and summaries follow the language (read when shown), so they are getters. */
const story = (
  id: Story['id'], title: T, summary: T, rest: Omit<Story, 'id' | 'title' | 'summary'>,
): Story => ({
  id,
  get title() { return tr(title[0], title[1]); },
  get summary() { return tr(summary[0], summary[1]); },
  ...rest,
});

const shop: Story = story('shop',
  ['Shop ปกติ (ขนส่งงานสาย 4W Plaza)', 'Regular Shop (Route carrier 4W Plaza)'],
  ['สาขา Shop ใน กทม. ส่งคืนสินค้า ใช้รถงานสาย (Route) – 4W Plaza ผ่านครบทุกบทบาทจนออก CN',
    'A Shop store in Bangkok returns goods by Route truck (4W Plaza), passing through every role until the CN is issued.'],
  {
    create: {
      brandId: DEMO_BRAND_ID, storeId: 'store-01', channel: 'SHOP', saleType: 'NORMAL',
      boxPcs: [12, 8], boxMims: ['26104521', '26104522'], docs: [],
    },
    steps: [
      assign4w(1),
      slip(['CS ออกใบแจ้งเก็บ', 'CS issues the pickup slip'],
        ['CS กดออกใบแจ้งเก็บ ระบบสร้างเลขใบแจ้งเก็บผูกกับเลข RTV เดียวกัน พิมพ์ส่งให้ขนส่งได้ทันที',
          'CS issues the pickup slip. The system creates a slip number tied to the same RTV number, ready to print for the carrier.']),
      accept(),
      collect('CARRIER', 2),
      whReceive(2),
      whCount(['คลังนับสินค้าและกรอกเลข TK ตัวเลขตรงกับที่ Brand แจ้ง จึงไม่มีอะไรให้ Brand ต้องยืนยันเพิ่ม',
        'The warehouse counts the goods and enters the TK number. The counts match what Brand declared, so Brand has nothing more to confirm.'],
      'TK2600412', [12, 8]),
      issueCn(['เอกสารครบ (MIM และ TK) Admin CN กรอกเลข Matdoc แล้วออก CN งานปิดด้วยเลข RTV เดิมตั้งแต่ต้นจนจบ',
        'Documents are complete (MIM and TK). Admin CN enters the Matdoc number and issues the CN. The job closes on the same RTV number from start to finish.'],
      { MATDOC: '5250001234' }),
    ],
  });

const consign: Story = story('consign',
  ['Consign (CG Network) ของขาดและรอ RTV Note', 'Consign (CG Network): goods short, waiting for RTV Note'],
  ['สาขา Consign ใช้ CG Network ผ่าน SCDC นับเจอขาด 1 ชิ้น Brand ต้องยืนยันยอดและเพิ่ม RTV Note (ห้าง) ก่อนออก CN',
    'A Consign store uses CG Network via SCDC. The count finds 1 pc short. Brand must confirm the quantity and add the RTV Note (mall) before the CN is issued.'],
  {
    create: {
      brandId: DEMO_BRAND_ID, storeId: 'store-07', channel: 'CONSIGN', saleType: 'NORMAL',
      boxPcs: [10, 6], docs: [],
    },
    steps: [
      accept(),
      collect('CARRIER', 2),
      scdcIn(2),
      scdcOut(),
      whReceive(2),
      whCount(['คลังนับสินค้าได้น้อยกว่าที่แจ้ง 1 ชิ้น และยังไม่มี RTV Note (ห้าง) ระบบจึงหยุดรอ Brand 2 เรื่อง',
        'The warehouse counts 1 pc fewer than declared and there is no RTV Note (mall) yet, so the system holds for Brand on 2 items.'],
      'TK2600455', [10, 5]),
      step('BRAND', ['Brand ยืนยันยอด', 'Brand confirms quantity'],
        ['Brand ตรวจแล้วยอมรับยอดที่คลังนับได้ ระบบปลดเงื่อนไขข้อแรก',
          'Brand checks and accepts the quantity the warehouse counted. The first condition is released.'],
        { type: 'brandConfirmQty' }),
      step('BRAND', ['Brand เพิ่ม RTV Note (ห้าง)', 'Brand adds the RTV Note (mall)'],
        ['Brand กรอกเลข RTV Note (ห้าง) ที่ห้างออกให้ ระบบปลดเงื่อนไขข้อสุดท้าย ตอนนี้ออก CN ได้',
          'Brand enters the RTV Note (mall) number issued by the mall. The last condition is released and the CN can now be issued.'],
        { type: 'addDoc', doc: { type: 'RTV_NOTE', value: 'RN-260718' } }),
      issueCn(['เอกสารครบแล้ว Admin CN กรอก Sale Return, Delivery และเลข CN เพื่อปิดงาน',
        'Documents are complete. Admin CN enters Sale Return, Delivery and the CN number to close the job.'],
      { SALE_RETURN: 'SR2600731', DELIVERY: '8000045612', CN: 'CN2600731' }),
    ],
  });

const tempPromo: Story = story('temp-promo',
  ['Temp shop โปรโมชัน (ส่งพัสดุ)', 'Temp shop promotion (parcel)'],
  ['สาขา Temp shop ส่งสินค้าโปรโมชันกลับทางพัสดุ CS บันทึกแทนขนส่ง และ Brand ต้องยืนยัน Promotion ก่อนออก CN',
    'A Temp shop sends promotion goods back by parcel. CS records on the carrier’s behalf, and Brand must confirm the Promotion before the CN is issued.'],
  {
    create: {
      brandId: DEMO_BRAND_ID, storeId: 'store-04', channel: 'TEMP_SHOP', saleType: 'PROMO',
      boxPcs: [15, 9], boxMims: ['26104702', '26104703'], docs: [],
    },
    steps: [
      step('CS', ['CS จัดขนส่ง Parcel', 'CS assigns the Parcel carrier'],
        ['CS เลือกส่งเป็นพัสดุและกรอกเลขพัสดุ ระบบข้ามใบแจ้งเก็บให้เพราะใช้ไม่ได้กับพัสดุ',
          'CS chooses parcel delivery and enters the parcel number. The system skips the pickup slip because it does not apply to parcels.'],
        adv({ step: 2, carrier: 'PARCEL', pickupDate: pickupIn(1), carrierRef: 'KEX1234567890' })),
      accept('CS'),
      collect('CS', 2),
      scdcIn(2),
      scdcOut(),
      whReceive(2),
      whCount(['คลังนับสินค้าและกรอกเลข TK ยอดตรงกัน แต่เป็นงานโปรโมชัน ระบบจึงรอ Brand ยืนยัน Promotion',
        'The warehouse counts the goods and enters the TK number. The counts match, but this is a promotion job, so the system waits for Brand to confirm the Promotion.'],
      'TK2600501', [15, 9]),
      step('BRAND', ['Brand ยืนยัน Promotion', 'Brand confirms the Promotion'],
        ['Brand ยืนยันว่าสินค้านี้เป็นโปรโมชันจริง ระบบปลดเงื่อนไขให้ออก CN ได้',
          'Brand confirms these goods are really a promotion. The condition is released so the CN can be issued.'],
        { type: 'confirmPromo' }),
      issueCn(['Admin CN กรอกเลข 104, เลข Promotion, Matdoc และเลข CN ของ Temp Shop แล้วปิดงาน',
        'Admin CN enters the 104 number, Promotion number, Matdoc and the Temp Shop CN number, then closes the job.'],
      { GEN104: '1040005512', PROMO_NO: 'PRO-0418', MATDOC: '5250001301', CN: 'CN2600802' }),
    ],
  });

const failedPickup: Story = story('failed-pickup',
  ['ขนส่งเก็บไม่สำเร็จ (ร้านปิด)', 'Carrier pickup failed (store closed)'],
  ['ขนส่งไปถึงแล้วร้านปิด งานย้อนกลับไปให้ CS นัดใหม่ แล้วเก็บได้ในรอบถัดไป ใช้ใบแจ้งเก็บเลขเดิม',
    'The carrier arrives but the store is closed. The job goes back to CS to reschedule and is collected on the next round, using the same pickup slip number.'],
  {
    create: {
      brandId: DEMO_BRAND_ID, storeId: 'store-02', channel: 'SHOP', saleType: 'NORMAL',
      boxPcs: [7, 5], boxMims: ['26104755', '26104756'], docs: [],
    },
    steps: [
      assign4w(1),
      slip(['CS ออกใบแจ้งเก็บ', 'CS issues the pickup slip'],
        ['CS ออกใบแจ้งเก็บ ระบบสร้างเลขใบแจ้งเก็บผูกกับเลข RTV เดียวกัน',
          'CS issues the pickup slip. The system creates a slip number tied to the same RTV number.']),
      accept(),
      step('CARRIER', ['ขนส่งเก็บไม่สำเร็จ', 'Carrier pickup failed'],
        ['ขนส่งไปถึงสาขาแต่ร้านปิด จึงกดเก็บไม่สำเร็จพร้อมเหตุผล งานย้อนกลับไปให้ CS นัดใหม่ และเหตุการณ์นี้ถูกบันทึกในประวัติ',
          'The carrier arrives at the store but it is closed, so they mark the pickup as failed with a reason. The job goes back to CS to reschedule and the event is logged in the history.'],
        { type: 'failPickup', get reason() { return tr('ร้านปิด', 'Store closed'); } }),
      step('CS', ['CS นัดขนส่งใหม่', 'CS reschedules the carrier'],
        ['CS นัดวันเก็บใหม่ให้ขนส่ง เลข RTV ยังเป็นเลขเดิม ประวัติรอบก่อนไม่หาย',
          'CS sets a new pickup date for the carrier. The RTV number stays the same and the earlier history is kept.'],
        adv({ step: 2, carrier: 'PLAZA_4W', pickupDate: pickupIn(3) })),
      slip(['CS ยืนยันใบแจ้งเก็บอีกครั้ง', 'CS confirms the pickup slip again'],
        ['CS ยืนยันใบแจ้งเก็บอีกครั้ง ระบบใช้ใบแจ้งเก็บเลขเดิม ไม่ออกเลขใหม่ ขนส่งถือใบเดิมไปได้เลย',
          'CS confirms the pickup slip again. The system reuses the same slip number and does not issue a new one, so the carrier can take the same slip.']),
      accept(),
      collect('CARRIER', 2),
    ],
  });

const promoEvent: Story = story('promo-event',
  ['งานเก็บโปร (หลายแบรนด์ · ไม่ใช้เมล)', 'Promo pickup (multi-brand, no email)'],
  ['ผู้ประสานงานโปรแจ้งงานในระบบ CS ส่งต่อขนส่ง ขนส่งยืนยันรถ คนขับสแกนใบแจ้งเก็บรวมแล้วนับของ + ถ่ายรูป จากนั้นติดตาม RTV ของ Lacoste จนออก CN',
    'The promo coordinator posts the job in the system, CS forwards it to the carrier, the carrier confirms the truck, and the driver scans the combined pickup slip, counts the goods and takes photos. Then we follow the Lacoste RTV until the CN is issued.'],
  {
    promo: {
      get name() { return tr('Demo งานโปร @ เมกาบางนา', 'Demo promo pickup @ Mega Bangna'); },
      storeId: 'venue-04', pickupInDays: 1,
      contact: { get name() { return tr('คุณมิ้นท์', 'Khun Mint'); }, phone: '081-000-4321' },
      lines: [{ brandId: DEMO_BRAND_ID, boxes: 3, pallets: 1 }, { brandId: 'SK', boxes: 5, pallets: 1 }, { brandId: 'HP', boxes: 4, pallets: 1 }],
      extras: [{ get label() { return tr('ถุง', 'Bags'); }, pallets: 1 }],
      estimate: { type: '4W', count: 1 },
    },
    steps: [
      promoStep('CS', ['CS ส่งต่อขนส่ง', 'CS forwards to the carrier'],
        ['ผู้ประสานงานแจ้งงานในระบบแล้ว (แทนเมลแจ้งรายชื่อ) ทุกแบรนด์ได้เลข RTV ทันที CS ตรวจแล้วกดส่งต่อขนส่งเป็นงานจองรถ ระบบออกใบแจ้งเก็บรวมใบเดียวให้ทั้งงาน',
          'The coordinator posted the job in the system (instead of emailing a list). Every brand gets an RTV number at once. CS checks it and forwards it to the carrier as a booked-truck job, and one combined pickup slip is issued for the whole job.'],
        { type: 'forward' }),
      promoStep('CARRIER', ['ขนส่งยืนยันรถ', 'Carrier confirms the truck'],
        ['ขนส่งกรอกประเภทรถ ทะเบียน และคนขับ ทุกแบรนด์ในงานเห็นการ์ด “ยืนยันรถเก็บโปร” ทันที แทนเมลยืนยันรถ',
          'The carrier enters the truck type, plate and driver. Every brand in the job sees the “Promo pickup truck confirmed” card at once, instead of a confirmation email.'],
        { type: 'confirmVehicles', vehicles: [{ type: '4W', plate: '3ฒก-4521 กทม.', get driver() { return tr('คุณบุญมี', 'Khun Boonmee'); }, phone: '089-000-4444' }] }),
      promoStep('CARRIER', ['คนขับเก็บของที่หน้างาน', 'Driver collects the goods on site'],
        ['วันเก็บ คนขับสแกน QR ใบแจ้งเก็บรวม เห็นทุกแบรนด์ในงาน นับยอดจริง (Lacoste ได้ 4 กล่อง เกินที่แจ้ง 1 · Hush Puppies ไม่มีของ) ถ่ายรูป และให้หน้างานเซ็น ไม่ต้องสแกนทีละกล่อง',
          'On pickup day the driver scans the QR on the combined pickup slip and sees every brand in the job. They count the real quantity (Lacoste 4 boxes, 1 over the declared amount; Hush Puppies has no goods), take photos and get an on-site signature. No need to scan box by box.'],
        { type: 'recordPickup', input: { lines: { [DEMO_BRAND_ID]: { boxes: 4, pallets: 1 }, SK: { boxes: 5, pallets: 1 }, HP: { boxes: 0, pallets: 0 } }, extras: [1] } },
        '/slip'),
      step('WH', ['คลัง CMG กม.20 รับสินค้า', 'CMG Km.20 warehouse receives the goods'],
        ['RTV ของ Lacoste ไปคลัง CMG กม.20 ตรง (Skechers ไป SCDC คลองส่งน้ำก่อน) คลังรับเข้าครบ 4 กล่องตามยอดที่คนขับเก็บจริง',
          'The Lacoste RTV goes straight to the CMG Km.20 warehouse (Skechers goes to SCDC Khlong Song Nam first). The warehouse receives all 4 boxes, matching what the driver actually collected.'],
        adv({ step: 8, boxes: 4 })),
      whCount(['คลังนับชิ้นและกรอกเลข TK งานโปรไม่มีจำนวนชิ้นตามเอกสาร ระบบจึงรอ Brand ยืนยันยอด เติม MIM และยืนยัน Promotion ก่อนออก CN',
        'The warehouse counts the pieces and enters the TK number. A promo job has no document piece count, so the system waits for Brand to confirm the quantity, fill in MIM and confirm the Promotion before the CN is issued.'],
      'TK2600877', [12, 9, 10, 6]),
      step('BRAND', ['Brand ยืนยันยอด', 'Brand confirms quantity'],
        ['Brand ตรวจยอดที่คลังนับได้แล้วยืนยัน', 'Brand checks the quantity the warehouse counted and confirms it.'],
        { type: 'brandConfirmQty' }),
      {
        role: 'BRAND',
        get title() { return tr('Brand เติมเลข MIM ทุกกล่อง', 'Brand fills in the MIM number for every box'); },
        get narration() {
          return tr('Brand เติมเลข MIM ของแต่ละกล่องทีหลังได้ (ตอนแจ้งงานยังไม่มีเอกสาร)',
            'Brand can fill in each box’s MIM number later (there were no documents when the job was posted).');
        },
        route: ({ rtvId }) => `/rtv/${rtvId}`,
        run: async ({ rtvId }, ctx) => {
          const r = await getRtv(rtvId);
          const mims = Object.fromEntries((r?.boxes ?? []).map((b, i) => [b.no, `2611${String(8801 + i)}`]));
          await act(rtvId, { type: 'setBoxMims', mims }, ctx);
        },
      },
      step('BRAND', ['Brand ยืนยัน Promotion', 'Brand confirms the Promotion'],
        ['Brand ยืนยันว่าเป็นสินค้าโปรโมชัน ระบบปลดเงื่อนไขสุดท้าย', 'Brand confirms these are promotion goods. The last condition is released.'],
        { type: 'confirmPromo' }),
      issueCn(['Admin CN กรอกเลข 104, เลข Promotion, Matdoc และเลข CN ของ Temp Shop แล้วปิดงาน',
        'Admin CN enters the 104 number, Promotion number, Matdoc and the Temp Shop CN number, then closes the job.'],
      { GEN104: '1040008801', PROMO_NO: 'PRO-1125', MATDOC: '5250008801', CN: 'CN2608801' }),
    ],
  });

export const STORIES: Story[] = [shop, consign, tempPromo, failedPickup, promoEvent];
