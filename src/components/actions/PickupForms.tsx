import { useState } from 'react';
import type { Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';

/** Steps 4 and 5: the carrier accepts the job, then collects the goods. Used by CS for PARCEL and by the carrier. */
export default function PickupForms({ rtv, step, onDone }: { rtv: Rtv; step: 4 | 5; onDone: () => void }) {
  const [boxes, setBoxes] = useState(String(rtv.boxes.length));
  const { run, error, busy } = useAct(rtv, onDone);

  if (step === 4) {
    return (
      <div className="card">
        <h2>รับงานขนส่ง</h2>
        <ErrorLine message={error} />
        <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
          onClick={() => { void run({ type: 'advance', payload: { step: 4 } }); }}>บันทึกว่าขนส่งรับงานแล้ว</button>
      </div>
    );
  }
  return (
    <div className="card">
      <h2>เก็บสินค้า</h2>
      <label className="field">จำนวนกล่องที่เก็บได้ (จากทั้งหมด {rtv.boxes.length} กล่อง)
        <input type="number" min={1} value={boxes} onChange={e => setBoxes(e.target.value)} />
      </label>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void run({ type: 'advance', payload: { step: 5, boxes: Number(boxes) } }); }}>บันทึกว่าเก็บสินค้าแล้ว</button>
    </div>
  );
}
