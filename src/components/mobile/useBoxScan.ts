import { useCallback, useEffect, useRef, useState } from 'react';
import type { Rtv } from '../../domain/types';
import { beep } from './ScanCamera';
import { tr } from '../../i18n';

export interface Toast { text: string; ok: boolean; id: number }

/** A scanned value names a box when it is the full box number or its "-Bnn" suffix (typed by hand). */
export function matchBox(rtv: Rtv, value: string): string | null {
  const v = value.trim().toUpperCase();
  if (!v) return null;
  const box = rtv.boxes.find(b => b.no.toUpperCase() === v || (v.length >= 3 && b.no.toUpperCase().endsWith(`-${v.replace(/^-/, '')}`)));
  return box?.no ?? null;
}

export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  const show = useCallback((text: string, ok: boolean) => {
    beep(ok);
    setToast({ text, ok, id: Date.now() });
    window.clearTimeout(t.current);
    t.current = window.setTimeout(() => setToast(null), 1800);
  }, []);
  return { toast, show };
}

/** Box-by-box scan state for one RTV: which boxes are in hand, what to point the camera at next. */
export function useBoxScan(rtv: Rtv | undefined) {
  const [scanned, setScanned] = useState<string[]>([]);
  const { toast, show } = useToast();
  const next = rtv?.boxes.find(b => !scanned.includes(b.no)) ?? null;
  const onScan = (value: string) => {
    if (!rtv) return;
    const no = matchBox(rtv, value);
    if (!no) { show(tr(`${value} ไม่อยู่ในงานนี้`, `${value} is not in this job`), false); return; }
    if (scanned.includes(no)) { show(tr(`สแกนซ้ำ ${no.slice(-3)}`, `Already scanned ${no.slice(-3)}`), false); return; }
    setScanned(s => [...s, no]);
    show(tr(`กล่อง ${no.slice(-3)} ✓`, `Box ${no.slice(-3)} ✓`), true);
  };
  return { scanned, next, onScan, toast, show, reset: () => setScanned([]) };
}
