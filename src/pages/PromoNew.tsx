import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPromo } from '../api';
import { BRAND_GROUPS, BRANDS, hubOf, VENUES } from '../data/masters';
import { HUBS } from '../domain/geo';
import { tr } from '../i18n';
import { suggestTrucks, TRUCK_TYPES } from '../domain/promo';
import type { Hub, TruckType } from '../domain/types';
import { useSession } from '../state/session';

/** `hub` '' = the brand's default destination. */
interface Row { brandId: string; boxes: string; pallets: string; hub: Hub | '' }
interface Extra { label: string; pallets: string }

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));
const sum = (xs: string[]) => xs.reduce((n, v) => n + (Number(v) || 0), 0);

/** Pickup date field: tomorrow 10:00, in the local datetime-local format. */
function tomorrowAt10(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  d.setHours(10, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`;
}

/** The promotion coordinator announces a pickup for many brands at once — this form replaces the e-mail table. */
export default function PromoNew() {
  const { role, actor } = useSession();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [storeId, setStoreId] = useState('');
  const [pickupAt, setPickupAt] = useState(tomorrowAt10);
  const [contact, setContact] = useState({ name: '', phone: '' });
  const [rows, setRows] = useState<Row[]>([{ brandId: '', boxes: '', pallets: '', hub: '' }]);
  const [extras, setExtras] = useState<Extra[]>([]);
  const [truck, setTruck] = useState<{ type: TruckType; count: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (role !== 'PROMO') return <div className="card empty">{tr('เฉพาะผู้ประสานงานโปร', 'Promo coordinator only')}</div>;

  const totalPallets = sum(rows.map(r => r.pallets)) + sum(extras.map(x => x.pallets));
  const totalBoxes = sum(rows.map(r => r.boxes));
  const suggested = suggestTrucks(totalPallets);
  // Follows the suggestion until the coordinator picks something else.
  const estimate = truck ?? { type: suggested.type, count: String(suggested.count) };
  const setRow = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setExtra = (i: number, patch: Partial<Extra>) => setExtras(xs => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const taken = new Set(rows.map(r => r.brandId));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const event = await createPromo({
        name, storeId, pickupAt: pickupAt ? new Date(pickupAt).toISOString() : '',
        contact,
        lines: rows.map(r => ({ brandId: r.brandId, boxes: num(r.boxes), pallets: num(r.pallets), hub: r.hub || undefined })),
        extras: extras.map(x => ({ label: x.label, pallets: num(x.pallets) })),
        estimate: { type: estimate.type, count: num(estimate.count) },
      }, { role, actor });
      navigate(`/promo/${event.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('เกิดข้อผิดพลาด', 'Something went wrong'));
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>{tr('แจ้งงานเก็บโปร', 'Announce promo pickup')}</h1>
      <div className="card">
        <h2>{tr('งาน', 'Job')}</h2>
        <div className="form-grid">
          <label className="field">{tr('ชื่องาน', 'Job name')}
            <input value={name} placeholder={tr('เช่น Event CMG @ แฟชั่นไอส์แลนด์', 'e.g. Event CMG @ Fashion Island')} onChange={e => setName(e.target.value)} />
          </label>
          <label className="field">{tr('สถานที่เก็บ', 'Pickup venue')}
            <select value={storeId} onChange={e => setStoreId(e.target.value)}>
              <option value="">{tr('เลือกสถานที่', 'Choose venue')}</option>
              {VENUES.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </label>
          <label className="field">{tr('วันและเวลาเก็บ', 'Pickup date and time')}
            <input type="datetime-local" value={pickupAt} onChange={e => setPickupAt(e.target.value)} />
          </label>
          <label className="field">{tr('ผู้ประสานงานหน้างาน', 'On-site coordinator')}
            <input value={contact.name} onChange={e => setContact(c => ({ ...c, name: e.target.value }))} />
          </label>
          <label className="field">{tr('เบอร์โทรหน้างาน', 'On-site phone')}
            <input type="tel" value={contact.phone} onChange={e => setContact(c => ({ ...c, phone: e.target.value }))} />
          </label>
        </div>
      </div>

      <div className="card">
        <h2>{tr('แบรนด์ที่ต้องเก็บ', 'Brands to collect')}</h2>
        <p className="muted">{tr('จำนวนเป็นยอดประมาณ วันเก็บขนส่งจะกรอกยอดจริง (ขาด / เกินได้) · ปลายทางตั้งค่าเริ่มต้นตามคลังที่ fulfill แบรนด์ เปลี่ยนได้', 'Quantities are estimates; the carrier enters the actual quantity on pickup day (short / over is fine) · the destination defaults to the warehouse that fulfils the brand and can be changed')}</p>
        <div className="table-wrap">
          <table className="promo-lines">
            <thead>
              <tr><th>{tr('แบรนด์', 'Brand')}</th><th className="num">{tr('กล่อง', 'Boxes')}</th><th className="num">{tr('พาเลท', 'Pallets')}</th><th>{tr('ปลายทาง', 'Destination')}</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>
                    <select aria-label={tr(`แถว ${i + 1}: แบรนด์`, `Row ${i + 1}: brand`)} value={r.brandId} onChange={e => setRow(i, { brandId: e.target.value, hub: '' })}>
                      <option value="">{tr('เลือกแบรนด์', 'Choose brand')}</option>
                      {BRAND_GROUPS.map(g => (
                        <optgroup key={g} label={g}>
                          {BRANDS.filter(b => b.group === g).map(b => (
                            <option key={b.id} value={b.id} disabled={taken.has(b.id) && b.id !== r.brandId}>{b.id} · {b.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </td>
                  <td className="num"><input type="number" min={1} aria-label={tr(`แถว ${i + 1}: กล่อง`, `Row ${i + 1}: boxes`)} value={r.boxes} onChange={e => setRow(i, { boxes: e.target.value })} /></td>
                  <td className="num"><input type="number" min={0} aria-label={tr(`แถว ${i + 1}: พาเลท`, `Row ${i + 1}: pallets`)} value={r.pallets} onChange={e => setRow(i, { pallets: e.target.value })} /></td>
                  <td>
                    {r.brandId ? (
                      <select aria-label={tr(`แถว ${i + 1}: ปลายทาง`, `Row ${i + 1}: destination`)} value={r.hub || hubOf(r.brandId)}
                        onChange={e => setRow(i, { hub: e.target.value === hubOf(r.brandId) ? '' : e.target.value as Hub })}>
                        {(['CMG', 'SCDC'] as Hub[]).map(h => (
                          <option key={h} value={h}>{HUBS[h].short}{h === hubOf(r.brandId) ? tr(' (ค่าเริ่มต้น)', ' (default)') : ''}</option>
                        ))}
                      </select>
                    ) : '—'}
                  </td>
                  <td>{rows.length > 1 && <button type="button" className="btn btn-sm" aria-label={tr(`ลบแถว ${i + 1}`, `Remove row ${i + 1}`)} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))}>{tr('ลบ', 'Remove')}</button>}</td>
                </tr>
              ))}
              {extras.map((x, i) => (
                <tr key={`x${i}`} className="promo-extra">
                  <td><input aria-label={tr(`ของอื่น ${i + 1}: รายการ`, `Other item ${i + 1}: name`)} value={x.label} placeholder={tr('เช่น ถุง', 'e.g. Bags')} onChange={e => setExtra(i, { label: e.target.value })} /></td>
                  <td className="num muted">{tr('ไม่ออก RTV', 'No RTV issued')}</td>
                  <td className="num"><input type="number" min={1} aria-label={tr(`ของอื่น ${i + 1}: พาเลท`, `Other item ${i + 1}: pallets`)} value={x.pallets} onChange={e => setExtra(i, { pallets: e.target.value })} /></td>
                  <td>—</td>
                  <td><button type="button" className="btn btn-sm" onClick={() => setExtras(xs => xs.filter((_, j) => j !== i))}>{tr('ลบ', 'Remove')}</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr><th>{tr(`รวม ${rows.filter(r => r.brandId).length} แบรนด์`, `Total ${rows.filter(r => r.brandId).length} brands`)}</th><th className="num">{totalBoxes}</th><th className="num">{totalPallets}</th><th colSpan={2} /></tr>
            </tfoot>
          </table>
        </div>
        <div className="secondary-row">
          <button type="button" className="btn" onClick={() => setRows(rs => [...rs, { brandId: '', boxes: '', pallets: '', hub: '' }])}>{tr('+ เพิ่มแบรนด์', '+ Add brand')}</button>
          <button type="button" className="btn" onClick={() => setExtras(xs => [...xs, { label: '', pallets: '' }])}>{tr('+ ของอื่น (ถุง ฯลฯ)', '+ Other items (bags etc.)')}</button>
        </div>
      </div>

      <div className="card">
        <h2>{tr('ประมาณรถ', 'Estimated trucks')}</h2>
        <div className="form-grid">
          <label className="field">{tr('ประเภทรถ', 'Truck type')}
            <select value={estimate.type} onChange={e => setTruck({ ...estimate, type: e.target.value as TruckType })}>
              {TRUCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="field">{tr('จำนวน (คัน)', 'Number of trucks')}
            <input type="number" min={1} value={estimate.count} onChange={e => setTruck({ ...estimate, count: e.target.value })} />
          </label>
        </div>
        <p className="muted">
          {tr(`ระบบแนะนำ ${suggested.type} × ${suggested.count} สำหรับ ${totalPallets} พาเลท`, `Suggested ${suggested.type} × ${suggested.count} for ${totalPallets} pallets`)}
          {truck && <> · <button type="button" className="link-btn" onClick={() => setTruck(null)}>{tr('ใช้ค่าที่แนะนำ', 'Use suggestion')}</button></>}
        </p>
      </div>

      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void submit(); }}>{tr('แจ้งงานและออกเลข RTV ทุกแบรนด์', 'Announce and issue an RTV for every brand')}</button>
    </div>
  );
}
