import type { Rtv } from '../../domain/types';
import { useSession } from '../../state/session';
import BottomBar from '../BottomBar';
import { useInPhone } from '../PhoneFrame';
import BoxCountForm from './BoxCountForm';
import FailPickupForm from './FailPickupForm';
import { ErrorLine, useAct } from './useAct';

/** Steps 4 and 5: the carrier accepts the job, then collects the goods. Used by CS for PARCEL and by the carrier. */
export default function PickupForms({ rtv, step, onDone }: { rtv: Rtv; step: 4 | 5; onDone: () => void }) {
  const { role } = useSession();
  const carrier = role === 'CARRIER';
  const inPhone = useInPhone();
  const { run, error, busy } = useAct(rtv, onDone);
  const fail = <FailPickupForm rtv={rtv} onDone={onDone} block={inPhone} />;

  if (step === 5) {
    return (
      <BoxCountForm rtv={rtv} step={5} title="เก็บสินค้า" label="จำนวนกล่องที่เก็บได้"
        submitLabel={carrier ? 'เก็บสินค้าแล้ว' : 'บันทึกว่าเก็บสินค้าแล้ว'} onDone={onDone} extra={fail} />
    );
  }
  const button = (
    <button type="button" className={`btn btn-primary${inPhone ? ' btn-block' : ''}`} data-tour="primary" disabled={busy}
      onClick={() => { void run({ type: 'advance', payload: { step: 4 } }); }}>
      {carrier ? 'รับงาน' : 'บันทึกว่าขนส่งรับงานแล้ว'}
    </button>
  );
  return (
    <div className="card">
      <h2>รับงานขนส่ง</h2>
      <ErrorLine message={error} />
      <BottomBar>{button}</BottomBar>
      {fail}
    </div>
  );
}
