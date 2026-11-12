import { Link } from 'react-router-dom';
import { isClosed, nextStep, owner } from '../domain/rules';
import type { Rtv } from '../domain/types';
import { useSession } from '../state/session';
import AssignCarrierForm from './actions/AssignCarrierForm';
import IssueSlipAction from './actions/IssueSlipAction';
import PickupForms from './actions/PickupForms';
import SecondaryActions from './actions/SecondaryActions';

function PrimaryForm({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const step = nextStep(rtv)?.step;
  switch (step) {
    case 2: return <AssignCarrierForm rtv={rtv} onDone={onDone} />;
    case 3: return <IssueSlipAction rtv={rtv} onDone={onDone} />;
    case 4:
    case 5: return <PickupForms rtv={rtv} step={step} onDone={onDone} />;
    default: return null; // steps 6-10 and Brand hold actions: later tasks
  }
}

/** Dispatcher: the step form for the role that owns the RTV now, plus that role's secondary actions. */
export default function ActionPanel({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const { role } = useSession();
  if (rtv.cancelled || isClosed(rtv)) return null;
  const mine = owner(rtv) === role;
  const hasSlip = role === 'CS' && rtv.docs.some(d => d.type === 'PICKUP_SLIP');
  return (
    <>
      {mine && <PrimaryForm rtv={rtv} onDone={onDone} />}
      {hasSlip && <p><Link to={`/slip/${rtv.id}`}>พิมพ์ใบแจ้งเก็บ</Link></p>}
      <SecondaryActions rtv={rtv} role={role} onDone={onDone} />
    </>
  );
}
