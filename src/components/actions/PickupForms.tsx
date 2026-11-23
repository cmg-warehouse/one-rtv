import type { Rtv } from '../../domain/types';
import { useSession } from '../../state/session';
import BottomBar from '../BottomBar';
import { useInPhone } from '../PhoneFrame';
import BoxCountForm from './BoxCountForm';
import FailPickupForm from './FailPickupForm';
import { ErrorLine, useAct } from './useAct';
import { tr } from '../../i18n';

/** Steps 4 and 5: the carrier accepts the job, then collects the goods. Used by CS for PARCEL and by the carrier. */
export default function PickupForms({ rtv, step, onDone }: { rtv: Rtv; step: 4 | 5; onDone: () => void }) {
  const { role } = useSession();
  const carrier = role === 'CARRIER';
  const inPhone = useInPhone();
  const { run, error, busy } = useAct(rtv, onDone);
  const fail = <FailPickupForm rtv={rtv} onDone={onDone} block={inPhone} />;

  if (step === 5) {
    return (
      <BoxCountForm rtv={rtv} step={5} title={tr('เก็บสินค้า', 'Collect goods')} label={tr('จำนวนกล่องที่เก็บได้', 'Boxes collected')}
        submitLabel={carrier ? tr('เก็บสินค้าแล้ว', 'Goods collected') : tr('บันทึกว่าเก็บสินค้าแล้ว', 'Record goods as collected')} onDone={onDone} extra={fail} />
    );
  }
  const button = (
    <button type="button" className={`btn btn-primary${inPhone ? ' btn-block' : ''}`} data-tour="primary" disabled={busy}
      onClick={() => { void run({ type: 'advance', payload: { step: 4 } }); }}>
      {carrier ? tr('รับงาน', 'Accept job') : tr('บันทึกว่าขนส่งรับงานแล้ว', 'Record carrier as accepted')}
    </button>
  );
  return (
    <div className="card">
      <h2>{tr('รับงานขนส่ง', 'Accept carrier job')}</h2>
      <ErrorLine message={error} />
      <BottomBar>{button}</BottomBar>
      {fail}
    </div>
  );
}
