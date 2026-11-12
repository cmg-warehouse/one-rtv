import { useState } from 'react';
import { allowedCarriers, CARRIER_LABELS } from '../../domain/rules';
import type { Carrier, Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';

export default function AssignCarrierForm({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const options = allowedCarriers(rtv.channel);
  const [carrier, setCarrier] = useState<Carrier | ''>(options.length === 1 ? options[0] : '');
  const [pickupDate, setPickupDate] = useState('');
  const [carrierRef, setCarrierRef] = useState('');
  const { run, error, busy, setError } = useAct(rtv, onDone);

  const submit = () => {
    if (!carrier) { setError('กรุณาเลือกขนส่ง'); return; }
    void run({
      type: 'advance',
      payload: { step: 2, carrier, pickupDate, carrierRef: carrier === 'PARCEL' ? carrierRef : undefined },
    });
  };

  return (
    <div className="card">
      <h2>จัดขนส่ง</h2>
      <div className="form-grid">
        <fieldset className="field">
          <legend>ขนส่ง</legend>
          {options.map(c => (
            <label key={c} className="radio-row">
              <input type="radio" name="carrier" checked={carrier === c} onChange={() => setCarrier(c)} />
              {CARRIER_LABELS[c]}
            </label>
          ))}
        </fieldset>
        <label className="field">วันนัดเก็บ
          <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
        </label>
        {carrier === 'PARCEL' && (
          <label className="field">เลขพัสดุ
            <input value={carrierRef} onChange={e => setCarrierRef(e.target.value)} />
          </label>
        )}
      </div>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy} onClick={submit}>ยืนยันจัดขนส่ง</button>
    </div>
  );
}
