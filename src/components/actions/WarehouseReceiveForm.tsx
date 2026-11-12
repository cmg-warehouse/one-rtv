import type { Rtv } from '../../domain/types';
import BoxCountForm from './BoxCountForm';

export default function WarehouseReceiveForm({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  return <BoxCountForm rtv={rtv} step={8} title="คลัง CMG รับสินค้า" label="จำนวนกล่องที่รับ" submitLabel="รับสินค้าเข้า CMG" onDone={onDone} />;
}
