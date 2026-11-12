import { DOC_LABELS, cnType, requiredDocs } from '../domain/rules';
import type { DocType, Rtv } from '../domain/types';

export default function DocRefTable({ rtv }: { rtv: Rtv }) {
  const req = requiredDocs(cnType(rtv.channel, rtv.saleType));
  const types: DocType[] = [...req.before, ...req.atCn];
  for (const d of rtv.docs) if (!types.includes(d.type)) types.push(d.type);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>เอกสาร</th><th>เลขที่</th></tr></thead>
        <tbody>
          {types.map(t => {
            const values = rtv.docs.filter(d => d.type === t).map(d => d.value);
            return (
              <tr key={t}>
                <td>{DOC_LABELS[t]}</td>
                <td className="mono">{values.length ? values.join(', ') : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
