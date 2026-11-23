import { useState } from 'react';
import { CN_LABELS, DOC_LABELS, HOLD_LABELS, cnType, hasDoc, holds, requiredDocs } from '../../domain/rules';
import type { DocType, Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';
import { tr } from '../../i18n';

/** Step 10 for Admin CN: checklist of documents already held, one input per document typed at CN time. */
export default function IssueCnForm({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const cn = cnType(rtv.channel, rtv.saleType);
  const req = requiredDocs(cn);
  const [values, setValues] = useState<Partial<Record<DocType, string>>>({});
  const { run, error, busy } = useAct(rtv, onDone);
  const active = holds(rtv);
  const missing = req.before.filter(t => !hasDoc(rtv, t));
  const blocked = active.length > 0 || missing.length > 0;
  return (
    <div className="card">
      <h2>{tr('ออก CN', 'Issue CN')} — {CN_LABELS[cn]}</h2>
      <ul className="doc-checklist">
        {req.before.map(t => {
          const have = hasDoc(rtv, t);
          return (
            <li key={t}>{DOC_LABELS[t]}: <span className={have ? 'ok' : 'error'}>{have ? '✓' : tr('ขาด', 'Missing')}</span></li>
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
      {active.length > 0 && <p className="warn">{tr(`ยังออก CN ไม่ได้: ${active.map(h => HOLD_LABELS[h]).join(', ')}`, `Cannot issue CN yet: ${active.map(h => HOLD_LABELS[h]).join(', ')}`)}</p>}
      {missing.length > 0 && <p className="warn">{missing.map(t => tr(`ขาด ${DOC_LABELS[t]}`, `Missing ${DOC_LABELS[t]}`)).join(', ')}</p>}
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy || blocked}
        onClick={() => { void run({ type: 'advance', payload: { step: 10, docs: values } }); }}>{tr('ออก CN และปิดงาน', 'Issue CN and close')}</button>
    </div>
  );
}
