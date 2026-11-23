import { useState } from 'react';
import { Link } from 'react-router-dom';
import { act } from '../../api';
import IPhone, { AppBar } from '../../components/mobile/IPhone';
import ScanCamera from '../../components/mobile/ScanCamera';
import SignaturePad from '../../components/mobile/SignaturePad';
import { useToast, type Toast } from '../../components/mobile/useBoxScan';
import { ACTORS, BRANDS, STORES } from '../../data/masters';
import { fmtDate } from '../../domain/format';
import { locate } from '../../domain/geo';
import { CARRIER_LABELS, isClosed, nextStep, owner } from '../../domain/rules';
import { slipOf } from '../../domain/promo';
import type { PromoEvent, Rtv } from '../../domain/types';
import { usePromoList, useRtvList } from '../../state/useRtvs';
import PromoPickup from './PromoPickup';
import { tr } from '../../i18n';

const store = (id: string) => STORES.find(s => s.id === id);
const shortStore = (id: string) => (store(id)?.name ?? id).replace('สาขาตัวอย่าง ', '').replace('ห้างท้องถิ่นตัวอย่าง ', 'ห้าง ').replace('Sample store ', '').replace('Sample local mall ', 'Mall ');
const slipNo = (r: Rtv) => r.docs.find(d => d.type === 'PICKUP_SLIP')?.value;
const failReasons = () => [tr('ร้านปิด', 'Store closed'), tr('ของยังไม่พร้อม', 'Goods not ready'), tr('ไม่พบผู้ส่งมอบ', 'No one to hand over')];

/** Drivers may be outside the Central group with no account: who they are is typed when they accept the job. */
interface Driver { name: string; plate: string }

/** The carrier actor recorded on the RTV: the driver typed on the phone plus the carrier the slip was issued to. */
function actorOf(rtv: Rtv, driver: Driver | null) {
  const company = rtv.carrier ? CARRIER_LABELS[rtv.carrier] : tr('ขนส่ง', 'Carrier');
  return { role: 'CARRIER' as const, actor: driver ? `${driver.name} · ${driver.plate} (${company})` : `${ACTORS.CARRIER} (${company})` };
}

/** Pickups the phone can open: the carrier owns the next step (4 accept or 5 collect). Parcel steps belong to CS. */
// Promotion pickups are collected for the whole event on the งานเก็บโปร page, not RTV by RTV.
const isPickup = (r: Rtv) => !r.promoId && owner(r) === 'CARRIER' && [4, 5].includes(nextStep(r)?.step ?? 0);

/** Why a scanned RTV cannot be opened on the carrier phone. */
function whyNot(r: Rtv): string {
  const short = r.id.slice(-5);
  if (r.cancelled) return tr(`${short} ถูกยกเลิกแล้ว`, `${short} is cancelled`);
  if (isClosed(r)) return tr(`${short} ปิดงานแล้ว`, `${short} is closed`);
  if (r.carrier === 'PARCEL') return tr(`${short} ส่งแบบ Parcel — CS เป็นผู้บันทึก`, `${short} ships as Parcel. CS records it`);
  if (r.promoId && r.step < 5) return tr(`${short} อยู่ในงานเก็บโปร ${r.promoId} — บันทึกรวมทั้งงาน`, `${short} is in promo pickup ${r.promoId}. Recorded for the whole job`);
  if ((nextStep(r)?.step ?? 0) < 4) return tr(`${short} CS ยังไม่ปล่อยงานให้ขนส่ง`, `${short} CS has not released it to the carrier`);
  return tr(`${short} เก็บแล้ว: ${locate(r, new Date().toISOString()).label}`, `${short} already collected: ${locate(r, new Date().toISOString()).label}`);
}

type Screen =
  | { name: 'home' } | { name: 'slip' } | { name: 'job'; id: string } | { name: 'collect'; id: string }
  | { name: 'done'; id: string; got: number; total: number } | { name: 'fail'; id: string } | { name: 'promo'; id: string };

/** Promotion pickups the driver can open from the combined slip (CS has handed them over). */
const promoReady = (e: PromoEvent) => e.status !== 'REQUESTED';

export function ToastView({ toast }: { toast: Toast | null }) {
  return toast ? <div key={toast.id} className={`ma-toast${toast.ok ? '' : ' is-bad'}`} role="status">{toast.text}</div> : null;
}

