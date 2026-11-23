import { DOC_LABELS, cnType, requiredDocs } from '../domain/rules';
import type { DocType, Rtv } from '../domain/types';
import { tr } from '../i18n';

export default function DocRefTable({ rtv }: { rtv: Rtv }) {
  const req = requiredDocs(cnType(rtv.channel, rtv.saleType));
  const types: DocType[] = [...req.before, ...req.atCn];
  for (const d of rtv.docs) if (!types.includes(d.type)) types.push(d.type);
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>{tr('เอกสาร', 'Document')}</th><th>{tr('เลขที่', 'No.')}</th></tr></thead>
        <tbody>
          {types.map(t => {
            if (t === 'MIM') {
              // MIM is per box: list the distinct numbers and say how many boxes have one.
              const mims = [...new Set(rtv.boxes.map(b => b.mim).filter((m): m is string => !!m))];
              const have = rtv.boxes.filter(b => b.mim).length;
              return (
                <tr key={t}>
                  <td>{tr('MIM (รายกล่อง)', 'MIM (per box)')}</td>
                  <td>
                    <span className="mono">{mims.length ? mims.join(', ') : '—'}</span>
                    {have < rtv.boxes.length && <span className="warn"> · {tr(`มีแล้ว ${have}/${rtv.boxes.length} กล่อง`, `${have}/${rtv.boxes.length} boxes have one`)}</span>}
                  </td>
                </tr>
              );
            }
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
