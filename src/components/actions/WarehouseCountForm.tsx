import { useState } from 'react';
import type { Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';
import { tr } from '../../i18n';

const parse = (v: string) => (v.trim() === '' ? NaN : Number(v));

/** Step 9: TK number and a piece count per box; rows that differ from the expected count are highlighted. */
export default function WarehouseCountForm({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const [tk, setTk] = useState('');
  const [counts, setCounts] = useState<string[]>(() => rtv.boxes.map(() => ''));
  const { run, error, busy } = useAct(rtv, onDone);
  return (
    <div className="card">
      <h2>{tr('ตรวจนับสินค้า', 'Count goods')}</h2>
      <div className="form-grid">
        <label className="field">{tr('เลข TK', 'TK no.')}
          <input value={tk} onChange={e => setTk(e.target.value)} />
        </label>
        {rtv.boxes.map((b, i) => {
          const differs = counts[i] !== '' && parse(counts[i]) !== b.expectedPcs;
          return (
            <div key={b.no} className={`box-row${differs ? ' count-diff' : ''}`} data-testid="count-row">
              <label className="field">{b.no}: {tr('จำนวนชิ้นที่นับได้', 'pieces counted')}
                <input type="number" min={0} value={counts[i]}
                  onChange={e => setCounts(c => c.map((x, j) => (j === i ? e.target.value : x)))} />
              </label>
              <span className="muted">{tr(`แจ้งไว้ ${b.expectedPcs} ชิ้น`, `Declared ${b.expectedPcs} pcs`)}</span>
            </div>
          );
        })}
      </div>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void run({ type: 'advance', payload: { step: 9, tk, counts: counts.map(parse) } }); }}>{tr('ยืนยันผลตรวจนับ', 'Confirm count')}</button>
    </div>
  );
}
