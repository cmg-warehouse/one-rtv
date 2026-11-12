import { buildSeed } from '../data/seed';
import type { Rtv } from '../domain/types';

const KEY = 'one-rtv.data.v1';

// Kept so the app still works for the page session when localStorage is unavailable.
let cache: Rtv[] | null = null;
// True after a failed write: the in-memory copy is then newer than whatever is stored.
let dirty = false;

function readStored(): Rtv[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as Rtv[]) : null;
  } catch {
    return null;
  }
}

export function saveAll(list: Rtv[]): void {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    dirty = false;
  } catch {
    dirty = true; // storage unavailable: the in-memory copy carries on
  }
}

export function loadAll(): Rtv[] {
  if (dirty && cache) return cache;
  const stored = readStored();
  if (stored) {
    cache = stored;
    return stored;
  }
  if (cache) return cache;
  const seed = buildSeed(new Date());
  saveAll(seed);
  return seed;
}

export function resetAll(): void {
  saveAll(buildSeed(new Date()));
}

/** Test helper: forget the in-memory copy so the next load starts cold. */
export function __clearCache(): void {
  cache = null;
  dirty = false;
}
