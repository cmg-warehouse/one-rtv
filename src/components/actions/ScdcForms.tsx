import type { Rtv } from '../../domain/types';
import BoxCountForm from './BoxCountForm';
import { ErrorLine, useAct } from './useAct';
import { tr } from '../../i18n';

/** SCDC: step 6 receives the boxes, step 7 forwards them to CMG. */
export default function ScdcForms({ rtv, step, onDone }: { rtv: Rtv; step: 6 | 7; onDone: () => void }) {
  const { run, error, busy } = useAct(rtv, onDone);
  if (step === 6) {
    return <BoxCountForm rtv={rtv} step={6} title={tr('SCDC รับสินค้า', 'SCDC receives goods')} label={tr('จำนวนกล่องที่รับ', 'Boxes received')} submitLabel={tr('รับเข้า SCDC', 'Receive at SCDC')} onDone={onDone} />;
  }
  return (
    <div className="card">
      <h2>{tr('ส่งต่อ CMG', 'Forward to CMG')}</h2>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void run({ type: 'advance', payload: { step: 7 } }); }}>{tr('ส่งต่อ CMG', 'Forward to CMG')}</button>
    </div>
  );
}
