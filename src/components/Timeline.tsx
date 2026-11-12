import { fmtDateTime } from '../domain/format';
import { STEP_LABELS } from '../domain/rules';
import type { RtvEvent } from '../domain/types';
import { ROLE_LABELS } from '../state/session';

const withNote = (label: string, note?: string) => (note ? `${label}: ${note}` : label);

export function eventText(e: RtvEvent): string {
  switch (e.kind) {
    case 'STEP': {
      const label = e.step ? STEP_LABELS[e.step] : 'เปลี่ยนสถานะ';
      const note = e.note?.replace(/^อัตโนมัติ:\s*/, '');
      return [e.auto ? `${label} (อัตโนมัติ)` : label, note].filter(Boolean).join(' — ');
    }
    case 'PICKUP_FAILED': return withNote('เก็บไม่สำเร็จ', e.note);
    case 'SHORT_BOX': return withNote('กล่องขาด', e.note);
    case 'FLAG_CLEARED': return withNote('ปิดธงกล่องขาด', e.note);
    case 'QTY_MISMATCH': return 'จำนวนชิ้นไม่ตรงเอกสาร';
    case 'BRAND_CONFIRMED': return 'Brand ยืนยันตามยอดที่คลังนับ';
    case 'RECOUNT_REQUESTED': return 'Brand ขอให้นับใหม่';
    case 'DOC_ADDED': return withNote('เพิ่มเลขเอกสาร', e.note);
    case 'PROMO_CONFIRMED': return 'ยืนยันยอด Promotion แล้ว';
    case 'CANCELLED': return withNote('ยกเลิก', e.note);
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
