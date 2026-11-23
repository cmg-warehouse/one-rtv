import { buildPromoSeed } from '../data/promoSeed';
import { buildSeed } from '../data/seed';
import type { PromoEvent, Rtv } from '../domain/types';

// v2: brand ids became CMG brand codes (Poolfleet master). v3: MIM moved from the RTV onto each box.
// v4: promotion pickups (งานเก็บโปร) and their RTVs. Older saved data is reseeded.
const KEY = 'one-rtv.data.v4';
const PROMO_KEY = 'one-rtv.promo.v1';

// Kept so the app still works for the page session when localStorage is unavailable.
let cache: Rtv[] | null = null;
let promoCache: PromoEvent[] | null = null;
// True after a failed write: the in-memory copy is then newer than whatever is stored.
let dirty = false;

function readStored<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

function write(key: string, list: unknown[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    dirty = true; // storage unavailable: the in-memory copy carries on
  }
}

export function saveAll(list: Rtv[]): void {
  cache = list;
  dirty = false;
  write(KEY, list);
}

export function savePromos(list: PromoEvent[]): void {
  promoCache = list;
  write(PROMO_KEY, list);
}

/** RTVs and promotion pickups are seeded together: the pickups own some of the RTVs. */
function seed(): void {
  const now = new Date();
  const rtvs = buildSeed(now);
  const promo = buildPromoSeed(rtvs, now);
  saveAll([...rtvs, ...promo.rtvs]);
  savePromos(promo.events);
}

export function loadAll(): Rtv[] {
  if (dirty && cache) return cache;
  const stored = readStored<Rtv>(KEY);
  if (stored) {
    cache = stored;
    return stored;
  }
  if (cache) return cache;
  seed();
  return cache!;
}

export function loadPromos(): PromoEvent[] {
  if (dirty && promoCache) return promoCache;
  loadAll(); // seeds both stores on first use
  const stored = readStored<PromoEvent>(PROMO_KEY);
  if (stored) {
    promoCache = stored;
    return stored;
  }
  return promoCache ?? [];
}

export function resetAll(): void {
  seed();
}

/** Test helper: forget the in-memory copy so the next load starts cold. */
export function __clearCache(): void {
  cache = null;
  promoCache = null;
  dirty = false;
}
