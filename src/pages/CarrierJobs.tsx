import { Link } from 'react-router-dom';
import PhoneFrame from '../components/PhoneFrame';
import { STORES } from '../data/masters';
import { fmtDate } from '../domain/format';
import { CARRIER_LABELS, canAct, nextStep } from '../domain/rules';
import type { Rtv } from '../domain/types';
import { CARRIER_ACTORS, useSession } from '../state/session';
import { useRtvList } from '../state/useRtvs';

function JobCard({ rtv }: { rtv: Rtv }) {
  const store = STORES.find(s => s.id === rtv.storeId)?.name ?? rtv.storeId;
  return (
    <div className="card" data-testid="job-card">
      <p><strong>{rtv.carrier ? CARRIER_LABELS[rtv.carrier] : '—'}</strong></p>
      <p><Link className="mono" to={`/rtv/${rtv.id}`}>{rtv.id}</Link></p>
      <p>{store}</p>
      <p className="muted">{rtv.boxes.length} กล่อง · นัดรับ {rtv.pickupDate ? fmtDate(rtv.pickupDate) : '—'}</p>
    </div>
  );
}

export default function CarrierJobs() {
  const { rtvs } = useRtvList();
  const { carrierActor, setCarrierActor, identity } = useSession();
  const mine = rtvs.filter(r => canAct(r, 'CARRIER', identity));
  const groups = [
    { title: 'รอรับงาน', jobs: mine.filter(r => nextStep(r)?.step === 4) },
    { title: 'รอเก็บสินค้า', jobs: mine.filter(r => nextStep(r)?.step === 5) },
  ];
  return (
    <PhoneFrame>
      <h1>งานขนส่ง</h1>
      <div className="carrier-toggle">
        {CARRIER_ACTORS.map(c => (
          <button key={c} type="button" className={`btn${carrierActor === c ? ' btn-primary' : ''}`}
            aria-pressed={carrierActor === c} onClick={() => setCarrierActor(c)}>{CARRIER_LABELS[c]}</button>
        ))}
      </div>
      {mine.length === 0 && <div className="card empty">ไม่มีงานสำหรับขนส่งรายนี้</div>}
      {groups.filter(g => g.jobs.length > 0).map(g => (
        <section key={g.title}>
          <h2>{g.title} ({g.jobs.length})</h2>
          {g.jobs.map(r => <JobCard key={r.id} rtv={r} />)}
        </section>
      ))}
    </PhoneFrame>
  );
}
