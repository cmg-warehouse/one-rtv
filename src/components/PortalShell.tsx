import { useMemo, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { canAct } from '../domain/rules';
import { LangToggle, tr } from '../i18n';
import { ROLE_LABELS, useSession } from '../state/session';
import { menuFor, usePortal, type IconName } from '../state/portal';
import { useRtvList } from '../state/useRtvs';

const ICONS: Record<IconName, string> = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  plus: 'M12 5v14M5 12h14',
  truck: 'M1 6h13v10H1zM14 10h4l3 3v3h-7M5.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  gift: 'M3 9h18v4H3zM5 13h14v8H5zM12 9v12M12 9c-2-4-6-4-6-1s6 1 6 1zm0 0c2-4 6-4 6-1s-6 1-6 1z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  phone: 'M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM11 18h2',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
};

export function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name]} />
    </svg>
  );
}

/** The signed-in layout: role menu on the side, the person and sign-out on top. No demo controls. */
export default function PortalShell({ children }: { children: ReactNode }) {
  const { account, signOut } = usePortal();
  const { role, identity } = useSession();
  const navigate = useNavigate();
  const { rtvs } = useRtvList();
  const waiting = useMemo(() => rtvs.filter(r => canAct(r, role, identity)).length, [rtvs, role, identity]);
  if (!account) return null;
  const menu = menuFor(account.role, account.carrier);

  return (
    <div className="portal">
      <aside className="portal-side">
        <NavLink to="/home" className="portal-brand">
          <img src="./crl-logo.svg" alt="CRL" />
          <strong>One RTV</strong>
        </NavLink>
        <nav aria-label={tr('เมนูหลัก', 'Main menu')}>
          {menu.map(m => (
            <NavLink key={m.to + m.label} to={m.to} end={m.end ?? m.to === '/home'} className="portal-link">
              <Icon name={m.icon} />
              <span>{m.label}</span>
              {m.to === '/home' && waiting > 0 && <span className="portal-count" aria-label={tr(`${waiting} งานรอคุณ`, `${waiting} waiting for you`)}>{waiting}</span>}
            </NavLink>
          ))}
        </nav>
        <p className="portal-env">{tr('สภาพแวดล้อมทดลอง', 'Demo environment')}</p>
      </aside>
      <div className="portal-main">
        <header className="portal-head">
          <LangToggle />
          <div className="portal-user">
            <span className="avatar" aria-hidden="true">{account.name().replace(/^คุณ/, '').trim().charAt(0)}</span>
            <span>
              <strong>{account.name()}</strong>
              <small>{ROLE_LABELS[account.role]} · {account.title()}</small>
            </span>
          </div>
          <button type="button" className="btn btn-sm" onClick={() => { signOut(); navigate('/login'); }}>{tr('ออกจากระบบ', 'Sign out')}</button>
        </header>
        <main className="container portal-content">{children}</main>
      </div>
    </div>
  );
}
