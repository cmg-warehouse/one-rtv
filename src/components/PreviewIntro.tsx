import { useEffect, useState } from 'react';
import { tr } from '../i18n';
import { GHOST, MARK, NAME } from './oneRtvLogoPaths';

const EVENT = 'one-rtv:preview-intro';
const LENGTH_MS = 3000;
const REDUCED_MS = 1200;

/** Plays the One RTV logo cut scene over whatever page is opening underneath. */
export function playPreviewIntro(): void {
  window.dispatchEvent(new Event(EVENT));
}

// PDF space is y-up; flip it into SVG space.
const FLIP = 'matrix(1 0 0 -1 0 320)';

/**
 * Full-screen logo reveal shown on the way into the live-system preview:
 * speed lines streak in, the red "1" lands, then the wordmark wipes in.
 * Any click or key skips it. Off under the test runner unless `enabled` is passed.
 */
export default function PreviewIntro({ enabled = import.meta.env.MODE !== 'test' }: { enabled?: boolean }) {
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const start = () => setRun(n => n + 1);
    window.addEventListener(EVENT, start);
    return () => window.removeEventListener(EVENT, start);
  }, [enabled]);

  useEffect(() => {
    if (!run) return;
    const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const stop = () => setRun(0);
    const t = window.setTimeout(stop, reduced ? REDUCED_MS : LENGTH_MS);
    window.addEventListener('keydown', stop);
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', stop); };
  }, [run]);

  if (!run) return null;
  return (
    <div className="pi" key={run} onClick={() => setRun(0)}>
      <div className="pi-stage">
        <svg viewBox="0 0 480 320" role="img" aria-label="One RTV">
          <g className="pi-ghost">
            <g transform={FLIP}><g transform="matrix(1.37 0 0 1.37 -68 -27)">
              {GHOST.map((p, i) => <path key={i} d={p.d} fill={p.fill} />)}
            </g></g>
          </g>
          {MARK.slice(2).map((p, i) => (
            <g key={i} className={`pi-line pi-line-${i}`}>
              <g transform={FLIP}><path d={p.d} fill={p.fill} fillOpacity={0.75} /></g>
            </g>
          ))}
          <g className="pi-mark">
            <g transform={FLIP}>
              {MARK.slice(0, 2).map((p, i) => <path key={i} d={p.d} fill={p.fill} fillOpacity={0.75} />)}
            </g>
          </g>
          <g className="pi-name">
            <g transform={FLIP}><g transform="matrix(1.39 0 0 1.39 -72 -55)">
              {NAME.map((p, i) => <path key={i} d={p.d} fill={p.fill} />)}
            </g></g>
          </g>
        </svg>
        <span className="pi-shine" aria-hidden="true" />
      </div>
      <p className="pi-tag">{tr('ตัวอย่างระบบจริง', 'Live system preview')}</p>
      <button type="button" className="pi-skip" onClick={() => setRun(0)}>{tr('ข้าม', 'Skip')}</button>
    </div>
  );
}
