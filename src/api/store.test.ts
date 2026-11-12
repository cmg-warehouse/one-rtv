import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { rtv } from '../domain/testing';
import { __clearCache, loadAll, saveAll } from './store';

beforeEach(() => {
  localStorage.clear();
  __clearCache();
});
afterEach(() => vi.restoreAllMocks());

test('after a failed write the in-memory copy wins over stale stored data', () => {
  const first = [rtv({ id: 'RTV-A' })];
  saveAll(first);                                   // stored OK
  const second = [rtv({ id: 'RTV-A' }), rtv({ id: 'RTV-B' })];
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
  saveAll(second);                                  // write fails: storage still holds `first`
  expect(loadAll().map(r => r.id)).toEqual(['RTV-A', 'RTV-B']);
});

test('once a write succeeds again, stored data is read as usual', () => {
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('quota'); });
  saveAll([rtv({ id: 'RTV-A' })]);
  spy.mockRestore();
  saveAll([rtv({ id: 'RTV-C' })]);
  localStorage.setItem('one-rtv.data.v1', JSON.stringify([rtv({ id: 'RTV-FROM-ANOTHER-TAB' })]));
  expect(loadAll().map(r => r.id)).toEqual(['RTV-FROM-ANOTHER-TAB']);
});
