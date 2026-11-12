import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRtv } from '../api';
import { BRANDS, DEMO_BRAND_ID, STORES } from '../data/masters';
import { CHANNEL_LABELS, DOC_LABELS } from '../domain/rules';
import type { DocRef, DocType, SaleType } from '../domain/types';
import { useSession } from '../state/session';

const PCS_ERROR = 'กรอกจำนวนชิ้นของทุกกล่อง (ตัวเลขมากกว่า 0)';

export default function NewRtv() {
  const { role, actor } = useSession();
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState('');
  const [saleType, setSaleType] = useState<SaleType>('NORMAL');
  const [pcs, setPcs] = useState<string[]>(['']);
  const [docs, setDocs] = useState<Partial<Record<DocType, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (role !== 'BRAND') return <div className="card empty">เฉพาะ Brand / ฝ่ายขาย</div>;

  const store = STORES.find(s => s.id === storeId);
  const brand = BRANDS.find(b => b.id === DEMO_BRAND_ID);
  const showNote = store?.channel === 'CONSIGN' || store?.channel === 'LOCAL_MALL';
  const docTypes: DocType[] = showNote ? ['MIM', 'SD10', 'RTV_NOTE'] : ['MIM', 'SD10'];
  const setDoc = (t: DocType, v: string) => setDocs(d => ({ ...d, [t]: v }));

  const submit = async () => {
    if (!store) { setError('กรุณาเลือกสาขา'); return; }
    const boxPcs = pcs.map(Number);
    if (pcs.some(p => p.trim() === '') || boxPcs.some(n => !Number.isInteger(n) || n < 1)) {
      setError(PCS_ERROR);
      return;
    }
    const refs: DocRef[] = docTypes
      .map(t => ({ type: t, value: (docs[t] ?? '').trim() }))
      .filter(d => d.value);
    setBusy(true);
    setError(null);
    try {
      const rtv = await createRtv(
        { brandId: DEMO_BRAND_ID, storeId: store.id, channel: store.channel, saleType, boxPcs, docs: refs },
        { role, actor },
      );
      navigate(`/rtv/${rtv.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>เปิดคำสั่งแจ้งเก็บ</h1>
      <div className="card">
        <div className="form-grid">
          <label className="field">แบรนด์
            <input value={brand?.name ?? ''} readOnly />
          </label>
          <label className="field">สาขา
            <select value={storeId} onChange={e => setStoreId(e.target.value)}>
              <option value="">เลือกสาขา</option>
              {STORES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">ช่องทาง
            <input value={store ? CHANNEL_LABELS[store.channel] : ''} readOnly />
          </label>
          <fieldset className="field">
            <legend>ประเภทการขาย</legend>
            <label className="radio-row"><input type="radio" name="saleType" checked={saleType === 'NORMAL'} onChange={() => setSaleType('NORMAL')} />Normal</label>
            <label className="radio-row"><input type="radio" name="saleType" checked={saleType === 'PROMO'} onChange={() => setSaleType('PROMO')} />Promotion</label>
          </fieldset>
        </div>
      </div>
      <div className="card">
        <h2>กล่อง</h2>
        <div className="form-grid">
          {pcs.map((v, i) => (
            <div key={i} className="box-row">
              <label className="field">กล่อง {i + 1}: จำนวนชิ้นตามเอกสาร
                <input type="number" min={1} value={v}
                  onChange={e => setPcs(p => p.map((x, j) => (j === i ? e.target.value : x)))} />
              </label>
              {pcs.length > 1 && (
                <button type="button" className="btn" aria-label={`ลบกล่อง ${i + 1}`}
                  onClick={() => setPcs(p => p.filter((_, j) => j !== i))}>ลบ</button>
              )}
            </div>
          ))}
        </div>
        <button type="button" className="btn" onClick={() => setPcs(p => [...p, ''])}>+ เพิ่มกล่อง</button>
      </div>
      <div className="card">
        <h2>เลขเอกสาร (ถ้ามี)</h2>
        <div className="form-grid">
          {docTypes.map(t => (
            <label key={t} className="field">{DOC_LABELS[t]}
              <input value={docs[t] ?? ''} onChange={e => setDoc(t, e.target.value)} />
            </label>
          ))}
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void submit(); }}>เปิดคำสั่งและออกเลข RTV</button>
    </div>
  );
}
