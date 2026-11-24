import { useState } from 'react';
import { Link } from 'react-router-dom';
import { act } from '../../api';
import IPhone, { AppBar } from '../../components/mobile/IPhone';
import ScanCamera from '../../components/mobile/ScanCamera';
import { matchBox, useBoxScan, useToast } from '../../components/mobile/useBoxScan';
import { ACTORS, STORES } from '../../data/masters';
import { locate, viaScdc } from '../../domain/geo';
import { CARRIER_LABELS, canAct, nextStep } from '../../domain/rules';
import type { Rtv } from '../../domain/types';
import { useSession } from '../../state/session';
import { useRtvList } from '../../state/useRtvs';
import { ToastView } from './CarrierApp';
import { tr } from '../../i18n';

const ME = { role: 'WH' as const, get actor() { return ACTORS.WH; } };
const shortStore = (id: string) => (STORES.find(s => s.id === id)?.name ?? id).replace('สาขาตัวอย่าง ', '').replace('ห้างท้องถิ่นตัวอย่าง ', 'ห้าง ').replace('Sample store ', '').replace('Sample local mall ', 'Mall ');

type Screen =
  | { name: 'home' } | { name: 'find' } | { name: 'receive'; id: string } | { name: 'count'; id: string; received?: number }
  | { name: 'done'; id: string; mismatch: boolean };

function Row({ r, onOpen, tag }: { r: Rtv; onOpen(): void; tag: string }) {
  return (
    <button type="button" className="ma-card ma-job" onClick={onOpen} data-testid="m-inbound">
      <span className="ma-job-top"><strong className="mono ma-small">{r.id}</strong><span className="ma-pill is-red">{tag}</span></span>
      <span>{shortStore(r.storeId)}</span>
      <span className="ma-small ma-muted">{r.boxes.length} {tr('กล่อง', 'boxes')} · {viaScdc(r) ? tr('มาจาก SCDC', 'From SCDC') : tr(`ส่งตรงโดย ${r.carrier ? CARRIER_LABELS[r.carrier] : '—'}`, `Sent direct by ${r.carrier ? CARRIER_LABELS[r.carrier] : '—'}`)}</span>
    </button>
  );
}

function Home({ inbound, toCount, go }: { inbound: Rtv[]; toCount: Rtv[]; go(s: Screen): void }) {
  return (
    <>
      <AppBar title={tr('คลัง CMG · รับคืน', 'CMG warehouse · Returns')} />
      <div className="ma-body">
        <div className="ma-hello">
          <span className="ma-avatar is-dark">{tr('อ', 'E')}</span>
          <div><strong>{tr('คุณอี', 'Khun E')}</strong><span className="ma-small ma-muted">{tr('คลัง CMG · ประตูรับสินค้า 3', 'CMG warehouse · Receiving dock 3')}</span></div>
        </div>
        <button type="button" className="ma-scan-cta" onClick={() => go({ name: 'find' })}>
          <span className="ma-scan-icon" aria-hidden="true">▥</span>
          <span><strong>{tr('สแกนรับสินค้า', 'Scan to receive')}</strong><span className="ma-small">{tr('สแกนป้ายกล่องใดก็ได้ ระบบหา RTV ให้', 'Scan any box label and the RTV is found for you')}</span></span>
        </button>
        <div className="ma-stats">
          <div><b>{inbound.length}</b><span>{tr('รอรับเข้า', 'To receive')}</span></div>
          <div><b>{toCount.length}</b><span>{tr('รอตรวจนับ', 'To count')}</span></div>
          <div><b>{inbound.reduce((n, r) => n + r.boxes.length, 0)}</b><span>{tr('กล่องกำลังมา', 'Boxes inbound')}</span></div>
        </div>
        {inbound.length > 0 && <h3 className="ma-h">{tr('รอรับเข้า', 'To receive')}</h3>}
        {inbound.map(r => <Row key={r.id} r={r} tag={tr('รอรับเข้า', 'To receive')} onOpen={() => go({ name: 'receive', id: r.id })} />)}
        {toCount.length > 0 && <h3 className="ma-h">{tr('รอตรวจนับ', 'To count')}</h3>}
        {toCount.map(r => <Row key={r.id} r={r} tag={tr('รอนับ', 'To count')} onOpen={() => go({ name: 'count', id: r.id })} />)}
        {inbound.length + toCount.length === 0 && <p className="ma-empty">{tr('ไม่มีสินค้ารอรับ', 'Nothing waiting')}</p>}
      </div>
    </>
  );
}

