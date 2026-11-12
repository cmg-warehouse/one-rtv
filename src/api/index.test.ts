import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FlowError } from '../domain/machine';
import { shopInput } from '../domain/testing';
import { __clearCache } from './store';
import { act, createRtv, getRtv, listRtvs, putRtv, resetData, searchByAnyNumber } from './index';

beforeEach(async () => {
  localStorage.clear();
  __clearCache();
  await resetData();
});
afterEach(() => vi.restoreAllMocks());

test('listRtvs is newest first', async () => {
  const times = (await listRtvs()).map(r => r.createdAt);
  expect(times).toEqual([...times].sort().reverse());
});

test('search by any number, loosely typed', async () => {
  const r = (await listRtvs()).find(x => x.docs.some(d => d.type === 'TK'))!;
  const tk = r.docs.find(d => d.type === 'TK')!.value;
  expect((await searchByAnyNumber(`  ${tk.toLowerCase()} `)).map(x => x.id)).toContain(r.id);
  expect((await searchByAnyNumber(r.id.slice(8))).map(x => x.id)).toContain(r.id);
  expect((await searchByAnyNumber(r.boxes[0].no)).map(x => x.id)).toContain(r.id);
  expect(await searchByAnyNumber('   ')).toEqual([]);
});

test('create then act persists', async () => {
  const r = await createRtv(shopInput, { role: 'BRAND', actor: 'a' });
  await act(r.id, { type: 'advance', payload: { step: 2, carrier: 'PLAZA_4W', pickupDate: '2026-11-13' } }, { role: 'CS', actor: 'b' });
  expect((await getRtv(r.id))!.step).toBe(2);
  __clearCache();
  expect((await getRtv(r.id))!.step).toBe(2);
});

test('new ids use max existing sequence + 1', async () => {
  const seqOf = (id: string) => Number(id.split('-').pop());
  const max = Math.max(...(await listRtvs()).map(r => seqOf(r.id)));
  const r = await createRtv(shopInput, { role: 'BRAND', actor: 'a' });
  expect(seqOf(r.id)).toBe(max + 1);
});

test('act surfaces FlowError and leaves data unchanged', async () => {
  const r = (await listRtvs()).find(x => x.step === 1 && !x.cancelled)!;
  await expect(act(r.id, { type: 'advance', payload: { step: 4 } }, { role: 'CARRIER', actor: 'c' })).rejects.toThrow(FlowError);
  expect((await getRtv(r.id))!.step).toBe(1);
});

test('putRtv replaces by id', async () => {
  const r = (await listRtvs())[0];
  await putRtv({ ...r, shortBoxes: 7 });
  expect((await getRtv(r.id))!.shortBoxes).toBe(7);
});

test('corrupt or unavailable storage falls back to seed', async () => {
  localStorage.setItem('one-rtv.data.v1', '{not json');
  __clearCache();
  expect((await listRtvs()).length).toBeGreaterThanOrEqual(38);
  __clearCache();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
  expect((await listRtvs()).length).toBeGreaterThanOrEqual(38);
  const r = await createRtv(shopInput, { role: 'BRAND', actor: 'a' });
  expect((await getRtv(r.id))!.id).toBe(r.id);
});

test('unknown id returns null', async () => expect(await getRtv('RTV-CMG-0000-00000')).toBeNull());
