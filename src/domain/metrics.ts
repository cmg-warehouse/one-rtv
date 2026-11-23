import { daysBetween } from './format';
import { HOLDS, holds, isClosed, owner, STEPS } from './rules';
import type { Hold, Role, Rtv, Step } from './types';
import { tr } from '../i18n';

export interface Metrics {
  open: number; closed: number; cancelled: number;
  byStep: Record<Step, number>;                 // open RTVs by last completed step
  byOwner: { role: Role; count: number; oldestDays: number }[];   // open RTVs, sorted by count desc
  byHold: Record<Hold, { count: number; avgWaitDays: number }>;
  segments: { label: string; avgDays: number | null; n: number }[];
  shortBoxOpen: number;
}

/** Time of the latest STEP event for `step`, or null. */
function stepAt(rtv: Rtv, step: Step): string | null {
  const times = rtv.events.filter(e => e.kind === 'STEP' && e.step === step).map(e => e.at);
  return times.length ? times.reduce((a, b) => (a > b ? a : b)) : null;
}

const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
const round1 = (n: number): number => Math.round(n * 10) / 10;

export function computeMetrics(rtvs: Rtv[], now: string): Metrics {
  const cancelled = rtvs.filter(r => r.cancelled);
  const closed = rtvs.filter(r => !r.cancelled && r.step === 10);
  const open = rtvs.filter(r => !isClosed(r));

  const byStep = Object.fromEntries(STEPS.map(s => [s, 0])) as Record<Step, number>;
  open.forEach(r => { byStep[r.step] += 1; });

  const owners = new Map<Role, { count: number; oldestDays: number }>();
  for (const r of open) {
    const role = owner(r);
    if (!role) continue;
    const age = daysBetween(r.createdAt, now);
    const cur = owners.get(role) ?? { count: 0, oldestDays: 0 };
    owners.set(role, { count: cur.count + 1, oldestDays: Math.max(cur.oldestDays, age) });
  }
  const byOwner = [...owners].map(([role, v]) => ({ role, ...v })).sort((a, b) => b.count - a.count);

  const byHold = {} as Metrics['byHold'];
  for (const h of HOLDS) {
    const waits = open.filter(r => holds(r).includes(h))
      .map(r => { const at = stepAt(r, 9); return at ? daysBetween(at, now) : null; })
      .filter((w): w is number => w !== null);
    const count = open.filter(r => holds(r).includes(h)).length;
    byHold[h] = { count, avgWaitDays: waits.length ? round1(avg(waits)) : 0 };
  }

  const segment = (label: string, from: Step, to: Step) => {
    const spans = rtvs.map(r => {
      const a = stepAt(r, from); const b = stepAt(r, to);
      return a && b ? daysBetween(a, b) : null;
    }).filter((d): d is number => d !== null);
    return { label, avgDays: spans.length ? round1(avg(spans)) : null, n: spans.length };
  };

  return {
    open: open.length, closed: closed.length, cancelled: cancelled.length,
    byStep, byOwner, byHold,
    segments: [
      segment(tr('เปิดคำสั่ง → เก็บ', 'Opened → collected'), 1, 5),
      segment(tr('เก็บ → CMG รับ', 'Collected → CMG received'), 5, 8),
      segment(tr('CMG รับ → CN', 'CMG received → CN'), 8, 10),
    ],
    shortBoxOpen: open.filter(r => r.shortBoxes > 0).length,
  };
}
