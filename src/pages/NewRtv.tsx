import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createRtv } from '../api';
import { BRANDS, DEMO_BRAND_ID, STORES } from '../data/masters';
import { BRAND_DOC_TYPES, CHANNEL_LABELS, DOC_LABELS, isMallGroup } from '../domain/rules';
import type { DocRef, DocType, SaleType } from '../domain/types';
import { useSession } from '../state/session';
import { tr } from '../i18n';

const pcsError = () => tr('กรอกจำนวนชิ้นของทุกกล่อง (ตัวเลขมากกว่า 0)', 'Enter the piece count for every box (a number above 0)');

export default function NewRtv() {
  const { role, actor } = useSession();
  const navigate = useNavigate();
  const [storeId, setStoreId] = useState('');
  const [saleType, setSaleType] = useState<SaleType>('NORMAL');
  const [pcs, setPcs] = useState<string[]>(['']);
  const [mims, setMims] = useState<string[]>(['']);
  const [docs, setDocs] = useState<Partial<Record<DocType, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (role !== 'BRAND') return <div className="card empty">{tr('เฉพาะ Brand / ฝ่ายขาย', 'Brand / Sales only')}</div>;

  const store = STORES.find(s => s.id === storeId);
  const brand = BRANDS.find(b => b.id === DEMO_BRAND_ID);
  const docTypes: DocType[] = store && isMallGroup(store.channel)
    ? BRAND_DOC_TYPES
    : BRAND_DOC_TYPES.filter(t => t !== 'RTV_NOTE');
  const setDoc = (t: DocType, v: string) => setDocs(d => ({ ...d, [t]: v }));
  // Shop / Temp shop: every box carries its own MIM. The mall group uses the RTV Note instead.
  const perBoxMim = !store || !isMallGroup(store.channel);
  const addBox = () => { setPcs(p => [...p, '']); setMims(m => [...m, '']); };
  const removeBox = (i: number) => { setPcs(p => p.filter((_, j) => j !== i)); setMims(m => m.filter((_, j) => j !== i)); };

  const submit = async () => {
    if (!store) { setError(tr('กรุณาเลือกสาขา', 'Please select a store')); return; }
    const boxPcs = pcs.map(Number);
    if (pcs.some(p => p.trim() === '') || boxPcs.some(n => !Number.isInteger(n) || n < 1)) {
      setError(pcsError());
      return;
    }
    const refs: DocRef[] = docTypes
      .map(t => ({ type: t, value: (docs[t] ?? '').trim() }))
      .filter(d => d.value);
    setBusy(true);
    setError(null);
    try {
      const rtv = await createRtv(
        { brandId: DEMO_BRAND_ID, storeId: store.id, channel: store.channel, saleType, boxPcs, docs: refs,
          boxMims: perBoxMim ? mims.map(m => m.trim()) : undefined },
        { role, actor },
      );
      navigate(`/rtv/${rtv.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('เกิดข้อผิดพลาด', 'Something went wrong'));
      setBusy(false);
    }
  };

  return (
    <div>
      <h1>{tr('เปิดคำสั่งแจ้งเก็บ', 'Open pickup order')}</h1>
      <div className="card">
        <div className="form-grid">
          <label className="field">{tr('แบรนด์', 'Brand')}
            <input value={brand?.name ?? ''} readOnly />
          </label>
          <label className="field">{tr('สาขา', 'Store')}
            <select value={storeId} onChange={e => setStoreId(e.target.value)}>
              <option value="">{tr('เลือกสาขา', 'Select a store')}</option>
              {STORES.filter(s => !s.venue).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="field">{tr('ช่องทาง', 'Channel')}
            <input value={store ? CHANNEL_LABELS[store.channel] : ''} readOnly />
          </label>
          <fieldset className="field">
            <legend>{tr('ประเภทการขาย', 'Sale type')}</legend>
            <label className="radio-row"><input type="radio" name="saleType" checked={saleType === 'NORMAL'} onChange={() => setSaleType('NORMAL')} />Normal</label>
            <label className="radio-row"><input type="radio" name="saleType" checked={saleType === 'PROMO'} onChange={() => setSaleType('PROMO')} />Promotion</label>
          </fieldset>
        </div>
      </div>
      <div className="card">
        <h2>{tr('กล่อง', 'Boxes')}</h2>
        <div className="form-grid">
          {pcs.map((v, i) => (
            <div key={i} className="box-row new-box-row">
              <span className="new-box-no">{tr(`กล่อง ${i + 1}`, `Box ${i + 1}`)}</span>
              {perBoxMim && (
                <label className="field">MIM
                  <input aria-label={tr(`กล่อง ${i + 1}: MIM`, `Box ${i + 1}: MIM`)} value={mims[i] ?? ''} placeholder={tr('เลข MIM ของกล่องนี้', 'MIM number for this box')}
                    onChange={e => setMims(m => m.map((x, j) => (j === i ? e.target.value : x)))} />
                </label>
              )}
              <label className="field">{tr('จำนวนชิ้นตามเอกสาร', 'Pieces per document')}
                <input type="number" min={1} value={v} aria-label={tr(`กล่อง ${i + 1}: จำนวนชิ้นตามเอกสาร`, `Box ${i + 1}: pieces per document`)}
                  onChange={e => setPcs(p => p.map((x, j) => (j === i ? e.target.value : x)))} />
              </label>
              {pcs.length > 1 && (
                <button type="button" className="btn" aria-label={tr(`ลบกล่อง ${i + 1}`, `Remove box ${i + 1}`)} onClick={() => removeBox(i)}>{tr('ลบ', 'Remove')}</button>
              )}
            </div>
          ))}
        </div>
        <div className="secondary-row">
          <button type="button" className="btn" onClick={addBox}>{tr('+ เพิ่มกล่อง', '+ Add box')}</button>
          {perBoxMim && pcs.length > 1 && (mims[0] ?? '').trim() && (
            <button type="button" className="btn" onClick={() => setMims(m => m.map(() => m[0]))}>{tr('ใช้ MIM กล่อง 1 กับทุกกล่อง', 'Use box 1 MIM for all boxes')}</button>
          )}
        </div>
        {perBoxMim && <p className="muted new-box-note">{tr('ปกติ 1 กล่อง = 1 MIM · ยังไม่มีเลขก็เปิดคำสั่งได้ แล้วค่อยเติมทีหลัง (ต้องครบทุกกล่องก่อนออก CN)', 'Usually 1 box = 1 MIM · you can open the order without numbers and add them later (every box needs one before the CN is issued)')}</p>}
      </div>
      <div className="card">
        <h2>{tr('เลขเอกสาร (ถ้ามี)', 'Document numbers (if any)')}</h2>
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
        onClick={() => { void submit(); }}>{tr('เปิดคำสั่งและออกเลข RTV', 'Open order and issue RTV number')}</button>
    </div>
  );
}
