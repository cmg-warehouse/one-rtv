import type { Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';
import { tr } from '../../i18n';

export default function IssueSlipAction({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const { run, error, busy } = useAct(rtv, onDone);
  return (
    <div className="card">
      <h2>{tr('ออกใบแจ้งเก็บ', 'Issue pickup slip')}</h2>
      <p className="muted">{tr('ระบบจะออกเลขใบแจ้งเก็บให้อัตโนมัติ แล้วพิมพ์ใบแจ้งเก็บส่งให้ขนส่งได้', 'The system issues the pickup slip number automatically, then you can print the slip for the carrier')}</p>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void run({ type: 'advance', payload: { step: 3 } }); }}>{tr('ออกใบแจ้งเก็บ', 'Issue pickup slip')}</button>
    </div>
  );
}
