import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDateTime } from '../domain/format';
import { HUBS } from '../domain/geo';
import { tr } from '../i18n';
import { slipOf, totals } from '../domain/promo';
import { CARRIER_LABELS } from '../domain/rules';
import { usePromo } from '../state/useRtvs';
import CarrierApp from './mobile/CarrierApp';
import { brandName, venueOf } from './PromoList';

/** ใบแจ้งเก็บรวม: one printed slip for a whole promotion pickup; its QR opens every brand on the driver's phone. */
export default function PromoSlip() {
  const { id = '' } = useParams();
  const { event } = usePromo(id);
  const [phone, setPhone] = useState(false);
  if (event === undefined) return <p className="muted">{tr('กำลังโหลด…', 'Loading…')}</p>;
  if (event === null) return <div className="card empty"><p>{tr('ไม่พบงานนี้', 'Job not found')}</p><Link to="/promo">{tr('กลับไปงานเก็บโปร', 'Back to promo pickups')}</Link></div>;
  if (event.status === 'REQUESTED') {
    return <div className="card empty"><p>{tr('CS ยังไม่ส่งต่อขนส่ง จึงยังไม่มีใบแจ้งเก็บรวม', 'CS has not forwarded to the carrier yet, so there is no combined pickup slip')}</p><Link to={`/promo/${event.id}`}>{tr('กลับไปหน้างาน', 'Back to the job')}</Link></div>;
  }
  const t = totals(event);
  const slip = slipOf(event);
  return (
    <div className={`slip-page${phone ? ' with-phone' : ''}`}>
      <div className="no-print slip-actions">
        <Link to={`/promo/${event.id}`}>{tr('กลับไปหน้างานเก็บโปร', 'Back to promo pickup')}</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>{tr('พิมพ์', 'Print')}</button>
      </div>
      <div className="slip-layout">
        <article className="slip">
          <p className="slip-demo">{tr('ตัวอย่างเพื่อการสาธิต', 'Demo sample')}</p>
          <header className="slip-head">
            <img src="./cmg-logo.png" alt="CMG" className="slip-logo" />
            <div>
              <h1>{tr('ใบแจ้งเก็บสินค้า (รวม · งานโปร)', 'Pickup slip (combined · promo)')}</h1>
              <p>{tr('เลขที่ใบแจ้งเก็บ', 'Pickup slip no.')} <strong className="mono">{slip}</strong></p>
            </div>
            <button type="button" className="slip-qr" data-tour={phone ? undefined : 'primary'} onClick={() => setPhone(p => !p)}
              aria-label={tr('จำลองการสแกน QR ด้วยมือถือคนขับ', 'Simulate scanning the QR with the driver\'s phone')} aria-expanded={phone}>
              <QRCodeSVG value={slip} size={120} />
              <span className="slip-qr-hint no-print">{phone ? tr('ปิดมือถือ', 'Close phone') : tr('แตะเพื่อสแกนด้วยมือถือ', 'Tap to scan with phone')}</span>
            </button>
          </header>
          <table className="slip-info">
            <tbody>
              <tr><th>{tr('งาน', 'Job')}</th><td>{event.name} <span className="mono">({event.id})</span></td></tr>
              <tr><th>{tr('สถานที่เก็บ', 'Pickup venue')}</th><td>{venueOf(event)}</td></tr>
              <tr><th>{tr('วันเวลาเก็บ', 'Pickup date and time')}</th><td>{fmtDateTime(event.pickupAt)}</td></tr>
              <tr><th>{tr('ผู้ประสานงานหน้างาน', 'On-site coordinator')}</th><td>{event.contact.name} {event.contact.phone}</td></tr>
              <tr><th>{tr('ขนส่ง', 'Carrier')}</th><td>{CARRIER_LABELS.AGREED}</td></tr>
              <tr>
                <th>{tr('รถ', 'Trucks')}</th>
                <td>{event.vehicles.length
                  ? event.vehicles.map(v => `${v.type} ${v.plate} (${v.driver})`).join(' · ')
                  : tr(`รอยืนยัน · ประมาณ ${event.estimate.type} × ${event.estimate.count}`, `Waiting for confirmation · est. ${event.estimate.type} × ${event.estimate.count}`)}</td>
              </tr>
            </tbody>
          </table>
          <table className="slip-boxes">
            <thead>
              <tr><th>{tr('แบรนด์', 'Brand')}</th><th>{tr('เลข RTV', 'RTV no.')}</th><th>{tr('ปลายทาง', 'Destination')}</th><th className="num">{tr('กล่อง', 'Boxes')}</th><th className="num">{tr('พาเลท', 'Pallets')}</th><th className="num">{tr('เก็บได้จริง', 'Collected')}</th></tr>
            </thead>
            <tbody>
              {event.lines.map(l => (
                <tr key={l.brandId}>
                  <td>{l.brandId} · {brandName(l.brandId)}</td>
                  <td className="mono">{l.rtvId}</td>
                  <td>{HUBS[l.hub].short}</td>
                  <td className="num">{l.boxes}</td>
                  <td className="num">{l.pallets}</td>
                  <td className="num slip-fill">{l.pickedBoxes ?? ''}</td>
                </tr>
              ))}
              {event.extras.map((x, i) => (
                <tr key={`x${i}`}><td>{x.label}</td><td className="muted">{tr('ไม่ออก RTV', 'No RTV issued')}</td><td>—</td><td className="num">—</td><td className="num">{x.pallets}</td><td className="num slip-fill">{x.pickedPallets ?? ''}</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th colSpan={3}>{tr(`รวม ${event.lines.length} แบรนด์`, `Total ${event.lines.length} brands`)}</th><th className="num">{t.boxes}</th><th className="num">{t.pallets}</th><th /></tr>
            </tfoot>
          </table>
          <p className="muted">{tr('จำนวนเป็นยอดที่แจ้งไว้ วันเก็บอาจขาด / เกิน — คนขับบันทึกยอดจริงในแอป พร้อมถ่ายรูปและให้หน้างานเซ็น (ไม่ต้องสแกนทีละกล่อง)', 'Quantities are as announced; on pickup day they may be short / over. The driver records the actual quantity in the app, takes a photo and gets the on-site coordinator to sign (no box-by-box scanning).')}</p>
          <div className="slip-sign">
            {[tr('ผู้ประสานงานหน้างาน', 'On-site coordinator'), tr('คนขับ', 'Driver'), tr('คลังรับ', 'Receiving warehouse')].map(r => <div key={r}><span className="sign-line" />{tr('ผู้ลงนาม', 'Signed by')} {r}</div>)}
          </div>
        </article>
        {phone && (
          <aside className="slip-phone no-print">
            <CarrierApp key={event.id} focusPromo={event.id} label={tr('มือถือคนขับที่สแกน QR ใบนี้', 'Driver\'s phone that scanned this QR')} />
            <button type="button" className="btn btn-sm" onClick={() => setPhone(false)}>{tr('ปิดมือถือ', 'Close phone')}</button>
          </aside>
        )}
      </div>
    </div>
  );
}
