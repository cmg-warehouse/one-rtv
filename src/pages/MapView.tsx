import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import ThaiMap, { fitView, project, TruckGlyph, VIEW_BKK, VIEW_TH, type View } from '../components/ThaiMap';
import { STORES } from '../data/masters';
import { HUBS, locate, placeAt, positionOf, route, STORE_AT, type HubId, type Location } from '../domain/geo';
import { CARRIER_LABELS } from '../domain/rules';
import type { Rtv } from '../domain/types';
import { useRtvList } from '../state/useRtvs';
import { tr } from '../i18n';

type Cat = 'STORE' | 'ROAD' | 'SCDC' | 'CMG';
const CATS: { key: Cat; label: string }[] = [
  { key: 'STORE', get label() { return tr('รอเก็บที่สาขา', 'Waiting at store'); } },
  { key: 'ROAD', get label() { return tr('กำลังขนส่ง', 'In transit'); } },
  { key: 'SCDC', get label() { return tr('อยู่ที่ SCDC', 'At SCDC'); } },
  { key: 'CMG', get label() { return tr('อยู่ที่คลัง CMG', 'At CMG warehouse'); } },
];

interface Item { rtv: Rtv; loc: Exclude<Location, { kind: 'DONE' }>; cat: Cat }

function catOf(loc: Item['loc']): Cat {
  if (loc.kind === 'ROAD') return 'ROAD';
  return loc.place.kind === 'STORE' ? 'STORE' : loc.place.id;
}

/** Stores close to Bangkok overlap at country zoom: their labels only show once zoomed in. */
const inBkk = (id: string) => { const [lng, lat] = STORE_AT[id]; return lng > 100.3 && lng < 100.9 && lat > 13.5 && lat < 14.2; };
const storeName = (id: string) => STORES.find(s => s.id === id)?.name ?? id;
const shortStore = (id: string) => storeName(id).replace('สาขาตัวอย่าง ', '').replace('ห้างท้องถิ่นตัวอย่าง ', 'ห้าง ').replace('Sample store ', '').replace('Sample local mall ', 'Mall ');

