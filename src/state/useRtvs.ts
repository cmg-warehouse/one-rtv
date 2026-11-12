import { useCallback, useEffect, useState } from 'react';
import { getRtv, listRtvs } from '../api';
import type { Rtv } from '../domain/types';

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
  return { rtvs, refresh };
}
