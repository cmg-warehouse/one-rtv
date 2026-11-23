import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { DEMO_BRAND_ID, ACTORS } from '../data/masters';
import { bi } from '../i18n';
import type { Identity } from '../domain/rules';
import type { Carrier, Role } from '../domain/types';

export const ROLE_LABELS: Record<Role, string> = bi<Role>({
  BRAND: ['Brand / ฝ่ายขาย', 'Brand / Sales'],
  PROMO: ['ผู้ประสานงานโปร', 'Promo coordinator'],
  CS: ['CS คลัง', 'Warehouse CS'],
  CARRIER: ['ขนส่ง', 'Carrier'],
  SCDC: ['SCDC', 'SCDC'],
  WH: ['คลัง CMG', 'CMG warehouse'],
  ADMIN_CN: ['Admin CN', 'Admin CN'],
  VIEWER: ['ผู้ดูภาพรวม', 'Viewer'],
});

export const CARRIER_ACTORS = ['PLAZA_4W', 'CG_NETWORK', 'AGREED'] as const;
export type CarrierActor = (typeof CARRIER_ACTORS)[number];

/** The carrier identity the demo can act as, or null for carriers it has no mobile view for (Parcel). */
export function asCarrierActor(c: Carrier | null): CarrierActor | null {
  return (CARRIER_ACTORS as readonly (Carrier | null)[]).includes(c) ? (c as CarrierActor) : null;
}

const ROLE_KEY = 'one-rtv.role';
const DEFAULT_ROLE: Role = 'CS';

function loadRole(): Role {
  try {
    const stored = localStorage.getItem(ROLE_KEY);
    if (stored && stored in ROLE_LABELS) return stored as Role;
  } catch { /* storage unavailable */ }
  return DEFAULT_ROLE;
}

interface Session {
  role: Role;
  actor: string;
  setRole(r: Role): void;
  carrierActor: CarrierActor;
  setCarrierActor(c: CarrierActor): void;
  identity: Identity;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(loadRole);
  const [carrierActor, setCarrierActor] = useState<CarrierActor>('PLAZA_4W');

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try { localStorage.setItem(ROLE_KEY, r); } catch { /* ignore */ }
  }, []);

  const value = useMemo<Session>(
    () => ({
      role, actor: ACTORS[role], setRole, carrierActor, setCarrierActor,
      identity: { brandId: DEMO_BRAND_ID, carrier: carrierActor },
    }),
    [role, setRole, carrierActor],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
