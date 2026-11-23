import { Link } from 'react-router-dom';
import { BRANDS, STORES } from '../data/masters';
import { fmtDateTime } from '../domain/format';
import { tr } from '../i18n';
import { PROMO_STAGES, PROMO_STATUS_LABELS, totals } from '../domain/promo';
import type { PromoEvent, Role } from '../domain/types';
import { ROLE_LABELS, useSession } from '../state/session';
import { usePromoList } from '../state/useRtvs';

export const venueOf = (e: PromoEvent) => STORES.find(s => s.id === e.storeId)?.name ?? e.storeId;
export const brandName = (id: string) => BRANDS.find(b => b.id === id)?.name ?? id;

/** Who has to act next on the pickup (null once the goods are collected). */
export function promoOwner(e: PromoEvent): Role | null {
  const i = PROMO_STAGES.findIndex(s => s.status === e.status);
  return PROMO_STAGES[i + 1]?.role ?? null;
}

export const STATUS_BADGE: Record<PromoEvent['status'], string> = {
  REQUESTED: 'badge-assigned', FORWARDED: 'badge-pending', CONFIRMED: 'badge-transit', PICKED: 'badge-done',
};

export default function PromoList() {
  const { role, identity } = useSession();
  const { events } = usePromoList();
  // Brand: only pickups with its own brand. Carrier: only what CS has handed over.
  const shown = events.filter(e => (role === 'BRAND' ? e.lines.some(l => l.brandId === identity.brandId)
    : role === 'CARRIER' ? e.status !== 'REQUESTED' : true));
  return (
    <div>
      <h1>{tr('งานเก็บโปร', 'Promo pickups')}</h1>
      <div className="card intro-card promo-intro">
        <p>
          {tr(`ผู้ประสานงานโปรแจ้งงานในระบบแทนเมล "แจ้งรายชื่อ" · CS ส่งต่อขนส่ง · ขนส่งยืนยันรถและทะเบียน
          แทนเมล "ยืนยันรถเก็บโปร" · ทุกแบรนด์ในงานเห็นสถานะเดียวกัน และแต่ละแบรนด์ได้เลข RTV ของตัวเองทันที`,
          'The promo coordinator announces the job in the system instead of the "name list" e-mail · CS forwards to the carrier · the carrier confirms trucks and plates instead of the "promo pickup truck confirmation" e-mail · every brand in the job sees the same status, and each brand gets its own RTV number straight away')}
        </p>
      </div>
      {role === 'PROMO' && <p><Link to="/promo/new" className="btn btn-primary" data-tour="primary">{tr('+ แจ้งงานเก็บโปร', '+ Announce promo pickup')}</Link></p>}
      {role === 'BRAND' && <p className="muted">{tr('แสดงเฉพาะงานที่มีแบรนด์ของคุณ', 'Showing only jobs that include your brand')}</p>}
      <div className="card table-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{tr('เลขงาน', 'Job no.')}</th><th>{tr('ชื่องาน', 'Job name')}</th><th>{tr('สถานที่', 'Venue')}</th><th>{tr('วันเก็บ', 'Pickup date')}</th>
                <th className="num">{tr('แบรนด์', 'Brands')}</th><th className="num">{tr('กล่อง', 'Boxes')}</th><th className="num">{tr('พาเลท', 'Pallets')}</th>
                <th>{tr('รถ', 'Trucks')}</th><th>{tr('สถานะ', 'Status')}</th><th>{tr('ค้างที่', 'Waiting on')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(e => {
                const t = totals(e);
                const own = promoOwner(e);
                const trucks = e.vehicles.length ? tr(`${e.vehicles.length} คัน (${e.vehicles.map(v => v.type).join(', ')})`, `${e.vehicles.length} trucks (${e.vehicles.map(v => v.type).join(', ')})`)
                  : tr(`ประมาณ ${e.estimate.type} × ${e.estimate.count}`, `Est. ${e.estimate.type} × ${e.estimate.count}`);
                return (
                  <tr key={e.id}>
                    <td><Link to={`/promo/${e.id}`} className="mono">{e.id}</Link></td>
                    <td>{e.name}</td>
                    <td>{venueOf(e)}</td>
                    <td className="nowrap">{fmtDateTime(e.pickupAt)}</td>
                    <td className="num">{e.lines.length}</td>
                    <td className="num">{e.status === 'PICKED' ? `${t.pickedBoxes} / ${t.boxes}` : t.boxes}</td>
                    <td className="num">{e.status === 'PICKED' ? `${t.pickedPallets} / ${t.pallets}` : t.pallets}</td>
                    <td>{trucks}</td>
                    <td><span className={`badge ${STATUS_BADGE[e.status]}`}>{PROMO_STATUS_LABELS[e.status]}</span></td>
                    <td>{own ? ROLE_LABELS[own] : '—'}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={10} className="muted">{tr('ยังไม่มีงานเก็บโปร', 'No promo pickups yet')}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
