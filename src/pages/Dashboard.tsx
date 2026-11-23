import { Link } from 'react-router-dom';
import { computeMetrics } from '../domain/metrics';
import { HOLD_LABELS, HOLDS, STEP_LABELS, STEPS } from '../domain/rules';
import { ROLE_LABELS } from '../state/session';
import { useRtvList } from '../state/useRtvs';
import { tr } from '../i18n';

const days = (n: number | null): string => (n === null ? '—' : tr(`${n.toFixed(1)} วัน`, `${n.toFixed(1)} days`));
/** Steps an open RTV can be at: step 10 means closed, so it never appears among open work. */
const OPEN_STEPS = STEPS.filter(s => s !== 10);

export default function Dashboard() {
  const { rtvs } = useRtvList();
  const m = computeMetrics(rtvs, new Date().toISOString());
  const maxStep = Math.max(1, ...OPEN_STEPS.map(s => m.byStep[s]));

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="kpi-grid">
        <div className="kpi-tile"><div className="kpi-label">{tr('งานเปิด', 'Open orders')}</div><div className="kpi-value">{m.open}</div></div>
        <div className="kpi-tile"><div className="kpi-label">{tr('ปิดแล้ว', 'Closed')}</div><div className="kpi-value">{m.closed}</div></div>
        <div className="kpi-tile kpi-alert"><div className="kpi-label">{tr('กล่องขาดที่ยังเปิด', 'Open short boxes')}</div><div className="kpi-value">{m.shortBoxOpen}</div></div>
      </div>

      <h2>{tr('งานเปิดตามสถานะ', 'Open orders by status')}</h2>
      <div className="card">
        {OPEN_STEPS.map(s => (
          <div className="bar-row" key={s}>
            <span className="bar-label">{s}. {STEP_LABELS[s]}</span>
            <span className="bar-track"><span className="bar-fill" style={{ width: `${(m.byStep[s] / maxStep) * 100}%` }} /></span>
            <span className="bar-value">{m.byStep[s]}</span>
          </div>
        ))}
      </div>

      <h2>{tr('งานค้างตามผู้รับผิดชอบ', 'Pending orders by owner')}</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{tr('ผู้รับผิดชอบ', 'Owner')}</th><th className="num">{tr('จำนวนงาน', 'Orders')}</th><th className="num">{tr('งานเก่าสุด', 'Oldest')}</th><th>{tr('รายการ', 'List')}</th></tr></thead>
          <tbody>
            {m.byOwner.map(o => (
              <tr key={o.role}>
                <td>{ROLE_LABELS[o.role]}</td>
                <td className="num">{o.count}</td>
                <td className="num">{days(o.oldestDays)}</td>
                <td><Link to={`/?owner=${o.role}`}>{tr('ดูรายการ', 'View list')}</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{tr('งานที่รอ Brand / ฝ่ายขาย', 'Orders waiting for Brand / Sales')}</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>{tr('รอเรื่อง', 'Waiting for')}</th><th className="num">{tr('จำนวนงาน', 'Orders')}</th><th className="num">{tr('รอเฉลี่ย', 'Avg wait')}</th></tr></thead>
          <tbody>
            {HOLDS.map(h => (
              <tr key={h}>
                <td>{m.byHold[h].count > 0 ? <Link to={`/?status=HOLD:${h}`}>{HOLD_LABELS[h]}</Link> : HOLD_LABELS[h]}</td>
                <td className="num">{m.byHold[h].count}</td>
                <td className="num">{m.byHold[h].count === 0 ? '—' : days(m.byHold[h].avgWaitDays)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>{tr('เวลาเฉลี่ยแต่ละช่วง', 'Average time per stage')}</h2>
      <div className="kpi-grid">
        {m.segments.map(s => (
          <div className="kpi-tile" key={s.label}>
            <div className="kpi-label">{s.label}</div>
            <div className="kpi-value">{days(s.avgDays)}</div>
            <div className="kpi-sub">{tr(`จาก ${s.n} งาน`, `from ${s.n} orders`)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
