import { createPromo, createRtv, getPromo, getRtv, listRtvs, putPromo, putRtv } from '../api';
import { ACTORS, DEMO_BRAND_ID } from '../data/masters';
import type { PromoEvent, Rtv } from '../domain/types';
import { tr } from '../i18n';
import { STORIES, type Story, type TourIds } from './stories';

/** Everything a step may change: the RTV, or for a promotion pickup the pickup and all its RTVs. */
export interface Snapshot { rtvs: Rtv[]; promo?: PromoEvent }

// snapshots[i] = data before step i
export interface TourState { storyId: Story['id']; rtvId: string; promoId?: string; index: number; snapshots: Snapshot[] }

export function storyOf(id: Story['id']): Story {
  const story = STORIES.find(s => s.id === id);
  if (!story) throw new Error(tr(`ไม่พบเรื่อง ${id}`, `Story not found: ${id}`));
  return story;
}

export const idsOf = (s: TourState): TourIds => ({ rtvId: s.rtvId, promoId: s.promoId });

export async function startStory(id: Story['id']): Promise<TourState> {
  const story = storyOf(id);
  if (story.promo) {
    const { pickupInDays, ...input } = story.promo;
    const pickupAt = new Date(Date.now() + pickupInDays * 86_400_000).toISOString();
    const event = await createPromo({ ...input, pickupAt }, { role: 'PROMO', actor: ACTORS.PROMO });
    const line = event.lines.find(l => l.brandId === DEMO_BRAND_ID) ?? event.lines[0];
    return { storyId: id, rtvId: line.rtvId, promoId: event.id, index: 0, snapshots: [] };
  }
  const rtv = await createRtv(story.create!, { role: 'BRAND', actor: ACTORS.BRAND });
  return { storyId: id, rtvId: rtv.id, index: 0, snapshots: [] };
}

export async function takeSnapshot(s: TourState): Promise<Snapshot> {
  if (s.promoId) {
    const promo = await getPromo(s.promoId);
    if (!promo) throw new Error(tr(`ไม่พบงาน ${s.promoId}`, `Pickup not found: ${s.promoId}`));
    return { promo, rtvs: (await listRtvs()).filter(r => r.promoId === s.promoId) };
  }
  const rtv = await getRtv(s.rtvId);
  if (!rtv) throw new Error(tr(`ไม่พบรายการ ${s.rtvId}`, `RTV not found: ${s.rtvId}`));
  return { rtvs: [rtv] };
}

export function isFinished(s: TourState): boolean {
  return s.index >= storyOf(s.storyId).steps.length;
}

export async function next(s: TourState): Promise<TourState> {
  if (isFinished(s)) return s;
  const step = storyOf(s.storyId).steps[s.index];
  const before = await takeSnapshot(s);
  await step.run(idsOf(s), { role: step.role, actor: ACTORS[step.role] });
  return { ...s, index: s.index + 1, snapshots: [...s.snapshots.slice(0, s.index), before] };
}

export async function back(s: TourState): Promise<TourState> {
  if (s.index === 0) return s;
  const snap = s.snapshots[s.index - 1];
  for (const r of snap.rtvs) await putRtv(r);
  if (snap.promo) await putPromo(snap.promo);
  return { ...s, index: s.index - 1, snapshots: s.snapshots.slice(0, s.index - 1) };
}

const KEY = 'one-rtv.tour';
let memory: TourState | null = null;
export const TOUR_EVENT = 'one-rtv:tour';

export function loadTour(): TourState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as TourState;
      // Saved before snapshots covered pickups: those were plain RTVs.
      return { ...s, snapshots: s.snapshots.map(x => ('rtvs' in x ? x : { rtvs: [x as unknown as Rtv] })) };
    }
  } catch { /* fall back to memory */ }
  return memory;
}

export function saveTour(s: TourState | null): void {
  memory = s;
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch { /* in-memory copy carries on */ }
  window.dispatchEvent(new Event(TOUR_EVENT));
}

/** Forget any tour in progress (used by the data reset). */
export function clearTour(): void {
  saveTour(null);
}
