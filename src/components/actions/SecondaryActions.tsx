import { useState } from 'react';
import { BRAND_DOC_TYPES, canCancel as cancellable, DOC_LABELS } from '../../domain/rules';
import type { DocType, Role, Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';

function CancelAction({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { run, error, busy } = useAct(rtv, onDone);
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>ยกเลิกคำสั่ง</button>;
  return (
    <div className="secondary-form">
      <label className="field">เหตุผลที่ยกเลิก
        <input value={reason} onChange={e => setReason(e.target.value)} />
      </label>
      <ErrorLine message={error} />
      <button type="button" className="btn" disabled={busy}
        onClick={() => { void run({ type: 'cancel', reason }); }}>ยืนยันยกเลิก</button>
    </div>
  );
}

function ClearShortFlag({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const { run, error, busy } = useAct(rtv, onDone);
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>ปิดธงกล่องขาด</button>;
  return (
    <div className="secondary-form">
      <label className="field">หมายเหตุ
        <input value={note} onChange={e => setNote(e.target.value)} />
      </label>
      <ErrorLine message={error} />
      <button type="button" className="btn" disabled={busy}
        onClick={() => { void run({ type: 'clearShortFlag', note }); }}>ยืนยันปิดธง</button>
    </div>
  );
}

function AddDoc({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DocType>('MIM');
  const [value, setValue] = useState('');
  const { run, error, busy } = useAct(rtv, onDone);
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>เพิ่มเลขเอกสาร</button>;
  return (
    <div className="secondary-form">
      <label className="field">ประเภทเอกสาร
        <select value={type} onChange={e => setType(e.target.value as DocType)}>
          {BRAND_DOC_TYPES.map(t => <option key={t} value={t}>{DOC_LABELS[t]}</option>)}
        </select>
      </label>
      <label className="field">เลขเอกสาร
        <input value={value} onChange={e => setValue(e.target.value)} />
      </label>
      <ErrorLine message={error} />
      <button type="button" className="btn" disabled={busy}
        onClick={() => { void run({ type: 'addDoc', doc: { type, value } }); }}>บันทึกเลขเอกสาร</button>
    </div>
  );
}

export default function SecondaryActions({ rtv, role, onDone }: { rtv: Rtv; role: Role; onDone: () => void }) {
  const canCancel = (role === 'BRAND' || role === 'CS') && cancellable(rtv);
  const canClear = role === 'CS' && rtv.shortBoxes > 0;
  const canAddDoc = role === 'BRAND';
  if (!canCancel && !canClear && !canAddDoc) return null;
  return (
    <div className="card secondary-actions">
      <h2>การดำเนินการอื่น</h2>
      <div className="secondary-row">
        {canAddDoc && <AddDoc rtv={rtv} onDone={onDone} />}
        {canClear && <ClearShortFlag rtv={rtv} onDone={onDone} />}
        {canCancel && <CancelAction rtv={rtv} onDone={onDone} />}
      </div>
    </div>
  );
}
