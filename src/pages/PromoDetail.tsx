import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { actPromo, type PromoAction } from '../api';
import { ErrorLine } from '../components/actions/useAct';
import { fmtDateTime } from '../domain/format';
import { HUBS } from '../domain/geo';
import { tr } from '../i18n';
import { PROMO_STAGES, PROMO_STATUS_LABELS, slipOf, totals, TRUCK_TYPES } from '../domain/promo';
import { HOLD_LABELS, holds, STEP_LABELS } from '../domain/rules';
import type { PromoEvent, Rtv, TruckType, Vehicle } from '../domain/types';
import { ROLE_LABELS, useSession } from '../state/session';
import { usePromo, useRtvList } from '../state/useRtvs';
import { brandName, promoOwner, STATUS_BADGE, venueOf } from './PromoList';

function usePromoAct(event: PromoEvent) {
  const { role, actor } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (action: PromoAction) => {
    setBusy(true);
    setError(null);
    try { await actPromo(event.id, action, { role, actor }); } catch (e) {
      setError(e instanceof Error ? e.message : tr('เกิดข้อผิดพลาด', 'Something went wrong'));
    }
    setBusy(false);
  };
  return { run, error, busy };
}

function Stages({ event }: { event: PromoEvent }) {
  const at = PROMO_STAGES.findIndex(s => s.status === event.status);
  return (
    <ol className="promo-stages">
      {PROMO_STAGES.map((s, i) => (
        <li key={s.status} className={i <= at ? 'is-done' : i === at + 1 ? 'is-next' : ''}>
          <span className="promo-stage-no">{i + 1}</span>
          <span>{s.label}<small>{ROLE_LABELS[s.role]}</small></span>
        </li>
      ))}
    </ol>
  );
}

function ForwardAction({ event }: { event: PromoEvent }) {
  const { run, error, busy } = usePromoAct(event);
  const t = totals(event);
  return (
    <div className="card action-card">
      <h2>{tr('ส่งต่อขนส่ง', 'Forward to carrier')}</h2>
      <p>
        {tr(`ขนส่งงานจองรถ (เก็บตรง) · ${event.lines.length} แบรนด์ ${t.boxes} กล่อง ${t.pallets} พาเลท ·`, `Booked truck carrier (direct pickup) · ${event.lines.length} brands ${t.boxes} boxes ${t.pallets} pallets ·`)}
        {' '}{tr('ผู้ประสานงานประมาณรถ', 'Coordinator estimates')} <strong>{event.estimate.type} × {event.estimate.count}</strong>
      </p>
      <p className="muted">{tr(`ทุก RTV ในงานจะใช้ใบแจ้งเก็บรวมใบเดียว (${slipOf(event)})`, `Every RTV in the job uses one combined pickup slip (${slipOf(event)})`)}</p>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void run({ type: 'forward' }); }}>{tr('ส่งต่อขนส่ง (งานจองรถ)', 'Forward to carrier (booked truck)')}</button>
    </div>
  );
}

