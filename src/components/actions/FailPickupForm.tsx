import { useState } from 'react';
import type { Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';
import { tr } from '../../i18n';

const REASONS: ReadonlyArray<readonly [string, string]> = [['ร้านปิด', 'Store closed'], ['ของยังไม่พร้อม', 'Goods not ready'], ['ไม่พบผู้ส่งมอบ', 'Handover person not found'], ['อื่นๆ', 'Other']];
const OTHER = 'อื่นๆ';

/** Pickup could not be completed: the reason sends the RTV back to CS. */
export default function FailPickupForm({ rtv, onDone, block }: { rtv: Rtv; onDone: () => void; block?: boolean }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState('');
  const [other, setOther] = useState('');
  const { run, error, busy } = useAct(rtv, onDone);
  if (!open) return <button type="button" className={`btn${block ? ' btn-block' : ''}`} onClick={() => setOpen(true)}>{tr('เก็บไม่สำเร็จ', 'Pickup failed')}</button>;
  const picked = REASONS.find(r => r[0] === choice);
  const reason = choice === OTHER ? other : picked ? tr(picked[0], picked[1]) : choice;
  return (
    <div className="secondary-form">
      <fieldset className="field">
        <legend>{tr('เหตุผล', 'Reason')}</legend>
        {REASONS.map(([th, en]) => (
          <label key={th} className="radio-row">
            <input type="radio" name="fail-reason" checked={choice === th} onChange={() => setChoice(th)} />{tr(th, en)}
          </label>
        ))}
      </fieldset>
      {choice === OTHER && (
        <label className="field">{tr('ระบุเหตุผล', 'Specify the reason')}
          <input value={other} onChange={e => setOther(e.target.value)} />
        </label>
      )}
      <ErrorLine message={error} />
      <button type="button" className={`btn${block ? ' btn-block' : ''}`} disabled={busy}
        onClick={() => { void run({ type: 'failPickup', reason }).then(ok => { if (ok) { setOpen(false); setChoice(''); setOther(''); } }); }}>{tr('ยืนยันเก็บไม่สำเร็จ', 'Confirm pickup failed')}</button>
    </div>
  );
}
