import { isClosed, stepsOf } from './rules';
import type { Rtv } from './types';
import { tr } from '../i18n';

/** [longitude, latitude] */
export type LngLat = [number, number];

export type HubId = 'SCDC' | 'CMG';
export interface Hub { id: HubId; name: string; short: string; address: string; at: LngLat }

/**
 * Addresses from the CRL website / public Google Maps pins (Nov 2026).
 * `at` is APPROXIMATE (sub-district level), not a surveyed GPS point: replace with the coordinates
 * right-clicked on the building pin. CMG-CDS still needs confirming as Online Warehouse Plant 1005.
 */
export const HUBS: Record<HubId, Hub> = {
  SCDC: {
    id: 'SCDC', get name() { return tr('SCDC1 คลองส่งน้ำ (Plant 1008)', 'SCDC1 Khlong Song Nam (Plant 1008)'); }, get short() { return tr('SCDC คลองส่งน้ำ', 'SCDC Khlong Song Nam'); },
    get address() { return tr('57/4 ม.7 ต.บางปลา อ.บางพลี จ.สมุทรปราการ 10540', '57/4 Moo 7, Bang Pla, Bang Phli, Samut Prakan 10540'); },
    at: [100.775, 13.585],
  },
  CMG: {
    id: 'CMG', get name() { return tr('คลัง CMG-CDS กม.20', 'CMG-CDS warehouse Km.20'); }, get short() { return tr('CMG กม.20', 'CMG Km.20'); },
    get address() { return tr('108 ม.1 ถ.บางนา–ตราด กม.21 (ขาออก) ต.ศีรษะจรเข้ใหญ่ อ.บางเสาธง จ.สมุทรปราการ 10540', '108 Moo 1, Bang Na–Trat Rd, Km.21 (outbound), Sisa Chorakhe Yai, Bang Sao Thong, Samut Prakan 10540'); },
    at: [100.825, 13.625],
  },
};

/** Approximate store positions (demo master data). */
export const STORE_AT: Record<string, LngLat> = {
  'store-01': [100.57, 13.82],  // ลาดพร้าว
  'store-02': [100.6, 13.7],    // อ่อนนุช
  'store-03': [98.98, 18.79],   // เชียงใหม่
  'store-04': [100.62, 13.99],  // รังสิต
  'store-05': [100.63, 13.66],  // บางนา
  'store-06': [102.83, 16.43],  // ขอนแก่น
  'store-07': [100.565, 13.757],// พระราม 9
  'store-08': [98.39, 7.88],    // ภูเก็ต
  'store-09': [102.1, 14.97],   // นครราชสีมา
  'store-10': [99.33, 9.14],    // สุราษฎร์ธานี
  'store-11': [102.79, 17.41],  // อุดรธานี
  'store-12': [100.47, 7.01],   // หาดใหญ่
  'venue-01': [100.678, 13.826],// แฟชั่นไอส์แลนด์
  'venue-02': [100.54, 13.747], // เซ็นทรัลเวิลด์
  'venue-03': [100.418, 13.877],// เวสต์เกต
  'venue-04': [100.679, 13.648],// เมกาบางนา
};

export type Place = { kind: 'STORE'; id: string } | { kind: 'HUB'; id: HubId };

export type Location =
  | { kind: 'AT'; place: Place; label: string }
  | { kind: 'ROAD'; from: Place; to: Place; progress: number; label: string }
  | { kind: 'DONE'; label: string };

export function placeAt(p: Place): LngLat {
  return p.kind === 'HUB' ? HUBS[p.id].at : STORE_AT[p.id] ?? HUBS.CMG.at;
}

/** Does this RTV pass through SCDC (steps 6–7 not skipped)? */
export function viaScdc(rtv: Rtv): boolean {
  return stepsOf(rtv).find(s => s.step === 6)?.mode !== 'SKIPPED';
}

/** The ordered stops of the RTV's physical journey: store → (SCDC) → CMG. */
export function route(rtv: Rtv): Place[] {
  const store: Place = { kind: 'STORE', id: rtv.storeId };
  return viaScdc(rtv)
    ? [store, { kind: 'HUB', id: 'SCDC' }, { kind: 'HUB', id: 'CMG' }]
    : [store, { kind: 'HUB', id: 'CMG' }];
}

const HOUR = 3600 * 1000;

