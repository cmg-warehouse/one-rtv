import { useEffect, useState } from 'react';
import CarrierApp, { isPickup } from './mobile/CarrierApp';
import WarehouseApp from './mobile/WarehouseApp';
import { viaScdc } from '../domain/geo';
import { nextStep } from '../domain/rules';
import type { Rtv } from '../domain/types';
import { useRtvList } from '../state/useRtvs';
import { tr } from '../i18n';

/** Both phone apps side by side: a pickup scanned on the left shows up as inbound on the right when it skips SCDC. */
export default function MobileDemo() {
  const { rtvs } = useRtvList();
  // One RTV is the first example on both phones, the perfect case: the job is accepted and the truck only has to
  // go and collect it, nothing is short, and it goes straight to CMG, so once collected on the left it can be
  // scanned in on the right. Chosen once, so it stays put while it moves through the steps.
  const [demoId, setDemoId] = useState<string>();
  useEffect(() => {
    if (demoId) return;
    const direct = (r: Rtv) => isPickup(r) && !viaScdc(r);
    const perfect = (r: Rtv) => direct(r) && nextStep(r)?.step === 5 && !r.shortBoxes;
    setDemoId((rtvs.find(r => perfect(r) && r.carrier === 'PLAZA_4W') ?? rtvs.find(perfect) ?? rtvs.find(direct))?.id);
  }, [rtvs, demoId]);
  return (
    <div className="mobile-demo">
      <div className="page-head">
        <div>
          <h1>{tr('ตัวอย่างแอปมือถือ', 'Mobile app preview')}</h1>
          <p className="muted">
            {tr('ขนส่งทุกราย รวมถึงรถนอกเครือที่ไม่มีบัญชี เริ่มงานจากสแกน QR บนใบแจ้งเก็บ แล้วข้อมูลออเดอร์จะขึ้นเอง', 'Works for every carrier, including outside carriers with no account. Start by scanning the QR on the pickup slip and the order details fill in.')}
            {' '}{tr('แตะช่องกล้องเพื่อจำลองการสแกน (ระบบจริงใช้กล้องมือถือ) ทุกการสแกนบันทึกสถานะจริงในข้อมูลจำลอง ดูผลได้ทันทีที่ Track & Trace', 'Tap the camera to simulate a scan (the real app uses the phone camera). Every scan records a real status in the demo data, visible right away in Track & Trace')}
            {' '}{tr('และแผนที่ — ตัวอย่างแรกของทั้งสองเครื่องเป็น RTV เดียวกัน เก็บทางซ้ายแล้วสแกนรับเข้าคลังทางขวาได้ทันที', 'and the map. Both phones start on the same RTV: collect it on the left, then scan it into the warehouse on the right.')}
          </p>
        </div>
      </div>
      <div className="phones">
        <CarrierApp firstId={demoId} />
        <WarehouseApp firstId={demoId} />
      </div>
    </div>
  );
}
