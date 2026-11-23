import { fmtDateTime } from '../domain/format';
import { STEP_LABELS } from '../domain/rules';
import type { RtvEvent } from '../domain/types';
import { ROLE_LABELS } from '../state/session';
import { tr } from '../i18n';

const withNote = (label: string, note?: string) => (note ? `${label}: ${note}` : label);

export function eventText(e: RtvEvent): string {
  switch (e.kind) {
    case 'STEP': {
      const label = e.step ? STEP_LABELS[e.step] : tr('เปลี่ยนสถานะ', 'Status changed');
      const noteSaysAuto = /^(อัตโนมัติ|auto)/i.test(e.note ?? '');
      return [e.auto && !noteSaysAuto ? `${label} ${tr('(อัตโนมัติ)', '(automatic)')}` : label, e.note].filter(Boolean).join(' — ');
    }
    case 'PICKUP_FAILED': return withNote(tr('เก็บไม่สำเร็จ', 'Pickup failed'), e.note);
    case 'SHORT_BOX': return withNote(tr('กล่องขาด', 'Short boxes'), e.note);
    case 'FLAG_CLEARED': return withNote(tr('ปิดธงกล่องขาด', 'Short-box flag cleared'), e.note);
    case 'QTY_MISMATCH': return tr('จำนวนชิ้นไม่ตรงเอกสาร', 'Piece count does not match the documents');
    case 'BRAND_CONFIRMED': return tr('Brand ยืนยันตามยอดที่คลังนับ', 'Brand confirmed the warehouse count');
    case 'RECOUNT_REQUESTED': return tr('Brand ขอให้นับใหม่', 'Brand requested a recount');
    case 'DOC_ADDED': return withNote(tr('เพิ่มเลขเอกสาร', 'Document number added'), e.note);
    case 'PROMO_CONFIRMED': return tr('ยืนยันยอด Promotion แล้ว', 'Promotion quantity confirmed');
    case 'CANCELLED': return withNote(tr('ยกเลิก', 'Cancelled'), e.note);
  }
}

export default function Timeline({ events }: { events: RtvEvent[] }) {
  const rows = [...events].reverse();
  return (
    <ul className="timeline">
      {rows.map((e, i) => (
        <li key={`${e.at}-${i}`} className={e.kind === 'STEP' ? undefined : 'timeline-warn'}>
          <span className="timeline-at">{fmtDateTime(e.at)}</span>
          <span className="timeline-role">{ROLE_LABELS[e.role]}</span>
          <span className="timeline-actor">{e.actor}</span>
          <span className="timeline-text">{eventText(e)}</span>
        </li>
      ))}
    </ul>
  );
}
