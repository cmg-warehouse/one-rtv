import { buildSeed } from '../data/seed';
import { computeMetrics } from './metrics';

const now = '2026-11-12T03:00:00Z';

test('counts, owners and segments', () => {
  const m = computeMetrics(buildSeed(new Date(now)), now);
  expect(m.open + m.closed + m.cancelled).toBe(buildSeed(new Date(now)).length);
  expect(Object.values(m.byStep).reduce((a, b) => a + b, 0)).toBe(m.open);
  expect(m.byOwner.reduce((a, o) => a + o.count, 0)).toBe(m.open);
  expect(m.byOwner.find(o => o.role === 'BRAND')!.count).toBeGreaterThanOrEqual(3);
  expect(m.segments.map(s => s.label)).toEqual(['เปิดคำสั่ง → เก็บ', 'เก็บ → CMG รับ', 'CMG รับ → CN']);
  m.segments.forEach(s => expect(s.avgDays).toBeGreaterThan(0));
});

test('no data gives nulls, not NaN', () => {
  const m = computeMetrics([], now);
  expect(m.segments.every(s => s.avgDays === null)).toBe(true);
  expect(m.byOwner).toEqual([]);
  expect(Object.values(m.byHold).every(h => h.count === 0 && h.avgWaitDays === 0)).toBe(true);
});

test('owners are sorted by count and holds are counted', () => {
  const m = computeMetrics(buildSeed(new Date(now)), now);
  const counts = m.byOwner.map(o => o.count);
  expect(counts).toEqual([...counts].sort((a, b) => b - a));
  expect(Object.values(m.byHold).reduce((a, h) => a + h.count, 0)).toBeGreaterThan(0);
  expect(m.byHold.WAIT_RTV_NOTE.avgWaitDays).toBeGreaterThanOrEqual(0);
});
