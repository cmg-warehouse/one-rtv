import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { tr } from '../i18n';

/**
 * Site tour: a spotlight walk over the top bar that says what each menu is
 * for, starting with the live-system preview. Opens by itself on the first
 * visit; the "Site tour" button opens it again. Different from the guided demo
 * (Demo นำชม), which acts out whole returns step by step.
 */
interface TourStep { target: string; title: string; body: string }

function steps(): TourStep[] {
  return [
    {
      target: 'live',
      title: tr('เริ่มที่นี่: ดูแบบระบบจริง', 'Start here: Live system preview'),
      body: tr(
        'หน้าตาระบบตอนใช้งานจริง เข้าสู่ระบบเป็นบุคคลหนึ่ง (Brand, CS, ขนส่ง, คลัง, Admin CN ฯลฯ) แล้วเห็นเฉพาะเมนู หน้าแรก และงานที่รอตัวเอง ไม่มีปุ่ม demo ใดๆ',
        'What the system looks like in daily use. Sign in as one person (Brand, CS, carrier, warehouse, Admin CN…) and see only your own menu, home page and to-do list, with no demo controls.',
      ),
    },
    {
      target: '/',
      title: tr('รายการ RTV', 'RTV list'),
      body: tr(
        'คำสั่งคืนสินค้าทุกใบในที่เดียว: สถานะ ค้างที่ใคร อายุกี่วัน กรอง เรียง และติ๊ก "ค้างที่ฉัน" เพื่อดูเฉพาะงานของบทบาทที่เลือก',
        'Every return order in one place: status, who it is with, and how old it is. Filter, sort, and tick "With me" to see only your role\'s work.',
      ),
    },
    {
      target: '/promo',
      title: tr('งานเก็บโปร', 'Promo pickups'),
      body: tr(
        'แทนเมลแจ้งรายชื่อและเมลยืนยันรถ: ผู้ประสานงานแจ้งแบรนด์ กล่อง พาเลท CS ส่งต่อขนส่ง ขนส่งยืนยันรถ แล้วคนขับใช้ใบแจ้งเก็บรวมใบเดียวเก็บทุกแบรนด์',
        'Replaces the announcement and truck-confirmation emails: the coordinator lists brands, boxes and pallets, CS forwards, the carrier confirms trucks, and the driver collects every brand with one combined slip.',
      ),
    },
    {
      target: '/track',
      title: 'Track & Trace',
      body: tr(
        'พิมพ์เลขอะไรก็ได้ (RTV, MIM, TK, CN) แล้วเห็นเส้นทางของสินค้าทีละจุดเหมือนติดตามพัสดุ',
        'Type any number (RTV, MIM, TK, CN) and follow the goods milestone by milestone, like parcel tracking.',
      ),
    },
    {
      target: '/map',
      title: tr('แผนที่', 'Map'),
      body: tr(
        'สินค้าอยู่ตรงไหนตอนนี้: สาขา รถที่กำลังวิ่ง SCDC คลองส่งน้ำ และ CMG กม.20',
        'Where the goods are right now: stores, trucks on the road, SCDC Khlong Song Nam and CMG Km.20.',
      ),
    },
    {
      target: '/mobile',
      title: tr('แอปมือถือ', 'Mobile app'),
      body: tr(
        'มือถือคนขับและคลัง: สแกน QR บนใบแจ้งเก็บ นับกล่อง ถ่ายรูป ให้สาขาเซ็น และคลังรับเข้า ทุกการกดเปลี่ยนสถานะจริง',
        'Driver and warehouse phones: scan the slip QR, count boxes, take a photo, get the store\'s signature, and receive at the warehouse. Every tap updates the real status.',
      ),
    },
    {
      target: '/dashboard',
      title: 'Dashboard',
      body: tr(
        'ภาพรวม: งานค้างแต่ละขั้น Hold ที่รอ Brand และรอมากี่วัน และงานค้างที่แต่ละฝ่าย',
        'The overview: open orders per step, holds waiting for the Brand and for how long, and how much work sits with each team.',
      ),
    },
    {
      target: '/flow',
      title: 'Flow',
      body: tr(
        'ใครทำขั้นไหน แยกตามประเภทการคืน (Consign, Shop, พัสดุ, งานเก็บโปร ฯลฯ) พร้อมปุ่ม "ลองทำ" พาไปหน้าจอจริงของขั้นนั้น',
        'Who does each step for each return type (Consign, Shop, parcel, promo pickup…), with "Try it" buttons that open the real screen for that step.',
      ),
    },
    {
      target: '/tour',
      title: tr('Demo นำชม', 'Guided demo'),
      body: tr(
        'เรื่องเล่าทีละขั้นที่เดินงานคืนสินค้าหนึ่งใบตั้งแต่เปิดคำสั่งจนออก CN เหมาะกับการนำเสนอ',
        'Step-by-step stories that walk one return from opening the order to issuing the CN. Good for presenting.',
      ),
    },
    {
      target: 'search',
      title: tr('ค้นหา', 'Search'),
      body: tr('ใส่เลขเอกสารใดก็ได้แล้วกด Enter เพื่อไปที่ RTV นั้นทันที', 'Enter any document number and press Enter to jump straight to its RTV.'),
    },
    {
      target: 'role',
      title: tr('บทบาท (เฉพาะ demo)', 'Role (demo only)'),
      body: tr('สลับว่ากำลังทำงานเป็นใคร หน้าจอและปุ่มที่กดได้จะเปลี่ยนตามบทบาท', 'Switch who you are acting as. Screens and available buttons change with the role.'),
    },
    {
      target: 'reset',
      title: tr('รีเซ็ตข้อมูล', 'Reset data'),
      body: tr('ล้างสิ่งที่ลองกดไว้ แล้วเริ่มใหม่จากข้อมูลตั้งต้น', 'Clear what you tried and start again from the starting data.'),
    },
    {
      target: 'lang',
      title: 'EN | TH',
      body: tr('สลับภาษาได้ทุกหน้า กด "แนะนำเว็บ" เมื่อไหร่ก็ได้เพื่อดูคำแนะนำนี้อีกครั้ง', 'Switch language on any page. Press "Site tour" any time to see this again.'),
    },
  ];
}

