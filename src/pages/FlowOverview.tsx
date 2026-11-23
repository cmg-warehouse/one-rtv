import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FLOW_COPY } from '../data/flowCopy';
import { CN_LABELS, DOC_LABELS, cnType, requiredDocs } from '../domain/rules';
import type { Channel, Role, Step } from '../domain/types';
import { tr } from '../i18n';
import { ROLE_LABELS } from '../state/session';
import { FlowLinks, ScenarioSelect, stepCopy, stepLabel, useScenario, type Scenario } from './flowScenarios';
import { TryStep } from './flowDemo';

const ROWS: Role[] = ['BRAND', 'PROMO', 'CS', 'CARRIER', 'SCDC', 'WH', 'ADMIN_CN', 'VIEWER'];
const COLS: Step[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Documents created at a step; for step 10 the union over Normal and Promotion for the channel. */
export function stepDocs(step: Step, channel: Channel, sc?: Scenario): string[] {
  if (step !== 10) return (sc ? stepCopy(sc, step) : FLOW_COPY[step]).docs.map(d => DOC_LABELS[d]);
  const all = [...requiredDocs(cnType(channel, 'NORMAL')).atCn, ...requiredDocs(cnType(channel, 'PROMO')).atCn];
  return [...new Set(all)].map(d => DOC_LABELS[d]);
}

export default function FlowOverview() {
  const { scenario, steps, setKey } = useScenario();
  const [params] = useSearchParams();
  // ?step= reopens the step the presenter came back from (see FlowReturnBar)
  const [selected, setSelected] = useState<Step | null>(() => {
    const n = Number(params.get('step'));
    return COLS.includes(n as Step) ? (n as Step) : null;
  });
  const viaScdc = steps.find(s => s.step === 6)?.mode !== 'SKIPPED';
  const def = selected ? steps.find(s => s.step === selected) : undefined;
  const docs = def ? stepDocs(def.step, scenario.channel, scenario) : [];
  const copy = def ? stepCopy(scenario, def.step) : null;
  // The coordinator lane only matters for promotion pickups.
  const rows = ROWS.filter(r => r !== 'PROMO' || scenario.promo);

  return (
    <div className="flow-page">
      <h1>{tr('Flow ภาพรวม — ใครทำอะไร', 'Flow overview: who does what')}</h1>
      <FlowLinks scenarioKey={scenario.key} other="detail" />
      <ScenarioSelect value={scenario.key} onChange={setKey} />

      <div className="flow-grid-wrap">
        <div className="flow-grid">
          <div className="flow-row flow-head">
            <div className="flow-rowhead" />
            {COLS.map(n => <div key={n} className="flow-colhead">{n}</div>)}
          </div>
          {rows.map(role => (
            <div key={role} className={`flow-row lane-${role}`}>
              <div className="flow-rowhead">{ROLE_LABELS[role]}</div>
              {role === 'VIEWER'
                ? <div className="flow-viewer-note muted">{tr('ดูได้ทุกขั้น (อ่านอย่างเดียว)', 'Can view every step (read-only)')}</div>
                : COLS.map(n => {
                  const s = steps.find(x => x.step === n)!;
                  if (s.role !== role) return <div key={n} className="flow-empty" />;
                  return (
                    <div key={n} className="flow-slot">
                      <button
                        type="button"
                        data-testid="flow-cell"
                        className={`flow-cell${s.mode === 'SKIPPED' ? ' is-skipped' : ''}${selected === n ? ' is-selected' : ''}`}
                        onClick={() => setSelected(n)}
                      >
                        <span className="flow-cell-no">{n}</span>
                        <span className="flow-cell-label">{stepLabel(scenario, n)}</span>
                        {s.mode === 'AUTO' && <span className="flow-tag">{tr('อัตโนมัติ', 'Automatic')}</span>}
                      </button>
                      <TryStep def={s} scenario={scenario} variant="link" />
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <p className="flow-route">
        {scenario.promo
          ? (viaScdc ? tr('หน้างานโปร → SCDC คลองส่งน้ำ → CMG กม.20', 'Promo site → SCDC Khlong Song Nam → CMG Km.20') : tr('หน้างานโปร → CMG กม.20', 'Promo site → CMG Km.20'))
          : viaScdc ? tr('สาขา → SCDC → CMG', 'Store → SCDC → CMG') : tr('สาขา → CMG', 'Store → CMG')}
      </p>
      {scenario.promo && (
        <p className="muted">
          {tr('ขั้น 1–5 ทำครั้งเดียวต่องาน (ทุกแบรนด์พร้อมกัน) ที่หน้า', 'Steps 1–5 are done once per job (all brands together) on the')} <Link to="/promo">{tr('งานเก็บโปร', 'Promo pickup')}</Link>{tr(' ·', ' page ·')}
          {' '}{tr('ตั้งแต่ขั้น 6 RTV ของแต่ละแบรนด์เดินแยกตามปกติ · ไม่มีจำนวนชิ้นตามเอกสาร Brand จึงยืนยันยอดที่คลังนับได้ และเติม MIM / ยืนยัน Promotion ก่อนออก CN', 'From step 6 each brand’s RTV follows the normal flow · There is no document piece count, so Brand confirms the quantity the warehouse counted and fills in MIM / confirms the Promotion before the CN is issued')}
        </p>
      )}
      <p className="flow-cn">
        {tr('แบบ CN', 'CN type')}: Normal → {CN_LABELS[cnType(scenario.channel, 'NORMAL')]} · Promotion → {CN_LABELS[cnType(scenario.channel, 'PROMO')]}
      </p>
      <p className="flow-next muted">{tr('ระยะถัดไป: Put away · Product select · ส่งกลับสาขา', 'Next phase: Put away · Product select · Return to store')}</p>

      {def && (
        <section className="card flow-side" aria-label={tr('รายละเอียดขั้นตอน', 'Step details')}>
          <h3>{def.step}. {stepLabel(scenario, def.step)}</h3>
          <p><strong>{tr('ผู้ทำ', 'Done by')}:</strong> {ROLE_LABELS[def.role]}</p>
          <p>{copy!.what}</p>
          <p><strong>{tr('บันทึก', 'Records')}:</strong> {copy!.records.join(', ')}</p>
          {docs.length > 0 && <p><strong>{tr('เอกสารที่เกิด', 'Documents created')}:</strong> {docs.join(', ')}</p>}
          {def.mode === 'SKIPPED' && <p className="muted">{tr('ขั้นนี้ถูกข้ามสำหรับประเภทนี้', 'This step is skipped for this type')}</p>}
          {def.mode === 'AUTO' && <p className="muted">{tr('ระบบทำให้อัตโนมัติ', 'Done automatically by the system')}</p>}
          <TryStep def={def} scenario={scenario} variant="button" />
        </section>
      )}
    </div>
  );
}
