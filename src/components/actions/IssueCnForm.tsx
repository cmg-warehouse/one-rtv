import { useState } from 'react';
import { CN_LABELS, DOC_LABELS, HOLD_LABELS, cnType, holds, requiredDocs } from '../../domain/rules';
import type { DocType, Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';

/** Step 10 for Admin CN: checklist of documents already held, one input per document typed at CN time. */
export default function IssueCnForm({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const cn = cnType(rtv.channel, rtv.saleType);
  const req = requiredDocs(cn);
  const [values, setValues] = useState<Partial<Record<DocType, string>>>({});
  const { run, error, busy } = useAct(rtv, onDone);
  const active = holds(rtv);
  return (
    <div className="card">
      <h2>ออก CN — {CN_LABELS[cn]}</h2>
      <ul className="doc-checklist">
        {req.before.map(t => {
          const have = rtv.docs.some(d => d.type === t);
          return (
            <li key={t}>{DOC_LABELS[t]}: <span className={have ? 'ok' : 'error'}>{have ? '✓' : 'ขาด'}</span></li>
          );
        })}
      </ul>
      <div className="form-grid">
        {req.atCn.map(t => (
          <label key={t} className="field">{DOC_LABELS[t]}
            <input value={values[t] ?? ''} onChange={e => setValues(v => ({ ...v, [t]: e.target.value }))} />
          </label>
        ))}
      </div>
      {active.length > 0 && <p className="warn">{`ยังออก CN ไม่ได้: ${active.map(h => HOLD_LABELS[h]).join(', ')}`}</p>}
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy || active.length > 0}
        onClick={() => { void run({ type: 'advance', payload: { step: 10, docs: values } }); }}>ออก CN และปิดงาน</button>
    </div>
  );
}
