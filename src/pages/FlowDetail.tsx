import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listRtvs } from '../api';
import { DEMO_BRAND_ID } from '../data/masters';
import { EXC_WAIT_PROMO, EXC_WAIT_RTV_NOTE, FLOW_COPY, FLOW_EXCEPTIONS } from '../data/flowCopy';
import { STEP_LABELS, holds, isMallGroup, nextStep } from '../domain/rules';
import type { Role, Rtv, Step } from '../domain/types';
import { ROLE_LABELS, asCarrierActor, useSession } from '../state/session';
import { stepDocs } from './FlowOverview';
import { FlowLinks, ScenarioSelect, useScenario } from './flowScenarios';

export default function FlowDetail() {
  const { scenario, steps, setKey } = useScenario();
  const { setRole, setCarrierActor } = useSession();
  const navigate = useNavigate();
  const [missing, setMissing] = useState<Step | null>(null);
  const consignGroup = isMallGroup(scenario.channel);

  const open = async (n: Step, role: Role) => {
    if (n === 1) { setRole('BRAND'); navigate('/new'); return; }
    const waiting = (await listRtvs()).filter(r => nextStep(r)?.step === n);
    const score = (r: Rtv) =>
      (role === 'BRAND' && r.brandId === DEMO_BRAND_ID ? 8 : 0)
      + (r.channel === scenario.channel ? 4 : 0) + (r.carrier === scenario.carrier ? 2 : 0)
      + (holds(r).length === 0 ? 1 : 0);
    const pick = waiting.sort((a, b) => score(b) - score(a))[0];
    if (!pick) { setMissing(n); return; }
    setMissing(null);
    setRole(role);
    const actor = role === 'CARRIER' ? asCarrierActor(pick.carrier) : null;
    if (actor) setCarrierActor(actor);
    navigate(`/rtv/${pick.id}`);
  };

  return (
    <div className="flow-page">
      <h1>Flow ละเอียด</h1>
      <FlowLinks scenarioKey={scenario.key} other="overview" />
      <ScenarioSelect value={scenario.key} onChange={setKey} />

      <div className="flow-steps">
        {steps.filter(s => s.mode !== 'SKIPPED').map(s => {
          const copy = FLOW_COPY[s.step];
          const docs = stepDocs(s.step, scenario.channel);
          const exceptions = [...FLOW_EXCEPTIONS[s.step]];
          if (s.step === 10) {
            if (consignGroup) exceptions.push(EXC_WAIT_RTV_NOTE);
            exceptions.push(EXC_WAIT_PROMO);
          }
          return (
            <section key={s.step} className="card flow-step" data-testid={`flow-step-${s.step}`}>
              <h2>{s.step}. {STEP_LABELS[s.step]}</h2>
              <p><strong>ผู้ทำ:</strong> {ROLE_LABELS[s.role]}{s.mode === 'AUTO' && <span className="flow-tag">ระบบทำให้อัตโนมัติ</span>}</p>
              <p>{copy.what}</p>
              <p><strong>บันทึก:</strong> {copy.records.join(', ')}</p>
              {docs.length > 0 && <p><strong>เอกสารที่เกิด:</strong> {docs.join(', ')}</p>}
              {exceptions.length > 0 && (
                <div>
                  <strong>กรณีไม่ปกติ:</strong>
                  <ul className="flow-exceptions">{exceptions.map(e => <li key={e}>{e}</li>)}</ul>
                </div>
              )}
              <button type="button" className="btn" onClick={() => { void open(s.step, s.role); }}>เปิดหน้าจอนี้ในแอป</button>
              {missing === s.step && <p className="muted" role="status">ยังไม่มีงานตัวอย่างที่รอขั้นนี้ — ลองกดรีเซ็ตข้อมูล</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
