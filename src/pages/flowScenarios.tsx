import { Link, useSearchParams } from 'react-router-dom';
import { FLOW_COPY, type FlowCopy } from '../data/flowCopy';
import { HUBS } from '../domain/geo';
import { CARRIER_LABELS, CHANNEL_LABELS, STEP_LABELS, stepsFor, type StepDef } from '../domain/rules';
import type { Carrier, Channel, Hub, Step } from '../domain/types';
import { tr } from '../i18n';

/** `promo`: a promotion pickup (งานเก็บโปร) and where its brand goes. */
export interface Scenario { key: string; label: string; channel: Channel; carrier: Carrier; promo?: Hub }

/** `label` is a function so it follows the language when read. */
const make = (channel: Channel, carrier: Carrier, label: () => string): Scenario => ({
  key: `${channel}:${carrier}`, get label() { return label(); }, channel, carrier,
});

export const SCENARIOS: Scenario[] = [
  make('CONSIGN', 'CG_NETWORK', () => `${CHANNEL_LABELS.CONSIGN} · ${CARRIER_LABELS.CG_NETWORK}`),
  make('SHOP', 'CG_NETWORK', () => `${CHANNEL_LABELS.SHOP} · ${CARRIER_LABELS.CG_NETWORK}`),
  make('SHOP', 'PLAZA_4W', () => tr('Shop · งานสาย (Route) – 4W Plaza', 'Shop · Route – 4W Plaza')),
  make('SHOP', 'PARCEL', () => `${CHANNEL_LABELS.SHOP} · ${CARRIER_LABELS.PARCEL}`),
  make('LOCAL_MALL', 'AGREED', () => `${CHANNEL_LABELS.LOCAL_MALL} · ${CARRIER_LABELS.AGREED}`),
  ...(['SCDC', 'CMG'] as Hub[]).map((hub): Scenario => ({
    key: `PROMO:${hub}`,
    get label() { return `${tr('งานเก็บโปร', 'Promo pickup')} · ${CARRIER_LABELS.AGREED} → ${HUBS[hub].short}`; },
    channel: 'TEMP_SHOP', carrier: 'AGREED', promo: hub,
  })),
];

/**
 * Promotion pickups: steps 1-5 happen once for the whole event (all brands together) on the งานเก็บโปร page;
 * from step 6 each brand's RTV follows the normal flow.
 */
type T = readonly [th: string, en: string];
const promoCopy = (label: T, what: T, records: readonly T[], docs: FlowCopy['docs']): FlowCopy & { label: string } => ({
  get label() { return tr(label[0], label[1]); },
  get what() { return tr(what[0], what[1]); },
  get records() { return records.map(r => tr(r[0], r[1])); },
  docs,
});

