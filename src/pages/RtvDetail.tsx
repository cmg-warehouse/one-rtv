import { Link, useParams } from 'react-router-dom';
import BoxList from '../components/BoxList';
import DocRefTable from '../components/DocRefTable';
import HoldBanner from '../components/HoldBanner';
import StatusBar from '../components/StatusBar';
import Timeline from '../components/Timeline';
import { BRANDS, STORES } from '../data/masters';
import { fmtDate } from '../domain/format';
import { CARRIER_LABELS, CHANNEL_LABELS, CN_LABELS, cnType, isClosed, owner } from '../domain/rules';
import { ROLE_LABELS } from '../state/session';
import { useRtv } from '../state/useRtvs';

export default function RtvDetail() {
  const { id = '' } = useParams();
  const { rtv } = useRtv(id);
  if (rtv === undefined) return <p className="muted">กำลังโหลด…</p>;
  if (rtv === null) {
    return (
      <div className="card empty">
        <p>ไม่พบเลข RTV นี้</p>
        <Link to="/">กลับไปหน้ารายการ</Link>
      </div>
    );
  }
  const own = owner(rtv);
  const ownerText = rtv.cancelled ? 'ยกเลิกแล้ว' : isClosed(rtv) ? 'ปิดงานแล้ว' : own ? `ค้างที่: ${ROLE_LABELS[own]}` : '—';
  const brand = BRANDS.find(b => b.id === rtv.brandId)?.name ?? rtv.brandId;
  const store = STORES.find(s => s.id === rtv.storeId)?.name ?? rtv.storeId;
  return (
    <div className="rtv-detail">
      <div className="card">
        <h1 className="rtv-id mono">{rtv.id}</h1>
        <div className="chips">
          <span className="badge badge-pending">{CHANNEL_LABELS[rtv.channel]}</span>
          <span className="badge badge-pending">{rtv.saleType === 'PROMO' ? 'Promotion' : 'Normal'}</span>
          <span className="badge badge-done">{CN_LABELS[cnType(rtv.channel, rtv.saleType)]}</span>
          <span className={`badge ${rtv.cancelled ? 'badge-failed' : isClosed(rtv) ? 'badge-transit' : 'badge-assigned'}`}>{ownerText}</span>
          {rtv.shortBoxes > 0 && <span className="badge badge-alert">กล่องขาด {rtv.shortBoxes} กล่อง</span>}
        </div>
        <p className="muted rtv-meta">
          {brand} · {store} · ขนส่ง: {rtv.carrier ? CARRIER_LABELS[rtv.carrier] : '—'}
          {rtv.pickupDate ? ` · นัดรับ ${fmtDate(rtv.pickupDate)}` : ''} · เปิดเมื่อ {fmtDate(rtv.createdAt)}
        </p>
        {rtv.cancelled && <p className="error">ยกเลิก: {rtv.cancelled.reason}</p>}
      </div>
      <HoldBanner rtv={rtv} />
      <div className="card"><StatusBar rtv={rtv} /></div>
      <div data-testid="actions" />
      <div className="card"><h2>เลขเอกสารอ้างอิง</h2><DocRefTable rtv={rtv} /></div>
      <div className="card"><h2>กล่อง</h2><BoxList boxes={rtv.boxes} /></div>
      <div className="card"><h2>ประวัติรายการ</h2><Timeline events={rtv.events} /></div>
    </div>
  );
}