function Find({ pool, all, go, firstId }: { pool: Rtv[]; all: Rtv[]; go(s: Screen): void; firstId?: string }) {
  const { toast, show } = useToast();
  // The demo's shared first example stays in view until the warehouse has counted it (before it arrives, a scan says where it is).
  const first = all.find(r => r.id === firstId && (nextStep(r)?.step ?? 99) <= 9);
  // Not collected yet: guide the viewer to the carrier phone instead of a red "not here" on the perfect case.
  const waiting = first && (nextStep(first)?.step ?? 0) < 8;
  const target = first?.boxes[0].no ?? pool.find(r => nextStep(r)?.step === 8)?.boxes[0].no ?? pool[0]?.boxes[0].no ?? null;
  return (
    <>
      <AppBar title={tr('สแกนรับสินค้า', 'Scan to receive')} dark onBack={() => go({ name: 'home' })} />
      <div className="ma-body ma-dark">
        {waiting && (
          <p className="ma-guide" role="note">
            {tr(`รถกำลังไปเก็บ ${first.id.slice(-5)} ที่${shortStore(first.storeId)} — กดเก็บที่แอปขนส่งทางซ้ายก่อน แล้วกล่องนี้จะสแกนรับเข้าได้`, `The truck is on its way to collect ${first.id.slice(-5)} at ${shortStore(first.storeId)}. Collect it on the carrier app on the left first, then this box can be scanned in`)}
          </p>
        )}
        <ScanCamera kind="barcode" target={target} hint={tr('แตะเพื่อสแกนป้ายกล่อง', 'Tap to scan a box label')} manualHint={tr('เลขกล่อง หรือเลข RTV', 'Box number or RTV number')}
          onScan={(v) => {
            const same = (r: Rtv) => r.id.toUpperCase() === v.toUpperCase() || matchBox(r, v);
            if (waiting && same(first)) return;
            const hit = pool.find(same);
            if (!hit) {
              // Known RTV that has not reached the warehouse yet: say where it is instead of "not found".
              const other = all.find(same);
              show(other ? `${other.id.slice(-5)}: ${locate(other, new Date().toISOString()).label}` : tr('ไม่พบเลขนี้ในระบบ', 'Number not found'), false);
              return;
            }
            show(tr(`พบ ${hit.id.slice(-5)} ✓`, `Found ${hit.id.slice(-5)} ✓`), true);
            go(nextStep(hit)?.step === 8 ? { name: 'receive', id: hit.id } : { name: 'count', id: hit.id });
          }} />
        <ToastView toast={toast} />
      </div>
    </>
  );
}

function Receive({ rtv, go }: { rtv: Rtv; go(s: Screen): void }) {
  const { scanned, next, onScan, toast } = useBoxScan(rtv);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const total = rtv.boxes.length;
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await act(rtv.id, { type: 'advance', payload: { step: 8, boxes: scanned.length } }, ME);
      go({ name: 'count', id: rtv.id, received: scanned.length });
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <>
      <AppBar title={tr('รับเข้าคลัง', 'Receive at warehouse')} dark onBack={() => go({ name: 'home' })} right={<span className="ma-count">{scanned.length}/{total}</span>} />
      <div className="ma-body ma-dark">
        <p className="ma-dark-head mono">{rtv.id}<span>{shortStore(rtv.storeId)}</span></p>
        <ScanCamera kind="barcode" target={next?.no ?? null} hint={tr('แตะเพื่อสแกนป้ายกล่อง', 'Tap to scan a box label')} manualHint={tr('เช่น B01', 'e.g. B01')} onScan={onScan}>
          <div className="ma-chips">
            {rtv.boxes.map(b => <span key={b.no} className={`ma-chip${scanned.includes(b.no) ? ' is-ok' : ''}`}>{scanned.includes(b.no) ? '✓ ' : ''}{b.no.slice(-3)}</span>)}
          </div>
        </ScanCamera>
        <ToastView toast={toast} />
        {err && <p className="ma-err" role="alert">{err}</p>}
      </div>
      <footer className="ma-foot ma-foot-dark">
        {scanned.length > 0 && scanned.length < total && <p className="ma-warn">{tr(`ยังขาด ${total - scanned.length} กล่อง — ระบบจะแจ้งกล่องขาด`, `${total - scanned.length} boxes still missing. A short-box alert will be sent`)}</p>}
        <button type="button" className="ma-btn" disabled={busy || scanned.length === 0} onClick={() => { void submit(); }}>
          {tr(`ยืนยันรับเข้า ${scanned.length} กล่อง`, `Confirm ${scanned.length} boxes received`)}
        </button>
      </footer>
    </>
  );
}

