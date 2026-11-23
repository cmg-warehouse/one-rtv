import { useEffect, useRef, useState, type ReactNode } from 'react';
import { THAILAND, type LngLat } from '../domain/geo';

/** SVG user units per degree; longitude is squeezed by cos(13°) so central Thailand keeps its shape. */
const K = 100;
const LNG_SCALE = 0.974;

export function project([lng, lat]: LngLat): [number, number] {
  return [(lng - 97) * K * LNG_SCALE, (21 - lat) * K];
}

export interface View { x: number; y: number; w: number; h: number }

export const VIEW_TH: View = { x: 0, y: 20, w: 880, h: 1560 };
export const VIEW_BKK: View = { x: 288, y: 662, w: 120, h: 120 };

/** Fit a view around points (in lng/lat) with padding; keeps a minimum size so a single point is not zoomed to nothing. */
export function fitView(points: LngLat[], minSize = 60, pad = 0.25): View {
  const xy = points.map(project);
  const xs = xy.map(p => p[0]);
  const ys = xy.map(p => p[1]);
  const x0 = Math.min(...xs); const x1 = Math.max(...xs);
  const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const size = Math.max(minSize, (x1 - x0) * (1 + pad * 2), (y1 - y0) * (1 + pad * 2));
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2;
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size };
}

const OUTLINE = THAILAND.map(p => project(p).map(n => n.toFixed(1)).join(',')).join(' ');

/** Tweens the viewBox to a new target so zooming between country and Bangkok feels like a map. */
function useAnimatedView(target: View): View {
  const [view, setView] = useState(target);
  const from = useRef(target);
  const current = useRef(target);
  useEffect(() => {
    from.current = current.current;
    const start = performance.now();
    const dur = 450;
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      const e = 1 - (1 - k) ** 3;
      const f = from.current;
      const v = {
        x: f.x + (target.x - f.x) * e, y: f.y + (target.y - f.y) * e,
        w: f.w + (target.w - f.w) * e, h: f.h + (target.h - f.h) * e,
      };
      current.current = v;
      setView(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target.x, target.y, target.w, target.h]); // eslint-disable-line react-hooks/exhaustive-deps
  return view;
}

interface Props {
  view: View;
  /** Render prop: `u` is roughly one screen pixel in SVG units at the current zoom, for constant-size markers. */
  children: (u: number) => ReactNode;
  className?: string;
  label: string;
  onBackgroundClick?: () => void;
  /** Approximate rendered size (px) of the map's limiting side, so markers keep a constant screen size. */
  px?: number;
}

export default function ThaiMap({ view: target, children, className, label, onBackgroundClick, px = 640 }: Props) {
  const view = useAnimatedView(target);
  const u = Math.max(view.w, view.h) / px;
  return (
    <svg className={`thai-map${className ? ` ${className}` : ''}`} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
      preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
      <defs>
        <pattern id="map-grid" width={K} height={K} patternUnits="userSpaceOnUse">
          <path d={`M ${K} 0 L 0 0 0 ${K}`} fill="none" stroke="var(--map-grid)" strokeWidth={u * 0.8} />
        </pattern>
      </defs>
      <rect x={-200} y={-200} width={1400} height={2000} fill="var(--map-sea)" onClick={onBackgroundClick} />
      <rect x={-200} y={-200} width={1400} height={2000} fill="url(#map-grid)" pointerEvents="none" />
      <polygon points={OUTLINE} fill="var(--map-land)" stroke="var(--map-border)" strokeWidth={u * 1.5}
        strokeLinejoin="round" onClick={onBackgroundClick} />
      {children(u)}
    </svg>
  );
}

/** A small delivery-truck glyph centred on (x, y). */
export function TruckGlyph({ x, y, u, color = 'var(--color-text)' }: { x: number; y: number; u: number; color?: string }) {
  const s = u * 1.1;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} pointerEvents="none">
      <circle r={13} fill={color} stroke="#fff" strokeWidth={2.5} />
      <path d="M-7 -4 h8 v8 h-8 z M1 -1 h3.5 l2.5 3 v2 h-6 z" fill="#fff" />
      <circle cx={-4} cy={5} r={1.8} fill="#fff" /><circle cx={4} cy={5} r={1.8} fill="#fff" />
    </g>
  );
}
