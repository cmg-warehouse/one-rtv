import { useState, type ReactNode } from 'react';
import type { StepPayload } from '../../domain/machine';
import type { Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';

interface Props {
  rtv: Rtv;
  step: 5 | 6 | 8;
  title: string;
  label: string;
  submitLabel: string;
  onDone: () => void;
  mobile?: boolean;
  extra?: ReactNode;
}

/** Shared "how many boxes did you get" form for steps 5, 6 and 8. Sends the raw parsed number so the machine's Thai error shows. */
export default function BoxCountForm({ rtv, step, title, label, submitLabel, onDone, mobile, extra }: Props) {
  const total = rtv.boxes.length;
  const [value, setValue] = useState(String(total));
  const { run, error, busy } = useAct(rtv, onDone);
  const n = value.trim() === '' ? NaN : Number(value);
  const short = Number.isInteger(n) && n >= 1 && n < total ? total - n : 0;
  const payload: StepPayload = { step, boxes: n };
  const button = (
    <button type="button" className={`btn btn-primary${mobile ? ' btn-block' : ''}`} data-tour="primary" disabled={busy}
      onClick={() => { void run({ type: 'advance', payload }); }}>{submitLabel}</button>
  );
  return (
    <div className="card">
      <h2>{title}</h2>
      <label className="field">{label}
        <input type="number" min={1} value={value} onChange={e => setValue(e.target.value)} />
      </label>
      <p className="muted">จากทั้งหมด {total} กล่อง</p>
      {short > 0 && <p className="warn short-preview">กล่องขาด {short} กล่อง — ระบบจะแจ้ง CS และ Brand</p>}
      <ErrorLine message={error} />
      {mobile ? <div className="bottom-bar"><div className="bottom-bar-inner">{button}{extra}</div></div> : <>{button}{extra}</>}
    </div>
  );
}
