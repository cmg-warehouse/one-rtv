import { buildSeed } from '../data/seed';
import { locate, route, viaScdc } from './geo';
import { boxTrace, milestones } from './track';
import type { Rtv } from './types';

const NOW = new Date('2026-11-12T05:00:00Z');
const seed = buildSeed(NOW);
const find = (pred: (r: Rtv) => boolean) => {
  const r = seed.find(pred);
  if (!r) throw new Error('no seeded RTV matches');
  return r;
};

test('4W Plaza skips SCDC: route goes store → CMG and the SCDC milestone is skipped', () => {
  const r = find(r => r.carrier === 'PLAZA_4W' && !r.cancelled);
  expect(viaScdc(r)).toBe(false);
  expect(route(r).map(p => p.id)).toEqual([r.storeId, 'CMG']);
  expect(milestones(r).find(m => m.key === 'scdc')?.state).toBe('skipped');
});

test('collected goods are on the road towards the next hub', () => {
  const r = find(r => r.step === 5 && r.carrier === 'CG_NETWORK' && !r.cancelled);
  const loc = locate(r, NOW.toISOString());
  expect(loc.kind).toBe('ROAD');
  if (loc.kind === 'ROAD') {
    expect(loc.to).toEqual({ kind: 'HUB', id: 'SCDC' });
    expect(loc.progress).toBeGreaterThan(0);
    expect(loc.progress).toBeLessThan(1);
  }
});

test('exactly one milestone is current on an open RTV, none on a closed one', () => {
  const open = find(r => r.step === 6 && !r.cancelled);
  expect(milestones(open).filter(m => m.state === 'current')).toHaveLength(1);
  const closed = find(r => r.step === 10);
  expect(milestones(closed).some(m => m.state === 'current')).toBe(false);
  expect(locate(closed, NOW.toISOString()).kind).toBe('DONE');
});

test('Consign: plan milestone is done right after creation (step 2 auto, step 3 skipped)', () => {
  const r = find(r => r.channel === 'CONSIGN' && r.step === 2 && !r.cancelled);
  expect(milestones(r).find(m => m.key === 'plan')?.state).toBe('done');
});

test('box trace marks the missing box at the scan point that reported it', () => {
  const r = find(r => r.shortBoxes > 0 && r.step === 5);
  const marks = boxTrace(r);
  expect(marks.filter(b => b.pickup === 'missing')).toHaveLength(r.shortBoxes);
  expect(marks.every(b => b.cmg === 'pending')).toBe(true);
});
