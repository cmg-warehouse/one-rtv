import type { Rtv } from '../../domain/types';
import BoxCountForm from './BoxCountForm';
import { tr } from '../../i18n';

export default function WarehouseReceiveForm({ rtv, onDone }: { rtv: Rtv; onDone: () => void }) {
  return <BoxCountForm rtv={rtv} step={8} title={tr('คลัง CMG รับสินค้า', 'CMG warehouse receives goods')} label={tr('จำนวนกล่องที่รับ', 'Boxes received')} submitLabel={tr('รับสินค้าเข้า CMG', 'Receive goods at CMG')} onDone={onDone} />;
}
