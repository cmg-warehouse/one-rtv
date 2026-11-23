import { useRef, useState, type PointerEvent } from 'react';
import { tr } from '../../i18n';

/** Finger signature on a canvas; reports whether anything has been drawn. */
export default function SignaturePad({ onChange }: { onChange(signed: boolean): void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  const point = (e: PointerEvent<HTMLCanvasElement>) => {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height] as const;
  };
  // getContext() is null where canvas is unsupported (jsdom); strokes then count as a signature without drawing.
  const ctx2d = () => { try { return ref.current?.getContext('2d') ?? null; } catch { return null; } };
  const down = (e: PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    ref.current?.setPointerCapture?.(e.pointerId);
    const ctx = ctx2d();
    if (!ctx) return;
    const [x, y] = point(e);
    ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#141414';
    ctx.beginPath(); ctx.moveTo(x, y);
  };
  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    if (!signed) { setSigned(true); onChange(true); }
    const ctx = ctx2d();
    if (!ctx) return;
    const [x, y] = point(e);
    ctx.lineTo(x, y); ctx.stroke();
  };
  const clear = () => {
    const c = ref.current;
    if (c) ctx2d()?.clearRect(0, 0, c.width, c.height);
    setSigned(false); onChange(false);
  };
  return (
    <div className="sign-pad">
      <canvas ref={ref} width={640} height={260} aria-label={tr('ช่องลายเซ็น', 'Signature area')}
        onPointerDown={down} onPointerMove={move} onPointerUp={() => { drawing.current = false; }} />
      {!signed && <span className="sign-pad-hint">{tr('เซ็นชื่อที่นี่', 'Sign here')}</span>}
      <button type="button" className="ma-link sign-pad-clear" onClick={clear}>{tr('ล้าง', 'Clear')}</button>
    </div>
  );
}
