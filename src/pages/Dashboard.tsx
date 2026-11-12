import { Link } from 'react-router-dom';
import { computeMetrics } from '../domain/metrics';
import { HOLD_LABELS, HOLDS, STEP_LABELS, STEPS } from '../domain/rules';
import { ROLE_LABELS } from '../state/session';
import { useRtvList } from '../state/useRtvs';

const days = (n: number | null): string => (n === null ? '—' : `${n.toFixed(1)} วัน`);

export default function Dashboard() {
  const { rtvs } = useRtvList();
  const m = computeMetrics(rtvs, new Date().toISOString());
  const maxStep = Math.max(1, ...STEPS.map(s => m.byStep[s]));

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="kpi-grid">
        <div className="kpi-tile"><div className="kpi-label">งานเปิด</div><div className="kpi-value">{m.open}</div></div>
        <div className="kpi-tile"><div className="kpi-label">ปิดแล้ว</div><div className="kpi-value">{m.closed}</div></div>
        <div className="kpi-tile kpi-alert"><div className="kpi-label">กล่องขาดที่ยังเปิด</div><div className="kpi-value">{m.shortBoxOpen}</div></div>
      </div>

      <h2>งานตามสถานะ</h2>
      <div className="card">
        {STEPS.map(s => (
          <div className="bar-row" key={s}>
            <span className="bar-label">{s}. {STEP_LABELS[s]}</span>
            <span className="bar-track"><span className="bar-fill" style={{ width: `${(m.byStep[s] / maxStep) * 100}%` }} /></span>
            <span className="bar-value">{m.byStep[s]}</span>
          </div>
        ))}
      </div>

      <h2>งานค้างตามผู้รับผิดชอบ</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>ผู้รับผิดชอบ</th><th className="num">จำนวนงาน</th><th className="num">งานเก่าสุด</th><th>รายการ</th></tr></thead>
          <tbody>
            {m.byOwner.map(o => (
              <tr key={o.role}>
                <td>{ROLE_LABELS[o.role]}</td>
                <td className="num">{o.count}</td>
                <td className="num">{days(o.oldestDays)}</td>
                <td><Link to={`/?owner=${o.role}`}>ดูรายการ</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>งานที่รอ Brand / ฝ่ายขาย</h2>
      <div className="table-wrap">
        <table>
          <thead><tr><th>รอเรื่อง</th><th className="num">จำนวนงาน</th><th className="num">รอเฉลี่ย</th></tr></thead>
          <tbody>
            {HOLDS.map(h => (
              <tr key={h}>
                <td>{HOLD_LABELS[h]}</td>
                <td className="num">{m.byHold[h].count}</td>
                <td className="num">{days(m.byHold[h].avgWaitDays)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>เวลาเฉลี่ยแต่ละช่วง</h2>
      <div className="kpi-grid">
        {m.segments.map(s => (
          <div className="kpi-tile" key={s.label}>
            <div className="kpi-label">{s.label}</div>
            <div className="kpi-value">{days(s.avgDays)}</div>
            <div className="kpi-sub">จาก {s.n} งาน</div>
          </div>
        ))}
      </div>
    </div>
  );
}
