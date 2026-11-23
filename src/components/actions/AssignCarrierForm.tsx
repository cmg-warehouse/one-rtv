import { useState } from 'react';
import { allowedCarriers, CARRIER_LABELS } from '../../domain/rules';
import type { Carrier, Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';
import { tr } from '../../i18n';

export default function AssignCarrierForm({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const options = allowedCarriers(rtv.channel);
  const [carrier, setCarrier] = useState<Carrier | ''>(options.length === 1 ? options[0] : '');
  const [pickupDate, setPickupDate] = useState('');
  const [carrierRef, setCarrierRef] = useState('');
  const { run, error, busy } = useAct(rtv, onDone);

  // An unselected carrier is sent as-is: the machine rejects it with its own message.
  const submit = () => {
    void run({
      type: 'advance',
      payload: { step: 2, carrier: carrier as Carrier, pickupDate, carrierRef: carrier === 'PARCEL' ? carrierRef : undefined },
    });
  };

  return (
    <div className="card">
      <h2>{tr('จัดขนส่ง', 'Assign carrier')}</h2>
      <div className="form-grid">
        <fieldset className="field">
          <legend>{tr('ขนส่ง', 'Carrier')}</legend>
          {options.map(c => (
            <label key={c} className="radio-row">
              <input type="radio" name="carrier" checked={carrier === c} onChange={() => setCarrier(c)} />
              {CARRIER_LABELS[c]}
            </label>
          ))}
        </fieldset>
        <label className="field">{tr('วันนัดเก็บ', 'Pickup date')}
          <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} />
        </label>
        {carrier === 'PARCEL' && (
          <label className="field">{tr('เลขพัสดุ', 'Tracking no.')}
            <input value={carrierRef} onChange={e => setCarrierRef(e.target.value)} />
          </label>
        )}
      </div>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy} onClick={submit}>{tr('ยืนยันจัดขนส่ง', 'Confirm carrier')}</button>
    </div>
  );
}
