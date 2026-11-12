import { useState } from 'react';
import { HOLD_LABELS, holds } from '../../domain/rules';
import type { Hold, Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';

function QtySection({ rtv, onDone, primary }: { rtv: Rtv; onDone: () => void; primary: boolean }) {
  const { run, error, busy } = useAct(rtv, onDone);
  return (
    <div className="card">
      <h2>{HOLD_LABELS.WAIT_BRAND_QTY}</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>กล่อง</th><th className="num">ตามเอกสาร</th><th className="num">คลังนับได้</th></tr></thead>
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
          onClick={() => { void run({ type: 'brandConfirmQty' }); }}>ยืนยันตามยอดที่คลังนับ</button>
        <button type="button" className="btn" disabled={busy}
          onClick={() => { void run({ type: 'brandRequestRecount' }); }}>ขอให้นับใหม่</button>
      </div>
    </div>
  );
}

function NoteSection({ rtv, onDone, primary }: { rtv: Rtv; onDone: () => void; primary: boolean }) {
  const [value, setValue] = useState('');
  const { run, error, busy } = useAct(rtv, onDone);
  return (
    <div className="card">
      <h2>{HOLD_LABELS.WAIT_RTV_NOTE}</h2>
      <label className="field">RTV Note (ห้าง)
        <input value={value} onChange={e => setValue(e.target.value)} />
      </label>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour={primary ? 'primary' : undefined} disabled={busy}
        onClick={() => { void run({ type: 'addDoc', doc: { type: 'RTV_NOTE', value } }); }}>บันทึกเลข</button>
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
        onClick={() => { void run({ type: 'confirmPromo' }); }}>ยืนยันยอด Promotion</button>
    </div>
  );
}

const SECTIONS: Record<Hold, typeof QtySection> = {
  WAIT_BRAND_QTY: QtySection,
  WAIT_RTV_NOTE: NoteSection,
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
