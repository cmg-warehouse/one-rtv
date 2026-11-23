import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { searchByAnyNumber } from '../api';
import { BRAND_GROUPS, BRANDS, STORES } from '../data/masters';
import { daysBetween, fmtDateTime } from '../domain/format';
import { CHANNEL_LABELS, CN_LABELS, HOLD_LABELS, HOLDS, STEP_LABELS, STEPS, canAct, cnType, holds, isClosed, owner } from '../domain/rules';
import type { Channel, CnType, Hold, Role, Rtv } from '../domain/types';
import { ROLE_LABELS, useSession } from '../state/session';
import { useRtvList } from '../state/useRtvs';
import { getLang, tr } from '../i18n';

type SortKey = 'id' | 'brand' | 'store' | 'channel' | 'status' | 'owner' | 'opened' | 'age';
interface Col { key: SortKey; label: string; num?: boolean }
const cols = (): Col[] => [
  { key: 'id', label: tr('เลข RTV', 'RTV no.') }, { key: 'opened', label: tr('วันเปิดงาน', 'Opened') }, { key: 'brand', label: tr('แบรนด์', 'Brand') },
  { key: 'store', label: tr('สาขา', 'Store') }, { key: 'channel', label: tr('ช่องทาง', 'Channel') }, { key: 'status', label: tr('สถานะ', 'Status') },
  { key: 'owner', label: tr('ค้างที่', 'With') }, { key: 'age', label: tr('อายุงาน (วัน)', 'Age (days)'), num: true },
];

const brandOf = (r: Rtv) => BRANDS.find(b => b.id === r.brandId)?.name ?? r.brandId;
const storeOf = (r: Rtv) => STORES.find(s => s.id === r.storeId)?.name ?? r.storeId;
/** Age in days: until closing for a closed order, until now otherwise. */
function ageDays(r: Rtv, now: string): number {
  const end = isClosed(r) ? r.events[r.events.length - 1]?.at ?? now : now;
  return daysBetween(r.createdAt, end);
}
/** Sort value per column; cancelled orders sort after step 10, unowned rows after every role. */
function sortValue(r: Rtv, key: SortKey, now: string): string | number {
  switch (key) {
    case 'id': return r.id;
    case 'opened': return r.createdAt;
    case 'brand': return brandOf(r);
    case 'store': return storeOf(r);
    case 'channel': return CHANNEL_LABELS[r.channel];
    case 'status': return r.cancelled ? 11 : r.step;
    case 'owner': { const o = owner(r); return o ? ROLE_LABELS[o] : '￿'; }
    case 'age': return ageDays(r, now);
  }
}

/**
 * Status filter values: '' all, '1'..'10' a step (cancelled orders excluded), 'HOLD:<Hold>' waiting for Brand,
 * 'SHORT' an open short-box flag, 'CANCELLED'.
 */
function matchesStatus(r: Rtv, status: string): boolean {
  if (!status) return true;
  if (status === 'CANCELLED') return !!r.cancelled;
  if (r.cancelled) return false;
  if (status === 'SHORT') return r.shortBoxes > 0;
  if (status.startsWith('HOLD:')) return holds(r).includes(status.slice(5) as Hold);
  return r.step === Number(status);
}

