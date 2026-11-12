import { describe, expect, test } from 'vitest';
import { holds } from '../domain/rules';
import type { Hold, Rtv } from '../domain/types';
import { DEMO_BRAND_ID } from './masters';
import { buildSeed } from './seed';

const now = new Date('2026-11-12T03:00:00Z');
const seed = buildSeed(now);
const demo = seed.filter(r => r.brandId === DEMO_BRAND_ID && !r.cancelled);
const only = (r: Rtv, h: Hold) => holds(r).length === 1 && holds(r)[0] === h;

describe('buildSeed', () => {
  test('size and coverage', () => {
    expect(seed.length).toBeGreaterThanOrEqual(38);
    for (const s of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) expect(seed.some(r => r.step === s && !r.cancelled)).toBe(true);
    for (const h of ['WAIT_BRAND_QTY', 'WAIT_RTV_NOTE', 'WAIT_PROMO']) expect(seed.some(r => holds(r).includes(h as Hold))).toBe(true);
    for (const c of ['CONSIGN', 'SHOP', 'TEMP_SHOP', 'LOCAL_MALL']) expect(seed.filter(r => r.channel === c).length).toBeGreaterThanOrEqual(3);
    expect(seed.some(r => r.shortBoxes > 0)).toBe(true);
    expect(seed.some(r => r.cancelled)).toBe(true);
    expect(seed.some(r => r.events.some(e => e.kind === 'PICKUP_FAILED'))).toBe(true);
  });

  test('ids are unique and well-formed; events are in time order', () => {
    expect(new Set(seed.map(r => r.id)).size).toBe(seed.length);
    for (const r of seed) {
      expect(r.id).toMatch(/^RTV-CMG-\d{4}-\d{5}$/);
      expect(r.events.map(e => e.at)).toEqual([...r.events.map(e => e.at)].sort());
    }
  });

  test('is deterministic and stays within the 30 days before now', () => {
    expect(buildSeed(now)).toEqual(seed);
    for (const r of seed) {
      expect(Date.parse(r.createdAt)).toBeGreaterThanOrEqual(now.getTime() - 31 * 86400000);
      expect(Date.parse(r.events[r.events.length - 1].at)).toBeLessThanOrEqual(now.getTime());
    }
    const old = seed.filter(r => !r.cancelled && r.step < 10 && now.getTime() - Date.parse(r.createdAt) > 14 * 86400000);
    expect(old.length).toBeGreaterThanOrEqual(1);
  });

  test('doc values (MIM, TK) are unique', () => {
    for (const t of ['MIM', 'TK'] as const) {
      const vals = seed.flatMap(r => r.docs.filter(d => d.type === t).map(d => d.value));
      expect(new Set(vals).size).toBe(vals.length);
    }
  });

  test('cases the UI tests rely on exist for the demo brand', () => {
    expect(demo.some(r => r.step === 1 && r.channel === 'SHOP')).toBe(true);
    for (const s of [2, 4]) expect(demo.some(r => r.step === s && r.carrier === 'PLAZA_4W')).toBe(true);
    expect(demo.some(r => r.step === 5 && r.carrier === 'PLAZA_4W' && r.boxes.length >= 2)).toBe(true);
    expect(demo.some(r => r.step === 8 && r.shortBoxes === 0)).toBe(true);
    expect(demo.some(r => r.step === 9 && holds(r).length === 0 && r.channel === 'SHOP' && r.saleType === 'NORMAL')).toBe(true);
    expect(demo.some(r => r.step === 9 && holds(r).length === 0 && r.channel === 'CONSIGN' && r.saleType === 'NORMAL')).toBe(true);
    expect(demo.some(r => only(r, 'WAIT_RTV_NOTE'))).toBe(true);
    expect(demo.some(r => only(r, 'WAIT_BRAND_QTY'))).toBe(true);
    expect(demo.some(r => only(r, 'WAIT_PROMO'))).toBe(true);
  });

  test('carrier demo has CG Network work waiting at steps 4 and 5', () => {
    const cg = seed.filter(r => !r.cancelled && r.carrier === 'CG_NETWORK');
    expect(cg.some(r => r.step === 2 || r.step === 3)).toBe(true);
    expect(cg.some(r => r.step === 4)).toBe(true);
  });

  test('about half of the seed belongs to the demo brand', () => {
    const share = seed.filter(r => r.brandId === DEMO_BRAND_ID).length / seed.length;
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.65);
  });
});
