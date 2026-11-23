import { useCallback, useEffect, useState } from 'react';
import { CHANGED_EVENT, getPromo, getRtv, listPromos, listRtvs } from '../api';
import type { PromoEvent, Rtv } from '../domain/types';

/** Re-reads whenever any write goes through the API (e.g. the guided tour acting for a role). */
function useRefreshOnChange(refresh: () => void): void {
  useEffect(() => {
    window.addEventListener(CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CHANGED_EVENT, refresh);
  }, [refresh]);
}

/** `undefined` = loading, `null` = not found. */
export function useRtv(id: string): { rtv: Rtv | null | undefined; refresh(): void } {
  const [loaded, setLoaded] = useState<{ id: string; rtv: Rtv | null } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void getRtv(id).then(r => { if (live) setLoaded({ id, rtv: r }); });
    return () => { live = false; };
  }, [id, tick]);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  useRefreshOnChange(refresh);
  // Whatever was loaded for a previous id counts as "loading" again, so no stale RTV is shown.
  return { rtv: loaded && loaded.id === id ? loaded.rtv : undefined, refresh };
}

export function useRtvList(): { rtvs: Rtv[]; refresh(): void } {
  const [rtvs, setRtvs] = useState<Rtv[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void listRtvs().then(r => { if (live) setRtvs(r); });
    return () => { live = false; };
  }, [tick]);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  useRefreshOnChange(refresh);
  return { rtvs, refresh };
}

/** `undefined` = loading, `null` = not found. */
export function usePromo(id: string): { event: PromoEvent | null | undefined; refresh(): void } {
  const [loaded, setLoaded] = useState<{ id: string; event: PromoEvent | null } | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void getPromo(id).then(e => { if (live) setLoaded({ id, event: e }); });
    return () => { live = false; };
  }, [id, tick]);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  useRefreshOnChange(refresh);
  return { event: loaded && loaded.id === id ? loaded.event : undefined, refresh };
}

export function usePromoList(): { events: PromoEvent[]; refresh(): void } {
  const [events, setEvents] = useState<PromoEvent[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void listPromos().then(e => { if (live) setEvents(e); });
    return () => { live = false; };
  }, [tick]);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  useRefreshOnChange(refresh);
  return { events, refresh };
}
