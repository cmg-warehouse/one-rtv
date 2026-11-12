import { useState } from 'react';
import type { Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';

const parse = (v: string) => (v.trim() === '' ? NaN : Number(v));

/** Step 9: TK number and a piece count per box; rows that differ from the expected count are highlighted. */
export default function WarehouseCountForm({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const [tk, setTk] = useState('');
  const [counts, setCounts] = useState<string[]>(() => rtv.boxes.map(() => ''));
  const { run, error, busy } = useAct(rtv, onDone);
  return (
    <div className="card">
      <h2>ตรวจนับสินค้า</h2>
      <div className="form-grid">
        <label className="field">เลข TK
          <input value={tk} onChange={e => setTk(e.target.value)} />
        </label>
        {rtv.boxes.map((b, i) => {
          const differs = counts[i] !== '' && parse(counts[i]) !== b.expectedPcs;
          return (
            <div key={b.no} className={`box-row${differs ? ' count-diff' : ''}`} data-testid="count-row">
              <label className="field">{b.no}: จำนวนชิ้นที่นับได้
                <input type="number" min={0} value={counts[i]}
                  onChange={e => setCounts(c => c.map((x, j) => (j === i ? e.target.value : x)))} />
              </label>
              <span className="muted">แจ้งไว้ {b.expectedPcs} ชิ้น</span>
            </div>
          );
        })}
      </div>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void run({ type: 'advance', payload: { step: 9, tk, counts: counts.map(parse) } }); }}>ยืนยันผลตรวจนับ</button>
    </div>
  );
}
