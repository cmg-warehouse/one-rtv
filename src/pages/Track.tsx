import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { searchByAnyNumber } from '../api';
import ThaiMap, { fitView, project, TruckGlyph } from '../components/ThaiMap';
import Timeline from '../components/Timeline';
import { BRANDS, STORES } from '../data/masters';
import { daysBetween, fmtDate, fmtDateTime } from '../domain/format';
import { HUBS, locate, placeAt, positionOf, route, type Place } from '../domain/geo';
import { CARRIER_LABELS, CHANNEL_LABELS, owner } from '../domain/rules';
import { boxTrace, milestones, type BoxMark } from '../domain/track';
import type { Rtv } from '../domain/types';
import { ROLE_LABELS } from '../state/session';
import { useRtv, useRtvList } from '../state/useRtvs';
import { tr } from '../i18n';

const storeName = (id: string) => STORES.find(s => s.id === id)?.name ?? id;
const placeName = (p: Place) => (p.kind === 'HUB' ? HUBS[p.id].name : storeName(p.id));

const MARK: Record<BoxMark, { icon: string; text: string }> = {
  ok: { icon: '✓', get text() { return tr('สแกนแล้ว', 'Scanned'); } },
  missing: { icon: '!', get text() { return tr('ไม่พบกล่อง', 'Not found'); } },
  pending: { icon: '·', get text() { return tr('ยังไม่ถึง', 'Not yet'); } },
  skipped: { icon: '–', get text() { return tr('ไม่ผ่าน', 'Skipped'); } },
};

function Mark({ m }: { m: BoxMark }) {
  return <span className={`bmark bmark-${m}`} title={MARK[m].text} aria-label={MARK[m].text}>{MARK[m].icon}</span>;
}

function RouteMap({ rtv }: { rtv: Rtv }) {
  const stops = route(rtv);
  const loc = locate(rtv, new Date().toISOString());
  const pos = positionOf(loc);
  const pts = stops.map(p => project(placeAt(p)));
  // how far along the stop list the goods are: index of the last stop passed
  const passed = loc.kind === 'DONE' ? stops.length - 1
    : loc.kind === 'AT' ? stops.findIndex(s => s.kind === loc.place.kind && s.id === loc.place.id)
    : stops.findIndex(s => s.kind === loc.from.kind && s.id === loc.from.id);
  const view = fitView(stops.map(placeAt), 30, 0.3);
  return (
    <ThaiMap view={view} className="track-map" label={tr('เส้นทางของสินค้า', 'Route of the goods')} px={300}>
      {(u) => (
        <>
          <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="var(--color-brand)" strokeWidth={u * 2.5}
            strokeDasharray={`${u * 5} ${u * 4}`} opacity={0.5} />
          <polyline points={[...pts.slice(0, passed + 1), ...(pos && loc.kind === 'ROAD' ? [project(pos)] : [])].map(p => p.join(',')).join(' ')}
            fill="none" stroke="var(--color-brand)" strokeWidth={u * 4} strokeLinecap="round" />
          {stops.map((p, i) => {
            const [x, y] = pts[i];
            const done = i <= passed;
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={u * 9} fill={done ? 'var(--color-brand)' : '#fff'} stroke="var(--color-brand)" strokeWidth={u * 2.5} />
                <text x={x + u * 14} y={y + u * 5} fontSize={u * 13} fontWeight={600} className="map-label">
                  {p.kind === 'HUB' ? HUBS[p.id].short : storeName(p.id).replace('สาขาตัวอย่าง ', '').replace('ห้างท้องถิ่นตัวอย่าง ', '').replace('Sample store ', '').replace('Sample local mall ', '')}
                </text>
              </g>
            );
          })}
          {pos && loc.kind === 'ROAD' && (() => { const [x, y] = project(pos); return <><circle cx={x} cy={y} r={u * 24} className="map-pulse" /><TruckGlyph x={x} y={y} u={u * 1.3} color="var(--color-brand)" /></>; })()}
          {pos && loc.kind === 'AT' && (() => { const [x, y] = project(pos); return <circle cx={x} cy={y} r={u * 22} className="map-pulse" />; })()}
        </>
      )}
    </ThaiMap>
  );
}

