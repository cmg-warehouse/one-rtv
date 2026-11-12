import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { searchByAnyNumber } from '../api';
import { BRANDS, DEMO_BRAND_ID, STORES } from '../data/masters';
import { daysBetween } from '../domain/format';
import { CHANNEL_LABELS, CN_LABELS, STEP_LABELS, cnType, isClosed, owner } from '../domain/rules';
import type { Channel, CnType, Role, Rtv, Step } from '../domain/types';
import { ROLE_LABELS, useSession } from '../state/session';
import { useRtvList } from '../state/useRtvs';

const STEPS = Object.keys(STEP_LABELS).map(Number) as Step[];

export default function RtvList() {
  const { rtvs } = useRtvList();
  const { role, carrierActor } = useSession();
  const [params, setParams] = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const ownerParam = params.get('owner') ?? '';
  const ownerFilter = Object.hasOwn(ROLE_LABELS, ownerParam) ? (ownerParam as Role) : null;
  const [matches, setMatches] = useState<Rtv[] | null>(null);
  const [step, setStep] = useState('');
  const [channel, setChannel] = useState('');
  const [brand, setBrand] = useState('');
  const [mine, setMine] = useState(false);

  useEffect(() => {
    let live = true;
    if (!q) { setMatches(null); return; }
    void searchByAnyNumber(q).then(r => { if (live) setMatches(r); });
    return () => { live = false; };
  }, [q]);

  const base = q ? (matches ?? []) : rtvs;
  const rows = base.filter(r => {
    if (ownerFilter && owner(r) !== ownerFilter) return false;
    if (step && r.step !== Number(step)) return false;
    if (channel && r.channel !== channel) return false;
    if (brand && r.brandId !== brand) return false;
    if (mine) {
      if (owner(r) !== role) return false;
      if (role === 'BRAND' && r.brandId !== DEMO_BRAND_ID) return false;
      if (role === 'CARRIER' && r.carrier !== carrierActor) return false;
    }
    return true;
  });
  const now = new Date().toISOString();
  const grouped = role === 'ADMIN_CN' && mine;

  const renderTable = (list: Rtv[]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>เลข RTV</th><th>แบรนด์</th><th>สาขา</th><th>ช่องทาง</th><th>สถานะ</th><th>ค้างที่</th><th className="num">อายุงาน (วัน)</th></tr>
        </thead>
        <tbody>
          {list.map(r => {
            const own = owner(r);
            const end = isClosed(r) ? r.events[r.events.length - 1]?.at ?? now : now;
            return (
              <tr key={r.id} data-testid="rtv-row">
                <td><Link className="mono" to={`/rtv/${r.id}`}>{r.id}</Link></td>
                <td>{BRANDS.find(b => b.id === r.brandId)?.name}</td>
                <td>{STORES.find(s => s.id === r.storeId)?.name}</td>
                <td>{CHANNEL_LABELS[r.channel]}</td>
                <td>{r.cancelled ? 'ยกเลิก' : `${r.step}. ${STEP_LABELS[r.step]}`}</td>
                <td data-testid="owner">{own ? ROLE_LABELS[own] : '—'}</td>
                <td className="num">{daysBetween(r.createdAt, end)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <div>
      <h1>รายการ RTV</h1>
      <div className="card intro-card">
        <p>One RTV: เลขเดียวที่ทุกฝ่ายใช้ติดตามงานคืนสินค้า ตั้งแต่เปิดคำสั่งจนออก CN</p>
        <div className="intro-actions">
          <Link className="btn btn-primary btn-sm" to="/tour">ดู Demo นำชม</Link>
          <Link className="btn btn-sm" to="/flow">ดู Flow ภาพรวม</Link>
        </div>
      </div>
      {role === 'BRAND' && <p><Link className="btn btn-primary" to="/new">+ เปิดคำสั่งแจ้งเก็บ</Link></p>}
      {ownerFilter && (
        <p className="chips">
          <span className="chip">ค้างที่: {ROLE_LABELS[ownerFilter]}{' '}
            <button type="button" className="btn btn-sm" aria-label="ล้างตัวกรองค้างที่"
              onClick={() => { const p = new URLSearchParams(params); p.delete('owner'); setParams(p); }}>✕</button>
          </span>
        </p>
      )}
      {q && <h2>ผลการค้นหา "{q}"</h2>}
      <div className="card form-grid">
        <label className="field">สถานะ
          <select value={step} onChange={e => setStep(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {STEPS.map(s => <option key={s} value={s}>{s}. {STEP_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="field">ช่องทาง
          <select value={channel} onChange={e => setChannel(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {(Object.keys(CHANNEL_LABELS) as Channel[]).map(c => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
          </select>
        </label>
        <label className="field">แบรนด์
          <select value={brand} onChange={e => setBrand(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {BRANDS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
        <label className="field check-field">
          <span><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> ค้างที่ฉัน</span>
        </label>
      </div>
      {rows.length === 0 ? (
        <div className="card empty">{mine ? 'ไม่มีงานที่ค้างอยู่กับบทบาทนี้' : 'ไม่พบรายการ'}</div>
      ) : (
        grouped ? (
          (Object.keys(CN_LABELS) as CnType[]).map(t => {
            const group = rows.filter(r => cnType(r.channel, r.saleType) === t);
            return (
              <section key={t}>
                <h2>{CN_LABELS[t]}</h2>
                {group.length === 0 ? <p className="muted">ไม่มีงาน</p> : renderTable(group)}
              </section>
            );
          })
        ) : renderTable(rows)
      )}
    </div>
  );
}
