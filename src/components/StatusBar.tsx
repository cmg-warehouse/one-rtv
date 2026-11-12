import { stepsFor } from '../domain/rules';
import type { Rtv } from '../domain/types';

export default function StatusBar({ rtv }: { rtv: Rtv }) {
  const defs = stepsFor(rtv.channel, rtv.carrier);
  const next = defs.find(d => d.step > rtv.step && d.mode !== 'SKIPPED');
  const current = rtv.cancelled || rtv.step === 10 ? undefined : next?.step;
  return (
    <ol className="status-bar">
      {defs.map(d => {
        const skipped = d.mode === 'SKIPPED';
        const state = skipped ? 'skipped' : d.step <= rtv.step ? 'done' : d.step === current ? 'current' : 'todo';
        const label = d.mode === 'AUTO' ? `${d.label} (อัตโนมัติ)` : d.label;
        return (
          <li key={d.step} data-testid="status-step" data-state={state}
            className={`status-seg status-${state}`}
            aria-label={skipped ? `${d.label} (ข้าม)` : label}>
            <span className="status-no">{d.step}</span>
            <span className="status-label" aria-hidden="true">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
