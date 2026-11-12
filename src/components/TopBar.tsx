import { NavLink } from 'react-router-dom';
import type { Role } from '../domain/types';
import { ROLE_LABELS, useSession } from '../state/session';

const NAV = [
  { to: '/', label: 'รายการ RTV', end: true },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/flow', label: 'Flow' },
  { to: '/tour', label: 'Demo นำชม' },
];

export default function TopBar() {
  const { role, setRole } = useSession();
  return (
    <header className="topbar">
      <NavLink to="/" className="topbar-brand">
        <img src="./crl-logo.svg" alt="CRL" />
        <strong>One RTV</strong>
      </NavLink>
      <div className="topbar-search">
        <input type="search" placeholder="ค้นหาเลข RTV / MIM / TK / CN" />
      </div>
      <div className="topbar-user">
        <select aria-label="บทบาท" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
      </div>
      <nav>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="nav-link">{n.label}</NavLink>
        ))}
      </nav>
    </header>
  );
}
