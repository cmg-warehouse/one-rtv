import { Link, useParams } from 'react-router-dom';
import ActionPanel from '../components/ActionPanel';
import BoxList from '../components/BoxList';
import DocRefTable from '../components/DocRefTable';
import HoldBanner from '../components/HoldBanner';
import PhoneFrame from '../components/PhoneFrame';
import StatusBar from '../components/StatusBar';
import Timeline from '../components/Timeline';
import { BRANDS, STORES } from '../data/masters';
import { fmtDate } from '../domain/format';
import { HUBS } from '../domain/geo';
import { CARRIER_LABELS, CHANNEL_LABELS, CN_LABELS, cnType, isClosed, isMallGroup, owner } from '../domain/rules';
import { ROLE_LABELS, useSession } from '../state/session';
import { useRtv } from '../state/useRtvs';
import { tr } from '../i18n';

export default function RtvDetail() {
  const { id = '' } = useParams();
  const { rtv, refresh } = useRtv(id);
  const { role } = useSession();
  if (rtv === undefined) return <p className="muted">{tr('กำลังโหลด…', 'Loading…')}</p>;
  if (rtv === null) {
    return (
      <div className="card empty">
        <p>{tr('ไม่พบเลข RTV นี้', 'RTV number not found')}</p>
        <Link to="/">{tr('กลับไปหน้ารายการ', 'Back to the list')}</Link>
      </div>
    );
  }
  const own = owner(rtv);
  const ownerText = rtv.cancelled ? tr('ยกเลิกแล้ว', 'Cancelled') : isClosed(rtv) ? tr('ปิดงานแล้ว', 'Closed') : own ? tr(`ค้างที่: ${ROLE_LABELS[own]}`, `With: ${ROLE_LABELS[own]}`) : '—';
  const cnNo = rtv.docs.find(d => d.type === 'CN')?.value;
  const brand = BRANDS.find(b => b.id === rtv.brandId)?.name ?? rtv.brandId;
  const store = STORES.find(s => s.id === rtv.storeId)?.name ?? rtv.storeId;
  const page = (
    <div className="rtv-detail">
      <div className="card">
        <h1 className="rtv-id mono">{rtv.id}</h1>
        <div className="chips">
          <span className="badge badge-pending">{CHANNEL_LABELS[rtv.channel]}</span>
          <span className="badge badge-pending">{rtv.saleType === 'PROMO' ? 'Promotion' : 'Normal'}</span>
          <span className="badge badge-done">{CN_LABELS[cnType(rtv.channel, rtv.saleType)]}</span>
          <span className={`badge ${rtv.cancelled ? 'badge-failed' : isClosed(rtv) ? 'badge-transit' : 'badge-assigned'}`}>{ownerText}</span>
          {rtv.shortBoxes > 0 && <span className="badge badge-alert">{tr(`กล่องขาด ${rtv.shortBoxes} กล่อง`, `${rtv.shortBoxes} short ${rtv.shortBoxes === 1 ? 'box' : 'boxes'}`)}</span>}
        </div>
        <p className="muted rtv-meta">
          {brand} · {store} · {tr('ขนส่ง:', 'Carrier:')} {rtv.carrier ? CARRIER_LABELS[rtv.carrier] : '—'}
          {rtv.pickupDate ? tr(` · นัดรับ ${fmtDate(rtv.pickupDate)}`, ` · Pickup ${fmtDate(rtv.pickupDate)}`) : ''}{tr(` · เปิดเมื่อ ${fmtDate(rtv.createdAt)}`, ` · Opened ${fmtDate(rtv.createdAt)}`)}
        </p>
        {isClosed(rtv) && cnNo && <p>{tr('เลข CN:', 'CN no.:')} {cnNo}</p>}
        {rtv.cancelled && <p className="error">{tr('ยกเลิก:', 'Cancelled:')} {rtv.cancelled.reason}</p>}
        {rtv.promoId && <p>{tr('งานเก็บโปร:', 'Promo pickup:')} <Link to={`/promo/${rtv.promoId}`} className="mono">{rtv.promoId}</Link> · {tr('ปลายทาง', 'Destination')} {rtv.hub === 'SCDC' ? `${HUBS.SCDC.short} → ${HUBS.CMG.short}` : HUBS.CMG.short}</p>}
      </div>
      <HoldBanner rtv={rtv} />
      <div className="card"><StatusBar rtv={rtv} /></div>
      <div data-testid="actions"><ActionPanel rtv={rtv} onDone={refresh} /></div>
      <div className="card"><h2>{tr('เลขเอกสารอ้างอิง', 'Reference documents')}</h2><DocRefTable rtv={rtv} /></div>
      <div className="card"><h2>{tr('กล่อง', 'Boxes')}</h2><BoxList boxes={rtv.boxes} showMim={!isMallGroup(rtv.channel)} /></div>
      <div className="card"><h2>{tr('ประวัติรายการ', 'History')}</h2><Timeline events={rtv.events} /></div>
    </div>
  );
  return role === 'CARRIER' ? <PhoneFrame>{page}</PhoneFrame> : page;
}
