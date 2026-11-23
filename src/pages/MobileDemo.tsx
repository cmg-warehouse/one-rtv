import CarrierApp from './mobile/CarrierApp';
import WarehouseApp from './mobile/WarehouseApp';
import { tr } from '../i18n';

/** Both phone apps side by side: a pickup scanned on the left shows up as inbound on the right when it skips SCDC. */
export default function MobileDemo() {
  return (
    <div className="mobile-demo">
      <div className="page-head">
        <div>
          <h1>{tr('ตัวอย่างแอปมือถือ', 'Mobile app preview')}</h1>
          <p className="muted">
            {tr('ขนส่งทุกราย รวมถึงรถนอกเครือที่ไม่มีบัญชี เริ่มงานจากสแกน QR บนใบแจ้งเก็บ แล้วข้อมูลออเดอร์จะขึ้นเอง', 'Works for every carrier, including outside carriers with no account. Start by scanning the QR on the pickup slip and the order details fill in.')}
            {' '}{tr('แตะช่องกล้องเพื่อจำลองการสแกน (ระบบจริงใช้กล้องมือถือ) ทุกการสแกนบันทึกสถานะจริงในข้อมูลจำลอง ดูผลได้ทันทีที่ Track & Trace', 'Tap the camera to simulate a scan (the real app uses the phone camera). Every scan records a real status in the demo data, visible right away in Track & Trace')}
            {' '}{tr('และแผนที่ — งานสาย 4W Plaza ที่เก็บแล้วจะเข้าคิวรับของคลังทางขวาทันที', 'and the map. A collected 4W Plaza route job joins the warehouse receiving queue on the right at once.')}
          </p>
        </div>
      </div>
      <div className="phones">
        <CarrierApp />
        <WarehouseApp />
      </div>
    </div>
  );
}
