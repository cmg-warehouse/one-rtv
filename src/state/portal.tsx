import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Carrier, Role } from '../domain/types';
import { tr } from '../i18n';
import { useSession, type CarrierActor } from './session';

/**
 * "Real system" preview: someone signs in as one person and sees only that
 * role's menu, home and functions, with none of the demo chrome (role switcher,
 * guided tour, flow bar). The demo pages are the same ones underneath.
 */
export interface Account {
  id: string;
  role: Role;
  carrier?: CarrierActor;
  email: string;
  name(): string;
  title(): string;
}

export function accounts(): Account[] {
  return [
    { id: 'brand', role: 'BRAND', email: 'ploy.s@brand.example', name: () => tr('คุณพลอย ศรีสุข', 'Ploy Srisuk'), title: () => tr('ฝ่ายขายแบรนด์', 'Brand sales') },
    { id: 'promo', role: 'PROMO', email: 'o.promo@cmg.example', name: () => tr('คุณโอ', 'Khun O'), title: () => tr('ผู้ประสานงานโปร CMG', 'CMG promo coordinator') },
    { id: 'cs', role: 'CS', email: 'nan.cs@crl.example', name: () => tr('คุณแนน', 'Nan'), title: () => tr('CS คลัง CMG กม.20', 'Warehouse CS, CMG Km.20') },
    { id: 'carrier', role: 'CARRIER', carrier: 'PLAZA_4W', email: 'dispatch@4wplaza.example', name: () => tr('คุณสมชาย', 'Somchai'), title: () => tr('ผู้จัดรถ 4W Plaza (งานสาย)', 'Dispatcher, 4W Plaza (route)') },
    { id: 'agreed', role: 'CARRIER', carrier: 'AGREED', email: 'booking@truck.example', name: () => tr('คุณวิชัย', 'Wichai'), title: () => tr('ผู้จัดรถ งานจองรถ', 'Dispatcher, booked trucks') },
    { id: 'scdc', role: 'SCDC', email: 'receive@scdc.example', name: () => tr('คุณมานพ', 'Manop'), title: () => tr('รับสินค้า SCDC คลองส่งน้ำ', 'Receiving, SCDC Khlong Song Nam') },
    { id: 'wh', role: 'WH', email: 'ton.wh@crl.example', name: () => tr('คุณต้น', 'Ton'), title: () => tr('รับสินค้า คลัง CMG กม.20', 'Receiving, CMG Km.20') },
    { id: 'admin', role: 'ADMIN_CN', email: 'may.ac@cmg.example', name: () => tr('คุณเมย์', 'May'), title: () => tr('บัญชี – ออก CN', 'Accounting – CN') },
    { id: 'viewer', role: 'VIEWER', email: 'manager@crl.example', name: () => tr('คุณวีระ', 'Weera'), title: () => tr('ผู้จัดการ (ดูภาพรวม)', 'Manager (overview)') },
  ];
}

export interface MenuItem { to: string; label: string; icon: IconName; end?: boolean }
export type IconName = 'home' | 'list' | 'plus' | 'truck' | 'gift' | 'chart' | 'map' | 'phone' | 'search';

/** Each role's sidebar: only what that person works with. */
export function menuFor(role: Role, carrier?: Carrier): MenuItem[] {
  const home: MenuItem = { to: '/home', label: tr('หน้าแรก', 'Home'), icon: 'home' };
  const track: MenuItem = { to: '/track', label: tr('ติดตามสถานะ', 'Track & Trace'), icon: 'search' };
  const rtvs = (label: string): MenuItem => ({ to: '/', label, icon: 'list', end: true });
  const promo: MenuItem = { to: '/promo', label: tr('งานเก็บโปร', 'Promo pickups'), icon: 'gift' };
  const dashboard: MenuItem = { to: '/dashboard', label: 'Dashboard', icon: 'chart' };
  const map: MenuItem = { to: '/map', label: tr('แผนที่', 'Map'), icon: 'map' };
  switch (role) {
    case 'BRAND':
      return [home, rtvs(tr('RTV ของฉัน', 'My returns')), { to: '/new', label: tr('เปิด RTV ใหม่', 'New return'), icon: 'plus' }, promo, track];
    case 'PROMO':
      return [home, promo, { to: '/promo/new', label: tr('แจ้งงานเก็บโปร', 'New promo pickup'), icon: 'plus' }, rtvs(tr('RTV งานโปร', 'Promo returns')), track];
    case 'CS':
      return [home, rtvs(tr('RTV ทั้งหมด', 'All returns')), promo, dashboard, track, map];
    case 'CARRIER':
      return [
        home,
        { to: '/carrier', label: tr('งานของฉัน', 'My jobs'), icon: 'truck' },
        ...(carrier === 'AGREED' ? [promo] : []),
        { to: '/mobile', label: tr('แอปคนขับ', 'Driver app'), icon: 'phone' },
        track,
      ];
    case 'SCDC':
      return [home, rtvs(tr('RTV ที่เข้า SCDC', 'Returns via SCDC')), track];
    case 'WH':
      return [home, rtvs(tr('RTV ทั้งหมด', 'All returns')), { to: '/mobile', label: tr('แอปคลัง', 'Warehouse app'), icon: 'phone' }, dashboard, track];
    case 'ADMIN_CN':
      return [home, rtvs(tr('RTV ทั้งหมด', 'All returns')), dashboard, track];
    case 'VIEWER':
      return [home, dashboard, map, track];
  }
}

const KEY = 'one-rtv.portal-user';

function storedId(): string | null {
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

interface PortalCtx {
  account: Account | null;
  signIn(id: string): void;
  signOut(): void;
}

const Ctx = createContext<PortalCtx>({ account: null, signIn: () => {}, signOut: () => {} });

export function PortalProvider({ children }: { children: ReactNode }) {
  const { setRole, setCarrierActor } = useSession();
  const [id, setId] = useState<string | null>(storedId);
  const signIn = useCallback((next: string) => {
    const a = accounts().find(x => x.id === next);
    if (!a) return;
    setRole(a.role);
    if (a.carrier) setCarrierActor(a.carrier);
    try { sessionStorage.setItem(KEY, next); } catch { /* ignore */ }
    setId(next);
  }, [setRole, setCarrierActor]);
  // The carrier company isn't stored by the session, so restore it after a reload.
  useEffect(() => {
    const a = accounts().find(x => x.id === id);
    if (a?.carrier) setCarrierActor(a.carrier);
  }, [id, setCarrierActor]);
  const signOut = useCallback(() => {
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    setId(null);
  }, []);
  const value = useMemo<PortalCtx>(
    () => ({ account: accounts().find(a => a.id === id) ?? null, signIn, signOut }),
    [id, signIn, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePortal(): PortalCtx {
  return useContext(Ctx);
}
