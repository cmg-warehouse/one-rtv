import type { Box } from '../domain/types';
import { tr } from '../i18n';

/** `showMim`: Shop / Temp shop orders, where every box carries its own MIM. */
export default function BoxList({ boxes, showMim = false }: { boxes: Box[]; showMim?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{tr('เลขกล่อง', 'Box no.')}</th>{showMim && <th>MIM</th>}
            <th className="num">{tr('จำนวนที่แจ้ง (ชิ้น)', 'Declared (pcs)')}</th><th className="num">{tr('จำนวนที่นับ (ชิ้น)', 'Counted (pcs)')}</th>
          </tr>
        </thead>
        <tbody>
          {boxes.map(b => (
            <tr key={b.no}>
              <td className="mono">{b.no}</td>
              {showMim && <td className={b.mim ? 'mono' : 'warn'}>{b.mim ?? tr('ยังไม่มี', 'None yet')}</td>}
              <td className="num">{b.expectedPcs || <span className="muted">{tr('ไม่ระบุ', 'Not given')}</span>}</td>
              <td className={`num${b.countedPcs !== undefined && b.expectedPcs > 0 && b.countedPcs !== b.expectedPcs ? ' count-diff' : ''}`}>
                {b.countedPcs ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