const PROMO_COPY: Partial<Record<Step, FlowCopy & { label: string }>> = {
  1: promoCopy(['แจ้งงานเก็บโปร', 'Post a promo pickup'],
    ['ผู้ประสานงานโปรแจ้งงานในระบบแทนเมลแจ้งรายชื่อ: สถานที่ วันเวลา ผู้ติดต่อหน้างาน แบรนด์พร้อมจำนวนกล่อง/พาเลท และประมาณรถ ระบบออกเลข RTV ให้ทุกแบรนด์ทันที ปลายทางตั้งค่าเริ่มต้นตามคลังที่ fulfill แบรนด์ (เปลี่ยนได้)',
      'The promo coordinator posts the job in the system instead of emailing a list: venue, date and time, on-site contact, brands with boxes/pallets, and the estimated truck. The system issues an RTV number to every brand at once. The destination defaults to the warehouse that fulfils the brand (can be changed).'],
    [['ชื่องาน', 'Job name'], ['สถานที่', 'Venue'], ['วันเวลาเก็บ', 'Pickup date and time'], ['ผู้ติดต่อหน้างาน', 'On-site contact'],
      ['แบรนด์ / กล่อง / พาเลท', 'Brand / boxes / pallets'], ['ปลายทาง', 'Destination'], ['ประมาณรถ', 'Estimated truck']],
    []),
  2: promoCopy(['CS ส่งต่อขนส่ง', 'CS forwards to the carrier'],
    ['CS ตรวจงานแล้วส่งต่อให้ขนส่งเป็นงานจองรถ (เก็บตรง) พร้อมกันทุกแบรนด์ในงาน',
      'CS checks the job and forwards it to the carrier as a booked-truck job (direct pickup), for every brand in the job at once.'],
    [['ขนส่ง', 'Carrier'], ['วันนัดเก็บ', 'Pickup date']],
    []),
  3: promoCopy(['ออกใบแจ้งเก็บรวม', 'Issue the combined pickup slip'],
    ['ระบบออกใบแจ้งเก็บใบเดียวต่องาน พร้อม QR — คนขับสแกนแล้วเห็นทุกแบรนด์',
      'The system issues one pickup slip per job with a QR. The driver scans it and sees every brand.'],
    [['เลขใบแจ้งเก็บรวม', 'Combined pickup slip number']],
    ['PICKUP_SLIP']),
  4: promoCopy(['ขนส่งยืนยันรถ', 'Carrier confirms the truck'],
    ['ขนส่งกรอกประเภทรถ ทะเบียน คนขับ และเบอร์โทร ทุกแบรนด์ในงานเห็นการ์ด "ยืนยันรถเก็บโปร" แทนเมลยืนยันรถ',
      'The carrier enters the truck type, plate, driver and phone. Every brand in the job sees the "Promo pickup truck confirmed" card instead of a confirmation email.'],
    [['ประเภทรถ', 'Truck type'], ['ทะเบียน', 'Plate'], ['คนขับ', 'Driver'], ['เบอร์โทร', 'Phone']],
    []),
  5: promoCopy(['เก็บสินค้าที่หน้างาน', 'Collect the goods on site'],
    ['คนขับสแกน QR ใบแจ้งเก็บรวม แล้วกรอกยอดที่เก็บได้จริงต่อแบรนด์ (ขาด / เกินจากที่แจ้งได้) RTV แต่ละแบรนด์ปรับจำนวนกล่องตามยอดจริง แบรนด์ที่ไม่มีของ RTV ถูกยกเลิก',
      'The driver scans the QR on the combined pickup slip and enters the quantity actually collected per brand (short / over the declared amount is allowed). Each brand’s RTV is adjusted to the real box count. A brand with no goods has its RTV cancelled.'],
    [['กล่องที่เก็บได้', 'Boxes collected'], ['พาเลทที่เก็บได้', 'Pallets collected']],
    []),
};

export const stepLabel = (sc: Scenario, step: Step): string => (sc.promo && PROMO_COPY[step]?.label) || STEP_LABELS[step];
export const stepCopy = (sc: Scenario, step: Step): FlowCopy => (sc.promo && PROMO_COPY[step]) || FLOW_COPY[step];

export function scenarioSteps(sc: Scenario): StepDef[] {
  const steps = stepsFor(sc.channel, sc.carrier, sc.promo);
  if (!sc.promo) return steps;
  return steps.map(s => ({
    ...s,
    label: stepLabel(sc, s.step),
    role: s.step === 1 ? 'PROMO' : s.role,
    mode: s.step === 3 ? 'AUTO' : s.mode,
  }));
}

const DEFAULT = SCENARIOS[1];

export function useScenario(): { scenario: Scenario; steps: StepDef[]; setKey: (key: string) => void } {
  const [params, setParams] = useSearchParams();
  const scenario = SCENARIOS.find(s => s.key === params.get('s')) ?? DEFAULT;
  return {
    scenario,
    steps: scenarioSteps(scenario),
    setKey: key => setParams({ s: key }, { replace: true }),
  };
}

export function ScenarioSelect({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  return (
    <label className="field flow-select">
      <span>{tr('ประเภทการคืน', 'Return type')}</span>
      <select aria-label={tr('ประเภทการคืน', 'Return type')} value={value} onChange={e => onChange(e.target.value)}>
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
        ? <Link to={`/flow/detail${q}`}>{tr('Flow ละเอียด', 'Detailed flow')} →</Link>
        : <Link to={`/flow${q}`}>← {tr('Flow ภาพรวม', 'Flow overview')}</Link>}
      <Link to="/tour">{tr('ดู Demo นำชม', 'View the guided demo')}</Link>
    </p>
  );
}