function Count({ rtv, received, go }: { rtv: Rtv; received?: number; go(s: Screen): void }) {
  const [counts, setCounts] = useState<number[]>(() => rtv.boxes.map(b => b.expectedPcs));
  const [tk, setTk] = useState(() => `TK26${String(10000 + (rtv.id.length * 977 + Number(rtv.id.slice(-3))) % 9000)}`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (i: number, n: number) => setCounts(c => c.map((x, j) => (j === i ? Math.max(0, n) : x)));
  const mismatch = counts.some((n, i) => n !== rtv.boxes[i].expectedPcs);
  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await act(rtv.id, { type: 'advance', payload: { step: 9, tk, counts } }, ME);
      go({ name: 'done', id: rtv.id, mismatch });
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <>
      <AppBar title={tr('ตรวจนับ', 'Count')} onBack={() => go({ name: 'home' })} />
      <div className="ma-body">
        {received !== undefined && <p className="ma-ok">{tr(`รับเข้าแล้ว ${received}/${rtv.boxes.length} กล่อง ✓`, `Received ${received}/${rtv.boxes.length} boxes ✓`)}</p>}
        <p className="mono ma-strong">{rtv.id}</p>
        <label className="ma-field">{tr('เลข TK', 'TK number')}
          <input className="ma-input mono" value={tk} onChange={e => setTk(e.target.value)} />
        </label>
        {rtv.boxes.map((b, i) => {
          const diff = counts[i] !== b.expectedPcs;
          return (
            <div key={b.no} className={`ma-card ma-count-row${diff ? ' is-diff' : ''}`} data-testid="m-count-row">
              <div><strong className="mono">{b.no.slice(-3)}</strong><span className="ma-small ma-muted">{tr(`แจ้งไว้ ${b.expectedPcs} ชิ้น`, `Declared ${b.expectedPcs} pcs`)}</span></div>
              <div className="ma-stepper">
                <button type="button" aria-label={tr(`ลด ${b.no.slice(-3)}`, `Decrease ${b.no.slice(-3)}`)} onClick={() => set(i, counts[i] - 1)}>−</button>
                <input aria-label={tr(`จำนวนที่นับ ${b.no.slice(-3)}`, `Counted ${b.no.slice(-3)}`)} inputMode="numeric" value={counts[i]}
                  onChange={e => set(i, Number(e.target.value.replace(/\D/g, '')) || 0)} />
                <button type="button" aria-label={tr(`เพิ่ม ${b.no.slice(-3)}`, `Increase ${b.no.slice(-3)}`)} onClick={() => set(i, counts[i] + 1)}>+</button>
              </div>
            </div>
          );
        })}
        {mismatch && <p className="ma-warn">{tr('ยอดไม่ตรงกับที่แจ้ง ระบบจะส่งให้ Brand ยืนยัน', 'Count differs from the declared quantity. It will go to Brand to confirm')}</p>}
        {err && <p className="ma-err" role="alert">{err}</p>}
      </div>
      <footer className="ma-foot">
        <button type="button" className="ma-btn" disabled={busy} onClick={() => { void submit(); }}>{tr('ยืนยันผลตรวจนับ', 'Confirm count')}</button>
      </footer>
    </>
  );
}

function Done({ id, mismatch, go }: { id: string; mismatch: boolean; go(s: Screen): void }) {
  return (
    <div className="ma-done">
      <span className="ma-done-check" aria-hidden="true">✓</span>
      <h3>{tr('ตรวจนับเสร็จ', 'Count complete')}</h3>
      <p className="mono">{id}</p>
      <p className="ma-small ma-muted">{mismatch ? tr('ยอดไม่ตรง — ส่งให้ Brand ยืนยันยอดแล้ว', 'Count differs. Sent to Brand to confirm quantity') : tr('ยอดตรง — ส่งต่อ Admin CN เพื่อออก CN', 'Count matches. Passed to CN admin to issue the CN')}</p>
      <button type="button" className="ma-btn" onClick={() => go({ name: 'home' })}>{tr('กลับหน้าหลัก', 'Back to home')}</button>
      <Link className="ma-link" to={`/track/${id}`}>{tr('ดูใน Track & Trace →', 'View in Track & Trace →')}</Link>
    </div>
  );
}

/** CMG warehouse receiving app (steps 8–9) inside an iPhone mock. */
export default function WarehouseApp({ firstId }: { firstId?: string } = {}) {
  const { rtvs } = useRtvList();
  const { identity } = useSession();
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const mine = rtvs.filter(r => canAct(r, 'WH', identity));
  const inbound = mine.filter(r => nextStep(r)?.step === 8);
  const toCount = mine.filter(r => nextStep(r)?.step === 9);
  const rtv = 'id' in screen ? rtvs.find(r => r.id === screen.id) : undefined;
  const dark = screen.name === 'find' || screen.name === 'receive';

  let body;
  if ('id' in screen && !rtv) body = <p className="ma-empty">{tr('กำลังโหลด…', 'Loading…')}</p>;
  else switch (screen.name) {
    case 'home': body = <Home inbound={inbound} toCount={toCount} go={setScreen} />; break;
    case 'find': body = <Find pool={[...inbound, ...toCount]} all={rtvs} go={setScreen} firstId={firstId} />; break;
    case 'receive': body = <Receive key={screen.id} rtv={rtv!} go={setScreen} />; break;
    case 'count': body = <Count key={screen.id} rtv={rtv!} received={screen.received} go={setScreen} />; break;
    case 'done': body = <Done id={screen.id} mismatch={screen.mismatch} go={setScreen} />; break;
  }
  return <IPhone label={tr('แอปคลัง CMG — สแกนรับสินค้า', 'CMG warehouse app: scan to receive')} dark={dark}><div className="ma-app">{body}</div></IPhone>;
}