function statusOf(r: Rtv): { text: string; tone: string } {
  const step = nextStep(r)?.step;
  if (step === 4) return { text: tr('ยังไม่รับงาน', 'Not accepted'), tone: 'is-amber' };
  if (step === 5) return { text: tr('รอเก็บ', 'To collect'), tone: 'is-red' };
  if (r.step >= 5) return { text: tr('เก็บแล้ว', 'Collected'), tone: 'is-green' };
  return { text: tr('ส่งกลับ CS', 'Back to CS'), tone: 'is-grey' };
}

function Home({ recent, all, driver, go }: { recent: string[]; all: Rtv[]; driver: Driver | null; go(s: Screen): void }) {
  const mine = recent.map(id => all.find(r => r.id === id)).filter((r): r is Rtv => !!r);
  return (
    <>
      <AppBar title={tr('แอปขนส่ง · รับคืนสินค้า', 'Carrier app · Return pickup')} />
      <div className="ma-body">
        <div className="ma-hello">
          <span className="ma-avatar">{driver ? driver.name.replace(/^คุณ/, '').slice(0, 1) : '?'}</span>
          <div>
            <strong>{driver ? driver.name : tr('ยังไม่ระบุคนขับ', 'Driver not set')}</strong>
            <span className="ma-small ma-muted">{driver ? tr(`ทะเบียน ${driver.plate}`, `Plate ${driver.plate}`) : tr('กรอกตอนรับงานครั้งแรก', 'Entered when accepting the first job')}</span>
          </div>
        </div>
        <button type="button" className="ma-scan-hero" onClick={() => go({ name: 'slip' })}>
          <span className="ma-scan-hero-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="56" height="56"><path d="M6 16V6h10M32 6h10v10M42 32v10H32M16 42H6V32" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /><rect x="14" y="14" width="8" height="8" fill="currentColor" /><rect x="26" y="14" width="8" height="8" fill="currentColor" /><rect x="14" y="26" width="8" height="8" fill="currentColor" /><rect x="28" y="28" width="4" height="4" fill="currentColor" /></svg>
          </span>
          <strong>{tr('สแกน QR ใบแจ้งเก็บ', 'Scan pickup slip QR')}</strong>
          <span className="ma-small">{tr('เริ่มงานทุกครั้งจากใบที่สาขาให้มา', 'Always start from the slip the store gives you')}</span>
        </button>
        <p className="ma-note">{tr('ใช้ได้กับขนส่งทุกราย ทั้งในและนอกเครือ ไม่ต้องมีบัญชีหรือรายการงานล่วงหน้า สแกนแล้วข้อมูลออเดอร์จะขึ้นเอง', 'Works for every carrier, inside or outside the group. No account or job list needed. Scan and the order details fill in')}</p>
        <h3 className="ma-h">{tr('งานที่สแกนวันนี้', 'Jobs scanned today')}</h3>
        {mine.length === 0 && <p className="ma-empty">{tr('ยังไม่มีงาน — สแกน QR บนใบแจ้งเก็บเพื่อเริ่ม', 'No jobs yet. Scan the QR on a pickup slip to start')}</p>}
        {mine.map(r => {
          const st = statusOf(r);
          return (
            <button key={r.id} type="button" className="ma-card ma-job" data-testid="m-job"
              onClick={() => go(isPickup(r) ? { name: 'job', id: r.id } : { name: 'home' })}>
              <span className="ma-job-top"><strong>{shortStore(r.storeId)}</strong><span className={`ma-pill ${st.tone}`}>{st.text}</span></span>
              <span className="mono ma-small">{r.id}</span>
              <span className="ma-small ma-muted">{r.boxes.length} {tr('กล่อง', 'boxes')} · {r.carrier ? CARRIER_LABELS[r.carrier] : '—'}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

interface SlipTarget { value: string; caption: string }

function SlipScan({ all, events, onFound, go, focus, focusPromo }: {
  all: Rtv[]; events: PromoEvent[]; onFound(id: string): void; go(s: Screen): void; focus?: string; focusPromo?: string;
}) {
  const { toast, show } = useToast();
  // Demo only: what the simulated camera is pointed at. A real phone reads whatever slip is in front of it.
  const rtvSlip = (r: Rtv): SlipTarget => ({
    value: r.id,
    caption: `${slipNo(r) ? tr(`ใบแจ้งเก็บ ${slipNo(r)}`, `Pickup slip ${slipNo(r)}`) : tr('เอกสาร RTV (ไม่มีใบแจ้งเก็บ)', 'RTV document (no pickup slip)')} · ${shortStore(r.storeId)}`,
  });
  const promoSlip = (e: PromoEvent): SlipTarget => ({ value: slipOf(e), caption: `${tr('ใบแจ้งเก็บรวม', 'Combined pickup slip')} ${slipOf(e)} · ${e.name}` });
  const slips: SlipTarget[] = [
    ...events.filter(e => promoReady(e) && e.status !== 'PICKED').map(promoSlip),
    ...all.filter(isPickup).map(rtvSlip),
  ];
  const [pick, setPick] = useState(0);
  const focused = focusPromo ? events.find(e => e.id === focusPromo) : undefined;
  const focusRtv = focus ? all.find(r => r.id === focus) : undefined;
  const target = focused ? promoSlip(focused) : focusRtv ? rtvSlip(focusRtv)
    : focus || focusPromo ? null : slips.length ? slips[pick % slips.length] : null;
  return (
    <>
      <AppBar title={tr('สแกน QR ใบแจ้งเก็บ', 'Scan pickup slip QR')} dark onBack={() => go({ name: 'home' })} />
      <div className="ma-body ma-dark">
        <ScanCamera kind="qr" target={target?.value ?? null} auto={!!(focus || focusPromo)} hint={tr('แตะเพื่อสแกน QR บนใบแจ้งเก็บ', 'Tap to scan the QR on the pickup slip')} manualHint={tr('เลข RTV หรือเลขใบแจ้งเก็บ', 'RTV number or pickup slip number')}
          caption={target?.caption}
          onScan={(v) => {
            const q = v.trim().toUpperCase();
            const ev = events.find(e => slipOf(e).toUpperCase() === q || e.id.toUpperCase() === q);
            if (ev) {
              if (!promoReady(ev)) { show(tr('งานเก็บโปรนี้ CS ยังไม่ส่งต่อขนส่ง', 'CS has not passed this promo pickup to the carrier'), false); return; }
              show(tr('พบงานเก็บโปร ✓', 'Promo pickup found ✓'), true);
              go({ name: 'promo', id: ev.id });
              return;
            }
            const found = all.find(r => r.id.toUpperCase() === q || slipNo(r)?.toUpperCase() === q);
            if (!found) { show(tr('ไม่พบเลขนี้ในระบบ', 'Number not found'), false); return; }
            if (!isPickup(found)) { show(whyNot(found), false); return; }
            show(tr('พบออเดอร์ ✓', 'Order found ✓'), true);
            onFound(found.id);
            go({ name: 'job', id: found.id });
          }}>
          {!focus && !focusPromo && slips.length > 1 && (
            <button type="button" className="ma-link scan-demo-next" onClick={() => setPick(p => p + 1)}>
              {tr(`↻ เปลี่ยนใบแจ้งเก็บที่ส่องอยู่ (demo · ${(pick % slips.length) + 1}/${slips.length})`, `↻ Switch the slip in view (demo · ${(pick % slips.length) + 1}/${slips.length})`)}
            </button>
          )}
        </ScanCamera>
        <ToastView toast={toast} />
      </div>
    </>
  );
}

function Job({ rtv, driver, setDriver, go }: { rtv: Rtv; driver: Driver | null; setDriver(d: Driver): void; go(s: Screen): void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [name, setName] = useState(driver?.name ?? '');
  const [plate, setPlate] = useState(driver?.plate ?? '');
  const step = nextStep(rtv)?.step;
  const s = store(rtv.storeId);
  const accept = async () => {
    if (!name.trim() || !plate.trim()) { setErr(tr('กรุณากรอกชื่อคนขับและทะเบียนรถ', 'Enter the driver name and plate number')); return; }
    const d = { name: name.trim(), plate: plate.trim() };
    setBusy(true); setErr(null);
    try { await act(rtv.id, { type: 'advance', payload: { step: 4 } }, actorOf(rtv, d)); setDriver(d); } catch (e) { setErr((e as Error).message); }
    setBusy(false);
  };
  return (
    <>
      <AppBar title={tr('ข้อมูลออเดอร์', 'Order details')} onBack={() => go({ name: 'home' })} />
      <div className="ma-body">
        <div className="ma-card">
          <p className="mono ma-strong">{rtv.id}</p>
          <p className="ma-big">{s?.name}</p>
          <p className="ma-small ma-muted">{s?.province} · {BRANDS.find(b => b.id === rtv.brandId)?.name}</p>
          <div className="ma-kv">
            <span>{tr('ใบแจ้งเก็บ', 'Pickup slip')}</span><b className="mono">{slipNo(rtv) ?? tr('ไม่มี (สแกนจากเอกสาร RTV)', 'None (scanned from the RTV document)')}</b>
            <span>{tr('มอบหมายให้', 'Assigned to')}</span><b>{rtv.carrier ? CARRIER_LABELS[rtv.carrier] : '—'}</b>
            <span>{tr('วันนัดเก็บ', 'Pickup date')}</span><b>{rtv.pickupDate ? fmtDate(rtv.pickupDate) : '—'}</b>
            <span>{tr('จำนวน', 'Quantity')}</span><b>{tr(`${rtv.boxes.length} กล่อง`, `${rtv.boxes.length} boxes`)}</b>
          </div>
        </div>
        <div className="ma-card ma-actions-row">
          <span className="ma-action"><span aria-hidden="true">☎</span>{tr('โทรหาสาขา', 'Call store')}</span>
          <span className="ma-action"><span aria-hidden="true">➤</span>{tr('นำทาง', 'Navigate')}</span>
        </div>
        <h3 className="ma-h">{tr('กล่องที่ต้องเก็บ', 'Boxes to collect')}</h3>
        <ul className="ma-list">
          {rtv.boxes.map(b => <li key={b.no}><span className="mono">{b.no.slice(-3)}</span><span className="ma-muted">{b.expectedPcs ? tr(`${b.expectedPcs} ชิ้น`, `${b.expectedPcs} pcs`) : ''}</span></li>)}
        </ul>
        {step === 4 && (
          <>
            <h3 className="ma-h">{tr('คนขับที่รับงาน', 'Driver accepting the job')}</h3>
            <input className="ma-input" aria-label={tr('ชื่อคนขับ', 'Driver name')} placeholder={tr('ชื่อ-นามสกุลคนขับ', 'Driver full name')} value={name} onChange={e => setName(e.target.value)} />
            <input className="ma-input mono" aria-label={tr('ทะเบียนรถ', 'Plate number')} placeholder={tr('ทะเบียนรถ เช่น 1กข-1234', 'Plate number, e.g. 1กข-1234')} value={plate} onChange={e => setPlate(e.target.value)} />
          </>
        )}
        {step === 5 && driver && <p className="ma-ok">{tr('รับงานแล้ว', 'Accepted')} · {driver.name} · {driver.plate}</p>}
        {err && <p className="ma-err" role="alert">{err}</p>}
      </div>
      <footer className="ma-foot">
        {step === 4 && <button type="button" className="ma-btn" disabled={busy} onClick={() => { void accept(); }}>{tr('รับงาน', 'Accept job')}</button>}
        {step === 5 && <button type="button" className="ma-btn" data-tour="primary" onClick={() => go({ name: 'collect', id: rtv.id })}>{tr('เก็บสินค้า: นับกล่อง + ถ่ายรูป', 'Collect: count boxes + take photo')}</button>}
        <button type="button" className="ma-link" onClick={() => go({ name: 'fail', id: rtv.id })}>{tr('เก็บไม่สำเร็จ', 'Pickup failed')}</button>
      </footer>
    </>
  );
}

/**
 * Collect without scanning every box (boxes carry no barcode labels): the driver confirms how many boxes were
 * handed over, takes a photo of them, and the store signs.
 */
function Collect({ rtv, driver, go }: { rtv: Rtv; driver: Driver | null; go(s: Screen): void }) {
  const total = rtv.boxes.length;
  const [got, setGot] = useState(total);
  const [photo, setPhoto] = useState(false);
  const [signed, setSigned] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ready = got > 0 && photo && signed && !!name.trim();
  const clamp = (n: number) => Math.min(total, Math.max(0, n));
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await act(rtv.id, { type: 'advance', payload: { step: 5, boxes: got } }, actorOf(rtv, driver));
      go({ name: 'done', id: rtv.id, got, total });
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <>
      <AppBar title={tr('ยืนยันการรับสินค้า', 'Confirm receipt')} onBack={() => go({ name: 'job', id: rtv.id })} />
      <div className="ma-body">
        <div className="ma-card ma-summary">
          <span className="ma-big-num">{got}<small>/{total}</small></span>
          <span>{tr('กล่องที่รับ', 'Boxes received')}<br /><span className="ma-small ma-muted">{shortStore(rtv.storeId)}</span></span>
        </div>
        <div className="ma-card ma-count-line">
          <span>{tr('จำนวนกล่องที่รับจริง', 'Boxes actually received')}</span>
          <span className="ma-stepper">
            <button type="button" aria-label={tr('ลดจำนวนกล่อง', 'Decrease boxes')} onClick={() => setGot(n => clamp(n - 1))}>−</button>
            <input aria-label={tr('จำนวนกล่องที่รับ', 'Boxes received')} inputMode="numeric" value={got}
              onChange={e => setGot(clamp(Number(e.target.value.replace(/[^0-9]/g, '')) || 0))} />
            <button type="button" aria-label={tr('เพิ่มจำนวนกล่อง', 'Increase boxes')} onClick={() => setGot(n => clamp(n + 1))}>+</button>
          </span>
        </div>
        {got < total && <p className="ma-warn">{tr(`กล่องขาด ${total - got} กล่อง ระบบจะแจ้ง CS และ Brand`, `${total - got} boxes short. CS and Brand will be notified`)}</p>}
        <h3 className="ma-h">{tr('รูปกล่องที่รับ (บังคับ)', 'Photo of boxes received (required)')}</h3>
        <button type="button" className={`ma-photo${photo ? ' has' : ''}`} onClick={() => setPhoto(true)}>
          {photo
            ? <span className="ma-photo-img" aria-label={tr('รูปที่ถ่ายแล้ว', 'Photo taken')}>{Array.from({ length: Math.min(got, 12) }, (_, i) => <i key={i} />)}</span>
            : <><span aria-hidden="true">◉</span>{tr('ถ่ายรูปกล่อง', 'Take photo of boxes')}</>}
        </button>
        <p className="ma-small ma-muted">{tr('ไม่ต้องสแกนทีละกล่อง ถ่ายรูปกองกล่องให้เห็นจำนวนเป็นหลักฐาน', 'No need to scan box by box. Photograph the stack so the count is visible as evidence')}</p>
        <h3 className="ma-h">{tr('ผู้ส่งมอบที่สาขา', 'Handed over at the store by')}</h3>
        <input className="ma-input" aria-label={tr('ชื่อผู้ส่งมอบ', 'Name of person handing over')} placeholder={tr('ชื่อ-นามสกุล', 'Full name')} value={name} onChange={e => setName(e.target.value)} />
        <SignaturePad onChange={setSigned} />
        {err && <p className="ma-err" role="alert">{err}</p>}
      </div>
      <footer className="ma-foot">
        <button type="button" className="ma-btn" data-tour="primary" disabled={busy || !ready} onClick={() => { void submit(); }}>{tr('ยืนยันเก็บสินค้า', 'Confirm pickup')}</button>
        {!ready && <p className="ma-small ma-muted ma-center">{tr('ถ่ายรูป กรอกชื่อ และให้สาขาเซ็นก่อนยืนยัน', 'Take a photo, enter the name and have the store sign before confirming')}</p>}
      </footer>
    </>
  );
}

function Fail({ rtv, driver, go }: { rtv: Rtv; driver: Driver | null; go(s: Screen): void }) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    try { await act(rtv.id, { type: 'failPickup', reason }, actorOf(rtv, driver)); go({ name: 'home' }); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <AppBar title={tr('เก็บไม่สำเร็จ', 'Pickup failed')} onBack={() => go({ name: 'job', id: rtv.id })} />
      <div className="ma-body">
        <p className="ma-muted">{tr('เลือกเหตุผล งานจะกลับไปที่ CS เพื่อนัดใหม่', 'Choose a reason. The job goes back to CS to be rescheduled')}</p>
        <div className="ma-radio">
          {failReasons().map(r => (
            <button key={r} type="button" className={reason === r ? 'on' : ''} aria-pressed={reason === r} onClick={() => setReason(r)}>{r}</button>
          ))}
        </div>
        {err && <p className="ma-err" role="alert">{err}</p>}
      </div>
      <footer className="ma-foot">
        <button type="button" className="ma-btn ma-btn-dark" disabled={!reason} onClick={() => { void submit(); }}>{tr('ยืนยันเก็บไม่สำเร็จ', 'Confirm pickup failed')}</button>
      </footer>
    </>
  );
}

function Done({ id, got, total, go }: { id: string; got: number; total: number; go(s: Screen): void }) {
  return (
    <div className="ma-done">
      <span className="ma-done-check" aria-hidden="true">✓</span>
      <h3>{tr('เก็บสินค้าแล้ว', 'Goods collected')}</h3>
      <p className="mono">{id}</p>
      <p>{got}/{total} {tr('กล่อง', 'boxes')} {got < total ? tr('· แจ้งกล่องขาดแล้ว', '· short boxes reported') : ''}</p>
      <p className="ma-small ma-muted">{tr('สถานะอัปเดตให้ทุกฝ่ายเห็นทันที', 'Status updated for everyone at once')}</p>
      <button type="button" className="ma-btn" onClick={() => go({ name: 'home' })}>{tr('กลับหน้าหลัก', 'Back to home')}</button>
      <Link className="ma-link" to={`/track/${id}`}>{tr('ดูใน Track & Trace →', 'View in Track & Trace →')}</Link>
    </div>
  );
}

/**
 * Carrier pickup app (steps 4–5) inside an iPhone mock. Boxes are confirmed by count + photo + signature, not scanned one by one. Scan-first: drivers (including carriers outside the
 * group, with no account) open an order by scanning the QR on the pickup slip; nothing is listed in advance.
 */
export default function CarrierApp({ focusId, focusPromo, label }: { focusId?: string; focusPromo?: string; label?: string } = {}) {
  const { rtvs } = useRtvList();
  const { events } = usePromoList();
  // focusId: opened by "scanning" a printed slip elsewhere in the demo — start on the camera, pointed at that slip.
  const [screen, setScreen] = useState<Screen>(focusId || focusPromo ? { name: 'slip' } : { name: 'home' });
  const [recent, setRecent] = useState<string[]>([]);
  const [driver, setDriver] = useState<Driver | null>(null);
  const dark = screen.name === 'slip';
  const remember = (id: string) => setRecent(r => [id, ...r.filter(x => x !== id)]);

  let body;
  const rtv = 'id' in screen ? rtvs.find(r => r.id === screen.id) : undefined;
  const promo = screen.name === 'promo' ? events.find(e => e.id === screen.id) : undefined;
  if (screen.name === 'promo') {
    body = promo ? <PromoPickup key={promo.id} event={promo} onBack={() => setScreen({ name: 'home' })} /> : <p className="ma-empty">{tr('กำลังโหลด…', 'Loading…')}</p>;
  } else if ('id' in screen && !rtv && screen.name !== 'done') body = <p className="ma-empty">{tr('กำลังโหลด…', 'Loading…')}</p>;
  else switch (screen.name) {
    case 'home': body = <Home recent={recent} all={rtvs} driver={driver} go={setScreen} />; break;
    case 'slip': body = <SlipScan all={rtvs} events={events} onFound={remember} go={setScreen} focus={focusId} focusPromo={focusPromo} />; break;
    case 'job': body = <Job key={screen.id} rtv={rtv!} driver={driver} setDriver={setDriver} go={setScreen} />; break;
    case 'collect': body = <Collect key={screen.id} rtv={rtv!} driver={driver} go={setScreen} />; break;
    case 'fail': body = <Fail rtv={rtv!} driver={driver} go={setScreen} />; break;
    case 'done': body = <Done id={screen.id} got={screen.got} total={screen.total} go={setScreen} />; break;
  }
  return <IPhone label={label ?? tr('แอปขนส่ง — สแกนเข้ารับสินค้า', 'Carrier app: scan to collect')} dark={dark}><div className="ma-app">{body}</div></IPhone>;
}
