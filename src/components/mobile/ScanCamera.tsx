import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { tr } from '../../i18n';

/** Short scanner beep; silently does nothing where Web Audio is unavailable (tests, locked-down browsers). */
export function beep(ok = true): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = ok ? 1760 : 220;
    g.gain.value = 0.04;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + (ok ? 0.09 : 0.25));
    o.onended = () => { void ctx.close(); };
  } catch { /* no audio */ }
}

/** Decorative 1D barcode derived from the text (not a real symbology). */
export function Barcode({ value, height = 44 }: { value: string; height?: number }) {
  const bars: { x: number; w: number }[] = [];
  let x = 0;
  const seq = `*${value}*`;
  for (let i = 0; i < seq.length; i++) {
    const c = seq.charCodeAt(i);
    for (let k = 0; k < 4; k++) {
      const w = 1 + ((c >> k) & 1) + ((c >> (k + 3)) & 1);
      if (k % 2 === 0) bars.push({ x, w });
      x += w + 1;
    }
  }
  return (
    <svg className="barcode" viewBox={`0 0 ${x} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} />)}
    </svg>
  );
}

interface Props {
  /** What the simulated camera is pointed at; tapping the viewfinder "reads" this value. */
  target: string | null;
  kind: 'qr' | 'barcode';
  /** Caption printed on the simulated label under the code. */
  caption?: ReactNode;
  hint: string;
  onScan(value: string): void;
  /** Manual entry placeholder. */
  manualHint: string;
  /** Read the target by itself shortly after opening (used when a QR is "scanned" from another screen). */
  auto?: boolean;
  children?: ReactNode;
}

/**
 * Simulated phone camera: a dark viewfinder with a label in it and an animated scan line.
 * Tap the viewfinder to read the label, or type the number by hand (real app: device camera / ring scanner).
 */
export default function ScanCamera({ target, kind, caption, hint, onScan, manualHint, children, auto = false }: Props) {
  const [locking, setLocking] = useState(false);
  const [flash, setFlash] = useState(false);
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState('');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const fire = (value: string) => {
    setFlash(true);
    window.setTimeout(() => setFlash(false), 260);
    onScan(value);
  };
  const tap = () => {
    if (!target || locking) return;
    setLocking(true);
    timer.current = window.setTimeout(() => { setLocking(false); fire(target); }, 550);
  };

  // Fires once, as soon as there is something to read (the RTV list loads asynchronously).
  const autoDone = useRef(false);
  useEffect(() => {
    if (!auto || !target || autoDone.current) return;
    autoDone.current = true;
    const t = window.setTimeout(tap, 900);
    // Cancelled before firing (StrictMode re-run, unmount): allow the next run to schedule it again.
    return () => { window.clearTimeout(t); autoDone.current = false; };
  }, [auto, target]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="scan">
      <button type="button" className={`scan-view${locking ? ' is-locking' : ''}${flash ? ' is-flash' : ''}`} onClick={tap}
        aria-label={target ? tr(`แตะเพื่อสแกน ${target}`, `Tap to scan ${target}`) : tr('ไม่มีอะไรให้สแกน', 'Nothing to scan')} disabled={!target}>
        {target ? (
          <span className={`scan-label scan-label-${kind}`} key={target}>
            {kind === 'qr' ? <QRCodeSVG value={target} size={112} /> : <Barcode value={target} />}
            <span className="scan-label-text mono">{caption ?? target}</span>
          </span>
        ) : <span className="scan-empty">{tr('สแกนครบแล้ว', 'All scanned')}</span>}
        <span className="scan-frame"><i /><i /><i /><i /></span>
        <span className="scan-line" />
        <span className="scan-hint">{locking ? tr('กำลังอ่าน…', 'Reading…') : hint}</span>
      </button>
      {children}
      {manual ? (
        <form className="scan-manual" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) { fire(typed.trim()); setTyped(''); } }}>
          <input aria-label={tr('พิมพ์เลข', 'Type the number')} placeholder={manualHint} value={typed} onChange={e => setTyped(e.target.value)} autoFocus />
          <button type="submit" className="ma-btn ma-btn-sm">{tr('ตกลง', 'OK')}</button>
        </form>
      ) : (
        <button type="button" className="ma-link scan-manual-toggle" onClick={() => setManual(true)}>{tr('พิมพ์เลขเอง', 'Type it in')}</button>
      )}
    </div>
  );
}
