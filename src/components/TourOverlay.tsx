import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CHANGED_EVENT, getRtv } from '../api';
import { tr } from '../i18n';
import { ROLE_LABELS, asCarrierActor, useSession } from '../state/session';
import {
  back, idsOf, isFinished, loadTour, next, saveTour, startStory, storyOf, takeSnapshot, TOUR_EVENT, type Snapshot, type TourState,
} from '../tour/runner';

/** Pulsing outline on the first primary action of the page (it may sit in the phone frame's footer). */
function useHighlight(active: boolean, key: string): void {
  useEffect(() => {
    if (!active) return;
    let current: Element | null = null;
    const apply = () => {
      const el = document.querySelector('[data-tour="primary"]');
      if (el === current) return;
      current?.classList.remove('tour-highlight');
      current = el;
      if (el) {
        el.classList.add('tour-highlight');
        el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      current?.classList.remove('tour-highlight');
    };
  }, [active, key]);
}

export default function TourOverlay() {
  const { setRole, setCarrierActor } = useSession();
  const navigate = useNavigate();
  const [tour, setTour] = useState<TourState | null>(loadTour);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tourRef = useRef(tour);
  const busyRef = useRef(false);
  const baseline = useRef<Snapshot | null>(null);
  tourRef.current = tour;

  useEffect(() => {
    const sync = () => setTour(loadTour());
    window.addEventListener(TOUR_EVENT, sync);
    return () => window.removeEventListener(TOUR_EVENT, sync);
  }, []);

  const commit = (s: TourState | null) => {
    tourRef.current = s;
    saveTour(s);
  };

  const story = tour ? storyOf(tour.storyId) : null;
  const finished = tour ? isFinished(tour) : false;
  const key = tour ? `${tour.rtvId}:${tour.index}` : '';
  const active = !!tour;

  useEffect(() => {
    document.body.classList.toggle('tour-active', active);
    return () => document.body.classList.remove('tour-active');
  }, [active]);

  // Show each step's screen as the role that performs it; a finished tour is shown read-only.
  useEffect(() => {
    if (!tour || !story) return;
    const stepDef = story.steps[tour.index];
    setRole(stepDef ? stepDef.role : 'VIEWER');
    navigate(stepDef ? stepDef.route(idsOf(tour)) : `/rtv/${tour.rtvId}`);
    let live = true;
    void takeSnapshot(tour).then(snap => { if (live) baseline.current = snap; }).catch(() => undefined);
    void getRtv(tour.rtvId).then(r => {
      if (!live || !r) return;
      // A promotion pickup is a booked truck even before CS has set the carrier.
      const actor = stepDef?.role === 'CARRIER' ? asCarrierActor(r.carrier ?? (tour.promoId ? 'AGREED' : null)) : null;
      if (actor) setCarrierActor(actor);
    });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useHighlight(active && !finished, key);

  // The presenter may click the real button instead of the next button: the RTV changed, so the step is done.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const s = tourRef.current;
      if (busyRef.current || !s || isFinished(s)) return;
      const id = (e as CustomEvent<string | undefined>).detail;
      if (id && id !== s.rtvId && id !== s.promoId) return;
      void takeSnapshot(s).catch(() => null).then(now => {
        const before = baseline.current;
        const cur = tourRef.current;
        if (!now || !before || !cur || cur.index !== s.index || busyRef.current) return;
        if (JSON.stringify(now) === JSON.stringify(before)) return;
        commit({ ...cur, index: cur.index + 1, snapshots: [...cur.snapshots.slice(0, cur.index), before] });
      });
    };
    window.addEventListener(CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(CHANGED_EVENT, onChanged);
  }, []);

  if (!tour || !story) return null;

  async function go(fn: () => Promise<TourState>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      commit(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('เกิดข้อผิดพลาด', 'Something went wrong'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const current = tour;
  const stepDef = story.steps[current.index];
  return (
    <aside className="tour-overlay" aria-label={tr('Demo นำชม', 'Guided demo')}>
      <p className="tour-story">{story.title}</p>
      {finished || !stepDef ? (
        <div className="tour-done">
          <h2>{tr('จบเรื่องนี้แล้ว', 'End of this story')}</h2>
          <p>{tr('เลข RTV', 'RTV number')} <span className="mono">{current.rtvId}</span> {tr('ผ่านครบทุกบทบาทแล้ว หน้านี้เปลี่ยนเป็นมุมมองผู้ดูภาพรวม (อ่านอย่างเดียว)', 'has been through every role. This page is now the Viewer view (read-only).')}</p>
          <p><Link to={`/rtv/${current.rtvId}`}>{tr('ดู timeline ของ RTV นี้', 'View this RTV’s timeline')}</Link></p>
          <p><Link to="/tour" onClick={() => commit(null)}>{tr('กลับไปเลือกเรื่อง', 'Back to the story list')}</Link></p>
        </div>
      ) : (
        <>
          {current.index === 0 && (current.promoId ? (
            <p className="tour-intro">
              {tr('เริ่มเรื่อง: ผู้ประสานงานโปรแจ้งงาน', 'Story start: the promo coordinator posted pickup')} <span className="mono">{current.promoId}</span> {tr('แล้ว ทุกแบรนด์ได้เลข RTV', 'and every brand has an RTV number')}
              {tr('— เรื่องนี้ติดตาม', '— this story follows')} <span className="mono">{current.rtvId}</span> {tr('ของ Lacoste', 'for Lacoste')}
            </p>
          ) : (
            <p className="tour-intro">
              {tr('เริ่มเรื่อง: Brand เปิดคำสั่งแล้ว ระบบออกเลข', 'Story start: Brand opened the order and the system issued number')} <span className="mono">{current.rtvId}</span> {tr('ให้ใช้ตลอดทาง', 'to use all the way through')}
            </p>
          ))}
          <div className="tour-head">
            <span className="tour-count">{tr('ขั้น', 'Step')} {current.index + 1} / {story.steps.length}</span>
            <span className="badge badge-assigned">{ROLE_LABELS[stepDef.role]}</span>
          </div>
          <h2 className="tour-title">{stepDef.title}</h2>
          <p className="tour-narration">{stepDef.narration}</p>
        </>
      )}
      {error && <p className="error" role="alert">{error}</p>}
      <div className="tour-buttons">
        <button type="button" className="btn" disabled={busy || current.index === 0} onClick={() => { void go(() => back(current)); }}>{tr('ย้อนกลับ', 'Back')}</button>
        <button type="button" className="btn btn-primary" disabled={busy || finished} onClick={() => { void go(() => next(current)); }}>{tr('ถัดไป', 'Next')}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => { void go(() => startStory(current.storyId)); }}>{tr('เริ่มใหม่', 'Restart')}</button>
        <button type="button" className="btn" onClick={() => commit(null)}>{tr('ออกจาก Demo', 'Exit demo')}</button>
      </div>
    </aside>
  );
}
