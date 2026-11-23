import { useState } from 'react';
import { BRAND_DOC_TYPES, canCancel as cancellable, DOC_LABELS, isMallGroup, matchesIdentity, type Identity } from '../../domain/rules';
import type { DocType, Role, Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';
import { tr } from '../../i18n';

function CancelAction({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const { run, error, busy } = useAct(rtv, onDone);
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>{tr('ยกเลิกคำสั่ง', 'Cancel order')}</button>;
  return (
    <div className="secondary-form">
      <label className="field">{tr('เหตุผลที่ยกเลิก', 'Reason for cancelling')}
        <input value={reason} onChange={e => setReason(e.target.value)} />
      </label>
      <ErrorLine message={error} />
      <button type="button" className="btn" disabled={busy}
        onClick={() => { void run({ type: 'cancel', reason }); }}>{tr('ยืนยันยกเลิก', 'Confirm cancel')}</button>
    </div>
  );
}

function ClearShortFlag({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const { run, error, busy } = useAct(rtv, onDone);
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>{tr('ปิดธงกล่องขาด', 'Clear short-box flag')}</button>;
  return (
    <div className="secondary-form">
      <label className="field">{tr('หมายเหตุ', 'Note')}
        <input value={note} onChange={e => setNote(e.target.value)} />
      </label>
      <ErrorLine message={error} />
      <button type="button" className="btn" disabled={busy}
        onClick={() => { void run({ type: 'clearShortFlag', note }); }}>{tr('ยืนยันปิดธง', 'Confirm clear flag')}</button>
    </div>
  );
}

function AddDoc({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  // MIM is recorded per box (Shop / Temp shop); the other documents belong to the whole RTV.
  const mimOk = !isMallGroup(rtv.channel);
  const [type, setType] = useState<DocType | 'BOX_MIM'>(mimOk ? 'BOX_MIM' : BRAND_DOC_TYPES[0]);
  const [box, setBox] = useState(rtv.boxes[0]?.no ?? '');
  const [value, setValue] = useState('');
  const { run, error, busy } = useAct(rtv, onDone);
  const save = () => (type === 'BOX_MIM'
    ? run({ type: 'setBoxMims', mims: { [box]: value } })
    : run({ type: 'addDoc', doc: { type, value } }));
  if (!open) return <button type="button" className="btn" onClick={() => setOpen(true)}>{tr('เพิ่มเลขเอกสาร', 'Add document number')}</button>;
  return (
    <div className="secondary-form">
      <label className="field">{tr('ประเภทเอกสาร', 'Document type')}
        <select value={type} onChange={e => setType(e.target.value as DocType | 'BOX_MIM')}>
          {mimOk && <option value="BOX_MIM">{tr('MIM (รายกล่อง)', 'MIM (per box)')}</option>}
          {BRAND_DOC_TYPES.map(t => <option key={t} value={t}>{DOC_LABELS[t]}</option>)}
        </select>
      </label>
      {type === 'BOX_MIM' && (
        <label className="field">{tr('กล่อง', 'Box')}
          <select value={box} onChange={e => setBox(e.target.value)}>
            {rtv.boxes.map(b => <option key={b.no} value={b.no}>{b.no.slice(-3)}{b.mim ? tr(` (มี MIM ${b.mim})`, ` (has MIM ${b.mim})`) : tr(' (ยังไม่มี MIM)', ' (no MIM yet)')}</option>)}
          </select>
        </label>
      )}
      <label className="field">{tr('เลขเอกสาร', 'Document number')}
        <input value={value} onChange={e => setValue(e.target.value)} />
      </label>
      <ErrorLine message={error} />
      <button type="button" className="btn" disabled={busy}
        onClick={() => { void save(); }}>{tr('บันทึกเลขเอกสาร', 'Save document number')}</button>
    </div>
  );
}

interface Props { rtv: Rtv; role: Role; identity: Identity; onDone: () => void }

export default function SecondaryActions({ rtv, role, identity, onDone }: Props) {
  const own = matchesIdentity(rtv, role, identity);
  const canCancel = (role === 'BRAND' || role === 'CS') && own && cancellable(rtv);
  const canClear = role === 'CS' && rtv.shortBoxes > 0;
  const canAddDoc = role === 'BRAND' && own;
  if (!canCancel && !canClear && !canAddDoc) return null;
  return (
    <div className="card secondary-actions">
      <h2>{tr('การดำเนินการอื่น', 'Other actions')}</h2>
      <div className="secondary-row">
        {canAddDoc && <AddDoc rtv={rtv} onDone={onDone} />}
        {canClear && <ClearShortFlag rtv={rtv} onDone={onDone} />}
        {canCancel && <CancelAction rtv={rtv} onDone={onDone} />}
      </div>
    </div>
  );
}
