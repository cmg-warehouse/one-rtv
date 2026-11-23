import { usePortal } from '../state/portal';
import { Link } from 'react-router-dom';
import PhoneFrame from '../components/PhoneFrame';
import { STORES } from '../data/masters';
import { fmtDate, fmtDateTime } from '../domain/format';
import { tr } from '../i18n';
import { PROMO_STATUS_LABELS, totals } from '../domain/promo';
import { CARRIER_LABELS, canAct, nextStep } from '../domain/rules';
import type { Rtv } from '../domain/types';
import { CARRIER_ACTORS, useSession } from '../state/session';
import { usePromoList, useRtvList } from '../state/useRtvs';
import { venueOf } from './PromoList';

function JobCard({ rtv }: { rtv: Rtv }) {
  const store = STORES.find(s => s.id === rtv.storeId)?.name ?? rtv.storeId;
  return (
    <div className="card" data-testid="job-card">
      <p><strong>{rtv.carrier ? CARRIER_LABELS[rtv.carrier] : '—'}</strong></p>
      <p><Link className="mono" to={`/rtv/${rtv.id}`}>{rtv.id}</Link></p>
      <p>{store}</p>
      <p className="muted">{tr(`${rtv.boxes.length} กล่อง`, `${rtv.boxes.length} boxes`)} · {tr('นัดรับ', 'Pickup')} {rtv.pickupDate ? fmtDate(rtv.pickupDate) : '—'}</p>
    </div>
  );
}

export default function CarrierJobs() {
  const { rtvs } = useRtvList();
  const { carrierActor, setCarrierActor, identity } = useSession();
  const { events } = usePromoList();
  const { account } = usePortal();
  // Promotion pickups are one job for the whole event (booked trucks = งานจองรถ).
  const mine = rtvs.filter(r => !r.promoId && canAct(r, 'CARRIER', identity));
  const promos = identity.carrier === 'AGREED' ? events.filter(e => e.status === 'FORWARDED' || e.status === 'CONFIRMED') : [];
  const groups = [
    { title: tr('รอรับงาน', 'Waiting to accept'), jobs: mine.filter(r => nextStep(r)?.step === 4) },
    { title: tr('รอเก็บสินค้า', 'Waiting for pickup'), jobs: mine.filter(r => nextStep(r)?.step === 5) },
  ];
  return (
    <PhoneFrame>
      <h1>{tr('งานขนส่ง', 'Carrier jobs')}</h1>
      {/* Signed in (live-system preview), the carrier company is the account's own. */}
      {account ? <p className="muted">{CARRIER_LABELS[carrierActor]}</p> : <div className="carrier-toggle">
        {CARRIER_ACTORS.map(c => (
          <button key={c} type="button" className={`btn${carrierActor === c ? ' btn-primary' : ''}`}
            aria-pressed={carrierActor === c} onClick={() => setCarrierActor(c)}>{CARRIER_LABELS[c]}</button>
        ))}
      </div>}
      {promos.length > 0 && (
        <section>
          <h2>{tr('งานเก็บโปร', 'Promo pickups')} ({promos.length})</h2>
          {promos.map(e => (
            <div key={e.id} className="card" data-testid="promo-card">
              <p><Link to={`/promo/${e.id}`}><strong>{e.name}</strong></Link></p>
              <p>{venueOf(e)} · {fmtDateTime(e.pickupAt)}</p>
              <p className="muted">{tr(`${e.lines.length} แบรนด์`, `${e.lines.length} brands`)} · {tr(`${totals(e).pallets} พาเลท`, `${totals(e).pallets} pallets`)} · {PROMO_STATUS_LABELS[e.status]}</p>
            </div>
          ))}
        </section>
      )}
      {mine.length === 0 && promos.length === 0 && <div className="card empty">{tr('ไม่มีงานสำหรับขนส่งรายนี้', 'No jobs for this carrier')}</div>}
      {groups.filter(g => g.jobs.length > 0).map(g => (
        <section key={g.title}>
          <h2>{g.title} ({g.jobs.length})</h2>
          {g.jobs.map(r => <JobCard key={r.id} rtv={r} />)}
        </section>
      ))}
    </PhoneFrame>
  );
}
