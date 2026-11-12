import { daysBetween } from '../domain/format';
import { HOLD_LABELS, holds } from '../domain/rules';
import type { Rtv } from '../domain/types';

export default function HoldBanner({ rtv }: { rtv: Rtv }) {
  const active = holds(rtv);
  if (active.length === 0) return null;
  const since = [...rtv.events].reverse().find(e => e.kind === 'STEP' && e.step === 9)?.at ?? rtv.createdAt;
  const days = Math.floor(daysBetween(since, new Date().toISOString()));
  return (
    <div className="hold-banner" role="status">
      {active.map(h => (
        <div key={h} className="hold-row">
          <span className="badge badge-alert">{HOLD_LABELS[h]}</span>
          <span className="muted"> ผู้ดำเนินการ: Brand / ฝ่ายขาย · รอมาแล้ว {days} วัน</span>
        </div>
      ))}
    </div>
  );
}
