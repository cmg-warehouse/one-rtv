import type { DocType, Step } from '../domain/types';

export interface FlowCopy {
  what: string;
  records: string[];
  docs: DocType[];
}

/** Thai explanation of each step (spec §5.1). Step 10 documents depend on the scenario and are computed by the page. */
export const FLOW_COPY: Record<Step, FlowCopy> = {
  1: {
    what: 'Brand / ฝ่ายขายเปิดคำสั่งแจ้งเก็บสินค้า ระบบออกเลข RTV หลักให้ทันที',
    records: ['สาขา', 'แบรนด์', 'ประเภท', 'จำนวนกล่อง', 'เลขเอกสารที่มี'],
    docs: ['MIM', 'SD10', 'RTV_NOTE'],
  },
  2: {
    what: 'CS คลังรับเรื่อง เลือกขนส่ง และกำหนดวันนัดเก็บสินค้า',
    records: ['ขนส่ง', 'วันนัดเก็บ'],
    docs: ['CARRIER_REF'],
  },
  3: {
    what: 'CS ออกใบแจ้งเก็บให้ขนส่งนำไปใช้ที่สาขา',
    records: ['เลขใบแจ้งเก็บ'],
    docs: ['PICKUP_SLIP'],
  },
  4: {
    what: 'ขนส่งกดรับงานเก็บสินค้า',
    records: ['เวลา'],
    docs: [],
  },
  5: {
    what: 'ขนส่งเก็บสินค้าที่สาขา แล้วบันทึกเวลาและจำนวนกล่องที่เก็บได้',
    records: ['เวลา', 'จำนวนกล่องที่เก็บได้'],
    docs: [],
  },
  6: {
    what: 'SCDC รับสินค้าเข้า crossdock และนับกล่อง',
    records: ['เวลา', 'จำนวนกล่อง'],
    docs: [],
  },
  7: {
    what: 'SCDC ส่งสินค้าต่อไปที่คลัง CMG',
    records: ['เวลา'],
    docs: [],
  },
  8: {
    what: 'คลัง CMG รับสินค้าและนับกล่อง',
    records: ['เวลา', 'จำนวนกล่อง'],
    docs: [],
  },
  9: {
    what: 'คลัง CMG ตรวจนับจำนวนชิ้นเทียบกับเอกสาร และใส่เลข TK',
    records: ['เลข TK', 'จำนวนชิ้นเทียบเอกสาร'],
    docs: ['TK'],
  },
  10: {
    what: 'Admin CN ใส่เลขเอกสาร SAP ออก CN และปิดงาน',
    records: ['เลข CN', 'เลข SAP'],
    docs: [],
  },
};

const CANCEL = 'ยกเลิกคำสั่งได้ก่อนเก็บสินค้า';
const PICKUP_FAILED = 'เก็บไม่สำเร็จ → กลับไปให้ CS นัดใหม่';
const SHORT_BOX = 'กล่องไม่ครบ → ติดธงกล่องขาด งานเดินต่อ';

/** Abnormal cases per step (spec §5.3). */
export const FLOW_EXCEPTIONS: Record<Step, string[]> = {
  1: [],
  2: [CANCEL],
  3: [CANCEL],
  4: [CANCEL, PICKUP_FAILED],
  5: [PICKUP_FAILED, SHORT_BOX],
  6: [SHORT_BOX],
  7: [],
  8: [SHORT_BOX],
  9: ['ชิ้นไม่ตรงเอกสาร → รอ Brand ยืนยันยอด'],
  10: [], // step 10 holds depend on the scenario, see FlowDetail
};

export const EXC_WAIT_RTV_NOTE = 'ไม่มี RTV Note (ห้าง) → รอ RTV Note';
export const EXC_WAIT_PROMO = 'งาน Promotion → รอยืนยัน Promotion';
