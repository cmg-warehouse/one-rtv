import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listPromos, listRtvs } from '../api';
import { DEMO_BRAND_ID } from '../data/masters';
import { EXC_WAIT_PROMO, EXC_WAIT_RTV_NOTE, FLOW_EXCEPTIONS } from '../data/flowCopy';
import { holds, isMallGroup, nextStep } from '../domain/rules';
import type { Role, Rtv, Step } from '../domain/types';
import { tr } from '../i18n';
import { ROLE_LABELS, asCarrierActor, useSession } from '../state/session';
import { stepDocs } from './FlowOverview';
import { FlowLinks, ScenarioSelect, stepCopy, stepLabel, useScenario } from './flowScenarios';
import { promoTarget, rememberFlow } from './flowDemo';

export default function FlowDetail() {
  const { scenario, steps, setKey } = useScenario();
  const { setRole, setCarrierActor } = useSession();
  const navigate = useNavigate();
  const [missing, setMissing] = useState<Step | null>(null);
  const consignGroup = isMallGroup(scenario.channel);
  const [params] = useSearchParams();
  const backTo = params.get('step');
  // Coming back from the demo: bring the step the presenter left from into view.
  useEffect(() => {
    if (backTo) document.querySelector(`[data-testid="flow-step-${backTo}"]`)?.scrollIntoView?.({ block: 'center' });
  }, [backTo]);

  const open = async (n: Step, role: Role) => {
    if (scenario.promo && n <= 5) {
      const t = promoTarget(n, await listPromos());
      if (!t) return;
      setRole(t.role);
      if (t.role === 'CARRIER') setCarrierActor('AGREED');
      rememberFlow({ s: scenario.key, step: n, page: 'detail' });
      navigate(t.to);
      return;
    }
    if (n === 1) { setRole('BRAND'); rememberFlow({ s: scenario.key, step: n, page: 'detail' }); navigate('/new'); return; }
    const waiting = (await listRtvs()).filter(r => nextStep(r)?.step === n);
    const score = (r: Rtv) =>
      (role === 'BRAND' && r.brandId === DEMO_BRAND_ID ? 8 : 0)
      + (r.channel === scenario.channel ? 4 : 0) + (r.carrier === scenario.carrier ? 2 : 0)
      + (holds(r).length === 0 ? 1 : 0)
      + (!!r.promoId === !!scenario.promo ? 16 : 0);
    const pick = waiting.sort((a, b) => score(b) - score(a))[0];
    if (!pick) { setMissing(n); return; }
    setMissing(null);
    setRole(role);
    const actor = role === 'CARRIER' ? asCarrierActor(pick.carrier) : null;
    if (actor) setCarrierActor(actor);
    rememberFlow({ s: scenario.key, step: n, page: 'detail' });
    navigate(`/rtv/${pick.id}`);
  };

  return (
    <div className="flow-page">
      <h1>{tr('Flow ละเอียด', 'Detailed flow')}</h1>
      <FlowLinks scenarioKey={scenario.key} other="overview" />
      <ScenarioSelect value={scenario.key} onChange={setKey} />

      <div className="flow-steps">
        {steps.filter(s => s.mode !== 'SKIPPED').map(s => {
          const copy = stepCopy(scenario, s.step);
          const docs = stepDocs(s.step, scenario.channel, scenario);
          const exceptions = [...FLOW_EXCEPTIONS[s.step]];
          if (s.step === 10) {
            if (consignGroup) exceptions.push(EXC_WAIT_RTV_NOTE());
            exceptions.push(EXC_WAIT_PROMO());
          }
          return (
            <section key={s.step} className="card flow-step" data-testid={`flow-step-${s.step}`}>
              <h2>{s.step}. {stepLabel(scenario, s.step)}</h2>
              <p><strong>{tr('ผู้ทำ', 'Done by')}:</strong> {ROLE_LABELS[s.role]}{s.mode === 'AUTO' && <span className="flow-tag">{tr('ระบบทำให้อัตโนมัติ', 'Done automatically by the system')}</span>}</p>
              <p>{copy.what}</p>
              <p><strong>{tr('บันทึก', 'Records')}:</strong> {copy.records.join(', ')}</p>
              {docs.length > 0 && <p><strong>{tr('เอกสารที่เกิด', 'Documents created')}:</strong> {docs.join(', ')}</p>}
              {exceptions.length > 0 && (
                <div>
                  <strong>{tr('กรณีไม่ปกติ', 'Exceptions')}:</strong>
                  <ul className="flow-exceptions">{exceptions.map(e => <li key={e}>{e}</li>)}</ul>
                </div>
              )}
              <button type="button" className="btn" onClick={() => { void open(s.step, s.role); }}>{tr('เปิดหน้าจอนี้ในแอป', 'Open this screen in the app')}</button>
              {missing === s.step && <p className="muted" role="status">{tr('ยังไม่มีงานตัวอย่างที่รอขั้นนี้ — ลองกดรีเซ็ตข้อมูล', 'No sample job is waiting at this step. Try resetting the data.')}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
