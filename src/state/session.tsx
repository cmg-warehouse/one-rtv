import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Carrier, Role } from '../domain/types';

export const ROLE_LABELS: Record<Role, string> = {
  BRAND: 'Brand / ฝ่ายขาย',
  CS: 'CS คลัง',
  CARRIER: 'ขนส่ง',
  SCDC: 'SCDC',
  WH: 'คลัง CMG',
  ADMIN_CN: 'Admin CN',
  VIEWER: 'ผู้ดูภาพรวม',
};

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
  carrierActor: Carrier;
  setCarrierActor(c: 'PLAZA_4W' | 'CG_NETWORK'): void;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role>(loadRole);
  const [carrierActor, setCarrierActor] = useState<Carrier>('PLAZA_4W');

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try { localStorage.setItem(ROLE_KEY, r); } catch { /* ignore */ }
  }, []);

  const value = useMemo<Session>(
    () => ({ role, actor: ROLE_LABELS[role], setRole, carrierActor, setCarrierActor }),
    [role, setRole, carrierActor],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
