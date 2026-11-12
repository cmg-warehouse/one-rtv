import { Link } from 'react-router-dom';
import { DEMO_BRAND_ID } from '../data/masters';
import { holds, isClosed, nextStep, owner } from '../domain/rules';
import type { Rtv } from '../domain/types';
import { useSession } from '../state/session';
import AssignCarrierForm from './actions/AssignCarrierForm';
import BrandHoldActions from './actions/BrandHoldActions';
import IssueCnForm from './actions/IssueCnForm';
import IssueSlipAction from './actions/IssueSlipAction';
import PickupForms from './actions/PickupForms';
import ScdcForms from './actions/ScdcForms';
import SecondaryActions from './actions/SecondaryActions';
import WarehouseCountForm from './actions/WarehouseCountForm';
import WarehouseReceiveForm from './actions/WarehouseReceiveForm';

function PrimaryForm({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const step = nextStep(rtv)?.step;
  switch (step) {
    case 2: return <AssignCarrierForm rtv={rtv} onDone={onDone} />;
    case 3: return <IssueSlipAction rtv={rtv} onDone={onDone} />;
    case 4:
    case 5: return <PickupForms rtv={rtv} step={step} onDone={onDone} />;
    case 6:
    case 7: return <ScdcForms rtv={rtv} step={step} onDone={onDone} />;
    case 8: return <WarehouseReceiveForm rtv={rtv} onDone={onDone} />;
    case 9: return <WarehouseCountForm rtv={rtv} onDone={onDone} />;
    case 10: return <IssueCnForm rtv={rtv} onDone={onDone} />;
    default: return null;
  }
}

/** Dispatcher: the step form for the role that owns the RTV now, plus that role's secondary actions. */
export default function ActionPanel({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const { role } = useSession();
  if (rtv.cancelled || isClosed(rtv)) return null;
  const mine = owner(rtv) === role;
  // While holds are active owner() is BRAND, but Admin CN still sees the (disabled) CN form.
  const cnBlocked = role === 'ADMIN_CN' && rtv.step === 9 && !mine;
  const brandHolds = role === 'BRAND' && rtv.brandId === DEMO_BRAND_ID && holds(rtv).length > 0;
  const hasSlip = role === 'CS' && rtv.docs.some(d => d.type === 'PICKUP_SLIP');
  return (
    <>
      {brandHolds ? <BrandHoldActions rtv={rtv} onDone={onDone} />
        : cnBlocked ? <IssueCnForm rtv={rtv} onDone={onDone} />
        : mine && <PrimaryForm rtv={rtv} onDone={onDone} />}
      {hasSlip && <p><Link to={`/slip/${rtv.id}`}>พิมพ์ใบแจ้งเก็บ</Link></p>}
      <SecondaryActions rtv={rtv} role={role} onDone={onDone} />
    </>
  );
}
