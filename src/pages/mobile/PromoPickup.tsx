import { useState } from 'react';
import { Link } from 'react-router-dom';
import { actPromo } from '../../api';
import { AppBar } from '../../components/mobile/IPhone';
import SignaturePad from '../../components/mobile/SignaturePad';
import { BRANDS, STORES } from '../../data/masters';
import { fmtDateTime } from '../../domain/format';
import { HUBS } from '../../domain/geo';
import { slipOf, totals } from '../../domain/promo';
import type { PromoEvent, Vehicle } from '../../domain/types';
import { tr } from '../../i18n';

const brandName = (id: string) => BRANDS.find(b => b.id === id)?.name ?? id;
const venue = (e: PromoEvent) => STORES.find(s => s.id === e.storeId)?.name ?? e.storeId;

type Sub = 'job' | 'count' | 'sign' | 'done';
interface Count { boxes: number; pallets: number }

function Stepper({ label, value, onChange }: { label: string; value: number; onChange(n: number): void }) {
  return (
    <span className="ma-stepper">
      <button type="button" aria-label={tr(`ลด ${label}`, `Decrease ${label}`)} onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <input aria-label={label} inputMode="numeric" value={value}
        onChange={e => onChange(Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))} />
      <button type="button" aria-label={tr(`เพิ่ม ${label}`, `Increase ${label}`)} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

const Diff = ({ got, want }: { got: number; want: number }) => (got === want ? null
  : <span className={`ma-pill ${got > want ? 'is-amber' : 'is-red'}`}>{got > want ? tr(`เกิน ${got - want}`, `Over ${got - want}`) : got === 0 ? tr('ไม่มีของ', 'None') : tr(`ขาด ${want - got}`, `Short ${want - got}`)}</span>);

/**
 * Driver's phone for a promotion pickup, opened by scanning the combined slip (ใบแจ้งเก็บรวม): every brand of the
 * event in one job. Confirm the trucks if the carrier has not yet, count what each brand hands over, have the
 * coordinator sign, and every brand's RTV moves on at once.
 */
export default function PromoPickup({ event, onBack }: { event: PromoEvent; onBack(): void }) {
  const [sub, setSub] = useState<Sub>(event.status === 'PICKED' ? 'done' : 'job');
  const [counts, setCounts] = useState<Record<string, Count>>(() =>
    Object.fromEntries(event.lines.map(l => [l.brandId, { boxes: l.pickedBoxes ?? l.boxes, pallets: l.pickedPallets ?? l.pallets }])));
  const [extras, setExtras] = useState<number[]>(() => event.extras.map(x => x.pickedPallets ?? x.pallets));
  const [trucks, setTrucks] = useState<Vehicle[]>(() => Array.from({ length: event.estimate.count },
    () => ({ type: event.estimate.type, plate: '', driver: '', phone: '' })));
  const [handover, setHandover] = useState('');
  const [signed, setSigned] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const actor = { role: 'CARRIER' as const, actor: `${event.vehicles[0]?.driver ?? tr('คนขับ', 'Driver')} · ${event.vehicles[0]?.plate ?? ''} (${tr('งานจองรถ', 'Booked truck')})` };
  const t = totals(event);
  const run = async (fn: () => Promise<unknown>, then: Sub) => {
    setBusy(true); setErr(null);
    try { await fn(); setSub(then); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };

  if (sub === 'done') {
    const lines = event.lines;
    return (
      <div className="ma-done">
        <span className="ma-done-check" aria-hidden="true">✓</span>
        <h3>{tr('เก็บสินค้าโปรแล้ว', 'Promo goods collected')}</h3>
        <p>{event.name}</p>
        <p>{tr(`${t.pickedBoxes} กล่อง / ${t.pickedPallets} พาเลท · แจ้งไว้ ${t.boxes} / ${t.pallets}`, `${t.pickedBoxes} boxes / ${t.pickedPallets} pallets · declared ${t.boxes} / ${t.pallets}`)}</p>
        <ul className="ma-list ma-left">
          {lines.map(l => (
            <li key={l.brandId}><span>{l.brandId} · {l.pickedBoxes ?? '—'} {tr('กล่อง', 'boxes')}</span><Diff got={l.pickedBoxes ?? l.boxes} want={l.boxes} /></li>
          ))}
        </ul>
        <p className="ma-small ma-muted">{tr('RTV ทุกแบรนด์อัปเดตพร้อมกัน ทุกแบรนด์เห็นยอดจริงทันที', 'Every brand RTV updates together. Every brand sees the actual quantity at once')}</p>
        <button type="button" className="ma-btn" onClick={onBack}>{tr('กลับหน้าหลัก', 'Back to home')}</button>
        <Link className="ma-link" to={`/promo/${event.id}`}>{tr('ดูงานเก็บโปร →', 'View promo pickup →')}</Link>
      </div>
    );
  }

  if (sub === 'count') {
    const set = (b: string, patch: Partial<Count>) => setCounts(c => ({ ...c, [b]: { ...c[b], ...patch } }));
    const sumBoxes = Object.values(counts).reduce((n, c) => n + c.boxes, 0);
    return (
      <>
        <AppBar title={tr('นับของที่หน้างาน', 'Count goods on site')} onBack={() => setSub('job')} right={<span className="ma-count">{sumBoxes}/{t.boxes}</span>} />
        <div className="ma-body">
          <p className="ma-note">{tr('ตั้งค่าตามยอดที่แจ้งไว้ ปรับตามของจริงได้ (ขาด / เกิน) · แบรนด์ที่ไม่มีของให้เป็น 0', 'Starts at the declared quantity. Adjust to what is really there (short / over). Set 0 for a brand with no goods')}</p>
          {event.lines.map(l => (
            <div key={l.brandId} className="ma-card ma-promo-line">
              <span className="ma-job-top"><strong>{l.brandId} · {brandName(l.brandId)}</strong><Diff got={counts[l.brandId].boxes} want={l.boxes} /></span>
              <span className="ma-small ma-muted">{tr(`แจ้ง ${l.boxes} กล่อง / ${l.pallets} พาเลท · ไป ${HUBS[l.hub].short}`, `Declared ${l.boxes} boxes / ${l.pallets} pallets · to ${HUBS[l.hub].short}`)}</span>
              <span className="ma-promo-steppers">
                <span>{tr('กล่อง', 'Boxes')}</span><Stepper label={tr(`${l.brandId} กล่อง`, `${l.brandId} boxes`)} value={counts[l.brandId].boxes} onChange={n => set(l.brandId, { boxes: n })} />
                <span>{tr('พาเลท', 'Pallets')}</span><Stepper label={tr(`${l.brandId} พาเลท`, `${l.brandId} pallets`)} value={counts[l.brandId].pallets} onChange={n => set(l.brandId, { pallets: n })} />
              </span>
            </div>
          ))}
          {event.extras.map((x, i) => (
            <div key={`x${i}`} className="ma-card ma-promo-line">
              <span className="ma-job-top"><strong>{x.label}</strong><span className="ma-small ma-muted">{tr('ไม่ออก RTV', 'No RTV')}</span></span>
              <span className="ma-promo-steppers">
                <span>{tr('พาเลท', 'Pallets')}</span><Stepper label={tr(`${x.label} พาเลท`, `${x.label} pallets`)} value={extras[i]} onChange={n => setExtras(xs => xs.map((v, j) => (j === i ? n : v)))} />
              </span>
            </div>
          ))}
        </div>
        <footer className="ma-foot">
          <button type="button" className="ma-btn" data-tour="primary" onClick={() => setSub('sign')}>{tr('ถัดไป: ให้หน้างานเซ็นส่งมอบ', 'Next: on-site handover signature')}</button>
        </footer>
      </>
    );
  }

  if (sub === 'sign') {
    const submit = () => run(() => actPromo(event.id, { type: 'recordPickup', input: { lines: counts, extras } }, actor), 'done');
    const got = Object.values(counts).reduce((n, c) => n + c.boxes, 0);
    return (
      <>
        <AppBar title={tr('ยืนยันการรับสินค้า', 'Confirm receipt')} onBack={() => setSub('count')} />
        <div className="ma-body">
          <div className="ma-card ma-summary">
            <span className="ma-big-num">{got}<small>/{t.boxes}</small></span>
            <span>{tr(`กล่องจาก ${event.lines.length} แบรนด์`, `Boxes from ${event.lines.length} brands`)}<br /><span className="ma-small ma-muted">{venue(event)}</span></span>
          </div>
          <h3 className="ma-h">{tr('รูปของที่รับ (บังคับ)', 'Photo of goods received (required)')}</h3>
          <button type="button" className={`ma-photo${photo ? ' has' : ''}`} onClick={() => setPhoto(true)}>
            {photo
              ? <span className="ma-photo-img" aria-label={tr('รูปที่ถ่ายแล้ว', 'Photo taken')}>{Array.from({ length: Math.min(got, 12) }, (_, i) => <i key={i} />)}</span>
              : <><span aria-hidden="true">◉</span>{tr('ถ่ายรูปพาเลท / กล่อง', 'Take photo of pallets / boxes')}</>}
          </button>
          <h3 className="ma-h">{tr('ผู้ส่งมอบที่หน้างาน', 'Handed over on site by')}</h3>
          <input className="ma-input" aria-label={tr('ชื่อผู้ส่งมอบ', 'Name of person handing over')} placeholder={event.contact.name} value={handover} onChange={e => setHandover(e.target.value)} />
          <SignaturePad onChange={setSigned} />
          {err && <p className="ma-err" role="alert">{err}</p>}
        </div>
        <footer className="ma-foot">
          <button type="button" className="ma-btn" data-tour="primary" disabled={busy || !photo || !signed || !handover.trim()} onClick={() => { void submit(); }}>
            {tr(`ยืนยันเก็บสินค้า (${event.lines.length} แบรนด์)`, `Confirm pickup (${event.lines.length} brands)`)}
          </button>
          {(!photo || !signed || !handover.trim()) && <p className="ma-small ma-muted ma-center">{tr('ถ่ายรูป กรอกชื่อ และให้หน้างานเซ็นก่อนยืนยัน', 'Take a photo, enter the name and have the site sign before confirming')}</p>}
        </footer>
      </>
    );
  }

  // job
  const needTrucks = event.status === 'FORWARDED';
  const setTruck = (i: number, patch: Partial<Vehicle>) => setTrucks(ts => ts.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  return (
    <>
      <AppBar title={tr('งานเก็บโปร', 'Promo pickup')} onBack={onBack} />
      <div className="ma-body">
        <div className="ma-card">
          <p className="ma-big">{event.name}</p>
          <p className="ma-small ma-muted">{venue(event)}</p>
          <div className="ma-kv">
            <span>{tr('ใบแจ้งเก็บรวม', 'Combined pickup slip')}</span><b className="mono">{slipOf(event)}</b>
            <span>{tr('นัดเก็บ', 'Pickup time')}</span><b>{fmtDateTime(event.pickupAt)}</b>
            <span>{tr('หน้างาน', 'On site')}</span><b>{event.contact.name} {event.contact.phone}</b>
            <span>{tr('จำนวน', 'Quantity')}</span><b>{tr(`${event.lines.length} แบรนด์ · ${t.boxes} กล่อง · ${t.pallets} พาเลท`, `${event.lines.length} brands · ${t.boxes} boxes · ${t.pallets} pallets`)}</b>
          </div>
        </div>
        <div className="ma-card ma-actions-row">
          <span className="ma-action"><span aria-hidden="true">☎</span>{tr('โทรหาหน้างาน', 'Call site')}</span>
          <span className="ma-action"><span aria-hidden="true">➤</span>{tr('นำทาง', 'Navigate')}</span>
        </div>
        {event.vehicles.length > 0 && (
          <>
            <h3 className="ma-h">{tr('รถที่ยืนยันแล้ว', 'Confirmed trucks')}</h3>
            <ul className="ma-list">
              {event.vehicles.map((v, i) => <li key={i}><span><b>{v.type}</b> <span className="mono">{v.plate}</span></span><span className="ma-muted">{v.driver}</span></li>)}
            </ul>
          </>
        )}
        <h3 className="ma-h">{tr('แบรนด์ที่ต้องเก็บ', 'Brands to collect')}</h3>
        <ul className="ma-list">
          {event.lines.map(l => <li key={l.brandId}><span>{l.brandId} · {brandName(l.brandId)}</span><span className="ma-muted">{tr(`${l.boxes} กล่อง / ${l.pallets} พล.`, `${l.boxes} boxes / ${l.pallets} plt.`)}</span></li>)}
          {event.extras.map((x, i) => <li key={`x${i}`}><span>{x.label}</span><span className="ma-muted">{tr(`${x.pallets} พล.`, `${x.pallets} plt.`)}</span></li>)}
        </ul>
        {needTrucks && (
          <>
            <h3 className="ma-h">{tr(`ยืนยันรถ (ประมาณ ${event.estimate.type} × ${event.estimate.count})`, `Confirm trucks (about ${event.estimate.type} × ${event.estimate.count})`)}</h3>
            {trucks.map((v, i) => (
              <div key={i} className="ma-truck">
                <input className="ma-input mono" aria-label={tr(`รถคันที่ ${i + 1}: ทะเบียน`, `Truck ${i + 1}: plate`)} placeholder={tr(`คันที่ ${i + 1} ทะเบียน`, `Truck ${i + 1} plate`)} value={v.plate} onChange={e => setTruck(i, { plate: e.target.value })} />
                <input className="ma-input" aria-label={tr(`รถคันที่ ${i + 1}: คนขับ`, `Truck ${i + 1}: driver`)} placeholder={tr('ชื่อคนขับ', 'Driver name')} value={v.driver} onChange={e => setTruck(i, { driver: e.target.value })} />
              </div>
            ))}
          </>
        )}
        {event.status === 'REQUESTED' && <p className="ma-warn">{tr('CS ยังไม่ส่งต่องานนี้ให้ขนส่ง', 'CS has not passed this job to the carrier yet')}</p>}
        {err && <p className="ma-err" role="alert">{err}</p>}
      </div>
      <footer className="ma-foot">
        {needTrucks && (
          <button type="button" className="ma-btn" data-tour="primary" disabled={busy}
            onClick={() => { void run(() => actPromo(event.id, { type: 'confirmVehicles', vehicles: trucks }, actor), 'job'); }}>{tr('ยืนยันรถ และแจ้งทุกแบรนด์', 'Confirm trucks and notify all brands')}</button>
        )}
        {event.status === 'CONFIRMED' && <button type="button" className="ma-btn" data-tour="primary" onClick={() => setSub('count')}>{tr('เริ่มนับของที่หน้างาน', 'Start counting on site')}</button>}
      </footer>
    </>
  );
}
