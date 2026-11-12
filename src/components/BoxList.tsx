import type { Box } from '../domain/types';

export default function BoxList({ boxes }: { boxes: Box[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>เลขกล่อง</th><th className="num">จำนวนที่แจ้ง (ชิ้น)</th><th className="num">จำนวนที่นับ (ชิ้น)</th></tr></thead>
        <tbody>
          {boxes.map(b => (
            <tr key={b.no}>
              <td className="mono">{b.no}</td>
              <td className="num">{b.expectedPcs}</td>
              <td className={`num${b.countedPcs !== undefined && b.countedPcs !== b.expectedPcs ? ' count-diff' : ''}`}>
                {b.countedPcs ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
