import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { STORES, BRANDS } from '../data/masters';
import { daysBetween, fmtDateTime } from '../domain/format';
import { PROMO_STATUS_LABELS } from '../domain/promo';
import { canAct, holds, HOLD_LABELS, isClosed, matchesIdentity, nextStep } from '../domain/rules';
import type { PromoEvent, Role, Rtv } from '../domain/types';
import { tr } from '../i18n';
import { menuFor, usePortal } from '../state/portal';
import { useSession } from '../state/session';
import { usePromoList, useRtvList } from '../state/useRtvs';
import { Icon } from '../components/PortalShell';
import { promoOwner, venueOf } from './PromoList';

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
  if (h < 12) return tr('สวัสดีตอนเช้า', 'Good morning');
  if (h < 17) return tr('สวัสดีตอนบ่าย', 'Good afternoon');
  return tr('สวัสดีตอนเย็น', 'Good evening');
}

/** Promotion pickups this person must act on now. */
function promoTasks(events: PromoEvent[], role: Role, carrier?: string): PromoEvent[] {
  if (role === 'CARRIER' && carrier !== 'AGREED') return [];
  return events.filter(e => promoOwner(e) === role);
}

/** The signed-in person's start page: what waits for them, their numbers, and shortcuts. */
export default function PortalHome() {
  const { account } = usePortal();
  const { role, identity } = useSession();
  const { rtvs } = useRtvList();
  const { events } = usePromoList();
  const now = new Date().toISOString();

  const mine = useMemo(() => rtvs.filter(r => matchesIdentity(r, role, identity)), [rtvs, role, identity]);
  const todo = useMemo(() => rtvs.filter(r => canAct(r, role, identity)), [rtvs, role, identity]);
  const promos = useMemo(() => promoTasks(events, role, account?.carrier), [events, role, account?.carrier]);
  if (!account) return <Navigate to="/login" replace />;

  const open = mine.filter(r => !isClosed(r));
  const onHold = open.filter(r => holds(r).length > 0);
  const closed = mine.filter(r => r.step === 10);
  const shortcuts = menuFor(account.role, account.carrier).filter(m => m.to !== '/home');

  const brand = (r: Rtv) => BRANDS.find(b => b.id === r.brandId)?.name ?? r.brandId;
  const store = (r: Rtv) => STORES.find(s => s.id === r.storeId)?.name ?? r.storeId;
  const what = (r: Rtv) => {
    const h = holds(r);
    if (h.length > 0) return h.map(x => HOLD_LABELS[x]).join(', ');
    const n = nextStep(r);
    return n ? tr(`ขั้น ${n.step}: ${n.label}`, `Step ${n.step}: ${n.label}`) : '—';
  };

  return (
    <div className="portal-home">
      <div className="page-head">
        <div>
          <h1>{greeting()}, {account.name()}</h1>
          <p className="muted">{account.title()}</p>
        </div>
      </div>

      <div className="kpi-grid">
        <div className={`kpi-tile${todo.length + promos.length > 0 ? ' kpi-alert' : ''}`}>
          <div className="kpi-label">{tr('งานที่รอคุณ', 'Waiting for you')}</div>
          <div className="kpi-value">{todo.length + promos.length}</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">{tr('กำลังดำเนินการ', 'In progress')}</div>
          <div className="kpi-value">{open.length}</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">{tr('ติด Hold', 'On hold')}</div>
          <div className="kpi-value">{onHold.length}</div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">{tr('ปิดงานแล้ว', 'Closed')}</div>
          <div className="kpi-value">{closed.length}</div>
        </div>
      </div>

      <section className="card">
        <h2>{tr('งานที่รอคุณ', 'Waiting for you')}</h2>
        {todo.length === 0 && promos.length === 0 && <p className="muted">{tr('ไม่มีงานค้าง', 'Nothing waiting. You are all caught up.')}</p>}
        {promos.length > 0 && (
          <ul className="portal-tasks">
            {promos.map(e => (
              <li key={e.id}>
                <Link to={`/promo/${e.id}`}>
                  <strong>{e.name}</strong>
                  <span className="muted">{venueOf(e)} · {fmtDateTime(e.pickupAt)}</span>
                </Link>
                <span className="badge badge-assigned">{PROMO_STATUS_LABELS[e.status]}</span>
              </li>
            ))}
          </ul>
        )}
        {todo.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>RTV</th>
                  <th>{tr('แบรนด์', 'Brand')}</th>
                  <th>{tr('สาขา', 'Store')}</th>
                  <th>{tr('สิ่งที่ต้องทำ', 'To do')}</th>
                  <th className="num">{tr('อายุ (วัน)', 'Age (days)')}</th>
                </tr>
              </thead>
              <tbody>
                {todo.slice(0, 12).map(r => (
                  <tr key={r.id}>
                    <td><Link className="mono" to={`/rtv/${r.id}`}>{r.id}</Link></td>
                    <td>{brand(r)}</td>
                    <td>{store(r)}</td>
                    <td>{what(r)}</td>
                    <td className="num">{Math.floor(daysBetween(r.createdAt, now))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {todo.length > 12 && <p><Link to={`/?owner=${role}`}>{tr(`ดูทั้งหมด ${todo.length} รายการ`, `See all ${todo.length}`)}</Link></p>}
          </div>
        )}
      </section>

      <section className="card">
        <h2>{tr('เมนูของคุณ', 'Your menu')}</h2>
        <div className="portal-shortcuts">
          {shortcuts.map(m => (
            <Link key={m.to + m.label} to={m.to} className="portal-shortcut">
              <Icon name={m.icon} />
              <span>{m.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
