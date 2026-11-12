import type { Rtv } from '../../domain/types';
import { ErrorLine, useAct } from './useAct';

export default function IssueSlipAction({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  const { run, error, busy } = useAct(rtv, onDone);
  return (
    <div className="card">
      <h2>ออกใบแจ้งเก็บ</h2>
      <p className="muted">ระบบจะออกเลขใบแจ้งเก็บให้อัตโนมัติ แล้วพิมพ์ใบแจ้งเก็บส่งให้ขนส่งได้</p>
      <ErrorLine message={error} />
      <button type="button" className="btn btn-primary" data-tour="primary" disabled={busy}
        onClick={() => { void run({ type: 'advance', payload: { step: 3 } }); }}>ออกใบแจ้งเก็บ</button>
    </div>
  );
}