function TrackResult({ rtv }: { rtv: Rtv }) {
  const now = new Date().toISOString();
  const ms = milestones(rtv);
  const loc = locate(rtv, now);
  const own = owner(rtv);
  const boxes = boxTrace(rtv);
  const doneCount = ms.filter(m => m.state === 'done').length;
  const total = ms.filter(m => m.state !== 'skipped').length;
  const brand = BRANDS.find(b => b.id === rtv.brandId)?.name ?? rtv.brandId;
  const age = daysBetween(rtv.createdAt, rtv.events[rtv.events.length - 1].at);
  const last = rtv.events[rtv.events.length - 1];
  return (
    <div className="track-result">
      <section className="card track-hero">
        <div className="track-hero-main">
          <p className="muted track-kicker">{tr('หมายเลขติดตาม', 'Tracking number')}</p>
          <h1 className="rtv-id mono">{rtv.id}</h1>
          <p className={`track-status${rtv.cancelled ? ' is-cancel' : ''}`}>
            <span className="track-status-dot" />{loc.label}
          </p>
          <p className="muted">
            {brand} · {storeName(rtv.storeId)} · {CHANNEL_LABELS[rtv.channel]} · {tr('ขนส่ง', 'Carrier')} {rtv.carrier ? CARRIER_LABELS[rtv.carrier] : '—'}
          </p>
        </div>
        <dl className="track-facts">
          <div><dt>{tr('ความคืบหน้า', 'Progress')}</dt><dd>{doneCount}/{total}</dd></div>
          <div><dt>{tr('จำนวนกล่อง', 'Boxes')}</dt><dd>{rtv.boxes.length}</dd></div>
          <div><dt>{own ? tr('ค้างที่', 'Waiting at') : tr('สถานะ', 'Status')}</dt><dd className="track-owner">{own ? ROLE_LABELS[own] : rtv.cancelled ? tr('ยกเลิก', 'Cancelled') : tr('ปิดงาน', 'Closed')}</dd></div>
          <div><dt>{tr('อัปเดตล่าสุด', 'Last update')}</dt><dd className="track-small">{fmtDateTime(last.at)}</dd></div>
        </dl>
        <div className="track-progress" aria-hidden="true"><span style={{ width: `${(doneCount / total) * 100}%` }} /></div>
      </section>

      <section className="card">
        <h2>{tr('ความคืบหน้า', 'Progress')}</h2>
        <ol className="milestones">
          {ms.map(m => (
            <li key={m.key} className={`ms ms-${m.state}`} data-testid="milestone" data-state={m.state}>
              <span className="ms-dot">{m.state === 'done' ? '✓' : ''}</span>
              <span className="ms-label">{m.label}</span>
              <span className="ms-sub">{m.state === 'current' ? tr('กำลังดำเนินการ', 'In progress') : m.sub}</span>
              {m.at && <span className="ms-at">{fmtDateTime(m.at)}</span>}
            </li>
          ))}
        </ol>
      </section>

      <div className="track-grid">
        <section className="card">
          <h2>{tr('เส้นทาง', 'Route')}</h2>
          <RouteMap rtv={rtv} />
          <ol className="route-stops">
            {route(rtv).map((p, i) => <li key={i}>{placeName(p)}</li>)}
          </ol>
          <p className="muted track-small">{tr(`ใช้เวลาแล้ว ${age} วัน`, `${age} days so far`)} · {tr('เปิดเมื่อ', 'opened')} {fmtDate(rtv.createdAt)}</p>
        </section>
        <section className="card">
          <h2>{tr('สถานะรายกล่อง', 'Box status')}</h2>
          <div className="table-wrap">
            <table className="box-trace">
              <thead><tr><th>{tr('เลขกล่อง', 'Box no.')}</th><th>{tr('เก็บ', 'Pickup')}</th><th>SCDC</th><th>CMG</th><th className="num">{tr('นับได้', 'Counted')}</th></tr></thead>
              <tbody>
                {boxes.map(b => (
                  <tr key={b.no}>
                    <td className="mono">{b.no.slice(-3)}</td>
                    <td><Mark m={b.pickup} /></td><td><Mark m={b.scdc} /></td><td><Mark m={b.cmg} /></td>
                    <td className={`num${b.countedPcs !== undefined && b.countedPcs !== b.expectedPcs ? ' count-diff' : ''}`}>
                      {b.countedPcs ?? '—'}/{b.expectedPcs}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rtv.shortBoxes > 0 && <p className="warn">{tr(`มีกล่องขาด ${rtv.shortBoxes} กล่อง รอ CS ตรวจสอบ`, `${rtv.shortBoxes} box(es) missing, waiting for CS to check`)}</p>}
          <p className="muted track-small">{tr('✓ สแกนแล้ว · ! ไม่พบกล่อง · – ไม่ผ่านจุดนี้', '✓ scanned · ! not found · – skipped')}</p>
        </section>
      </div>

      <section className="card">
        <h2>{tr('ประวัติการสแกนและสถานะ', 'Scan and status history')}</h2>
        <Timeline events={rtv.events} />
      </section>
      <p className="secondary-row">
        <Link className="btn" to={`/rtv/${rtv.id}`}>{tr('เปิดหน้ารายละเอียด RTV', 'Open RTV details')}</Link>
        <Link className="btn" to={`/map?rtv=${rtv.id}`}>{tr('ดูบนแผนที่', 'View on map')}</Link>
      </p>
    </div>
  );
}

function TrackById({ id }: { id: string }) {
  const { rtv } = useRtv(id);
  if (rtv === undefined) return <p className="muted">{tr('กำลังโหลด…', 'Loading…')}</p>;
  if (rtv === null) return <div className="card empty"><p>{tr(`ไม่พบเลข ${id}`, `Number ${id} not found`)}</p></div>;
  return <TrackResult rtv={rtv} />;
}

/** RTVs worth showing on the landing state: goods currently on a truck, then the newest ones. */
function Suggestions() {
  const { rtvs } = useRtvList();
  const now = new Date().toISOString();
  const moving = rtvs.filter(r => locate(r, now).kind === 'ROAD').slice(0, 6);
  return (
    <section>
      <h2>{tr('กำลังขนส่งตอนนี้', 'In transit now')}</h2>
      <div className="track-suggest">
        {moving.map(r => (
          <Link key={r.id} to={`/track/${r.id}`} className="card track-suggest-card">
            <span className="mono">{r.id}</span>
            <span className="muted">{storeName(r.storeId)}</span>
            <span className="track-suggest-loc">{locate(r, now).label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Track() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [q, setQ] = useState(id ?? '');
  const [hits, setHits] = useState<Rtv[] | null>(null);
  useEffect(() => { setQ(id ?? ''); setHits(null); }, [id]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (!term) return;
    const found = await searchByAnyNumber(term);
    if (found.length === 1) navigate(`/track/${found[0].id}`);
    else setHits(found);
  };

  return (
    <div className="track-page">
      <form className="track-search" onSubmit={(e) => { void submit(e); }}>
        <div>
          <p className="track-search-title">Track &amp; Trace</p>
          <p className="muted">{tr('ติดตามสินค้าคืนด้วยเลขใดก็ได้: RTV, เลขกล่อง, MIM, TK, เลขพัสดุ หรือ CN', 'Track a return with any number: RTV, box number, MIM, TK, tracking number or CN')}</p>
        </div>
        <div className="track-search-row">
          <input aria-label={tr('เลขติดตาม', 'Tracking number')} placeholder={tr('เช่น RTV-CMG-2611-00120', 'e.g. RTV-CMG-2611-00120')} value={q} onChange={e => setQ(e.target.value)} />
          <button type="submit" className="btn btn-primary">{tr('ติดตาม', 'Track')}</button>
        </div>
      </form>
      {hits && hits.length === 0 && <div className="card empty">{tr('ไม่พบเลขนี้', 'Number not found')}</div>}
      {hits && hits.length > 1 && (
        <div className="card">
          <h2>{tr(`พบ ${hits.length} รายการ`, `${hits.length} found`)}</h2>
          <ul className="map-list">
            {hits.map(r => <li key={r.id}><Link className="mono" to={`/track/${r.id}`}>{r.id}</Link> <span className="muted">{storeName(r.storeId)}</span></li>)}
          </ul>
        </div>
      )}
      {id ? <TrackById key={id} id={id} /> : !hits && <Suggestions />}
    </div>
  );
}
