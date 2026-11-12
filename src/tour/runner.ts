import { createRtv, getRtv, putRtv } from '../api';
import { ACTORS } from '../data/masters';
import type { Rtv } from '../domain/types';
import { STORIES, type Story } from './stories';

export interface TourState { storyId: Story['id']; rtvId: string; index: number; snapshots: Rtv[] } // snapshots[i] = RTV before step i

export function storyOf(id: Story['id']): Story {
  const story = STORIES.find(s => s.id === id);
  if (!story) throw new Error(`ไม่พบเรื่อง ${id}`);
  return story;
}

export async function startStory(id: Story['id']): Promise<TourState> {
  const story = storyOf(id);
  const rtv = await createRtv(story.create, { role: 'BRAND', actor: ACTORS.BRAND });
  return { storyId: id, rtvId: rtv.id, index: 0, snapshots: [] };
}

export function isFinished(s: TourState): boolean {
  return s.index >= storyOf(s.storyId).steps.length;
}

export async function next(s: TourState): Promise<TourState> {
  if (isFinished(s)) return s;
  const step = storyOf(s.storyId).steps[s.index];
  const before = await getRtv(s.rtvId);
  if (!before) throw new Error(`ไม่พบรายการ ${s.rtvId}`);
  await step.run(s.rtvId, { role: step.role, actor: ACTORS[step.role] });
  return { ...s, index: s.index + 1, snapshots: [...s.snapshots.slice(0, s.index), before] };
}

export async function back(s: TourState): Promise<TourState> {
  if (s.index === 0) return s;
  await putRtv(s.snapshots[s.index - 1]);
  return { ...s, index: s.index - 1, snapshots: s.snapshots.slice(0, s.index - 1) };
}

const KEY = 'one-rtv.tour';
let memory: TourState | null = null;
export const TOUR_EVENT = 'one-rtv:tour';

export function loadTour(): TourState | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as TourState;
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
