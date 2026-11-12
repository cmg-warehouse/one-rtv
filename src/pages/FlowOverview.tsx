import { useState } from 'react';
import { FLOW_COPY } from '../data/flowCopy';
import { CN_LABELS, DOC_LABELS, STEP_LABELS, cnType, requiredDocs } from '../domain/rules';
import type { Channel, Role, Step } from '../domain/types';
import { ROLE_LABELS } from '../state/session';
import { FlowLinks, ScenarioSelect, useScenario } from './flowScenarios';

const ROWS: Role[] = ['BRAND', 'CS', 'CARRIER', 'SCDC', 'WH', 'ADMIN_CN', 'VIEWER'];
const COLS: Step[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Documents created at a step; for step 10 the union over Normal and Promotion for the channel. */
export function stepDocs(step: Step, channel: Channel): string[] {
  if (step !== 10) return FLOW_COPY[step].docs.map(d => DOC_LABELS[d]);
  const all = [...requiredDocs(cnType(channel, 'NORMAL')).atCn, ...requiredDocs(cnType(channel, 'PROMO')).atCn];
  return [...new Set(all)].map(d => DOC_LABELS[d]);
}

export default function FlowOverview() {
  const { scenario, steps, setKey } = useScenario();
  const [selected, setSelected] = useState<Step | null>(null);
  const viaScdc = steps.find(s => s.step === 6)?.mode !== 'SKIPPED';
  const def = selected ? steps.find(s => s.step === selected) : undefined;
  const docs = def ? stepDocs(def.step, scenario.channel) : [];

  return (
    <div className="flow-page">
      <h1>Flow ภาพรวม — ใครทำอะไร</h1>
      <FlowLinks scenarioKey={scenario.key} other="detail" />
      <ScenarioSelect value={scenario.key} onChange={setKey} />

      <div className="flow-grid-wrap">
        <div className="flow-grid">
          <div className="flow-row flow-head">
            <div className="flow-rowhead" />
            {COLS.map(n => <div key={n} className="flow-colhead">{n}</div>)}
          </div>
          {ROWS.map(role => (
            <div key={role} className={`flow-row lane-${role}`}>
              <div className="flow-rowhead">{ROLE_LABELS[role]}</div>
              {role === 'VIEWER'
                ? <div className="flow-viewer-note muted">ดูได้ทุกขั้น (อ่านอย่างเดียว)</div>
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
                        <span className="flow-cell-label">{STEP_LABELS[n]}</span>
                        {s.mode === 'AUTO' && <span className="flow-tag">อัตโนมัติ</span>}
                      </button>
                    </div>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <p className="flow-route">{viaScdc ? 'สาขา → SCDC → CMG' : 'สาขา → CMG'}</p>
      <p className="flow-cn">
        แบบ CN: Normal → {CN_LABELS[cnType(scenario.channel, 'NORMAL')]} · Promotion → {CN_LABELS[cnType(scenario.channel, 'PROMO')]}
      </p>
      <p className="flow-next muted">ระยะถัดไป: Put away · Product select · ส่งกลับสาขา</p>

      {def && (
        <section className="card flow-side" aria-label="รายละเอียดขั้นตอน">
          <h3>{def.step}. {STEP_LABELS[def.step]}</h3>
          <p><strong>ผู้ทำ:</strong> {ROLE_LABELS[def.role]}</p>
          <p>{FLOW_COPY[def.step].what}</p>
          <p><strong>บันทึก:</strong> {FLOW_COPY[def.step].records.join(', ')}</p>
          {docs.length > 0 && <p><strong>เอกสารที่เกิด:</strong> {docs.join(', ')}</p>}
          {def.mode === 'SKIPPED' && <p className="muted">ขั้นนี้ถูกข้ามสำหรับประเภทนี้</p>}
          {def.mode === 'AUTO' && <p className="muted">ระบบทำให้อัตโนมัติ</p>}
        </section>
      )}
    </div>
  );
}
