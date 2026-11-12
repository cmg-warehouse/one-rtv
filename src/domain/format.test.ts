import { expect, test } from 'vitest';
import { daysBetween, fmtDate, fmtDateTime } from './format';

test('formats in Bangkok time', () => {
  expect(fmtDate('2026-11-11T18:30:00Z')).toBe('12/11/2026');
  expect(fmtDateTime('2026-11-12T07:05:00Z')).toBe('12/11/2026 14:05');
});
test('midnight renders as 00:xx in 24h', () => {
  expect(fmtDateTime('2026-11-11T17:05:00Z')).toBe('12/11/2026 00:05');
});
test('daysBetween rounds to 1 decimal', () => {
  expect(daysBetween('2026-11-10T00:00:00Z', '2026-11-12T12:00:00Z')).toBe(2.5);
  expect(daysBetween('2026-11-10T00:00:00Z', '2026-11-10T01:00:00Z')).toBe(0);
  expect(daysBetween('2026-11-10T00:00:00Z', '2026-11-10T04:00:00Z')).toBe(0.2);
});
