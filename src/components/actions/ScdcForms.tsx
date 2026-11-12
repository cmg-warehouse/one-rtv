import type { Rtv } from '../../domain/types';
import BoxCountForm from './BoxCountForm';
import { ErrorLine, useAct } from './useAct';

/** SCDC: step 6 receives the boxes, step 7 forwards them to CMG. */
export default function ScdcForms({ rtv, step, onDone }: { rtv: Rtv; step: 6 | 7; onDone: () => void }) {
  const { run, error, busy } = useAct(rtv, onDone);
  if (step === 6) {
    return <BoxCountForm rtv={rtv} step={6} title="SCDC รับสินค้า" label="จำนวนกล่องที่รับ" submitLabel="รับเข้า SCDC" onDone={onDone} />;
  }
  return (
    <div className="card">
      <h2>ส่งต่อ CMG</h2>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void run({ type: 'advance', payload: { step: 7 } }); }}>ส่งต่อ CMG</button>
    </div>
  );
}