function VehiclesForm({ event }: { event: PromoEvent }) {
  const { run, error, busy } = usePromoAct(event);
  const [rows, setRows] = useState<Vehicle[]>(() => (event.vehicles.length ? event.vehicles.map(v => ({ ...v }))
    : Array.from({ length: event.estimate.count }, () => ({ type: event.estimate.type, plate: '', driver: '', phone: '' }))));
  const set = (i: number, patch: Partial<Vehicle>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const edit = event.status === 'CONFIRMED';
  return (
    <div className="card action-card">
      <h2>{edit ? tr('แก้ไขรถ', 'Edit trucks') : tr('ยืนยันรถเก็บโปร', 'Confirm promo pickup trucks')}</h2>
      <p className="muted">{tr(`ผู้ประสานงานประมาณ ${event.estimate.type} × ${event.estimate.count} · เปลี่ยนประเภทหรือจำนวนคันได้`, `Coordinator estimates ${event.estimate.type} × ${event.estimate.count} · you can change the type or number of trucks`)}</p>
      {rows.map((v, i) => (
        <div key={i} className="box-row new-box-row">
          <span className="new-box-no">{tr(`คันที่ ${i + 1}`, `Truck ${i + 1}`)}</span>
          <label className="field">{tr('ประเภท', 'Type')}
            <select value={v.type} onChange={e => set(i, { type: e.target.value as TruckType })}>
              {TRUCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="field">{tr('ทะเบียน', 'Plate')}
            <input aria-label={tr(`คันที่ ${i + 1}: ทะเบียน`, `Truck ${i + 1}: plate`)} value={v.plate} onChange={e => set(i, { plate: e.target.value })} />
          </label>
          <label className="field">{tr('คนขับ', 'Driver')}
            <input aria-label={tr(`คันที่ ${i + 1}: คนขับ`, `Truck ${i + 1}: driver`)} value={v.driver} onChange={e => set(i, { driver: e.target.value })} />
          </label>
          <label className="field">{tr('เบอร์โทร', 'Phone')}
            <input aria-label={tr(`คันที่ ${i + 1}: เบอร์โทร`, `Truck ${i + 1}: phone`)} type="tel" value={v.phone} onChange={e => set(i, { phone: e.target.value })} />
          </label>
          {rows.length > 1 && <button type="button" className="btn btn-sm" onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>{tr('ลบ', 'Remove')}</button>}
        </div>
      ))}
      <div className="secondary-row">
        <button type="button" className="btn" onClick={() => setRows(rs => [...rs, { type: event.estimate.type, plate: '', driver: '', phone: '' }])}>{tr('+ เพิ่มรถ', '+ Add truck')}</button>
      </div>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void run({ type: 'confirmVehicles', vehicles: rows }); }}>{edit ? tr('บันทึกการแก้ไขรถ', 'Save truck changes') : tr('ยืนยันรถ และแจ้งทุกแบรนด์', 'Confirm trucks and notify every brand')}</button>
    </div>
  );
}

