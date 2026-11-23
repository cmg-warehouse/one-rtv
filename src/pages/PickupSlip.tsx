import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BRANDS, STORES } from '../data/masters';
import { fmtDate } from '../domain/format';
import { CARRIER_LABELS } from '../domain/rules';
import { useRtv } from '../state/useRtvs';
import CarrierApp from './mobile/CarrierApp';
import { tr } from '../i18n';

export default function PickupSlip() {
  const { id = '' } = useParams();
  const { rtv } = useRtv(id);
  // Demo: "scan" the printed QR with a phone shown beside the slip (a real phone only reads the RTV number).
  const [phone, setPhone] = useState(false);
  if (rtv === undefined) return <p className="muted">{tr('กำลังโหลด…', 'Loading…')}</p>;
  if (rtv === null) return <div className="card empty"><p>{tr('ไม่พบเลข RTV นี้', 'RTV number not found')}</p><Link to="/">{tr('กลับไปหน้ารายการ', 'Back to the list')}</Link></div>;
  const slip = rtv.docs.find(d => d.type === 'PICKUP_SLIP')?.value;
  if (!slip) {
    return <div className="card empty"><p>{tr('ยังไม่ได้ออกใบแจ้งเก็บ', 'The pickup slip has not been issued yet')}</p><Link to={`/rtv/${rtv.id}`}>{tr('กลับไปหน้า RTV นี้', 'Back to this RTV')}</Link></div>;
  }
  const brand = BRANDS.find(b => b.id === rtv.brandId)?.name ?? rtv.brandId;
  const store = STORES.find(s => s.id === rtv.storeId)?.name ?? rtv.storeId;
  return (
    <div className={`slip-page${phone ? ' with-phone' : ''}`}>
      <div className="no-print slip-actions">
        <Link to={`/rtv/${rtv.id}`}>{tr('กลับไปหน้า RTV นี้', 'Back to this RTV')}</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>{tr('พิมพ์', 'Print')}</button>
      </div>
      <div className="slip-layout">
      <article className="slip">
        <p className="slip-demo">{tr('ตัวอย่างเพื่อการสาธิต', 'Sample for demonstration')}</p>
        <header className="slip-head">
          <img src="./cmg-logo.png" alt="CMG" className="slip-logo" />
          <div>
            <h1>{tr('ใบแจ้งเก็บสินค้า', 'Pickup slip')}</h1>
            <p>{tr('เลขที่ใบแจ้งเก็บ', 'Pickup slip no.')} <strong className="mono">{slip}</strong></p>
          </div>
          <button type="button" className="slip-qr" onClick={() => setPhone(p => !p)}
            aria-label={tr('จำลองการสแกน QR ด้วยมือถือขนส่ง', 'Simulate scanning the QR with the carrier phone')} aria-expanded={phone}>
            <QRCodeSVG value={rtv.id} size={120} />
            <span className="slip-qr-hint no-print">{phone ? tr('ปิดมือถือ', 'Close phone') : tr('แตะเพื่อสแกนด้วยมือถือ', 'Tap to scan with phone')}</span>
          </button>
        </header>
        <p>{tr('เลข RTV', 'RTV no.')} <strong className="mono">{rtv.id}</strong></p>
        <table className="slip-info">
          <tbody>
            <tr><th>{tr('สาขา', 'Store')}</th><td>{store}</td></tr>
            <tr><th>{tr('แบรนด์', 'Brand')}</th><td>{brand}</td></tr>
            <tr><th>{tr('ขนส่ง', 'Carrier')}</th><td>{rtv.carrier ? CARRIER_LABELS[rtv.carrier] : '—'}</td></tr>
            <tr><th>{tr('วันนัดเก็บ', 'Pickup date')}</th><td>{rtv.pickupDate ? fmtDate(rtv.pickupDate) : '—'}</td></tr>
          </tbody>
        </table>
        <table className="slip-boxes">
          <thead><tr><th>{tr('เลขกล่อง', 'Box no.')}</th><th>MIM</th><th className="num">{tr('จำนวนชิ้น', 'Pieces')}</th></tr></thead>
          <tbody>
            {rtv.boxes.map(b => <tr key={b.no}><td className="mono">{b.no}</td><td className="mono">{b.mim ?? '—'}</td><td className="num">{b.expectedPcs}</td></tr>)}
          </tbody>
        </table>
        <div className="slip-sign">
          {([['ร้าน', 'Store'], ['ขนส่ง', 'Carrier'], ['คลัง', 'Warehouse']] as const).map(([th, en]) => <div key={th}><span className="sign-line" />{tr(`ผู้ลงนาม ${th}`, `Signed by ${en}`)}</div>)}
        </div>
      </article>
      {phone && (
        <aside className="slip-phone no-print">
          <CarrierApp key={rtv.id} focusId={rtv.id} label={tr('มือถือขนส่งที่สแกน QR ใบนี้', 'Carrier phone scanning this slip QR')} />
          <button type="button" className="btn btn-sm" onClick={() => setPhone(false)}>{tr('ปิดมือถือ', 'Close phone')}</button>
        </aside>
      )}
      </div>
    </div>
  );
}
