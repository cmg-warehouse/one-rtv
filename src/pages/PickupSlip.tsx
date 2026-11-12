import { QRCodeSVG } from 'qrcode.react';
import { Link, useParams } from 'react-router-dom';
import { BRANDS, STORES } from '../data/masters';
import { fmtDate } from '../domain/format';
import { CARRIER_LABELS } from '../domain/rules';
import { useRtv } from '../state/useRtvs';

export default function PickupSlip() {
  const { id = '' } = useParams();
  const { rtv } = useRtv(id);
  if (rtv === undefined) return <p className="muted">กำลังโหลด…</p>;
  if (rtv === null) return <div className="card empty"><p>ไม่พบเลข RTV นี้</p><Link to="/">กลับไปหน้ารายการ</Link></div>;
  const slip = rtv.docs.find(d => d.type === 'PICKUP_SLIP')?.value;
  if (!slip) {
    return <div className="card empty"><p>ยังไม่ได้ออกใบแจ้งเก็บ</p><Link to={`/rtv/${rtv.id}`}>กลับไปหน้ารายการ</Link></div>;
  }
  const brand = BRANDS.find(b => b.id === rtv.brandId)?.name ?? rtv.brandId;
  const store = STORES.find(s => s.id === rtv.storeId)?.name ?? rtv.storeId;
  return (
    <div className="slip-page">
      <div className="no-print slip-actions">
        <Link to={`/rtv/${rtv.id}`}>กลับไปหน้ารายการ</Link>
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>พิมพ์</button>
      </div>
      <article className="slip">
        <header className="slip-head">
          <img src="./cmg-logo.png" alt="CMG" className="slip-logo" />
          <div>
            <h1>ใบแจ้งเก็บสินค้า</h1>
            <p>เลขที่ใบแจ้งเก็บ <strong className="mono">{slip}</strong></p>
          </div>
          <QRCodeSVG value={rtv.id} size={120} />
        </header>
        <p>เลข RTV <strong className="mono">{rtv.id}</strong></p>
        <table className="slip-info">
          <tbody>
            <tr><th>สาขา</th><td>{store}</td></tr>
            <tr><th>แบรนด์</th><td>{brand}</td></tr>
            <tr><th>ขนส่ง</th><td>{rtv.carrier ? CARRIER_LABELS[rtv.carrier] : '—'}</td></tr>
            <tr><th>วันนัดเก็บ</th><td>{rtv.pickupDate ? fmtDate(rtv.pickupDate) : '—'}</td></tr>
          </tbody>
        </table>
        <table className="slip-boxes">
          <thead><tr><th>เลขกล่อง</th><th className="num">จำนวนชิ้น</th></tr></thead>
          <tbody>
            {rtv.boxes.map(b => <tr key={b.no}><td className="mono">{b.no}</td><td className="num">{b.expectedPcs}</td></tr>)}
          </tbody>
        </table>
        <div className="slip-sign">
          {['ร้าน', 'ขนส่ง', 'คลัง'].map(r => <div key={r}><span className="sign-line" />ผู้ลงนาม {r}</div>)}
        </div>
      </article>
    </div>
  );
}
