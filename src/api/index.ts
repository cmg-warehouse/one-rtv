import * as machine from '../domain/machine';
import type { Ctx, NewRtvInput, StepPayload } from '../domain/machine';
import type { DocRef, Role, Rtv } from '../domain/types';
import { loadAll, resetAll, saveAll } from './store';

export type Action =
  | { type: 'advance'; payload: StepPayload } | { type: 'failPickup'; reason: string }
  | { type: 'clearShortFlag'; note: string } | { type: 'brandConfirmQty' } | { type: 'brandRequestRecount' }
  | { type: 'confirmPromo' } | { type: 'addDoc'; doc: DocRef } | { type: 'cancel'; reason: string };

interface Actor { role: Role; actor: string }

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
  return rtv;
}

export async function act(id: string, action: Action, actor: Actor): Promise<Rtv> {
  const all = loadAll();
  const current = all.find(r => r.id === id);
  if (!current) throw new Error(`ไม่พบรายการ ${id}`);
  const updated = apply(current, action, withNow(actor));
  saveAll(all.map(r => (r.id === id ? updated : r)));
  return updated;
}

export async function searchByAnyNumber(q: string): Promise<Rtv[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const hit = (v: string) => v.toLowerCase().includes(needle);
  return (await listRtvs()).filter(r => hit(r.id) || r.boxes.some(b => hit(b.no)) || r.docs.some(d => hit(d.value)));
}

/** Tour snapshots only: replaces the RTV with the same id, or adds it. */
export async function putRtv(rtv: Rtv): Promise<void> {
  const all = loadAll();
  saveAll(all.some(r => r.id === rtv.id) ? all.map(r => (r.id === rtv.id ? rtv : r)) : [...all, rtv]);
}

export async function resetData(): Promise<void> {
  resetAll();
}
