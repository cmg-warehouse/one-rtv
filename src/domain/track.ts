import { viaScdc } from './geo';
import { isClosed, stepsOf } from './rules';
import type { Rtv, RtvEvent, Step } from './types';
import { tr } from '../i18n';

export type MilestoneState = 'done' | 'current' | 'todo' | 'skipped';
export interface Milestone { key: string; label: string; sub: string; state: MilestoneState; at?: string; by?: string }

interface Def { key: string; label: string; sub: string; done: Step; from: Step }

/** Customer-facing milestones: groups of the 10 internal steps, as a parcel tracker would show them. */
const DEFS: Def[] = [
  { key: 'open', get label() { return tr('เปิดคำสั่งคืน', 'Return opened'); }, get sub() { return tr('Brand แจ้งคืนสินค้า', 'Brand reports the return'); }, from: 1, done: 1 },
  { key: 'plan', get label() { return tr('จัดขนส่ง', 'Carrier arranged'); }, get sub() { return tr('CS รับเรื่อง / ออกใบแจ้งเก็บ', 'CS accepts / issues the pickup slip'); }, from: 2, done: 3 },
  { key: 'pickup', get label() { return tr('เข้ารับสินค้า', 'Goods collected'); }, get sub() { return tr('ขนส่งสแกนกล่องที่สาขา', 'Carrier scans the boxes at the store'); }, from: 4, done: 5 },
  { key: 'scdc', get label() { return tr('ผ่าน SCDC', 'Via SCDC'); }, get sub() { return tr('รับเข้า / ส่งต่อ', 'Received / forwarded'); }, from: 6, done: 7 },
  { key: 'cmg', get label() { return tr('ถึงคลัง CMG', 'At CMG warehouse'); }, get sub() { return tr('คลังสแกนรับสินค้า', 'Warehouse scans the goods in'); }, from: 8, done: 8 },
  { key: 'count', get label() { return tr('ตรวจนับ', 'Count'); }, get sub() { return tr('นับชิ้น / ออกเลข TK', 'Count pieces / issue TK number'); }, from: 9, done: 9 },
  { key: 'cn', get label() { return tr('ออก CN', 'Issue CN'); }, get sub() { return tr('ปิดงาน', 'Closed'); }, from: 10, done: 10 },
];

function stepEvent(rtv: Rtv, from: Step, to: Step): RtvEvent | undefined {
  return [...rtv.events].reverse().find(e => e.kind === 'STEP' && e.step !== undefined && e.step >= from && e.step <= to);
}

export function milestones(rtv: Rtv): Milestone[] {
  const defs = stepsOf(rtv);
  let currentSet = false;
  return DEFS.map((d): Milestone => {
    const live = defs.filter(s => s.step >= d.from && s.step <= d.done && s.mode !== 'SKIPPED');
    if (live.length === 0) return { key: d.key, label: d.label, sub: tr('ไม่ผ่านขั้นนี้', 'Not part of this journey'), state: 'skipped' };
    if (rtv.step >= live[live.length - 1].step) {
      const e = stepEvent(rtv, d.from, d.done);
      return { key: d.key, label: d.label, sub: d.sub, state: 'done', at: e?.at, by: e?.actor };
    }
    if (!currentSet && !isClosed(rtv)) {
      currentSet = true;
      const partial = rtv.step >= d.from ? stepEvent(rtv, d.from, d.done) : undefined;
      return { key: d.key, label: d.label, sub: d.sub, state: 'current', at: partial?.at, by: partial?.actor };
    }
    return { key: d.key, label: d.label, sub: d.sub, state: 'todo' };
  });
}

export type BoxMark = 'ok' | 'missing' | 'pending' | 'skipped';
export interface BoxTrace { no: string; expectedPcs: number; countedPcs?: number; pickup: BoxMark; scdc: BoxMark; cmg: BoxMark }

/** How many boxes were received at a scan point (steps 5, 6, 8), from the SHORT_BOX event of that step if any. */
function receivedAt(rtv: Rtv, step: 5 | 6 | 8): number | null {
  if (rtv.step < step) return null;
  const lastStep = [...rtv.events].reverse().find(e => e.kind === 'STEP' && e.step === step);
  if (!lastStep) return null;
  const short = rtv.events.find(e => e.kind === 'SHORT_BOX' && e.step === step && e.at >= lastStep.at);
  const m = short?.note?.match(/(?:ได้รับ|Received) (\d+) (?:จาก|of)/);
  return m ? Number(m[1]) : rtv.boxes.length;
}

/** Per-box scan marks. The demo only records counts, so the missing boxes are shown as the last ones. */
export function boxTrace(rtv: Rtv): BoxTrace[] {
  const scdc = viaScdc(rtv);
  const got = { pickup: receivedAt(rtv, 5), scdc: scdc ? receivedAt(rtv, 6) : null, cmg: receivedAt(rtv, 8) };
  const mark = (n: number | null, i: number, skip = false): BoxMark => {
    if (skip) return 'skipped';
    if (n === null) return 'pending';
    return i < n ? 'ok' : 'missing';
  };
  return rtv.boxes.map((b, i) => ({
    no: b.no, expectedPcs: b.expectedPcs, countedPcs: b.countedPcs,
    pickup: mark(got.pickup, i), scdc: mark(got.scdc, i, !scdc), cmg: mark(got.cmg, i),
  }));
}
