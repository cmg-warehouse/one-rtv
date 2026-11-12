import { HOLD_LABELS, holds } from '../domain/rules';
import type { Rtv } from '../domain/types';

export default function HoldBanner({ rtv }: { rtv: Rtv }) {
  const active = holds(rtv);
  if (active.length === 0) return null;
  return (
    <div className="hold-banner" role="status">
      {active.map(h => <span key={h} className="badge badge-alert">{HOLD_LABELS[h]}</span>)}
    </div>
  );
}
