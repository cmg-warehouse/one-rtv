import type { DocType, Step } from '../domain/types';
import { tr } from '../i18n';

export interface FlowCopy {
  what: string;
  records: string[];
  docs: DocType[];
}

type T = readonly [th: string, en: string];

/** A step's copy whose text follows the language (read when shown), so it is safe at module level. */
const copy = (what: T, records: readonly T[], docs: DocType[]): FlowCopy => ({
  get what() { return tr(what[0], what[1]); },
  get records() { return records.map(r => tr(r[0], r[1])); },
  docs,
});

/** Explanation of each step (spec §5.1). Step 10 documents depend on the scenario and are computed by the page. */
export const FLOW_COPY: Record<Step, FlowCopy> = {
  1: copy(
    ['Brand / ฝ่ายขายเปิดคำสั่งแจ้งเก็บสินค้า ระบบออกเลข RTV หลักให้ทันที', 'Brand / Sales opens the pickup order and the system issues the main RTV number at once.'],
    [['สาขา', 'Store'], ['แบรนด์', 'Brand'], ['ประเภท', 'Type'], ['จำนวนกล่อง', 'Number of boxes'], ['เลขเอกสารที่มี', 'Document numbers on hand']],
    ['MIM', 'SD10', 'RTV_NOTE'],
  ),
  2: copy(
    ['CS คลังรับเรื่อง เลือกขนส่ง และกำหนดวันนัดเก็บสินค้า', 'Warehouse CS takes the request, picks the carrier and sets the pickup date.'],
    [['ขนส่ง', 'Carrier'], ['วันนัดเก็บ', 'Pickup date']],
    ['CARRIER_REF'],
  ),
  3: copy(
    ['CS ออกใบแจ้งเก็บให้ขนส่งนำไปใช้ที่สาขา', 'CS issues the pickup slip for the carrier to use at the store.'],
    [['เลขใบแจ้งเก็บ', 'Pickup slip number']],
    ['PICKUP_SLIP'],
  ),
  4: copy(
    ['ขนส่งกดรับงานเก็บสินค้า', 'The carrier accepts the pickup job.'],
    [['เวลา', 'Time']],
    [],
  ),
  5: copy(
    ['ขนส่งเก็บสินค้าที่สาขา แล้วบันทึกเวลาและจำนวนกล่องที่เก็บได้', 'The carrier collects the goods at the store and records the time and number of boxes collected.'],
    [['เวลา', 'Time'], ['จำนวนกล่องที่เก็บได้', 'Boxes collected']],
    [],
  ),
  6: copy(
    ['SCDC รับสินค้าเข้า crossdock และนับกล่อง', 'SCDC receives the goods into the crossdock and counts the boxes.'],
    [['เวลา', 'Time'], ['จำนวนกล่อง', 'Number of boxes']],
    [],
  ),
  7: copy(
    ['SCDC ส่งสินค้าต่อไปที่คลัง CMG', 'SCDC sends the goods on to the CMG warehouse.'],
    [['เวลา', 'Time']],
    [],
  ),
  8: copy(
    ['คลัง CMG รับสินค้าและนับกล่อง', 'The CMG warehouse receives the goods and counts the boxes.'],
    [['เวลา', 'Time'], ['จำนวนกล่อง', 'Number of boxes']],
    [],
  ),
  9: copy(
    ['คลัง CMG ตรวจนับจำนวนชิ้นเทียบกับเอกสาร และใส่เลข TK', 'The CMG warehouse counts pieces against the documents and enters the TK number.'],
    [['เลข TK', 'TK number'], ['จำนวนชิ้นเทียบเอกสาร', 'Pieces vs documents']],
    ['TK'],
  ),
  10: copy(
    ['Admin CN ใส่เลขเอกสาร SAP ออก CN และปิดงาน', 'Admin CN enters the SAP document numbers, issues the CN and closes the job.'],
    [['เลข CN', 'CN number'], ['เลข SAP', 'SAP number']],
    [],
  ),
};

const CANCEL: T = ['ยกเลิกคำสั่งได้ก่อนเก็บสินค้า', 'The order can be cancelled before the goods are collected'];
const PICKUP_FAILED: T = ['เก็บไม่สำเร็จ → กลับไปให้ CS นัดใหม่', 'Pickup failed → back to CS to reschedule'];
const SHORT_BOX: T = ['กล่องไม่ครบ → ติดธงกล่องขาด งานเดินต่อ', 'Boxes missing → flag the short box, the job carries on'];
const SHORT_PCS: T = ['ชิ้นไม่ตรงเอกสาร → รอ Brand ยืนยันยอด', 'Pieces do not match the documents → wait for Brand to confirm the quantity'];

const list = (...items: T[]): string[] => items.map(t => tr(t[0], t[1]));

/** Abnormal cases per step (spec §5.3); each step's list is built when read so it follows the language. */
export const FLOW_EXCEPTIONS: Record<Step, string[]> = (() => {
  const src: Record<Step, T[]> = {
    1: [],
    2: [CANCEL],
    3: [CANCEL],
    4: [CANCEL, PICKUP_FAILED],
    5: [PICKUP_FAILED, SHORT_BOX],
    6: [SHORT_BOX],
    7: [],
    8: [SHORT_BOX],
    9: [SHORT_PCS],
    10: [], // step 10 holds depend on the scenario, see FlowDetail
  };
  const out = {} as Record<Step, string[]>;
  for (const k of Object.keys(src)) {
    const step = Number(k) as Step;
    Object.defineProperty(out, step, { enumerable: true, get: () => list(...src[step]) });
  }
  return out;
})();

export const EXC_WAIT_RTV_NOTE = (): string => tr('ไม่มี RTV Note (ห้าง) → รอ RTV Note', 'No RTV Note (mall) → wait for RTV Note');
export const EXC_WAIT_PROMO = (): string => tr('งาน Promotion → รอยืนยัน Promotion', 'Promotion job → wait for Promotion confirmation');