export default function RtvList() {
  const { rtvs } = useRtvList();
  const { role, identity } = useSession();
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const ownerParam = params.get('owner') ?? '';
  const ownerFilter = Object.hasOwn(ROLE_LABELS, ownerParam) ? (ownerParam as Role) : null;
  const [matches, setMatches] = useState<Rtv[] | null>(null);
  const [step, setStep] = useState(() => params.get('status') ?? '');
  const [channel, setChannel] = useState('');
  const [brand, setBrand] = useState('');
  const [mine, setMine] = useState(false);
  // Newest first by default, as before.
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'opened', dir: -1 });
  const toggleSort = (key: SortKey) => setSort(s => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  useEffect(() => {
    let live = true;
    if (!q) { setMatches(null); return; }
    void searchByAnyNumber(q).then(r => { if (live) setMatches(r); });
    return () => { live = false; };
  }, [q]);

  // Brand sees only its own brand's work (spec §9); every other role sees all brands.
  const brandOnly = role === 'BRAND';
  const brandName = BRANDS.find(b => b.id === identity.brandId)?.name ?? identity.brandId;
  const found = q ? (matches ?? []) : rtvs;
  const base = brandOnly ? found.filter(r => r.brandId === identity.brandId) : found;
  const rows = base.filter(r => {
    if (ownerFilter && owner(r) !== ownerFilter) return false;
    // Cancelled orders keep the step they stopped at, so they are their own status, not part of that step.
    if (!matchesStatus(r, step)) return false;
    if (channel && r.channel !== channel) return false;
    if (brand && !brandOnly && r.brandId !== brand) return false;
    if (mine && !canAct(r, role, identity)) return false;
    return true;
  });
  const now = new Date().toISOString();
  const grouped = role === 'ADMIN_CN' && mine;
  const sorted = (list: Rtv[]) => [...list].sort((a, b) => {
    const x = sortValue(a, sort.key, now); const y = sortValue(b, sort.key, now);
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), getLang());
    return (c || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)) * (c ? sort.dir : 1);
  });

  const renderTable = (list: Rtv[]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {cols().map(c => {
              const on = sort.key === c.key;
              return (
                <th key={c.key} className={c.num ? 'num' : undefined} aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button type="button" className={`th-sort${on ? ' on' : ''}`} onClick={() => toggleSort(c.key)}>
                    {c.label}<span className="th-arrow" aria-hidden="true">{on ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted(list).map(r => {
            const own = owner(r);
            return (
              <tr key={r.id} data-testid="rtv-row">
                <td className="nowrap"><Link className="mono" to={`/rtv/${r.id}`}>{r.id}</Link></td>
                <td className="nowrap" data-testid="opened">{fmtDateTime(r.createdAt)}</td>
                <td>{brandOf(r)}</td>
                <td>{storeOf(r)}</td>
                <td>{CHANNEL_LABELS[r.channel]}</td>
                <td className="status-cell">{r.cancelled
                  ? <><span className="badge badge-failed">{tr('ยกเลิก', 'Cancelled')}</span> <span className="muted cancel-at">{tr(`หลังขั้น ${r.step}`, `after step ${r.step}`)}</span></>
                  : <>
                    {r.step}. {STEP_LABELS[r.step]}
                    {(holds(r).length > 0 || r.shortBoxes > 0) && (
                      <span className="status-flags">
                        {holds(r).map(h => <span key={h} className="badge badge-assigned">{HOLD_LABELS[h]}</span>)}
                        {r.shortBoxes > 0 && <span className="badge badge-alert">{tr(`กล่องขาด ${r.shortBoxes}`, `${r.shortBoxes} short`)}</span>}
                      </span>
                    )}
                  </>}</td>
                <td data-testid="owner">{own ? ROLE_LABELS[own] : '—'}</td>
                <td className="num" data-testid="age">{ageDays(r, now)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <h1>{tr('รายการ RTV', 'RTV list')}</h1>
      <div className="card intro-card">
        <p>{tr('One RTV: เลขเดียวที่ทุกฝ่ายใช้ติดตามงานคืนสินค้า ตั้งแต่เปิดคำสั่งจนออก CN', 'One RTV: a single number every team uses to track a return, from opening the order to issuing the CN')}</p>
        <div className="intro-actions">
          <Link className="btn btn-primary btn-sm" to="/tour">{tr('ดู Demo นำชม', 'View guided demo')}</Link>
          <Link className="btn btn-sm" to="/flow">{tr('ดู Flow ภาพรวม', 'View flow overview')}</Link>
        </div>
      </div>
      {role === 'BRAND' && <p><Link className="btn btn-primary" to="/new">{tr('+ เปิดคำสั่งแจ้งเก็บ', '+ Open pickup order')}</Link></p>}
      {ownerFilter && (
        <p className="chips">
          <span className="chip">{tr('ค้างที่:', 'With:')} {ROLE_LABELS[ownerFilter]}{' '}
            <button type="button" className="btn btn-sm" aria-label={tr('ล้างตัวกรองค้างที่', 'Clear the With filter')}
              onClick={() => { const p = new URLSearchParams(params); p.delete('owner'); setParams(p); }}>✕</button>
          </span>
        </p>
      )}
      {brandOnly && <p className="muted">{tr(`แสดงเฉพาะงานของ ${brandName}`, `Showing ${brandName} only`)}</p>}
      {q && <h2>{tr(`ผลการค้นหา "${q}"`, `Search results for "${q}"`)}</h2>}
      <div className="card form-grid">
        <label className="field">{tr('สถานะ', 'Status')}
          <select value={step} onChange={e => setStep(e.target.value)}>
            <option value="">{tr('ทั้งหมด', 'All')}</option>
            {STEPS.map(s => <option key={s} value={s}>{s}. {STEP_LABELS[s]}</option>)}
            <optgroup label={tr('รอ Brand / ฝ่ายขาย (ออก CN ไม่ได้)', 'Waiting for Brand / Sales (cannot issue CN)')}>
              {HOLDS.map(h => <option key={h} value={`HOLD:${h}`}>{HOLD_LABELS[h]}</option>)}
            </optgroup>
            <optgroup label={tr('ปัญหาระหว่างทาง', 'Issues in transit')}>
              <option value="SHORT">{tr('กล่องขาด (ยังไม่ปิดธง)', 'Short boxes (flag open)')}</option>
            </optgroup>
            <option value="CANCELLED">{tr('ยกเลิก', 'Cancelled')}</option>
          </select>
        </label>
        <label className="field">{tr('ช่องทาง', 'Channel')}
          <select value={channel} onChange={e => setChannel(e.target.value)}>
            <option value="">{tr('ทั้งหมด', 'All')}</option>
            {(Object.keys(CHANNEL_LABELS) as Channel[]).map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
          </select>
        </label>
        {!brandOnly && (
          <label className="field">{tr('แบรนด์', 'Brand')}
            <select value={brand} onChange={e => setBrand(e.target.value)}>
              <option value="">{tr('ทั้งหมด', 'All')}</option>
              {BRAND_GROUPS.map(g => (
                <optgroup key={g} label={g}>
                  {BRANDS.filter(b => b.group === g).sort((x, y) => x.name.localeCompare(y.name))
                    .map(b => <option key={b.id} value={b.id}>{b.name} ({b.id})</option>)}
                </optgroup>
              ))}
            </select>
          </label>
        )}
        <label className="field check-field">
          <span><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> {tr('ค้างที่ฉัน', 'With me')}</span>
        </label>
      </div>
      {rows.length === 0 ? (
        <div className="card empty">{mine ? tr('ไม่มีงานที่ค้างอยู่กับบทบาทนี้', 'Nothing is waiting on this role') : tr('ไม่พบรายการ', 'No orders found')}</div>
      ) : (
        grouped ? (
          (Object.keys(CN_LABELS) as CnType[]).map(t => {
            const group = rows.filter(r => cnType(r.channel, r.saleType) === t);
            return (
              <section key={t}>
                <h2>{CN_LABELS[t]}</h2>
                {group.length === 0 ? <p className="muted">{tr('ไม่มีงาน', 'No jobs')}</p> : renderTable(group)}
              </section>
            );
          })
        ) : renderTable(rows)
      )}
    </div>
  );
}
