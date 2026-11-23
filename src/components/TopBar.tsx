import { useState, type KeyboardEvent } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { resetData, searchByAnyNumber } from '../api';
import type { Role } from '../domain/types';
import { ROLE_LABELS, useSession } from '../state/session';
import { clearTour } from '../tour/runner';
import { LangToggle, tr } from '../i18n';
import SiteTour, { openSiteTour } from './SiteTour';
import { playPreviewIntro } from './PreviewIntro';

const nav = () => [
  { to: '/', label: tr('รายการ RTV', 'RTV list'), end: true },
  { to: '/promo', label: tr('งานเก็บโปร', 'Promo pickups') },
  { to: '/track', label: 'Track & Trace' },
  { to: '/map', label: tr('แผนที่', 'Map') },
  { to: '/mobile', label: tr('แอปมือถือ', 'Mobile app') },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/flow', label: 'Flow' },
  { to: '/tour', label: tr('Demo นำชม', 'Guided demo') },
];

export default function TopBar() {
  const { role, setRole } = useSession();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [notFound, setNotFound] = useState(false);

  const onKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const term = q.trim();
    if (!term) return;
    const hits = await searchByAnyNumber(term);
    if (hits.length === 0) setNotFound(true);
    else if (hits.length === 1) navigate(`/rtv/${hits[0].id}`);
    else navigate(`/?q=${encodeURIComponent(term)}`);
  };
  const onReset = async () => {
    if (!window.confirm(tr('ล้างข้อมูลที่ทดลองทำและกลับไปใช้ข้อมูลตั้งต้น?', 'Clear what you tried and go back to the starting data?'))) return;
    clearTour();
    await resetData();
    navigate('/');
  };
  return (
    <header className="topbar">
      <NavLink to="/" className="topbar-brand">
        <img src="./crl-logo.svg" alt="CRL" />
        <strong>One RTV</strong>
      </NavLink>
      <div className="topbar-search" data-sitetour="search">
        <input type="search" placeholder={tr('ค้นหาเลข RTV / MIM / TK / CN', 'Search RTV / MIM / TK / CN no.')} value={q}
          onChange={(e) => { setQ(e.target.value); setNotFound(false); }}
          onKeyDown={(e) => { void onKeyDown(e); }} />
        {notFound && <div className="search-error" role="alert">{tr('ไม่พบเลขนี้', 'No match for this number')}</div>}
      </div>
      <div className="topbar-user">
        <select data-sitetour="role" aria-label={tr('บทบาท', 'Role')} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <button type="button" className="btn btn-sm" data-sitetour="reset" onClick={() => { void onReset(); }}>{tr('รีเซ็ตข้อมูล', 'Reset data')}</button>
        <span data-sitetour="lang"><LangToggle /></span>
        <button type="button" className="btn btn-sm" onClick={openSiteTour}>{tr('แนะนำเว็บ', 'Site tour')}</button>
        <NavLink to="/login" className="btn btn-sm btn-primary" data-sitetour="live" onClick={playPreviewIntro}>{tr('ดูแบบระบบจริง', 'Live system preview')}</NavLink>
      </div>
      <nav>
        {role === 'CARRIER' && <NavLink to="/carrier" className="nav-link">{tr('งานขนส่ง', 'Carrier jobs')}</NavLink>}
        {nav().map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className="nav-link" data-sitetour={n.to}>{n.label}</NavLink>
        ))}
      </nav>
      <SiteTour />
    </header>
  );
}
