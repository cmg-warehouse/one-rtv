import { getRtv } from '../api';
import { holds, owner } from '../domain/rules';
import type { Hold } from '../domain/types';
import { back, isFinished, next, startStory } from './runner';
import { STORIES, type Story } from './stories';

test.each(STORIES.map(s => [s.id, s.steps.length]))('story %s runs to the end', async (id) => {
  let s = await startStory(id as Story['id']);
  while (!isFinished(s)) s = await next(s);
  const r = (await getRtv(s.rtvId))!;
  expect(r.step).toBe(id === 'failed-pickup' ? 5 : 10);
});
test('step counts match the brief', () => {
  expect(STORIES.map(s => s.steps.length)).toEqual([7, 9, 9, 8, 9]);
});
test('every step is performed by the role it names', async () => {
  for (const story of STORIES) {
    let s = await startStory(story.id);
    for (const step of story.steps) {
      const before = (await getRtv(s.rtvId))!;
      expect(owner(before)).toBe(step.role);
      s = await next(s);
    }
  }
});
test('back restores the RTV exactly', async () => {
  let s = await startStory('shop');
  const before = await getRtv(s.rtvId);
  s = await next(s); s = await back(s);
  expect(await getRtv(s.rtvId)).toEqual(before);
  expect(s.index).toBe(0);
});
test('back at the first step does nothing', async () => {
  const s = await startStory('shop');
  expect(await back(s)).toBe(s);
});
test('consign story passes through both brand holds', async () => {
  let s = await startStory('consign'); const seen = new Set<Hold>();
  while (!isFinished(s)) { s = await next(s); holds((await getRtv(s.rtvId))!).forEach(h => seen.add(h)); }
  expect([...seen].sort()).toEqual(['WAIT_BRAND_QTY', 'WAIT_RTV_NOTE']);
});
test('failed pickup reuses the same pickup slip number', async () => {
  let s = await startStory('failed-pickup');
  for (let i = 0; i < 3; i++) s = await next(s);
  const slip = (await getRtv(s.rtvId))!.docs.find(d => d.type === 'PICKUP_SLIP')?.value;
  expect(slip).toBeTruthy();
  while (!isFinished(s)) s = await next(s);
  expect((await getRtv(s.rtvId))!.docs.find(d => d.type === 'PICKUP_SLIP')?.value).toBe(slip);
});
