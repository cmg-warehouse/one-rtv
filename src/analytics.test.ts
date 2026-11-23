import { describe, expect, it } from 'vitest';
import { pageOf, startAnalytics } from './analytics';

describe('analytics', () => {
  it('counts hash routes as paths', () => {
    expect(pageOf('#/track?id=1')).toBe('/track');
    expect(pageOf('#/login')).toBe('/login');
    expect(pageOf('')).toBe('/');
  });

  it('loads nothing outside the deployed build', () => {
    startAnalytics('one-rtv');
    expect(document.querySelector('script[src*="goatcounter"], script[src*="gc.zgo.at"]')).toBeNull();
  });
});
