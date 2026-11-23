import { useState, type ReactNode } from 'react';
import type { StepPayload } from '../../domain/machine';
import type { Rtv } from '../../domain/types';
import BottomBar from '../BottomBar';
import { useInPhone } from '../PhoneFrame';
import { ErrorLine, useAct } from './useAct';
import { tr } from '../../i18n';

interface Props {
  rtv: Rtv;
  step: 5 | 6 | 8;
  title: string;
  label: string;
  submitLabel: string;
  onDone: () => void;
  extra?: ReactNode;
}

/** Shared "how many boxes did you get" form for steps 5, 6 and 8. Sends the raw parsed number so the machine's Thai error shows. */
export default function BoxCountForm({ rtv, step, title, label, submitLabel, onDone, extra }: Props) {
  const total = rtv.boxes.length;
  const [value, setValue] = useState(String(total));
  const { run, error, busy } = useAct(rtv, onDone);
  const inPhone = useInPhone();
  const n = value.trim() === '' ? NaN : Number(value);
  const short = Number.isInteger(n) && n >= 1 && n < total ? total - n : 0;
  const payload: StepPayload = { step, boxes: n };
  const button = (
    <button type="button" className={`btn btn-primary${inPhone ? ' btn-block' : ''}`} data-tour="primary" disabled={busy}
      onClick={() => { void run({ type: 'advance', payload }); }}>{submitLabel}</button>
  );
  return (
    <div className="card">
      <h2>{title}</h2>
      <label className="field">{label}
        <input type="number" min={1} value={value} onChange={e => setValue(e.target.value)} />
      </label>
      <p className="muted">{tr(`จากทั้งหมด ${total} กล่อง`, `Out of ${total} ${total === 1 ? 'box' : 'boxes'}`)}</p>
      {short > 0 && <p className="warn short-preview">{tr(`กล่องขาด ${short} กล่อง — ระบบจะแจ้ง CS และ Brand`, `${short} short ${short === 1 ? 'box' : 'boxes'} — CS and Brand will be notified`)}</p>}
      <ErrorLine message={error} />
      <BottomBar>{button}</BottomBar>
      {extra}
    </div>
  );
}
