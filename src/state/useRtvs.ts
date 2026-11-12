import { useCallback, useEffect, useState } from 'react';
import { CHANGED_EVENT, getRtv, listRtvs } from '../api';
import type { Rtv } from '../domain/types';

/** Re-reads whenever any write goes through the API (e.g. the guided tour acting for a role). */
function useRefreshOnChange(refresh: () => void): void {
  useEffect(() => {
    window.addEventListener(CHANGED_EVENT, refresh);
    return () => window.removeEventListener(CHANGED_EVENT, refresh);
  }, [refresh]);
}

/** `undefined` = loading, `null` = not found. */
export function useRtv(id: string): { rtv: Rtv | null | undefined; refresh(): void } {
  const [rtv, setRtv] = useState<Rtv | null | undefined>(undefined);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    void getRtv(id).then(r => { if (live) setRtv(r); });
    return () => { live = false; };
  }, [id, tick]);
  const refresh = useCallback(() => setTick(t => t + 1), []);
  useRefreshOnChange(refresh);
  return { rtv, refresh };
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
