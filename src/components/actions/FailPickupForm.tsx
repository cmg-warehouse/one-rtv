import { useState } from 'react';
import type { Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';

const REASONS = ['ร้านปิด', 'ของยังไม่พร้อม', 'ไม่พบผู้ส่งมอบ', 'อื่นๆ'];

/** Pickup could not be completed: the reason sends the RTV back to CS. */
export default function FailPickupForm({ rtv, onDone, block }: { rtv: Rtv; onDone: () => void; block?: boolean }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState('');
  const [other, setOther] = useState('');
  const { run, error, busy } = useAct(rtv, onDone);
  if (!open) return <button type="button" className={`btn${block ? ' btn-block' : ''}`} onClick={() => setOpen(true)}>เก็บไม่สำเร็จ</button>;
  const reason = choice === 'อื่นๆ' ? other : choice;
  return (
    <div className="secondary-form">
      <fieldset className="field">
        <legend>เหตุผล</legend>
        {REASONS.map(r => (
          <label key={r} className="radio-row">
            <input type="radio" name="fail-reason" checked={choice === r} onChange={() => setChoice(r)} />{r}
          </label>
        ))}
      </fieldset>
      {choice === 'อื่นๆ' && (
        <label className="field">ระบุเหตุผล
          <input value={other} onChange={e => setOther(e.target.value)} />
        </label>
      )}
      <ErrorLine message={error} />
      <button type="button" className={`btn${block ? ' btn-block' : ''}`} disabled={busy}
        onClick={() => { void run({ type: 'failPickup', reason }); }}>ยืนยันเก็บไม่สำเร็จ</button>
    </div>
  );
}
