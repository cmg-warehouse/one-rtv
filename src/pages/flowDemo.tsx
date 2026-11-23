import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { nextStep, owner, STEP_LABELS, type StepDef } from '../domain/rules';
import { tr } from '../i18n';
import type { PromoEvent, Role, Rtv, Step } from '../domain/types';
import { asCarrierActor, useSession } from '../state/session';
import { usePromoList, useRtvList } from '../state/useRtvs';
import type { Scenario } from './flowScenarios';

export interface DemoTarget { to: string; role: Role; what: string }

/** RTV waiting at exactly this step for this role, preferring the scenario's channel and carrier. */
function sampleRtv(rtvs: Rtv[], step: Step, role: Role, sc: Scenario): Rtv | undefined {
  // Promotion scenarios use the pickups' RTVs; the others keep to ordinary RTVs when there is one.
  const all = rtvs.filter(r => nextStep(r)?.step === step && owner(r) === role);
  const same = all.filter(r => !!r.promoId === !!sc.promo);
  const waiting = same.length ? same : all;
  return waiting.find(r => r.channel === sc.channel && (step <= 2 || r.carrier === sc.carrier))
    ?? waiting.find(r => r.channel === sc.channel)
    ?? waiting[0];
}

/** Where to try a flow step in the demo: the screen that role really uses for it, with a matching RTV when one is needed. */
/** Steps 1-5 of a promotion pickup happen on the pickup pages: a pickup waiting at that stage, or the list. */
export function promoTarget(step: Step, events: PromoEvent[]): DemoTarget | null {
  if (step === 1) return { to: '/promo/new', role: 'PROMO', what: tr('แจ้งงานเก็บโปรใหม่', 'Post a new promo pickup') };
  const status = ({ 2: 'REQUESTED', 4: 'FORWARDED', 5: 'CONFIRMED' } as Partial<Record<Step, PromoEvent['status']>>)[step];
  if (!status) return null;
  const role: Role = step === 2 ? 'CS' : 'CARRIER';
  const e = events.find(x => x.status === status);
  if (!e) return { to: '/promo', role, what: tr('รายการงานเก็บโปร', 'Promo pickup list') };
  // Pickup day: the combined slip with the driver's phone beside it.
  return step === 5 ? { to: `/promo/${e.id}/slip`, role, what: `${tr('ใบแจ้งเก็บรวม', 'Combined pickup slip')} ${e.name}` } : { to: `/promo/${e.id}`, role, what: e.name };
}

export function demoTarget(def: StepDef, sc: Scenario, rtvs: Rtv[], events: PromoEvent[] = []): DemoTarget | null {
  if (def.mode !== 'MANUAL') return null;
  const { step, role } = def;
  if (sc.promo && step <= 5) return promoTarget(step, events);
  if (step === 1) return { to: '/new', role, what: tr('เปิดคำสั่งคืนใหม่', 'Open a new return order') };
  if (role === 'CARRIER') return { to: '/mobile', role, what: tr('แอปมือถือขนส่ง (ซ้าย)', 'Carrier mobile app (left)') };
  if (role === 'WH') return { to: '/mobile', role, what: tr('แอปมือถือคลัง (ขวา)', 'Warehouse mobile app (right)') };
  const rtv = sampleRtv(rtvs, step, role, sc);
  if (!rtv) return { to: `/?owner=${role}`, role, what: tr('รายการที่ค้างอยู่กับบทบาทนี้', 'Items waiting with this role') };
  return { to: `/rtv/${rtv.id}`, role, what: rtv.id };
}

/* ---- "back to flow" memory: survives page changes inside the demo, cleared when used ---- */

const KEY = 'one-rtv.flow-return';
interface FlowReturn { s: string; step: Step; page?: 'overview' | 'detail' }
const EVENT = 'one-rtv:flow-return';

function readReturn(): FlowReturn | null {
  try { const v = sessionStorage.getItem(KEY); return v ? JSON.parse(v) as FlowReturn : null; } catch { return null; }
}
/** Remember which flow page and step the presenter jumped from, for FlowReturnBar. */
export function rememberFlow(v: FlowReturn): void { writeReturn(v); }

function writeReturn(v: FlowReturn | null): void {
  try { if (v) sessionStorage.setItem(KEY, JSON.stringify(v)); else sessionStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

/** Button/link that switches to the step's role, remembers the way back, and opens the demo screen. */
export function TryStep({ def, scenario, variant }: { def: StepDef; scenario: Scenario; variant: 'link' | 'button' }) {
  const { rtvs } = useRtvList();
  const { events } = usePromoList();
  const { setRole, setCarrierActor } = useSession();
  const navigate = useNavigate();
  const target = demoTarget(def, scenario, rtvs, events);
  if (!target) return null;
  const go = () => {
    setRole(target.role);
    const c = asCarrierActor(scenario.carrier);
    if (c) setCarrierActor(c);
    writeReturn({ s: scenario.key, step: def.step });
    navigate(target.to);
  };
  return variant === 'link' ? (
    <button type="button" className="flow-try" onClick={go} aria-label={tr(`ลองทำขั้น ${def.step} ใน demo`, `Try step ${def.step} in the demo`)}>▶ {tr('ลองทำ', 'Try it')}</button>
  ) : (
    <div className="flow-try-box">
      <button type="button" className="btn btn-primary" onClick={go}>▶ {tr('ลองทำขั้นนี้ใน demo', 'Try this step in the demo')}</button>
      <span className="muted">{tr('จะสลับเป็นบทบาทนี้ แล้วเปิด', 'Switches to this role, then opens')} {target.what}</span>
    </div>
  );
}

/** Sticky bar shown on every demo page after jumping from the flow, until the presenter goes back or closes it. */
export function FlowReturnBar() {
  const location = useLocation();
  const [ret, setRet] = useState<FlowReturn | null>(readReturn);
  useEffect(() => {
    const sync = () => setRet(readReturn());
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  if (!ret || location.pathname.startsWith('/flow')) return null;
  const detail = ret.page === 'detail';
  return (
    <div className="flow-return" role="region" aria-label={tr('กลับไป Flow', 'Back to the flow')}>
      <Link className="btn btn-sm btn-primary" to={`/flow${detail ? '/detail' : ''}?s=${encodeURIComponent(ret.s)}&step=${ret.step}`}
        onClick={() => writeReturn(null)}>← {tr('กลับไป', 'Back to')} {detail ? tr('Flow ละเอียด', 'Detailed flow') : tr('Flow ภาพรวม', 'Flow overview')}</Link>
      <span>{tr('กำลังลองขั้น', 'Trying step')} {ret.step}. {STEP_LABELS[ret.step]}</span>
      <button type="button" className="btn btn-sm btn-icon flow-return-close" aria-label={tr('ปิดแถบกลับไป Flow', 'Close the back-to-flow bar')} onClick={() => writeReturn(null)}>×</button>
    </div>
  );
}