/** Stable 0..1 value per RTV id, to spread trucks along the road when no GPS is available. */
function spread(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

/**
 * Rough progress along a road leg from the time it started. Without GPS a leg that has run longer than
 * expected is shown somewhere mid-road (stable per RTV) rather than piled up at the destination.
 */
function roadProgress(id: string, sinceIso: string | undefined, nowIso: string, legHours: number): number {
  const fallback = 0.3 + spread(id) * 0.45;
  if (!sinceIso) return fallback;
  const t = (Date.parse(nowIso) - Date.parse(sinceIso)) / HOUR / legHours;
  return t >= 1 ? fallback : Math.min(0.85, Math.max(0.1, t));
}

function lastStepAt(rtv: Rtv, step: number): string | undefined {
  return [...rtv.events].reverse().find(e => e.kind === 'STEP' && e.step === step)?.at;
}

/** Where the goods physically are, derived from the last completed step. */
export function locate(rtv: Rtv, nowIso: string): Location {
  if (rtv.cancelled) return { kind: 'DONE', label: tr('ยกเลิกแล้ว', 'Cancelled') };
  if (isClosed(rtv)) return { kind: 'DONE', label: tr('ปิดงานแล้ว (ออก CN)', 'Closed (CN issued)') };
  const store: Place = { kind: 'STORE', id: rtv.storeId };
  const scdc: Place = { kind: 'HUB', id: 'SCDC' };
  const cmg: Place = { kind: 'HUB', id: 'CMG' };
  if (rtv.step <= 4) return { kind: 'AT', place: store, label: rtv.step === 4 ? tr('รอขนส่งเข้าเก็บที่สาขา', 'Waiting for the carrier to collect at the store') : tr('สินค้าอยู่ที่สาขา', 'Goods are at the store') };
  if (rtv.step === 5) {
    const to = viaScdc(rtv) ? scdc : cmg;
    return {
      kind: 'ROAD', from: store, to, progress: roadProgress(rtv.id, lastStepAt(rtv, 5), nowIso, 36),
      label: viaScdc(rtv) ? tr('กำลังขนส่งไป SCDC', 'On the way to SCDC') : tr('กำลังขนส่งไปคลัง CMG', 'On the way to the CMG warehouse'),
    };
  }
  if (rtv.step === 6) return { kind: 'AT', place: scdc, label: tr('อยู่ที่ SCDC', 'At SCDC') };
  if (rtv.step === 7) {
    return { kind: 'ROAD', from: scdc, to: cmg, progress: roadProgress(rtv.id, lastStepAt(rtv, 7), nowIso, 12), label: tr('กำลังส่งต่อไปคลัง CMG', 'On the way to the CMG warehouse') };
  }
  return { kind: 'AT', place: cmg, label: rtv.step === 8 ? tr('อยู่ที่คลัง CMG รอตรวจนับ', 'At the CMG warehouse, waiting for count') : tr('ตรวจนับแล้ว รอออก CN', 'Counted, waiting for CN') };
}

/** Linear interpolation between two points. */
export function lerp(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export function positionOf(loc: Location): LngLat | null {
  if (loc.kind === 'DONE') return null;
  if (loc.kind === 'AT') return placeAt(loc.place);
  return lerp(placeAt(loc.from), placeAt(loc.to), loc.progress);
}

/** Simplified outline of Thailand (lng, lat), clockwise from Mae Sai. Schematic only. */
export const THAILAND: LngLat[] = [
  [99.9, 20.45], [100.1, 20.35], [100.4, 20.15], [100.6, 19.5], [101.2, 19.6], [101.3, 18.9], [101.1, 18.4],
  [101.3, 17.8], [101.7, 17.9], [102.1, 18.2], [102.7, 17.9], [103.4, 18.4], [104.0, 18.3], [104.7, 17.5],
  [104.8, 16.5], [105.4, 15.9], [105.6, 15.3], [105.5, 14.4], [104.8, 14.4], [103.7, 14.4], [102.9, 14.2],
  [102.6, 13.6], [102.3, 13.0], [102.6, 12.6], [102.8, 12.2], [102.9, 11.7], [102.4, 12.1], [102.1, 12.5],
  [101.7, 12.7], [100.9, 12.7], [100.95, 13.4], [100.6, 13.5], [100.0, 13.4], [100.0, 12.7], [99.9, 12.0],
  [99.5, 11.0], [99.2, 10.3], [99.25, 9.3], [99.9, 9.3], [100.1, 8.5], [100.4, 7.4], [100.6, 7.2], [101.0, 6.9],
  [101.7, 6.6], [102.1, 6.2], [101.8, 5.8], [101.1, 6.0], [100.9, 6.3], [100.4, 6.5], [100.1, 6.5], [99.7, 7.0],
  [99.4, 7.6], [98.8, 8.0], [98.4, 7.75], [98.3, 8.5], [98.3, 9.0], [98.6, 9.8], [98.7, 10.4], [99.2, 10.9],
  [99.5, 11.6], [99.2, 12.3], [99.1, 13.0], [99.2, 13.7], [98.5, 14.3], [98.2, 15.2], [98.6, 16.0], [98.9, 16.4],
  [98.5, 16.8], [97.8, 17.7], [97.6, 18.5], [97.4, 18.6], [97.8, 19.3], [97.8, 19.8], [98.3, 19.8], [98.9, 19.9],
  [99.3, 20.1], [99.5, 20.3],
];
