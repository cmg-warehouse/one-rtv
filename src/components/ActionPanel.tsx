import { Link } from 'react-router-dom';
import { canAct, canSeeCnForm, holds, isClosed, nextStep } from '../domain/rules';
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
import { tr } from '../i18n';

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
  const { role, identity } = useSession();
  if (rtv.cancelled || isClosed(rtv)) return null;
  const mine = canAct(rtv, role, identity);
  // While holds are active owner() is BRAND, but Admin CN still sees the (disabled) CN form.
  const cnBlocked = canSeeCnForm(rtv, role);
  const brandHolds = mine && role === 'BRAND' && holds(rtv).length > 0;
  const hasSlip = role === 'CS' && rtv.docs.some(d => d.type === 'PICKUP_SLIP');
  if (rtv.promoId && rtv.step < 5) {
    return (
      <div className="card action-card">
        <h2>{tr('จัดการรวมที่งานเก็บโปร', 'Managed together in the promo pickup')}</h2>
        <p>{tr(`RTV นี้อยู่ในงานเก็บโปร ${rtv.promoId} · ส่งต่อขนส่ง ยืนยันรถ และบันทึกการเก็บ ทำพร้อมกันทุกแบรนด์ในงาน`, `This RTV is in promo pickup ${rtv.promoId} · handing over to the carrier, confirming the truck and recording the pickup are done together for every brand in the job`)}</p>
        <Link to={`/promo/${rtv.promoId}`} className="btn btn-primary" data-tour="primary">{tr('ไปที่งานเก็บโปร', 'Go to the promo pickup')}</Link>
        <SecondaryActions rtv={rtv} role={role} identity={identity} onDone={onDone} />
      </div>
    );
  }
  return (
    <>
      {brandHolds ? <BrandHoldActions rtv={rtv} onDone={onDone} />
        : cnBlocked ? <IssueCnForm rtv={rtv} onDone={onDone} />
        : mine && <PrimaryForm rtv={rtv} onDone={onDone} />}
      {hasSlip && <p><Link to={`/slip/${rtv.id}`}>{tr('พิมพ์ใบแจ้งเก็บ', 'Print pickup slip')}</Link></p>}
      <SecondaryActions rtv={rtv} role={role} identity={identity} onDone={onDone} />
    </>
  );
}
