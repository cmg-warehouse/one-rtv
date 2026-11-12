import { Link, useSearchParams } from 'react-router-dom';
import { CARRIER_LABELS, CHANNEL_LABELS, stepsFor, type StepDef } from '../domain/rules';
import type { Carrier, Channel } from '../domain/types';

export interface Scenario { key: string; label: string; channel: Channel; carrier: Carrier }

const make = (channel: Channel, carrier: Carrier, label: string): Scenario => ({ key: `${channel}:${carrier}`, label, channel, carrier });

export const SCENARIOS: Scenario[] = [
  make('CONSIGN', 'CG_NETWORK', `${CHANNEL_LABELS.CONSIGN} · ${CARRIER_LABELS.CG_NETWORK}`),
  make('SHOP', 'CG_NETWORK', `${CHANNEL_LABELS.SHOP} · ${CARRIER_LABELS.CG_NETWORK}`),
  make('SHOP', 'PLAZA_4W', 'Shop · 4W Plaza'),
  make('SHOP', 'PARCEL', `${CHANNEL_LABELS.SHOP} · ${CARRIER_LABELS.PARCEL}`),
  make('LOCAL_MALL', 'AGREED', `${CHANNEL_LABELS.LOCAL_MALL} · ${CARRIER_LABELS.AGREED}`),
];

const DEFAULT = SCENARIOS[1];

export function useScenario(): { scenario: Scenario; steps: StepDef[]; setKey: (key: string) => void } {
  const [params, setParams] = useSearchParams();
  const scenario = SCENARIOS.find(s => s.key === params.get('s')) ?? DEFAULT;
  return {
    scenario,
    steps: stepsFor(scenario.channel, scenario.carrier),
    setKey: key => setParams({ s: key }, { replace: true }),
  };
}

export function ScenarioSelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <label className="field flow-select">
      <span>ประเภทการคืน</span>
      <select aria-label="ประเภทการคืน" value={value} onChange={e => onChange(e.target.value)}>
        {SCENARIOS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
      </select>
    </label>
  );
}

export function FlowLinks({ scenarioKey, other }: { scenarioKey: string; other: 'overview' | 'detail' }) {
  const q = `?s=${encodeURIComponent(scenarioKey)}`;
  return (
    <p className="flow-links">
      {other === 'detail'
        ? <Link to={`/flow/detail${q}`}>Flow ละเอียด →</Link>
        : <Link to={`/flow${q}`}>← Flow ภาพรวม</Link>}
      <Link to="/tour">ดู Demo นำชม</Link>
    </p>
  );
}
