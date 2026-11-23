import * as machine from '../domain/machine';
import type { Ctx, NewRtvInput, StepPayload } from '../domain/machine';
import * as promo from '../domain/promo';
import type { PickupInput, PromoInput } from '../domain/promo';
import type { DocRef, PromoEvent, Role, Rtv, Vehicle } from '../domain/types';
import { loadAll, loadPromos, resetAll, saveAll, savePromos } from './store';
import { tr } from '../i18n';

export type Action =
  | { type: 'advance'; payload: StepPayload } | { type: 'failPickup'; reason: string }
  | { type: 'clearShortFlag'; note: string } | { type: 'brandConfirmQty' } | { type: 'brandRequestRecount' }
  | { type: 'confirmPromo' } | { type: 'addDoc'; doc: DocRef } | { type: 'cancel'; reason: string }
  | { type: 'setBoxMims'; mims: Record<string, string> };

interface Actor { role: Role; actor: string }

/** Window event fired after every successful write, so open pages and the tour overlay can refresh. */
export const CHANGED_EVENT = 'one-rtv:changed';
function notify(id?: string): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CHANGED_EVENT, { detail: id }));
}

const withNow = (a: Actor): Ctx => ({ role: a.role, actor: a.actor, now: new Date().toISOString() });
const seqOf = (id: string): number => Number(id.split('-').pop()) || 0;

function apply(rtv: Rtv, action: Action, ctx: Ctx): Rtv {
  switch (action.type) {
    case 'advance': return machine.advance(rtv, action.payload, ctx);
    case 'failPickup': return machine.failPickup(rtv, action.reason, ctx);
    case 'clearShortFlag': return machine.clearShortFlag(rtv, action.note, ctx);
    case 'brandConfirmQty': return machine.brandConfirmQty(rtv, ctx);
    case 'brandRequestRecount': return machine.brandRequestRecount(rtv, ctx);
    case 'confirmPromo': return machine.confirmPromo(rtv, ctx);
    case 'addDoc': return machine.addDoc(rtv, action.doc, ctx);
    case 'cancel': return machine.cancel(rtv, action.reason, ctx);
    case 'setBoxMims': return machine.setBoxMims(rtv, action.mims, ctx);
  }
}

export async function listRtvs(): Promise<Rtv[]> {
  return [...loadAll()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export async function getRtv(id: string): Promise<Rtv | null> {
  return loadAll().find(r => r.id === id) ?? null;
}

export async function createRtv(input: NewRtvInput, actor: Actor): Promise<Rtv> {
  const all = loadAll();
  const seq = Math.max(0, ...all.map(r => seqOf(r.id))) + 1;
  const rtv = machine.createRtv(input, seq, withNow(actor));
  saveAll([...all, rtv]);
  notify(rtv.id);
  return rtv;
}

export async function act(id: string, action: Action, actor: Actor): Promise<Rtv> {
  const all = loadAll();
  const current = all.find(r => r.id === id);
  if (!current) throw new Error(tr(`ไม่พบรายการ ${id}`, `Return order ${id} not found`));
  const updated = apply(current, action, withNow(actor));
  saveAll(all.map(r => (r.id === id ? updated : r)));
  notify(id);
  return updated;
}

export type PromoAction =
  | { type: 'forward' } | { type: 'confirmVehicles'; vehicles: Vehicle[] } | { type: 'recordPickup'; input: PickupInput };

export async function listPromos(): Promise<PromoEvent[]> {
  return [...loadPromos()].sort((a, b) => b.pickupAt.localeCompare(a.pickupAt) || b.id.localeCompare(a.id));
}

export async function getPromo(id: string): Promise<PromoEvent | null> {
  return loadPromos().find(e => e.id === id) ?? null;
}

function savePromoResult(res: promo.PromoResult, isNew: boolean): void {
  const all = loadAll();
  const byId = new Map(res.rtvs.map(r => [r.id, r]));
  saveAll(isNew ? [...all, ...res.rtvs] : all.map(r => byId.get(r.id) ?? r));
  const events = loadPromos();
  savePromos(isNew ? [...events, res.event] : events.map(e => (e.id === res.event.id ? res.event : e)));
  notify(res.event.id);
}

export async function createPromo(input: PromoInput, actor: Actor): Promise<PromoEvent> {
  const all = loadAll();
  const rtvSeq = Math.max(0, ...all.map(r => seqOf(r.id))) + 1;
  const seq = Math.max(0, ...loadPromos().map(e => seqOf(e.id))) + 1;
  const res = promo.createPromo(input, seq, rtvSeq, withNow(actor));
  savePromoResult(res, true);
  return res.event;
}

export async function actPromo(id: string, action: PromoAction, actor: Actor): Promise<PromoEvent> {
  const event = loadPromos().find(e => e.id === id);
  if (!event) throw new Error(tr(`ไม่พบงาน ${id}`, `Promo pickup ${id} not found`));
  const rtvs = loadAll();
  const ctx = withNow(actor);
  const res = action.type === 'forward' ? promo.forwardPromo(event, rtvs, ctx)
    : action.type === 'confirmVehicles' ? promo.confirmVehicles(event, rtvs, action.vehicles, ctx)
    : promo.recordPickup(event, rtvs, action.input, ctx);
  savePromoResult(res, false);
  return res.event;
}

export async function searchByAnyNumber(q: string): Promise<Rtv[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const hit = (v: string) => v.toLowerCase().includes(needle);
  return (await listRtvs()).filter(r => hit(r.id) || r.boxes.some(b => hit(b.no) || (!!b.mim && hit(b.mim))) || r.docs.some(d => hit(d.value)));
}

/** Tour snapshots only: replaces the RTV with the same id, or adds it. */
export async function putRtv(rtv: Rtv): Promise<void> {
  const all = loadAll();
  saveAll(all.some(r => r.id === rtv.id) ? all.map(r => (r.id === rtv.id ? rtv : r)) : [...all, rtv]);
  notify(rtv.id);
}

/** Tour snapshots only: replaces the pickup with the same id, or adds it. */
export async function putPromo(event: PromoEvent): Promise<void> {
  const all = loadPromos();
  savePromos(all.some(e => e.id === event.id) ? all.map(e => (e.id === event.id ? event : e)) : [...all, event]);
  notify(event.id);
}

export async function resetData(): Promise<void> {
  resetAll();
  notify();
}