export default function MapView() {
  const { rtvs } = useRtvList();
  const [params] = useSearchParams();
  const [cat, setCat] = useState<Cat | 'ALL'>('ALL');
  const [store, setStore] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(params.get('rtv'));
  const [view, setView] = useState<View>(() => VIEW_TH);
  const now = new Date().toISOString();

  const items = useMemo(() => rtvs.flatMap((rtv): Item[] => {
    const loc = locate(rtv, now);
    return loc.kind === 'DONE' ? [] : [{ rtv, loc, cat: catOf(loc) }];
  }), [rtvs]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = Object.fromEntries(CATS.map(c => [c.key, items.filter(i => i.cat === c.key).length])) as Record<Cat, number>;
  const atStore = (id: string) => items.filter(i => i.cat === 'STORE' && i.loc.kind === 'AT' && i.loc.place.id === id);
  const atHub = (id: HubId) => items.filter(i => i.cat === id);
  const list = items.filter(i => (cat === 'ALL' || i.cat === cat) && (!store || i.rtv.storeId === store));
  const sel = items.find(i => i.rtv.id === selected) ?? null;

  const select = (it: Item | null) => {
    setSelected(it?.rtv.id ?? null);
    if (it) setView(fitView(route(it.rtv).map(placeAt), 40, 0.35));
  };
  const pickStore = (id: string | null) => {
    setStore(id);
    setSelected(null);
    if (id) setView(fitView([STORE_AT[id], HUBS.CMG.at], 40, 0.4));
  };

  return (
    <div className="map-page">
      <div className="page-head">
        <div>
          <h1>{tr('แผนที่งานคืนสินค้า', 'Returns map')}</h1>
          <p className="muted">{tr('ตำแหน่งสินค้าของงานที่ยังเปิดอยู่ คำนวณจากสถานะล่าสุดของแต่ละ RTV', 'Location of goods for open orders, worked out from the latest status of each RTV')}</p>
        </div>
        <div className="seg" role="group" aria-label={tr('มุมมองแผนที่', 'Map view')}>
          <button type="button" className={`seg-btn${view === VIEW_TH ? ' on' : ''}`} onClick={() => setView(VIEW_TH)}>{tr('ทั้งประเทศ', 'Nationwide')}</button>
          <button type="button" className={`seg-btn${view === VIEW_BKK ? ' on' : ''}`} onClick={() => setView(VIEW_BKK)}>{tr('กรุงเทพฯ และปริมณฑล', 'Bangkok and vicinity')}</button>
        </div>
      </div>

      <div className="map-kpis">
        <button type="button" className={`map-kpi${cat === 'ALL' ? ' on' : ''}`} onClick={() => setCat('ALL')}>
          <span className="map-kpi-value">{items.length}</span><span>{tr('งานเปิดทั้งหมด', 'Open orders')}</span>
        </button>
        {CATS.map(c => (
          <button key={c.key} type="button" className={`map-kpi map-kpi-${c.key.toLowerCase()}${cat === c.key ? ' on' : ''}`}
            onClick={() => setCat(cat === c.key ? 'ALL' : c.key)}>
            <span className="map-kpi-value">{counts[c.key]}</span><span>{c.label}</span>
          </button>
        ))}
      </div>

      <div className="map-layout">
        <div className="map-canvas card">
          <ThaiMap view={view} label={tr('แผนที่ประเทศไทย แสดงตำแหน่งงานคืนสินค้า', 'Map of Thailand showing the location of return orders')} onBackgroundClick={() => { setSelected(null); }}>
            {(u) => (
              <>
                {/* trunk routes to the hubs */}
                {STORES.map(s => {
                  const [x1, y1] = project(STORE_AT[s.id]);
                  const [x2, y2] = project(HUBS.CMG.at);
                  return <line key={s.id} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--map-route)" strokeWidth={u} strokeDasharray={`${u * 3} ${u * 4}`} />;
                })}
                {/* trucks on the road */}
                {items.filter(i => i.loc.kind === 'ROAD' && (cat === 'ALL' || cat === 'ROAD')).map(i => {
                  const loc = i.loc as Extract<Location, { kind: 'ROAD' }>;
                  const [x1, y1] = project(placeAt(loc.from));
                  const [x2, y2] = project(placeAt(loc.to));
                  const [x, y] = project(positionOf(loc)!);
                  const on = selected === i.rtv.id;
                  return (
                    <g key={i.rtv.id} className="map-truck" onClick={() => select(i)} role="button" aria-label={`${i.rtv.id} ${loc.label}`}>
                      <line x1={x1} y1={y1} x2={x} y2={y} stroke="var(--color-brand)" strokeWidth={u * (on ? 3 : 1.6)} opacity={on ? 1 : 0.55} />
                      <line x1={x} y1={y} x2={x2} y2={y2} stroke="var(--color-brand)" strokeWidth={u * (on ? 2.5 : 1.2)}
                        strokeDasharray={`${u * 4} ${u * 4}`} opacity={on ? 1 : 0.4} className="map-dash" />
                      {on && <circle cx={x} cy={y} r={u * 20} className="map-pulse" />}
                      <TruckGlyph x={x} y={y} u={u} color={on ? 'var(--color-brand)' : 'var(--color-text)'} />
                    </g>
                  );
                })}
                {/* selected RTV route */}
                {sel && sel.loc.kind === 'AT' && (() => {
                  const pts = route(sel.rtv).map(p => project(placeAt(p)));
                  const [x, y] = project(positionOf(sel.loc)!);
                  return (
                    <g pointerEvents="none">
                      <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="var(--color-brand)"
                        strokeWidth={u * 2.5} strokeDasharray={`${u * 5} ${u * 4}`} className="map-dash" />
                      <circle cx={x} cy={y} r={u * 22} className="map-pulse" />
                    </g>
                  );
                })()}
                {/* stores */}
                {STORES.map(s => {
                  const [x, y] = project(STORE_AT[s.id]);
                  const n = atStore(s.id).length;
                  const on = store === s.id || sel?.rtv.storeId === s.id;
                  const show = cat === 'ALL' || cat === 'STORE';
                  return (
                    <g key={s.id} className="map-store" onClick={() => pickStore(store === s.id ? null : s.id)} role="button"
                      aria-label={tr(`${s.name} รอเก็บ ${n} งาน`, `${s.name}: ${n} waiting for pickup`)}>
                      <circle cx={x} cy={y} r={u * (n && show ? 9 : 5)} fill={n && show ? '#fff' : 'var(--map-store-idle)'}
                        stroke={on ? 'var(--color-brand)' : 'var(--color-text)'} strokeWidth={u * (on ? 3 : 1.5)} />
                      {n > 0 && show && <text x={x} y={y + u * 3.5} textAnchor="middle" fontSize={u * 10} fontWeight={700} className="map-num">{n}</text>}
                      {(!inBkk(s.id) || u < 0.6) && <text x={x + u * 12} y={y + u * 4} fontSize={u * 11} className="map-label">{shortStore(s.id)}</text>}
                    </g>
                  );
                })}
                {u >= 0.6 && (() => {
                  const [x, y] = project([100.95, 14.05]);
                  return (
                    <text x={x + u * 6} y={y} fontSize={u * 11} className="map-label map-bkk" role="button"
                      onClick={() => setView(VIEW_BKK)}>{tr(`กรุงเทพฯ และปริมณฑล (${STORES.filter(st => inBkk(st.id)).length} สาขา) — คลิกเพื่อซูม`, `Bangkok and vicinity (${STORES.filter(st => inBkk(st.id)).length} stores) — click to zoom`)}</text>
                  );
                })()}
                {/* hubs */}
                {(Object.keys(HUBS) as HubId[]).map(h => {
                  const [hx, hy] = project(HUBS[h].at);
                  // Both hubs are ~6 km apart in Samut Prakan: at country zoom pull the markers apart so they stay readable.
                  const left = h === 'SCDC';
                  const spreadOut = u >= 0.6 ? (left ? -13 : 13) * u : 0;
                  const x = hx + spreadOut;
                  const y = hy;
                  const n = atHub(h).length;
                  const dim = cat !== 'ALL' && cat !== h;
                  return (
                    <g key={h} className="map-hub" opacity={dim ? 0.45 : 1} onClick={() => setCat(cat === h ? 'ALL' : h)} role="button"
                      aria-label={tr(`${HUBS[h].name} ${n} งาน`, `${HUBS[h].name}: ${n} orders`)}>
                      <title>{tr(`${HUBS[h].name}\n${HUBS[h].address}\n(ตำแหน่งโดยประมาณ)`, `${HUBS[h].name}\n${HUBS[h].address}\n(approximate location)`)}</title>
                      {spreadOut !== 0 && <line x1={hx} y1={hy} x2={x} y2={y} stroke="var(--color-text)" strokeWidth={u} />}
                      <rect x={x - u * 11} y={y - u * 11} width={u * 22} height={u * 22} rx={u * 5}
                        fill={h === 'CMG' ? 'var(--color-brand)' : 'var(--color-text)'} stroke="#fff" strokeWidth={u * 2} />
                      <text x={x} y={y + u * 4} textAnchor="middle" fontSize={u * 11} fontWeight={700} fill="#fff">{n}</text>
                      <text x={x + (left ? -15 : 15) * u} y={y + u * 4} textAnchor={left ? 'end' : 'start'} fontSize={u * 12} fontWeight={600}
                        className="map-label map-label-hub">{HUBS[h].short}</text>
                    </g>
                  );
                })}
              </>
            )}
          </ThaiMap>
          <div className="map-legend">
            <span><i className="lg lg-store" />{tr('สาขา (ตัวเลข = งานรอเก็บ)', 'Store (number = orders waiting for pickup)')}</span>
            <span><i className="lg lg-truck" />{tr('รถกำลังขนส่ง', 'Truck in transit')}</span>
            <span><i className="lg lg-scdc" />{tr('SCDC คลองส่งน้ำ (บางพลี)', 'SCDC Khlong Song Nam (Bang Phli)')}</span>
            <span><i className="lg lg-cmg" />{tr('CMG กม.20 (บางเสาธง)', 'CMG Km.20 (Bang Sao Thong)')}</span>
            <span className="muted">{tr('ตำแหน่งคลังโดยประมาณ · สาขาเป็นข้อมูลจำลอง', 'Warehouse locations are approximate · stores are demo data')}</span>
          </div>
        </div>

        <aside className="map-side">
          {store && (
            <div className="map-filter-chip">
              {tr('สาขา', 'Store')}: <strong>{shortStore(store)}</strong>
              <button type="button" className="btn btn-sm" onClick={() => pickStore(null)}>{tr('ล้าง', 'Clear')}</button>
            </div>
          )}
          {sel && (
            <div className="card map-sel">
              <p className="mono map-sel-id">{sel.rtv.id}</p>
              <p className="map-sel-loc"><span className={`dot dot-${sel.cat.toLowerCase()}`} />{sel.loc.label}</p>
              <p className="muted">{storeName(sel.rtv.storeId)} · {sel.rtv.carrier ? CARRIER_LABELS[sel.rtv.carrier] : tr('ยังไม่จัดขนส่ง', 'No carrier yet')} · {sel.rtv.boxes.length} {tr('กล่อง', 'boxes')}</p>
              <div className="secondary-row">
                <Link className="btn btn-primary btn-sm" to={`/track/${sel.rtv.id}`}>Track &amp; Trace</Link>
                <Link className="btn btn-sm" to={`/rtv/${sel.rtv.id}`}>{tr('รายละเอียด', 'Details')}</Link>
              </div>
            </div>
          )}
          <h2 className="map-list-title">{cat === 'ALL' ? tr('งานเปิดทั้งหมด', 'Open orders') : CATS.find(c => c.key === cat)?.label} ({list.length})</h2>
          <ul className="map-list">
            {list.map(i => (
              <li key={i.rtv.id}>
                <button type="button" className={`map-row${selected === i.rtv.id ? ' on' : ''}`} onClick={() => select(i)}>
                  <span className={`dot dot-${i.cat.toLowerCase()}`} />
                  <span className="map-row-main">
                    <span className="mono">{i.rtv.id}</span>
                    <span className="muted">{shortStore(i.rtv.storeId)} · {i.loc.label}</span>
                  </span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="muted">{tr('ไม่มีงานในกลุ่มนี้', 'No orders in this group')}</li>}
          </ul>
        </aside>
      </div>
    </div>
  );
}