function PickupForm({ event }: { event: PromoEvent }) {
  const { run, error, busy } = usePromoAct(event);
  const [lines, setLines] = useState(() => Object.fromEntries(event.lines.map(l => [l.brandId, { boxes: String(l.boxes), pallets: String(l.pallets) }])));
  const [extras, setExtras] = useState(() => event.extras.map(x => String(x.pallets)));
  const set = (b: string, patch: Partial<{ boxes: string; pallets: string }>) => setLines(ls => ({ ...ls, [b]: { ...ls[b], ...patch } }));
  const n = (v: string) => (v.trim() === '' ? NaN : Number(v));
  const submit = () => run({
    type: 'recordPickup',
    input: {
      lines: Object.fromEntries(Object.entries(lines).map(([b, v]) => [b, { boxes: n(v.boxes), pallets: n(v.pallets) }])),
      extras: extras.map(n),
    },
  });
  return (
    <div className="card action-card">
      <h2>{tr('บันทึกการเก็บที่หน้างาน', 'Record the pickup on site')}</h2>
      <p className="muted">{tr('กรอกยอดที่เก็บได้จริงต่อแบรนด์ · ขาด / เกินได้ · แบรนด์ที่ไม่มีของให้ใส่ 0 (RTV ของแบรนด์นั้นจะถูกยกเลิก)', 'Enter the quantity actually collected per brand · short / over is fine · enter 0 for a brand with no goods (its RTV will be cancelled)')}</p>
      <div className="table-wrap">
        <table className="promo-lines">
          <thead><tr><th>{tr('แบรนด์', 'Brand')}</th><th className="num">{tr('แจ้ง (กล่อง / พาเลท)', 'Announced (boxes / pallets)')}</th><th className="num">{tr('เก็บได้ (กล่อง)', 'Collected (boxes)')}</th><th className="num">{tr('เก็บได้ (พาเลท)', 'Collected (pallets)')}</th></tr></thead>
          <tbody>
            {event.lines.map(l => (
              <tr key={l.brandId}>
                <td>{l.brandId} · {brandName(l.brandId)}</td>
                <td className="num">{l.boxes} / {l.pallets}</td>
                <td className="num"><input type="number" min={0} aria-label={tr(`${l.brandId}: กล่องที่เก็บได้`, `${l.brandId}: boxes collected`)} value={lines[l.brandId].boxes} onChange={e => set(l.brandId, { boxes: e.target.value })} /></td>
                <td className="num"><input type="number" min={0} aria-label={tr(`${l.brandId}: พาเลทที่เก็บได้`, `${l.brandId}: pallets collected`)} value={lines[l.brandId].pallets} onChange={e => set(l.brandId, { pallets: e.target.value })} /></td>
              </tr>
            ))}
            {event.extras.map((x, i) => (
              <tr key={`x${i}`}>
                <td>{x.label}</td><td className="num">— / {x.pallets}</td><td className="num muted">—</td>
                <td className="num"><input type="number" min={0} aria-label={tr(`${x.label}: พาเลทที่เก็บได้`, `${x.label}: pallets collected`)} value={extras[i]} onChange={e => setExtras(xs => xs.map((v, j) => (j === i ? e.target.value : v)))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void submit(); }}>{tr(`บันทึกการเก็บ (${event.lines.length} แบรนด์)`, `Save pickup (${event.lines.length} brands)`)}</button>
    </div>
  );
}

/** What the "ยืนยันรถเก็บโปร" e-mail used to say, now one shared notice every brand in the pickup sees. */
function Confirmation({ event }: { event: PromoEvent }) {
  if (event.vehicles.length === 0) return null;
  const t = totals(event);
  return (
    <div className="card promo-confirm">
      <h2>{tr('ยืนยันรถเก็บโปร', 'Promo pickup trucks confirmed')}</h2>
      <p>
        {event.name} · {venueOf(event)} · <strong>{fmtDateTime(event.pickupAt)}</strong> ·
        {tr('ผู้ประสานงานหน้างาน', 'On-site coordinator')} {event.contact.name} {event.contact.phone}
      </p>
      <ul className="promo-vehicles">
        {event.vehicles.map((v, i) => (
          <li key={i}><span className="badge badge-transit">{v.type}</span> <strong className="mono">{v.plate}</strong> · {v.driver} {v.phone}</li>
        ))}
      </ul>
      <p className="muted">{tr(`รวม ${t.pallets} พาเลท · รถ ${event.vehicles.length} คัน · วันเก็บจำนวนอาจขาด / เกินจากที่แจ้ง`, `Total ${t.pallets} pallets · ${event.vehicles.length} trucks · quantities on pickup day may be short / over the announcement`)}</p>
    </div>
  );
}

function LineStatus({ rtv }: { rtv: Rtv | undefined }) {
  if (!rtv) return <>—</>;
  if (rtv.cancelled) return <span className="badge badge-failed">{tr('ยกเลิก', 'Cancelled')}</span>;
  return (
    <span className="status-cell">
      {rtv.step}. {STEP_LABELS[rtv.step]}
      {holds(rtv).length > 0 && (
        <span className="status-flags">{holds(rtv).map(h => <span key={h} className="badge badge-assigned">{HOLD_LABELS[h]}</span>)}</span>
      )}
    </span>
  );
}

export default function PromoDetail() {
  const { id = '' } = useParams();
  const { event } = usePromo(id);
  const { rtvs } = useRtvList();
  const { role, identity } = useSession();
  if (event === undefined) return <p className="muted">{tr('กำลังโหลด…', 'Loading…')}</p>;
  if (event === null) return <div className="card empty"><p>{tr('ไม่พบงานนี้', 'Job not found')}</p><Link to="/promo">{tr('กลับไปงานเก็บโปร', 'Back to promo pickups')}</Link></div>;
  const t = totals(event);
  const own = promoOwner(event);
  const picked = event.status === 'PICKED';
  const rtvOf = (rid: string) => rtvs.find(r => r.id === rid);
  return (
    <div className="promo-detail">
      <div className="card">
        <p className="muted"><Link to="/promo">{tr('← งานเก็บโปร', '← Promo pickups')}</Link></p>
        <h1>{event.name}</h1>
        <div className="chips">
          <span className="mono chip">{event.id}</span>
          <span className={`badge ${STATUS_BADGE[event.status]}`}>{PROMO_STATUS_LABELS[event.status]}</span>
          {own && <span className="badge badge-assigned">{tr('ค้างที่', 'Waiting on')}: {ROLE_LABELS[own]}</span>}
        </div>
        <p className="muted rtv-meta">
          {venueOf(event)} · {tr('เก็บ', 'Pickup')} {fmtDateTime(event.pickupAt)} · {tr('หน้างาน', 'On site')} {event.contact.name} {event.contact.phone} ·
          {' '}{tr(`${event.lines.length} แบรนด์ ${t.boxes} กล่อง ${t.pallets} พาเลท · ประมาณรถ ${event.estimate.type} × ${event.estimate.count}`, `${event.lines.length} brands ${t.boxes} boxes ${t.pallets} pallets · est. trucks ${event.estimate.type} × ${event.estimate.count}`)}
        </p>
        <Stages event={event} />
      </div>

      {role === 'CS' && event.status === 'REQUESTED' && <ForwardAction event={event} />}
      {role === 'CARRIER' && (event.status === 'FORWARDED' || event.status === 'CONFIRMED') && <VehiclesForm key={event.status} event={event} />}
      {role === 'CARRIER' && event.status === 'CONFIRMED' && <PickupForm event={event} />}

      <Confirmation event={event} />

      <div className="card">
        <h2>{tr('แบรนด์ในงาน', 'Brands in the job')}</h2>
        <div className="table-wrap">
          <table className="promo-lines">
            <thead>
              <tr>
                <th>{tr('แบรนด์', 'Brand')}</th><th>{tr('เลข RTV', 'RTV no.')}</th><th>{tr('ปลายทาง', 'Destination')}</th>
                <th className="num">{tr('แจ้ง กล่อง / พาเลท', 'Announced boxes / pallets')}</th>{picked && <th className="num">{tr('เก็บได้', 'Collected')}</th>}<th>{tr('สถานะ RTV', 'RTV status')}</th>
              </tr>
            </thead>
            <tbody>
              {event.lines.map(l => {
                const diff = (l.pickedBoxes ?? l.boxes) - l.boxes;
                return (
                  <tr key={l.brandId} className={role === 'BRAND' && l.brandId === identity.brandId ? 'is-mine' : undefined}>
                    <td>{l.brandId} · {brandName(l.brandId)}</td>
                    <td><Link to={`/rtv/${l.rtvId}`} className="mono">{l.rtvId}</Link></td>
                    <td>{HUBS[l.hub].short}</td>
                    <td className="num">{l.boxes} / {l.pallets}</td>
                    {picked && (
                      <td className="num">
                        {l.pickedBoxes} / {l.pickedPallets}
                        {diff !== 0 && <span className={`badge ${diff > 0 ? 'badge-assigned' : 'badge-alert'} promo-diff`}>{diff > 0 ? tr(`เกิน ${diff}`, `over ${diff}`) : tr(`ขาด ${-diff}`, `short ${-diff}`)}</span>}
                      </td>
                    )}
                    <td><LineStatus rtv={rtvOf(l.rtvId)} /></td>
                  </tr>
                );
              })}
              {event.extras.map((x, i) => (
                <tr key={`x${i}`} className="promo-extra">
                  <td>{x.label}</td><td className="muted">{tr('ไม่ออก RTV', 'No RTV issued')}</td><td>—</td><td className="num">— / {x.pallets}</td>
                  {picked && <td className="num">— / {x.pickedPallets ?? 0}</td>}<td>—</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={3}>{tr('รวม', 'Total')}</th><th className="num">{t.boxes} / {t.pallets}</th>
                {picked && <th className="num">{t.pickedBoxes} / {t.pickedPallets}</th>}<th />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {event.status !== 'REQUESTED' && (
        <div className="card promo-slip">
          <QRCodeSVG value={slipOf(event)} size={96} />
          <div>
            <h2>{tr('ใบแจ้งเก็บรวม', 'Combined pickup slip')}</h2>
            <p className="mono">{slipOf(event)}</p>
            <p className="muted">{tr('ใบเดียวต่องาน · คนขับสแกนแล้วเห็นทุกแบรนด์ในงาน', 'One slip per job · the driver scans it and sees every brand in the job')}</p>
            <p><Link to={`/promo/${event.id}/slip`}>{tr('เปิดใบแจ้งเก็บรวม (พิมพ์ / ลองสแกนด้วยมือถือ) →', 'Open the combined pickup slip (print / try scanning with a phone) →')}</Link></p>
          </div>
        </div>
      )}

      <div className="card">
        <h2>{tr('ประวัติงาน', 'Job history')}</h2>
        <ul className="promo-log">
          {[...event.log].reverse().map((g, i) => (
            <li key={i}><span className="muted nowrap">{fmtDateTime(g.at)}</span> <strong>{g.actor}</strong> · {g.text}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
