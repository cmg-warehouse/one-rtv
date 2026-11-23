import { useState } from 'react';
import { boxesMissingMim, DOC_LABELS, HOLD_LABELS, holds } from '../../domain/rules';
import type { DocType, Hold, Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';
import { tr } from '../../i18n';

function QtySection({ rtv, onDone, primary }: { rtv: Rtv; onDone: () => void; primary: boolean }) {
  const { run, error, busy } = useAct(rtv, onDone);
  return (
    <div className="card">
      <h2>{HOLD_LABELS.WAIT_BRAND_QTY}</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{tr('กล่อง', 'Box')}</th><th className="num">{tr('ตามเอกสาร', 'Per document')}</th><th className="num">{tr('คลังนับได้', 'Warehouse count')}</th></tr></thead>
          <tbody>
            {rtv.boxes.map(b => (
              <tr key={b.no}>
                <td className="mono">{b.no}</td>
                <td className="num">{b.expectedPcs}</td>
                <td className={`num${b.countedPcs !== b.expectedPcs ? ' count-diff' : ''}`}>{b.countedPcs ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorLine message={error} />
      <div className="secondary-row">
        <button type="button" className="btn btn-primary" data-tour={primary ? 'primary' : undefined} disabled={busy}
          onClick={() => { void run({ type: 'brandConfirmQty' }); }}>{tr('ยืนยันตามยอดที่คลังนับ', 'Confirm warehouse count')}</button>
        <button type="button" className="btn" disabled={busy}
          onClick={() => { void run({ type: 'brandRequestRecount' }); }}>{tr('ขอให้นับใหม่', 'Request recount')}</button>
      </div>
    </div>
  );
}

interface SectionProps { rtv: Rtv; onDone: () => void; primary: boolean }

/** A hold released by Brand typing one document number. */
function DocSection({ rtv, onDone, primary, hold, doc }: SectionProps & { hold: Hold; doc: DocType }) {
  const [value, setValue] = useState('');
  const { run, error, busy } = useAct(rtv, onDone);
  return (
    <div className="card">
      <h2>{HOLD_LABELS[hold]}</h2>
      <label className="field">{DOC_LABELS[doc]}
        <input value={value} onChange={e => setValue(e.target.value)} />
      </label>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour={primary ? 'primary' : undefined} disabled={busy}
        onClick={() => { void run({ type: 'addDoc', doc: { type: doc, value } }); }}>{tr('บันทึกเลข', 'Save number')}</button>
    </div>
  );
}

const NoteSection = (p: SectionProps) => <DocSection {...p} hold="WAIT_RTV_NOTE" doc="RTV_NOTE" />;
/** WAIT_MIM: one input per box that still has no MIM. */
function MimSection({ rtv, onDone, primary }: SectionProps) {
  const missing = boxesMissingMim(rtv);
  const [values, setValues] = useState<Record<string, string>>({});
  const { run, error, busy } = useAct(rtv, onDone);
  return (
    <div className="card">
      <h2>{HOLD_LABELS.WAIT_MIM}</h2>
      <p className="muted">{tr(`ยังไม่มี MIM ${missing.length} จาก ${rtv.boxes.length} กล่อง`, `${missing.length} of ${rtv.boxes.length} boxes still have no MIM`)}</p>
      <div className="form-grid">
        {missing.map(b => (
          <label key={b.no} className="field">{tr(`MIM กล่อง ${b.no.slice(-3)}`, `MIM for box ${b.no.slice(-3)}`)}
            <input value={values[b.no] ?? ''} onChange={e => setValues(v => ({ ...v, [b.no]: e.target.value }))} />
          </label>
        ))}
      </div>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour={primary ? 'primary' : undefined} disabled={busy}
        onClick={() => { void run({ type: 'setBoxMims', mims: values }); }}>{tr('บันทึกเลข MIM', 'Save MIM numbers')}</button>
    </div>
  );
}

function PromoSection({ rtv, onDone, primary }: { rtv: Rtv; onDone: () => void; primary: boolean }) {
  const { run, error, busy } = useAct(rtv, onDone);
  return (
    <div className="card">
      <h2>{HOLD_LABELS.WAIT_PROMO}</h2>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour={primary ? 'primary' : undefined} disabled={busy}
        onClick={() => { void run({ type: 'confirmPromo' }); }}>{tr('ยืนยันยอด Promotion', 'Confirm Promotion quantity')}</button>
    </div>
  );
}

const SECTIONS: Record<Hold, typeof QtySection> = {
  WAIT_BRAND_QTY: QtySection,
  WAIT_RTV_NOTE: NoteSection,
  WAIT_MIM: MimSection,
  WAIT_PROMO: PromoSection,
};

/** One section per active hold, in holds() order; only the first carries the tour's primary marker. */
export default function BrandHoldActions({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  return (
    <>
      {holds(rtv).map((h, i) => {
        const Section = SECTIONS[h];
        return <Section key={h} rtv={rtv} onDone={onDone} primary={i === 0} />;
      })}
    </>
  );
}