const SEEN_KEY = 'one-rtv.site-tour-seen';
export const OPEN_SITE_TOUR = 'one-rtv:site-tour';

export function openSiteTour(): void {
  window.dispatchEvent(new Event(OPEN_SITE_TOUR));
}

function rectOf(target: string): DOMRect | null {
  const el = document.querySelector(`[data-sitetour="${target}"]`);
  return el ? el.getBoundingClientRect() : null;
}

export default function SiteTour() {
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const list = steps();

  const close = useCallback(() => {
    setIndex(null);
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const open = () => setIndex(0);
    window.addEventListener(OPEN_SITE_TOUR, open);
    // First visit only, and never under the test runner.
    let seen = true;
    try { seen = localStorage.getItem(SEEN_KEY) === '1'; } catch { /* ignore */ }
    const t = !seen && import.meta.env.MODE !== 'test' ? window.setTimeout(open, 600) : undefined;
    return () => { window.removeEventListener(OPEN_SITE_TOUR, open); window.clearTimeout(t); };
  }, []);

  const step = index === null ? null : list[index];

  const target = step?.target ?? null;
  useLayoutEffect(() => {
    if (!target) return;
    const el = document.querySelector(`[data-sitetour="${target}"]`);
    if (el && 'scrollIntoView' in el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const update = () => setRect(rectOf(target));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [target]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') setIndex(i => (i === null ? i : Math.min(i + 1, list.length - 1)));
      if (e.key === 'ArrowLeft') setIndex(i => (i === null ? i : Math.max(i - 1, 0)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, close, list.length]);

  if (index === null || !step) return null;
  const last = index === list.length - 1;
  const pad = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = Math.min(360, vw - 32);
  const spot = rect && { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  // Below the target when it fits, above otherwise; kept inside the screen.
  const below = !spot || spot.top + spot.height + 220 < vh;
  const cardTop = spot ? (below ? spot.top + spot.height + 12 : Math.max(16, spot.top - 12 - 220)) : vh / 2 - 110;
  const cardLeft = spot ? Math.min(Math.max(16, spot.left + spot.width / 2 - cardW / 2), vw - cardW - 16) : vw / 2 - cardW / 2;

  return (
    <div className="site-tour" role="dialog" aria-modal="true" aria-labelledby="site-tour-title">
      <div className="site-tour-backdrop" onClick={close} />
      {spot && <div className="site-tour-spot" style={spot} />}
      <div className="site-tour-card" style={{ top: cardTop, left: cardLeft, width: cardW }}>
        <p className="site-tour-count">{tr(`แนะนำเว็บ · ${index + 1} / ${list.length}`, `Site tour · ${index + 1} of ${list.length}`)}</p>
        <h2 id="site-tour-title">{step.title}</h2>
        <p>{step.body}</p>
        <div className="site-tour-actions">
          <button type="button" className="btn btn-sm site-tour-skip" onClick={close}>{tr('ข้าม', 'Skip')}</button>
          <span className="site-tour-dots" aria-hidden="true">
            {list.map((s, i) => <span key={s.target} className={i === index ? 'on' : ''} />)}
          </span>
          {index > 0 && <button type="button" className="btn btn-sm" onClick={() => setIndex(index - 1)}>{tr('ย้อนกลับ', 'Back')}</button>}
          <button type="button" className="btn btn-sm btn-primary" autoFocus onClick={() => (last ? close() : setIndex(index + 1))}>
            {last ? tr('เสร็จสิ้น', 'Done') : tr('ถัดไป', 'Next')}
          </button>
        </div>
      </div>
    </div>
  );
}
