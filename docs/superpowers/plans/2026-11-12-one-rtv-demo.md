# One RTV Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable, mock-data demo of the One RTV application for BU CMG: every role works one RTV number from "เปิดคำสั่ง" to "ออก CN", with a flow overview, a detailed flow walkthrough and a guided tour.

**Architecture:** Single-page React app with no server. All flow rules live in pure TypeScript (`src/domain`) and are unit-tested; screens call an async `src/api` layer shaped like the future REST API, backed by localStorage. The guided tour drives the same API calls the buttons use.

**Tech Stack:** Node 24 · Vite · React 19 · TypeScript (strict) · react-router-dom (HashRouter) · Vitest + @testing-library/react + jsdom · qrcode.react

**Spec:** `docs/superpowers/specs/2026-11-12-one-rtv-demo-design.md` — read it before any task. Section numbers below (§) refer to it.

## Global Constraints

- All UI copy in Thai. Dates `DD/MM/YYYY`, time 24h, zone `Asia/Bangkok` — always via `fmtDate` / `fmtDateTime` (Task 2).
- Mock data only. No real store, driver or staff names; no network calls; no backend.
- RTV number format `RTV-CMG-YYMM-NNNNN`; box number `<rtv id>-B01`, `-B02`, …
- The mall's number is labelled `RTV Note (ห้าง)` everywhere, never plain "RTV".
- Every page shows the footer banner `ข้อมูลจำลองเพื่อการสาธิต — ยังไม่เชื่อมต่อ SAP / Sprint FC`.
- Theme: copy `C:\Workbench\CMG_Transport_DP\src\app\globals.css` to `src/styles/theme.css` unchanged and `public\crl-logo.svg`, `public\cmg-logo.png` to `public/`. Use its classes (`.topbar`, `.card`, `.btn`, `.btn-primary`, `.badge-*`, `.mobile`, `.bottom-bar`) before writing new CSS; new CSS goes in `src/styles/demo.css`. Fonts: Kanit (headings, `--font-head`) and Sarabun (body, `--font-sans`) from Google Fonts in `index.html`, with `system-ui` fallback.
- Vite `base: './'` and `HashRouter`, so `dist/index.html` opens from a folder.
- Never touch `C:\Workbench\CMG_Transport_DP` (read-only source for the theme).
- Commit after every task. Commit messages end with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.

## Review Focus

1. Search input typed loosely (lowercase, surrounding spaces, partial number such as `2611-00042` or a TK) → still lands on the right RTV. Test in Task 4.
2. localStorage missing, full or holding corrupt JSON → app loads from seed instead of a white screen. Test in Task 4.
3. Box / piece counts that are empty, negative, non-numeric or larger than expected boxes → rejected with a Thai message, RTV unchanged. Test in Task 3.
4. A role acting on a step that is not theirs (role switched while a detail page is open) → no action button, and the domain throws `FlowError`. Tests in Task 3 and Task 5.
5. Opening `#/rtv/<unknown id>` (after reset, or a mistyped number) → page says `ไม่พบเลข RTV นี้` with a link back to the list. Test in Task 5.

## File Structure

```
index.html · vite.config.ts · package.json · tsconfig.json · README.md
public/            crl-logo.svg, cmg-logo.png
src/main.tsx       mounts <App/>
src/App.tsx        HashRouter + routes + layout (TopBar, footer banner)
src/styles/        theme.css (copied), demo.css (additions)
src/domain/types.ts      all shared types
src/domain/format.ts     fmtDate, fmtDateTime, daysBetween
src/domain/rules.ts      flow configuration: steps, skips, CN type, required docs, holds, owner
src/domain/machine.ts    pure transitions on an Rtv (create, advance, exceptions)
src/data/masters.ts      brands, stores, carriers, demo actors
src/data/seed.ts         buildSeed(now) – ~40 RTVs produced by replaying machine transitions
src/api/store.ts         localStorage read/write with seed fallback
src/api/index.ts         async API used by every screen
src/state/session.tsx    current role + actor (context, persisted)
src/state/useRtvs.ts     hooks that load from api and refresh after actions
src/components/          TopBar, StatusBar, Timeline, DocRefTable, BoxList, ActionPanel, PhoneFrame, HoldBanner
src/pages/               RtvList, RtvDetail, NewRtv, PickupSlip, CarrierJobs, Dashboard, FlowOverview, FlowDetail, Tour
src/tour/stories.ts      4 stories as data
src/tour/runner.ts       story state machine (start, next, back, restart)
```

Tests sit beside the file they test as `*.test.ts(x)`.

---

### Task 1: Project shell, theme and role switcher

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `src/main.tsx`, `src/App.tsx`, `src/styles/theme.css`, `src/styles/demo.css`, `src/domain/types.ts`, `src/state/session.tsx`, `src/components/TopBar.tsx`, `public/crl-logo.svg`, `public/cmg-logo.png`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces (`src/domain/types.ts`) — the full type set every later task uses:

```ts
export type Role = 'BRAND' | 'CS' | 'CARRIER' | 'SCDC' | 'WH' | 'ADMIN_CN' | 'VIEWER';
export type Channel = 'CONSIGN' | 'SHOP' | 'TEMP_SHOP' | 'LOCAL_MALL';
export type SaleType = 'NORMAL' | 'PROMO';
export type Carrier = 'CG_NETWORK' | 'PLAZA_4W' | 'PARCEL' | 'AGREED';
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export type CnType = 'MIM_SHOP' | 'TEMP_SHOP' | 'ETAX_CONSIGN' | 'ETAX_CREDIT';
export type DocType = 'MIM' | 'RTV_NOTE' | 'SD10' | 'PICKUP_SLIP' | 'CARRIER_REF' | 'TK'
  | 'MATDOC' | 'GEN104' | 'PROMO_NO' | 'SALE_RETURN' | 'DELIVERY' | 'INVOICE_REF' | 'CN';
export type Hold = 'WAIT_BRAND_QTY' | 'WAIT_RTV_NOTE' | 'WAIT_PROMO';
export type EventKind = 'STEP' | 'PICKUP_FAILED' | 'SHORT_BOX' | 'FLAG_CLEARED' | 'QTY_MISMATCH'
  | 'BRAND_CONFIRMED' | 'RECOUNT_REQUESTED' | 'DOC_ADDED' | 'PROMO_CONFIRMED' | 'CANCELLED';
export interface Box { no: string; expectedPcs: number; countedPcs?: number }
export interface DocRef { type: DocType; value: string }
export interface RtvEvent { at: string; role: Role; actor: string; kind: EventKind; step?: Step; auto?: boolean; note?: string }
export interface Rtv {
  id: string; brandId: string; storeId: string; channel: Channel; saleType: SaleType;
  carrier: Carrier | null; pickupDate?: string;
  boxes: Box[]; docs: DocRef[];
  step: Step;                 // last completed step
  shortBoxes: number;         // open "กล่องขาด" flag, 0 = none
  qtyConfirmed: boolean;      // Brand accepted the counted quantity
  promoConfirmed: boolean;
  cancelled?: { reason: string };
  createdAt: string; events: RtvEvent[];
}
```

- Produces (`src/state/session.tsx`): `SessionProvider`, `useSession(): { role: Role; actor: string; setRole(r: Role): void; carrierActor: Carrier; setCarrierActor(c: 'PLAZA_4W' | 'CG_NETWORK'): void }`. Role persists in localStorage key `one-rtv.role`. `ROLE_LABELS: Record<Role, string>` = Brand / ฝ่ายขาย, CS คลัง, ขนส่ง, SCDC, คลัง CMG, Admin CN, ผู้ดูภาพรวม.
- Produces (`src/App.tsx`): routes `/` (list), `/rtv/:id`, `/new`, `/slip/:id`, `/carrier`, `/dashboard`, `/flow`, `/flow/detail`, `/tour` — placeholders for now.

- [ ] **Step 1:** `git init`; scaffold with `npm create vite@latest . -- --template react-ts`; install `react-router-dom qrcode.react` and dev deps `vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom`; add scripts `test: vitest run`, `typecheck: tsc --noEmit`; configure Vitest (`environment: 'jsdom'`, setup file importing `@testing-library/jest-dom`). Copy the theme and logos per Global Constraints.
- [ ] **Step 2: Write the failing test** (`src/App.test.tsx`)

```tsx
test('top bar shows CRL logo, search box and all 7 roles', () => {
  render(<App />);
  expect(screen.getByAltText('CRL')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('ค้นหาเลข RTV / MIM / TK / CN')).toBeInTheDocument();
  expect(screen.getAllByRole('option')).toHaveLength(7);
});
test('chosen role survives a remount', async () => {
  const { unmount } = render(<App />);
  await userEvent.selectOptions(screen.getByLabelText('บทบาท'), 'WH');
  unmount(); render(<App />);
  expect(screen.getByLabelText('บทบาท')).toHaveValue('WH');
});
test('footer banner states the data is mock', () => {
  render(<App />);
  expect(screen.getByText('ข้อมูลจำลองเพื่อการสาธิต — ยังไม่เชื่อมต่อ SAP / Sprint FC')).toBeInTheDocument();
});
```

- [ ] **Step 3:** Run `npm test` — expect FAIL (no TopBar).
- [ ] **Step 4:** Implement types, session context, `TopBar` (logo, title `One RTV`, nav links รายการ RTV · Dashboard · Flow · Demo นำชม, search input, role `<select aria-label="บทบาท">`), layout and placeholder routes.
- [ ] **Step 5:** Run `npm test` and `npm run typecheck` — expect PASS. Run `npm run dev` and confirm the top bar renders in CRL red/white.
- [ ] **Step 6:** Commit `feat: project shell with CRL theme and role switcher`.

---

### Task 2: Flow rules

**Files:**
- Create: `src/domain/rules.ts`, `src/domain/format.ts`
- Test: `src/domain/rules.test.ts`, `src/domain/format.test.ts`

**Interfaces:**
- Consumes: types from Task 1.
- Produces:

```ts
export type StepMode = 'MANUAL' | 'AUTO' | 'SKIPPED';
export interface StepDef { step: Step; label: string; role: Role; mode: StepMode }
export const STEP_LABELS: Record<Step, string>;       // §5.1 names, verbatim
export const CHANNEL_LABELS, CARRIER_LABELS, CN_LABELS, DOC_LABELS, HOLD_LABELS;
export function cnType(channel: Channel, saleType: SaleType): CnType;
export function allowedCarriers(channel: Channel): Carrier[];
export function stepsFor(channel: Channel, carrier: Carrier | null): StepDef[];   // always 10 entries
export function nextStep(rtv: Rtv): StepDef | null;   // null when closed or cancelled
export function holds(rtv: Rtv): Hold[];
export function owner(rtv: Rtv): Role | null;         // who must act now
export function requiredDocs(cn: CnType): { before: DocType[]; atCn: DocType[] };
export function isClosed(rtv: Rtv): boolean;          // step 10 or cancelled
// format.ts
export function fmtDate(iso: string): string;         // '12/11/2026'
export function fmtDateTime(iso: string): string;     // '12/11/2026 14:05'
export function daysBetween(fromIso: string, toIso: string): number; // 1 decimal
```

Values pinned by the spec (§5.2, §5.3):
- `allowedCarriers`: CONSIGN → `[CG_NETWORK]`; SHOP, TEMP_SHOP → `[CG_NETWORK, PLAZA_4W, PARCEL]`; LOCAL_MALL → `[AGREED]`.
- `stepsFor` roles: 1 BRAND · 2–3 CS · 4–5 CARRIER · 6–7 SCDC · 8–9 WH · 10 ADMIN_CN. Overrides: CONSIGN → step 2 `AUTO`, step 3 `SKIPPED`; PARCEL → step 3 `SKIPPED`, steps 4–5 role `CS`; PLAZA_4W and AGREED → steps 6–7 `SKIPPED`; carrier `null` → nothing skipped.
- `holds` apply only when `rtv.step === 9`: `WAIT_BRAND_QTY` if any box has `countedPcs !== expectedPcs` and `!qtyConfirmed`; `WAIT_RTV_NOTE` if channel is CONSIGN or LOCAL_MALL and no `RTV_NOTE` doc; `WAIT_PROMO` if PROMO and `!promoConfirmed`.
- `owner`: any hold → `BRAND`; else `nextStep(rtv).role`; closed → `null`.
- `requiredDocs`: MIM_SHOP `{before:[MIM,TK], atCn:[MATDOC]}` · TEMP_SHOP `{before:[MIM,TK], atCn:[GEN104,PROMO_NO,MATDOC,CN]}` · ETAX_CONSIGN `{before:[RTV_NOTE,TK], atCn:[SALE_RETURN,DELIVERY,CN]}` · ETAX_CREDIT `{before:[RTV_NOTE,TK], atCn:[INVOICE_REF,SALE_RETURN,DELIVERY,CN]}`.
- `DOC_LABELS.RTV_NOTE` = `RTV Note (ห้าง)`.

- [ ] **Step 1: Write the failing tests**

```ts
test.each([
  ['SHOP','NORMAL','MIM_SHOP'], ['TEMP_SHOP','NORMAL','MIM_SHOP'],
  ['SHOP','PROMO','TEMP_SHOP'], ['TEMP_SHOP','PROMO','TEMP_SHOP'],
  ['CONSIGN','NORMAL','ETAX_CONSIGN'], ['LOCAL_MALL','NORMAL','ETAX_CONSIGN'],
  ['CONSIGN','PROMO','ETAX_CREDIT'], ['LOCAL_MALL','PROMO','ETAX_CREDIT'],
])('cnType(%s,%s) = %s', (c, s, cn) => expect(cnType(c as Channel, s as SaleType)).toBe(cn));

const modes = (c: Channel, k: Carrier | null) => stepsFor(c, k).map(s => s.mode[0]).join('');
test('skips per channel and carrier', () => {
  expect(modes('CONSIGN', 'CG_NETWORK')).toBe('MASMMMMMMM');
  expect(modes('SHOP', 'CG_NETWORK')).toBe('MMMMMMMMMM');
  expect(modes('SHOP', 'PLAZA_4W')).toBe('MMMMMSSMMM');
  expect(modes('TEMP_SHOP', 'PARCEL')).toBe('MMSMMMMMMM');
  expect(modes('LOCAL_MALL', 'AGREED')).toBe('MMMMMSSMMM');
  expect(modes('SHOP', null)).toBe('MMMMMMMMMM');
});
test('parcel pickup steps belong to CS', () => {
  const s = stepsFor('SHOP', 'PARCEL');
  expect([s[3].role, s[4].role]).toEqual(['CS', 'CS']);
});
test('nextStep jumps over skipped steps', () => {
  expect(nextStep(rtv({ channel: 'SHOP', carrier: 'PLAZA_4W', step: 5 }))!.step).toBe(8);
  expect(nextStep(rtv({ step: 10 }))).toBeNull();
});
test('holds and owner at step 9', () => {
  const r = rtv({ channel: 'CONSIGN', saleType: 'PROMO', carrier: 'CG_NETWORK', step: 9,
    boxes: [{ no: 'x-B01', expectedPcs: 10, countedPcs: 8 }] });
  expect(holds(r)).toEqual(['WAIT_BRAND_QTY', 'WAIT_RTV_NOTE', 'WAIT_PROMO']);
  expect(owner(r)).toBe('BRAND');
  expect(holds({ ...r, step: 8 })).toEqual([]);
});
test('requiredDocs for E-tax Credit', () =>
  expect(requiredDocs('ETAX_CREDIT').atCn).toEqual(['INVOICE_REF', 'SALE_RETURN', 'DELIVERY', 'CN']));
// format.test.ts
test('formats in Bangkok time', () => {
  expect(fmtDate('2026-11-11T18:30:00Z')).toBe('12/11/2026');
  expect(fmtDateTime('2026-11-12T07:05:00Z')).toBe('12/11/2026 14:05');
});
```

`rtv(overrides)` is a test helper in `src/domain/testing.ts` returning a valid SHOP/NORMAL Rtv with one 10-piece box; later tasks reuse it.

- [ ] **Step 2:** Run `npm test -- rules format` — expect FAIL.
- [ ] **Step 3:** Implement `rules.ts` and `format.ts` (`Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok' })`).
- [ ] **Step 4:** Run tests — expect PASS.
- [ ] **Step 5:** Commit `feat: flow rules for channels, carriers and CN types`.

---

### Task 3: Transitions

**Files:**
- Create: `src/domain/machine.ts`
- Test: `src/domain/machine.test.ts`

**Interfaces:**
- Consumes: `rules.ts`.
- Produces:

```ts
export class FlowError extends Error {}               // message is Thai, shown to the user as-is
export interface Ctx { role: Role; actor: string; now: string }
export interface NewRtvInput { brandId: string; storeId: string; channel: Channel; saleType: SaleType;
  boxPcs: number[]; docs: DocRef[] }
export type StepPayload =
  | { step: 2; carrier: Carrier; pickupDate: string; carrierRef?: string }
  | { step: 3 } | { step: 4 } | { step: 7 }
  | { step: 5 | 6 | 8; boxes: number }
  | { step: 9; tk: string; counts: number[] }
  | { step: 10; docs: Partial<Record<DocType, string>> };
export function rtvId(seq: number, now: string): string;              // 'RTV-CMG-2611-00042'
export function createRtv(input: NewRtvInput, seq: number, ctx: Ctx): Rtv;
export function advance(rtv: Rtv, payload: StepPayload, ctx: Ctx): Rtv;
export function failPickup(rtv: Rtv, reason: string, ctx: Ctx): Rtv;
export function clearShortFlag(rtv: Rtv, note: string, ctx: Ctx): Rtv;
export function brandConfirmQty(rtv: Rtv, ctx: Ctx): Rtv;
export function brandRequestRecount(rtv: Rtv, ctx: Ctx): Rtv;
export function confirmPromo(rtv: Rtv, ctx: Ctx): Rtv;
export function addDoc(rtv: Rtv, doc: DocRef, ctx: Ctx): Rtv;
export function cancel(rtv: Rtv, reason: string, ctx: Ctx): Rtv;
```

Behaviour the tests don't fully determine:
- All functions are pure and return a new Rtv with one or more events appended; they never mutate.
- `createRtv`: role must be BRAND; CONSIGN sets `carrier: 'CG_NETWORK'` and appends a step-2 event with `auto: true`, note `อัตโนมัติ: เข้ารอบรถ CG Network`, leaving `step = 2`.
- `advance`: `payload.step` must equal `nextStep(rtv).step` and `ctx.role` must equal its role, else `FlowError('ขั้นนี้ไม่ใช่หน้าที่ของบทบาทนี้')`. Step 2 carrier must be in `allowedCarriers`; PARCEL requires `carrierRef`, stored as a `CARRIER_REF` doc. Step 3 adds doc `PICKUP_SLIP` = `PS-` + id without the `RTV-` prefix, unless one exists. Steps 5/6/8: `boxes` must be an integer from 1 to `rtv.boxes.length`; fewer than expected sets `shortBoxes` and appends `SHORT_BOX`. Step 9: `tk` required, `counts.length === boxes.length`, each an integer ≥ 0; stores `countedPcs`, adds `TK` doc, appends `QTY_MISMATCH` if any differ. Step 10: `holds(rtv)` must be empty, every `requiredDocs(cn).before` doc present, every `atCn` doc supplied non-empty.
- `failPickup`: allowed for the role that owns step 4/5 while `step` is 2, 3 or 4. Non-consign: `step` back to 1 (CS redoes step 2; the existing slip is kept). Consign: `step` unchanged. Reason required.
- `clearShortFlag`: CS only. `brandConfirmQty` / `brandRequestRecount` / `confirmPromo`: BRAND only, at step 9; recount sets `step = 8` and clears `countedPcs`. `addDoc`: BRAND may add MIM, RTV_NOTE, SD10 at any open step. `cancel`: BRAND or CS, only while `step < 5`.

- [ ] **Step 1: Write the failing tests**

```ts
const at = '2026-11-12T03:00:00Z';
const as = (role: Role): Ctx => ({ role, actor: 'ทดสอบ', now: at });
const shop = () => createRtv({ brandId: 'B1', storeId: 'S1', channel: 'SHOP', saleType: 'NORMAL',
  boxPcs: [10, 12], docs: [{ type: 'MIM', value: '26000123' }] }, 42, as('BRAND'));

test('id and box numbers', () => {
  const r = shop();
  expect(r.id).toBe('RTV-CMG-2611-00042');
  expect(r.boxes.map(b => b.no)).toEqual(['RTV-CMG-2611-00042-B01', 'RTV-CMG-2611-00042-B02']);
  expect(r.step).toBe(1);
});
test('consign is routed automatically', () => {
  const r = createRtv({ ...consignInput }, 1, as('BRAND'));
  expect([r.step, r.carrier]).toEqual([2, 'CG_NETWORK']);
  expect(r.events.at(-1)).toMatchObject({ step: 2, auto: true });
});
test('happy path shop via 4W Plaza closes at step 10', () => {
  let r = shop();
  r = advance(r, { step: 2, carrier: 'PLAZA_4W', pickupDate: '2026-11-13' }, as('CS'));
  r = advance(r, { step: 3 }, as('CS'));
  expect(r.docs).toContainEqual({ type: 'PICKUP_SLIP', value: 'PS-CMG-2611-00042' });
  r = advance(r, { step: 4 }, as('CARRIER'));
  r = advance(r, { step: 5, boxes: 2 }, as('CARRIER'));
  r = advance(r, { step: 8, boxes: 2 }, as('WH'));
  r = advance(r, { step: 9, tk: 'TK0001', counts: [10, 12] }, as('WH'));
  r = advance(r, { step: 10, docs: { MATDOC: '5250000001' } }, as('ADMIN_CN'));
  expect(r.step).toBe(10);
  expect(r.events.filter(e => e.kind === 'STEP')).toHaveLength(8);
});
test('wrong role or wrong step is refused', () => {
  expect(() => advance(shop(), { step: 2, carrier: 'PLAZA_4W', pickupDate: '2026-11-13' }, as('WH'))).toThrow(FlowError);
  expect(() => advance(shop(), { step: 4 }, as('CARRIER'))).toThrow(FlowError);
});
test.each([0, -1, 3, 1.5, NaN])('box count %s is refused', n => {
  const r = toStep(shop(), 4);                     // helper: advance along the happy path
  expect(() => advance(r, { step: 5, boxes: n }, as('CARRIER'))).toThrow(FlowError);
});
test('short box flags but does not stop', () => {
  const r = advance(toStep(shop(), 5), { step: 8, boxes: 1 }, as('WH'));
  expect([r.step, r.shortBoxes]).toEqual([8, 1]);
  expect(clearShortFlag(r, 'พบกล่องที่สาขา', as('CS')).shortBoxes).toBe(0);
});
test('piece mismatch blocks CN until Brand confirms', () => {
  let r = advance(toStep(shop(), 8), { step: 9, tk: 'TK1', counts: [10, 9] }, as('WH'));
  expect(() => advance(r, { step: 10, docs: { MATDOC: '525' } }, as('ADMIN_CN'))).toThrow(FlowError);
  r = brandConfirmQty(r, as('BRAND'));
  expect(advance(r, { step: 10, docs: { MATDOC: '525' } }, as('ADMIN_CN')).step).toBe(10);
});
test('recount sends it back to the warehouse', () => {
  const r = brandRequestRecount(advance(toStep(shop(), 8), { step: 9, tk: 'TK1', counts: [10, 9] }, as('WH')), as('BRAND'));
  expect(r.step).toBe(8);
  expect(r.boxes.every(b => b.countedPcs === undefined)).toBe(true);
});
test('missing CN documents are refused', () =>
  expect(() => advance(toStep(shop(), 9), { step: 10, docs: {} }, as('ADMIN_CN'))).toThrow(FlowError));
test('failed pickup returns to CS and keeps the slip', () => {
  const r = failPickup(toStep(shop(), 4), 'ร้านปิด', as('CARRIER'));
  expect(r.step).toBe(1);
  expect(r.docs.filter(d => d.type === 'PICKUP_SLIP')).toHaveLength(1);
  const again = advance(advance(r, { step: 2, carrier: 'PLAZA_4W', pickupDate: '2026-11-14' }, as('CS')), { step: 3 }, as('CS'));
  expect(again.docs.filter(d => d.type === 'PICKUP_SLIP')).toHaveLength(1);
});
test('parcel needs a tracking number and CS records the pickup', () => {
  expect(() => advance(shop(), { step: 2, carrier: 'PARCEL', pickupDate: '2026-11-13' }, as('CS'))).toThrow(FlowError);
  let r = advance(shop(), { step: 2, carrier: 'PARCEL', pickupDate: '2026-11-13', carrierRef: 'KEX123' }, as('CS'));
  r = advance(r, { step: 4 }, as('CS'));
  expect(r.step).toBe(4);
});
test('cancel only before pickup', () => {
  expect(cancel(shop(), 'เปิดซ้ำ', as('BRAND')).cancelled).toEqual({ reason: 'เปิดซ้ำ' });
  expect(() => cancel(toStep(shop(), 5), 'x', as('CS'))).toThrow(FlowError);
});
test('transitions do not mutate their input', () => {
  const r = shop(); const snapshot = structuredClone(r);
  advance(r, { step: 2, carrier: 'PLAZA_4W', pickupDate: '2026-11-13' }, as('CS'));
  expect(r).toEqual(snapshot);
});
```

Put `toStep(rtv, step)` and `consignInput` in `src/domain/testing.ts`.

- [ ] **Step 2:** Run `npm test -- machine` — expect FAIL.
- [ ] **Step 3:** Implement `machine.ts`.
- [ ] **Step 4:** Run tests — expect PASS.
- [ ] **Step 5:** Commit `feat: RTV transitions and exception handling`.

---

### Task 4: Mock data and API layer

**Files:**
- Create: `src/data/masters.ts`, `src/data/seed.ts`, `src/api/store.ts`, `src/api/index.ts`
- Test: `src/data/seed.test.ts`, `src/api/index.test.ts`

**Interfaces:**
- Consumes: `machine.ts`, `rules.ts`.
- Produces:

```ts
// masters.ts
export interface Brand { id: string; name: string }
export interface Store { id: string; name: string; channel: Channel; province: string }
export const BRANDS: Brand[];          // 6 invented names, e.g. 'แบรนด์ตัวอย่าง A'
export const STORES: Store[];          // 12 invented stores covering all 4 channels, กทม. and ต่างจังหวัด
export const ACTORS: Record<Role, string>;   // invented, e.g. BRAND 'คุณเอ (ฝ่ายขาย แบรนด์ A)'
export const DEMO_BRAND_ID: string;    // the brand the BRAND role sees
// seed.ts
export function buildSeed(now: Date): Rtv[];
// api/index.ts — every function returns a Promise
export type Action =
  | { type: 'advance'; payload: StepPayload } | { type: 'failPickup'; reason: string }
  | { type: 'clearShortFlag'; note: string } | { type: 'brandConfirmQty' } | { type: 'brandRequestRecount' }
  | { type: 'confirmPromo' } | { type: 'addDoc'; doc: DocRef } | { type: 'cancel'; reason: string };
export function listRtvs(): Promise<Rtv[]>;                       // newest first
export function getRtv(id: string): Promise<Rtv | null>;
export function createRtv(input: NewRtvInput, ctx: { role: Role; actor: string }): Promise<Rtv>;
export function act(id: string, action: Action, ctx: { role: Role; actor: string }): Promise<Rtv>;
export function searchByAnyNumber(q: string): Promise<Rtv[]>;
export function putRtv(rtv: Rtv): Promise<void>;                  // tour snapshots only
export function resetData(): Promise<void>;
```

- `buildSeed` creates about 40 RTVs by calling machine functions with back-dated timestamps (spread over the 30 days before `now`), so every seeded RTV is reachable by real transitions. It must include at least one RTV at each of steps 1–10, each of the three holds, an open short-box flag, a failed pickup and a cancellation; at least 3 RTVs of every channel; and some open RTVs older than 14 days.
- Later tasks' tests look up these specific seeded cases, so the seed must also contain, all for `DEMO_BRAND_ID` where Brand acts: a SHOP RTV at step 1; PLAZA_4W RTVs at steps 2, 4 and 5 (the step-5 one with ≥ 2 boxes); an RTV at step 8 with no short-box flag; RTVs at step 9 with no holds for MIM_SHOP and for ETAX_CONSIGN; an RTV whose only hold is `WAIT_RTV_NOTE`; one with `WAIT_BRAND_QTY`. MIM and TK values are unique across the seed.
- `store.ts` uses key `one-rtv.data.v1`. If localStorage throws, is empty, or does not parse to an array, return `buildSeed(new Date())` and keep working in memory.
- `searchByAnyNumber`: trim, case-insensitive, substring match on RTV id, box numbers and every doc value; empty query → `[]`.
- New ids use `max existing sequence + 1`.

- [ ] **Step 1: Write the failing tests**

```ts
// seed.test.ts
const seed = buildSeed(new Date('2026-11-12T03:00:00Z'));
test('size and coverage', () => {
  expect(seed.length).toBeGreaterThanOrEqual(38);
  for (const s of [1,2,3,4,5,6,7,8,9,10]) expect(seed.some(r => r.step === s && !r.cancelled)).toBe(true);
  for (const h of ['WAIT_BRAND_QTY','WAIT_RTV_NOTE','WAIT_PROMO']) expect(seed.some(r => holds(r).includes(h as Hold))).toBe(true);
  for (const c of ['CONSIGN','SHOP','TEMP_SHOP','LOCAL_MALL']) expect(seed.filter(r => r.channel === c).length).toBeGreaterThanOrEqual(3);
  expect(seed.some(r => r.shortBoxes > 0)).toBe(true);
  expect(seed.some(r => r.cancelled)).toBe(true);
  expect(seed.some(r => r.events.some(e => e.kind === 'PICKUP_FAILED'))).toBe(true);
});
test('ids are unique and well-formed; events are in time order', () => {
  expect(new Set(seed.map(r => r.id)).size).toBe(seed.length);
  for (const r of seed) {
    expect(r.id).toMatch(/^RTV-CMG-\d{4}-\d{5}$/);
    expect(r.events.map(e => e.at)).toEqual([...r.events.map(e => e.at)].sort());
  }
});
// api/index.test.ts  (beforeEach: localStorage.clear(); await resetData())
test('search by any number, loosely typed', async () => {
  const r = (await listRtvs()).find(x => x.docs.some(d => d.type === 'TK'))!;
  const tk = r.docs.find(d => d.type === 'TK')!.value;
  expect((await searchByAnyNumber(`  ${tk.toLowerCase()} `)).map(x => x.id)).toContain(r.id);
  expect((await searchByAnyNumber(r.id.slice(8))).map(x => x.id)).toContain(r.id);
  expect(await searchByAnyNumber('   ')).toEqual([]);
});
test('create then act persists', async () => {
  const r = await createRtv(shopInput, { role: 'BRAND', actor: 'a' });
  await act(r.id, { type: 'advance', payload: { step: 2, carrier: 'PLAZA_4W', pickupDate: '2026-11-13' } }, { role: 'CS', actor: 'b' });
  expect((await getRtv(r.id))!.step).toBe(2);
});
test('act surfaces FlowError and leaves data unchanged', async () => {
  const r = (await listRtvs()).find(x => x.step === 1 && !x.cancelled)!;
  await expect(act(r.id, { type: 'advance', payload: { step: 4 } }, { role: 'CARRIER', actor: 'c' })).rejects.toThrow(FlowError);
  expect((await getRtv(r.id))!.step).toBe(1);
});
test('corrupt or unavailable storage falls back to seed', async () => {
  localStorage.setItem('one-rtv.data.v1', '{not json');
  expect((await listRtvs()).length).toBeGreaterThanOrEqual(38);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
  expect((await listRtvs()).length).toBeGreaterThanOrEqual(38);
});
test('unknown id returns null', async () => expect(await getRtv('RTV-CMG-0000-00000')).toBeNull());
```

- [ ] **Step 2:** Run `npm test -- seed api` — expect FAIL.
- [ ] **Step 3:** Implement masters, seed, store and api.
- [ ] **Step 4:** Run tests — expect PASS.
- [ ] **Step 5:** Commit `feat: mock data and API layer`.

---

### Task 5: RTV list, detail and search (read-only views)

**Files:**
- Create: `src/state/useRtvs.ts`, `src/components/StatusBar.tsx`, `Timeline.tsx`, `DocRefTable.tsx`, `BoxList.tsx`, `HoldBanner.tsx`, `src/pages/RtvList.tsx`, `src/pages/RtvDetail.tsx`
- Modify: `src/components/TopBar.tsx` (search behaviour), `src/App.tsx` (routes)
- Test: `src/pages/RtvDetail.test.tsx`, `src/pages/RtvList.test.tsx`

**Interfaces:**
- Consumes: api (Task 4), rules (Task 2), session (Task 1).
- Produces: `useRtv(id): { rtv: Rtv | null | undefined; refresh(): void }` (`undefined` = loading), `useRtvList(): { rtvs: Rtv[]; refresh(): void }`; `<RtvDetail>` renders `<div data-testid="actions" />` where Task 6 mounts the action panel; `renderAt(path, role?)` test helper in `src/testing.tsx` (wraps in `MemoryRouter` + `SessionProvider`).

Decisions:
- Detail header: RTV id in the largest type on the page (class `.rtv-id`, Kanit, mono digits), badges for channel, Normal/Promotion, CN type, and `ค้างที่: <role label>` from `owner()`.
- `StatusBar`: 10 segments from `stepsFor`; done = brand red, current = outlined red, skipped = faded with strikethrough label and `aria-label` ending `(ข้าม)`, auto = label suffix `(อัตโนมัติ)`.
- `Timeline`: newest first; each row `fmtDateTime` · role label · actor · text; non-STEP events use a warning colour.
- `DocRefTable`: one row per `DocType` relevant to this RTV's CN type plus any doc present; empty value shows `—`.
- `RtvList` filters: status (step), channel, brand, checkbox `ค้างที่ฉัน` (= `owner(rtv) === role`; BRAND role additionally restricted to `DEMO_BRAND_ID`; CARRIER restricted to `carrierActor`). Columns: เลข RTV, แบรนด์, สาขา, ช่องทาง, สถานะ, ค้างที่, อายุงาน (วัน).
- TopBar search: on Enter, 1 match → navigate to its detail; several → list page with `?q=`; none → inline `ไม่พบเลขนี้`.

- [ ] **Step 1: Write the failing tests**

```tsx
test('detail shows the One RTV number, 10 steps and the mall label', async () => {
  const r = await seeded(x => x.channel === 'CONSIGN' && x.step >= 6);
  renderAt(`/rtv/${r.id}`);
  expect(await screen.findByRole('heading', { name: r.id })).toBeInTheDocument();
  expect(screen.getAllByTestId('status-step')).toHaveLength(10);
  expect(screen.getByLabelText(/ออกใบแจ้งเก็บแล้ว \(ข้าม\)/)).toBeInTheDocument();
  expect(screen.getByText('RTV Note (ห้าง)')).toBeInTheDocument();
});
test('unknown id shows a friendly message', async () => {
  renderAt('/rtv/RTV-CMG-0000-00000');
  expect(await screen.findByText('ไม่พบเลข RTV นี้')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'กลับไปหน้ารายการ' })).toBeInTheDocument();
});
test('viewer sees no action buttons', async () => {
  const r = await seeded(x => x.step === 1);
  renderAt(`/rtv/${r.id}`, 'VIEWER');
  await screen.findByRole('heading', { name: r.id });
  expect(within(screen.getByTestId('actions')).queryByRole('button')).toBeNull();
});
test('"ค้างที่ฉัน" narrows the list to the current role', async () => {
  renderAt('/', 'ADMIN_CN');
  await userEvent.click(await screen.findByLabelText('ค้างที่ฉัน'));
  const rows = screen.getAllByTestId('rtv-row');
  rows.forEach(row => expect(within(row).getByTestId('owner')).toHaveTextContent('Admin CN'));
});
test('search with one match opens its detail', async () => {
  const r = await seeded(x => x.docs.some(d => d.type === 'MIM'));
  renderAt('/');
  await userEvent.type(screen.getByPlaceholderText('ค้นหาเลข RTV / MIM / TK / CN'), r.docs.find(d => d.type === 'MIM')!.value + '{Enter}');
  expect(await screen.findByRole('heading', { name: r.id })).toBeInTheDocument();
});
```

`seeded(pred)` (in `src/testing.tsx`) resets data and returns the first seeded RTV matching the predicate. If MIM values in the seed are not unique, make them unique in `seed.ts`.

- [ ] **Step 2:** Run tests — expect FAIL.
- [ ] **Step 3:** Implement hooks, components and pages.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck` — expect PASS. In `npm run dev`, open a consign and a shop RTV and confirm the status bar and timeline read correctly.
- [ ] **Step 5:** Commit `feat: RTV list, detail timeline and one-number search`.

---

### Task 6: Brand and CS screens

**Files:**
- Create: `src/components/ActionPanel.tsx`, `src/pages/NewRtv.tsx`, `src/pages/PickupSlip.tsx`
- Modify: `src/pages/RtvDetail.tsx` (mount ActionPanel), `src/pages/RtvList.tsx` (BRAND sees `+ เปิดคำสั่งแจ้งเก็บ`)
- Test: `src/pages/NewRtv.test.tsx`, `src/components/ActionPanel.cs.test.tsx`

**Interfaces:**
- Consumes: api, rules, session, `useRtv`.
- Produces: `<ActionPanel rtv={rtv} onDone={refresh} />` — renders the form for `nextStep(rtv)` when `owner(rtv) === role`, plus secondary actions for that role; shows `FlowError.message` in `.error` under the form. Every primary button carries `data-tour="primary"`. Tasks 7 and 8 add the remaining step forms to this component.

Decisions:
- `NewRtv` (BRAND only; other roles see `เฉพาะ Brand / ฝ่ายขาย`): store select → channel filled read-only from the store; brand fixed to `DEMO_BRAND_ID`; Normal/Promotion radio; box rows (`จำนวนชิ้นตามเอกสาร` per box, add/remove, min 1 box); optional MIM, SD10, and `RTV Note (ห้าง)` shown only for CONSIGN / LOCAL_MALL. Submit `เปิดคำสั่งและออกเลข RTV` → navigates to the new detail page.
- CS step 2 form: carrier radios from `allowedCarriers`, `วันนัดเก็บ` date, `เลขพัสดุ` shown and required only for PARCEL. Button `ยืนยันจัดขนส่ง`.
- CS step 3: button `ออกใบแจ้งเก็บ`; afterwards a link `พิมพ์ใบแจ้งเก็บ` → `/slip/:id`.
- `PickupSlip`: print layout with the CMG logo, slip number, RTV id as text and as QR (`qrcode.react`, value = RTV id), store, brand, carrier, pickup date, box list, signature lines for ร้าน / ขนส่ง / คลัง. `@media print` hides the top bar.
- Secondary actions: BRAND and CS `ยกเลิกคำสั่ง` (reason required) while `step < 5`; CS `ปิดธงกล่องขาด` (note required) when `shortBoxes > 0`; BRAND `เพิ่มเลขเอกสาร` (MIM / SD10 / RTV Note (ห้าง)).
- For PARCEL, CS also gets steps 4 and 5 (`บันทึกว่าขนส่งรับงานแล้ว`, `บันทึกว่าเก็บสินค้าแล้ว` + box count) — same forms Task 7 builds for the carrier; build them here as `<PickupForms>` inside `ActionPanel.tsx` so Task 7 reuses them.

- [ ] **Step 1: Write the failing tests**

```tsx
test('brand opens a consign order and gets a number at step 2 (auto)', async () => {
  renderAt('/new', 'BRAND');
  await userEvent.selectOptions(await screen.findByLabelText('สาขา'), consignStore.id);
  expect(screen.getByLabelText('ช่องทาง')).toHaveValue('Consign');
  expect(screen.getByLabelText('RTV Note (ห้าง)')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('กล่อง 1: จำนวนชิ้นตามเอกสาร'), '10');
  await userEvent.click(screen.getByRole('button', { name: 'เปิดคำสั่งและออกเลข RTV' }));
  expect(await screen.findByRole('heading', { name: /^RTV-CMG-\d{4}-\d{5}$/ })).toBeInTheDocument();
  expect(screen.getByText(/อัตโนมัติ: เข้ารอบรถ CG Network/)).toBeInTheDocument();
});
test('a box with no piece count is refused', async () => {
  renderAt('/new', 'BRAND');
  await userEvent.selectOptions(await screen.findByLabelText('สาขา'), shopStore.id);
  await userEvent.click(screen.getByRole('button', { name: 'เปิดคำสั่งและออกเลข RTV' }));
  expect(screen.getByText('กรอกจำนวนชิ้นของทุกกล่อง (ตัวเลขมากกว่า 0)')).toBeInTheDocument();
});
test('non-brand roles cannot open an order', async () => {
  renderAt('/new', 'WH');
  expect(await screen.findByText('เฉพาะ Brand / ฝ่ายขาย')).toBeInTheDocument();
});
test('CS assigns parcel only with a tracking number, and no slip step follows', async () => {
  const r = await seeded(x => x.channel === 'SHOP' && x.step === 1 && !x.cancelled);
  renderAt(`/rtv/${r.id}`, 'CS');
  await userEvent.click(await screen.findByLabelText('Parcel'));
  await userEvent.type(screen.getByLabelText('วันนัดเก็บ'), '2026-11-20');
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันจัดขนส่ง' }));
  expect(await screen.findByText(/เลขพัสดุ/, { selector: '.error' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('เลขพัสดุ'), 'KEX123');
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันจัดขนส่ง' }));
  expect(await screen.findByRole('button', { name: 'บันทึกว่าขนส่งรับงานแล้ว' })).toBeInTheDocument();
});
test('CS issues a slip for 4W Plaza and can open the printable slip', async () => {
  const r = await seeded(x => x.carrier === 'PLAZA_4W' && x.step === 2);
  renderAt(`/rtv/${r.id}`, 'CS');
  await userEvent.click(await screen.findByRole('button', { name: 'ออกใบแจ้งเก็บ' }));
  expect(await screen.findByRole('link', { name: 'พิมพ์ใบแจ้งเก็บ' })).toHaveAttribute('href', expect.stringContaining(`/slip/${r.id}`));
});
test('action panel disappears when the role changes', async () => {
  const r = await seeded(x => x.step === 1 && x.channel === 'SHOP' && !x.cancelled);
  renderAt(`/rtv/${r.id}`, 'CS');
  await screen.findByRole('button', { name: 'ยืนยันจัดขนส่ง' });
  await userEvent.selectOptions(screen.getByLabelText('บทบาท'), 'WH');
  expect(screen.queryByRole('button', { name: 'ยืนยันจัดขนส่ง' })).toBeNull();
});
```

- [ ] **Step 2:** Run tests — expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck` — expect PASS. In the browser, print-preview a slip and confirm it fits one A4 page with a scannable QR.
- [ ] **Step 5:** Commit `feat: brand order form, CS dispatch and pickup slip`.

---

### Task 7: Carrier (mobile), SCDC and CMG warehouse screens

**Files:**
- Create: `src/components/PhoneFrame.tsx`, `src/pages/CarrierJobs.tsx`
- Modify: `src/components/ActionPanel.tsx` (steps 4–9 forms, failPickup)
- Test: `src/pages/CarrierJobs.test.tsx`, `src/components/ActionPanel.wh.test.tsx`

**Interfaces:**
- Consumes: `<PickupForms>` and `ActionPanel` from Task 6.
- Produces: route `/carrier` (carrier job list inside `<PhoneFrame>`); `/rtv/:id` rendered inside `<PhoneFrame>` when role is CARRIER.

Decisions:
- `PhoneFrame`: 390 px wide centred frame with rounded border, content uses theme class `.mobile`; primary buttons use `.btn-block` in a `.bottom-bar`.
- `CarrierJobs`: RTVs where `owner === 'CARRIER'` and `rtv.carrier === carrierActor`, grouped `รอรับงาน` (next step 4) and `รอเก็บสินค้า` (next step 5). A toggle switches `carrierActor` between `4W Plaza` and `CG Network`. Each card shows RTV id, store, boxes, pickup date.
- Step 4 button `รับงาน`. Step 5: `จำนวนกล่องที่เก็บได้` (default = all) + `เก็บสินค้าแล้ว`; secondary `เก็บไม่สำเร็จ` opens reason choices `ร้านปิด`, `ของยังไม่พร้อม`, `ไม่พบผู้ส่งมอบ`, `อื่นๆ` (free text required for อื่นๆ).
- SCDC step 6: `จำนวนกล่องที่รับ` + `รับเข้า SCDC`; step 7: `ส่งต่อ CMG`.
- WH step 8: `จำนวนกล่องที่รับ` + `รับสินค้าเข้า CMG`; step 9: `เลข TK` + one `จำนวนชิ้นที่นับได้` input per box showing the expected count beside it + `ยืนยันผลตรวจนับ`. A row whose count differs is highlighted before submit.
- When a received count is lower than expected, show a confirm line `กล่องขาด N กล่อง — ระบบจะแจ้ง CS และ Brand` before submitting.

- [ ] **Step 1: Write the failing tests**

```tsx
test('carrier sees only their carrier\'s jobs and can switch', async () => {
  renderAt('/carrier', 'CARRIER');
  const cards = await screen.findAllByTestId('job-card');
  cards.forEach(c => expect(c).toHaveTextContent('4W Plaza'));
  await userEvent.click(screen.getByRole('button', { name: 'CG Network' }));
  (await screen.findAllByTestId('job-card')).forEach(c => expect(c).toHaveTextContent('CG Network'));
});
test('failed pickup with a reason goes back to CS', async () => {
  const r = await seeded(x => x.carrier === 'PLAZA_4W' && x.step === 4);
  renderAt(`/rtv/${r.id}`, 'CARRIER');
  await userEvent.click(await screen.findByRole('button', { name: 'เก็บไม่สำเร็จ' }));
  await userEvent.click(screen.getByLabelText('ร้านปิด'));
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันเก็บไม่สำเร็จ' }));
  expect(await screen.findByText(/ค้างที่: CS คลัง/)).toBeInTheDocument();
  expect(screen.getByText(/เก็บไม่สำเร็จ: ร้านปิด/)).toBeInTheDocument();
});
test('warehouse receiving fewer boxes raises the short-box flag', async () => {
  const r = await seeded(x => x.carrier === 'PLAZA_4W' && x.step === 5 && x.boxes.length >= 2);
  renderAt(`/rtv/${r.id}`, 'WH');
  const input = await screen.findByLabelText('จำนวนกล่องที่รับ');
  await userEvent.clear(input); await userEvent.type(input, String(r.boxes.length - 1));
  expect(screen.getByText(/กล่องขาด 1 กล่อง/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'รับสินค้าเข้า CMG' }));
  expect(await screen.findByText('กล่องขาด 1 กล่อง', { selector: '.badge' })).toBeInTheDocument();
});
test('count mismatch puts the RTV on hold for Brand', async () => {
  const r = await seeded(x => x.step === 8 && x.shortBoxes === 0);
  renderAt(`/rtv/${r.id}`, 'WH');
  await userEvent.type(await screen.findByLabelText('เลข TK'), 'TK777');
  for (const [i, b] of r.boxes.entries())
    await userEvent.type(screen.getByLabelText(`${b.no}: จำนวนชิ้นที่นับได้`), String(i === 0 ? b.expectedPcs - 1 : b.expectedPcs));
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันผลตรวจนับ' }));
  expect(await screen.findByText('รอ Brand ยืนยันยอด')).toBeInTheDocument();
});
test('non-numeric box count shows the Thai error and changes nothing', async () => {
  const r = await seeded(x => x.step === 5 && x.carrier === 'PLAZA_4W');
  renderAt(`/rtv/${r.id}`, 'WH');
  const input = await screen.findByLabelText('จำนวนกล่องที่รับ');
  await userEvent.clear(input);
  await userEvent.click(screen.getByRole('button', { name: 'รับสินค้าเข้า CMG' }));
  expect(await screen.findByText(/จำนวนกล่อง/, { selector: '.error' })).toBeInTheDocument();
  expect((await getRtv(r.id))!.step).toBe(5);
});
```

- [ ] **Step 2:** Run tests — expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck` — expect PASS. In the browser as ขนส่ง, confirm the phone frame and large buttons.
- [ ] **Step 5:** Commit `feat: carrier mobile, SCDC and warehouse receiving`.

---

### Task 8: Admin CN and Brand holds

**Files:**
- Modify: `src/components/ActionPanel.tsx` (step 10 form, hold actions), `src/components/HoldBanner.tsx`, `src/pages/RtvList.tsx` (ADMIN_CN grouping)
- Test: `src/components/ActionPanel.cn.test.tsx`

**Interfaces:**
- Consumes: `requiredDocs`, `holds`, api.
- Produces: complete `ActionPanel` covering all 10 steps and all exception actions.

Decisions:
- `HoldBanner` at the top of the detail page lists each active hold with who must act (always Brand / ฝ่ายขาย) and how long it has been waiting (days since the step-9 event).
- BRAND actions at step 9: for `WAIT_BRAND_QTY`, a table expected vs counted per box and buttons `ยืนยันตามยอดที่คลังนับ` / `ขอให้นับใหม่`; for `WAIT_RTV_NOTE`, input `RTV Note (ห้าง)` + `บันทึกเลข`; for `WAIT_PROMO`, `ยืนยันยอด Promotion`.
- ADMIN_CN step 10: heading `ออก CN — <CN label>`; read-only checklist of `before` docs (✓ / ขาด); one input per `atCn` doc labelled from `DOC_LABELS`; button `ออก CN และปิดงาน`, disabled with the reason listed while any hold is active. On success the page shows `ปิดงานแล้ว` and the CN number.
- `RtvList` for ADMIN_CN with `ค้างที่ฉัน` on groups rows under the four CN type headings.

- [ ] **Step 1: Write the failing tests**

```tsx
test('E-tax Consign asks for exactly its CN documents', async () => {
  const r = await seeded(x => x.step === 9 && cnType(x.channel, x.saleType) === 'ETAX_CONSIGN' && holds(x).length === 0);
  renderAt(`/rtv/${r.id}`, 'ADMIN_CN');
  expect(await screen.findByRole('heading', { name: 'ออก CN — E-tax Consign' })).toBeInTheDocument();
  for (const l of ['Sale Return', 'Delivery', 'CN']) expect(screen.getByLabelText(l)).toBeInTheDocument();
  expect(screen.queryByLabelText('Matdoc')).toBeNull();
});
test('CN is blocked while waiting for the mall note, then released by Brand', async () => {
  const r = await seeded(x => holds(x).length === 1 && holds(x)[0] === 'WAIT_RTV_NOTE');
  const view = renderAt(`/rtv/${r.id}`, 'ADMIN_CN');
  expect(await screen.findByRole('button', { name: 'ออก CN และปิดงาน' })).toBeDisabled();
  expect(screen.getByText('รอ RTV Note')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('บทบาท'), 'BRAND');
  await userEvent.type(await screen.findByLabelText('RTV Note (ห้าง)'), 'RN-889900');
  await userEvent.click(screen.getByRole('button', { name: 'บันทึกเลข' }));
  await userEvent.selectOptions(screen.getByLabelText('บทบาท'), 'ADMIN_CN');
  expect(await screen.findByRole('button', { name: 'ออก CN และปิดงาน' })).toBeEnabled();
});
test('closing shows the CN number and no further actions', async () => {
  const r = await seeded(x => x.step === 9 && cnType(x.channel, x.saleType) === 'MIM_SHOP' && holds(x).length === 0);
  renderAt(`/rtv/${r.id}`, 'ADMIN_CN');
  await userEvent.type(await screen.findByLabelText('Matdoc'), '5250009999');
  await userEvent.click(screen.getByRole('button', { name: 'ออก CN และปิดงาน' }));
  expect(await screen.findByText('ปิดงานแล้ว')).toBeInTheDocument();
  expect(within(screen.getByTestId('actions')).queryByRole('button')).toBeNull();
});
test('Brand can ask for a recount', async () => {
  const r = await seeded(x => holds(x).includes('WAIT_BRAND_QTY'));
  renderAt(`/rtv/${r.id}`, 'BRAND');
  await userEvent.click(await screen.findByRole('button', { name: 'ขอให้นับใหม่' }));
  expect(await screen.findByText(/ค้างที่: คลัง CMG/)).toBeInTheDocument();
});
```

Seed note: the BRAND role only acts on `DEMO_BRAND_ID`; make sure the seeded hold cases belong to that brand (adjust `seed.ts` if not).

- [ ] **Step 2:** Run tests — expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck` — expect PASS.
- [ ] **Step 5:** Commit `feat: CN issuing by flow type and brand confirmations`.

---

### Task 9: Guided tour (Demo นำชม)

**Files:**
- Create: `src/tour/stories.ts`, `src/tour/runner.ts`, `src/pages/Tour.tsx`, `src/components/TourOverlay.tsx`
- Modify: `src/App.tsx` (mount overlay), `src/styles/demo.css`
- Test: `src/tour/runner.test.ts`, `src/pages/Tour.test.tsx`

**Interfaces:**
- Consumes: api (`createRtv`, `act`, `putRtv`, `getRtv`), session.
- Produces:

```ts
export interface TourStep { role: Role; title: string; narration: string;       // Thai, ≤ 2 sentences
  route: (rtvId: string) => string;                                            // screen to show
  run: (rtvId: string, ctx: { role: Role; actor: string }) => Promise<void> }  // what "ถัดไป" performs
export interface Story { id: 'shop' | 'consign' | 'temp-promo' | 'failed-pickup'; title: string; summary: string;
  create: NewRtvInput; steps: TourStep[] }
export const STORIES: Story[];
// runner.ts
export interface TourState { storyId: Story['id']; rtvId: string; index: number; snapshots: Rtv[] } // snapshots[i] = RTV before step i
export function startStory(id: Story['id']): Promise<TourState>;
export function next(s: TourState): Promise<TourState>;     // runs steps[index].run, then index+1
export function back(s: TourState): Promise<TourState>;     // putRtv(snapshots[index-1]), index-1
export function isFinished(s: TourState): boolean;
```

Decisions:
- Stories follow §7 exactly. Step counts: shop 7 (CS assign, CS slip, carrier accept, carrier collect, WH receive, WH count, CN) · consign 9 (carrier accept, collect, SCDC in, SCDC out, WH receive, WH count with −1 piece, Brand confirms quantity, Brand adds RTV Note (ห้าง), CN) · temp-promo 9 (CS assign Parcel, CS records accept, CS records collect, SCDC in, SCDC out, WH receive, WH count, Brand confirms Promotion, CN) · failed-pickup 8 (CS assign 4W Plaza, CS slip, carrier accept, carrier fails `ร้านปิด`, CS re-assign with a new date, CS confirms the slip again — narration says the same slip number is reused, carrier accept, carrier collect; the story ends at step 5).
- The consign story's `create` omits RTV_NOTE so the hold appears. The shop and temp-promo stories' `create` include a MIM doc (required before CN).
- Before a CARRIER step the overlay also calls `setCarrierActor(rtv.carrier)` so the job is visible. Each story's RTV is created by `startStory` as the BRAND role; the first screen shown is its detail page with narration "Brand เปิดคำสั่งแล้ว ระบบออกเลข …".
- `/tour` lists the 4 stories as cards with `เริ่ม`. While a tour runs, `TourOverlay` is a fixed side panel (right, 320 px; bottom sheet under 900 px): story title, `ขั้น n / N`, role badge, narration, buttons `ย้อนกลับ`, `ถัดไป`, `เริ่มใหม่`, `ออกจาก Demo`. Before each step it calls `setRole(step.role)`, navigates to `step.route`, and adds class `.tour-highlight` (pulsing red outline) to the element with `data-tour="primary"`.
- `ถัดไป` performs the action through `run` (same API call the button makes) — the presenter does not need to fill the form. Clicking the real button instead is allowed; the overlay then detects the RTV's step changed and advances.
- Tour state lives in `sessionStorage` key `one-rtv.tour`. Finishing shows `จบเรื่องนี้แล้ว` with links to the RTV's timeline and back to the story list.

- [ ] **Step 1: Write the failing tests**

```ts
// runner.test.ts
test.each(STORIES.map(s => [s.id, s.steps.length]))('story %s runs to the end', async (id) => {
  let s = await startStory(id as Story['id']);
  while (!isFinished(s)) s = await next(s);
  const r = (await getRtv(s.rtvId))!;
  expect(r.step).toBe(id === 'failed-pickup' ? 5 : 10);
});
test('every step is performed by the role it names', async () => {
  for (const story of STORIES) {
    let s = await startStory(story.id);
    for (const step of story.steps) {
      const before = (await getRtv(s.rtvId))!;
      expect(owner(before)).toBe(step.role);
      s = await next(s);
    }
  }
});
test('back restores the RTV exactly', async () => {
  let s = await startStory('shop');
  const before = await getRtv(s.rtvId);
  s = await next(s); s = await back(s);
  expect(await getRtv(s.rtvId)).toEqual(before);
  expect(s.index).toBe(0);
});
test('consign story passes through both brand holds', async () => {
  let s = await startStory('consign'); const seen = new Set<Hold>();
  while (!isFinished(s)) { s = await next(s); holds((await getRtv(s.rtvId))!).forEach(h => seen.add(h)); }
  expect([...seen].sort()).toEqual(['WAIT_BRAND_QTY', 'WAIT_RTV_NOTE']);
});
```

```tsx
// Tour.test.tsx
test('starting a story switches role and shows narration', async () => {
  renderAt('/tour');
  await userEvent.click((await screen.findAllByRole('button', { name: 'เริ่ม' }))[0]);
  expect(await screen.findByText(/ขั้น 1 \/ 7/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
  expect(await screen.findByText(/ขั้น 2 \/ 7/)).toBeInTheDocument();
  expect(screen.getByLabelText('บทบาท')).toHaveValue('CS');
});
```

- [ ] **Step 2:** Run tests — expect FAIL.
- [ ] **Step 3:** Implement stories, runner, overlay and page.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck` — expect PASS. Play all four stories in the browser end to end, including `ย้อนกลับ` and `เริ่มใหม่`.
- [ ] **Step 5:** Commit `feat: guided tour with four stories`.

---

### Task 10: Flow overview and detailed flow pages

**Files:**
- Create: `src/pages/FlowOverview.tsx`, `src/pages/FlowDetail.tsx`, `src/data/flowCopy.ts`
- Test: `src/pages/Flow.test.tsx`

**Interfaces:**
- Consumes: `stepsFor`, `STEP_LABELS`, `requiredDocs`, `cnType`, `STORIES`.
- Produces: `FLOW_COPY: Record<Step, { what: string; records: string[]; docs: DocType[]; screen: (rtvId: string) => string }>` — the Thai explanation for each step (`what` ≤ 2 sentences; `records` from §5.1's "บันทึกอะไร" column).

Decisions:
- `FlowOverview` (`/flow`): a swimlane grid, 7 role rows × 10 step columns, built from `stepsFor(channel, carrier)` for the scenario chosen in a selector with the five rows of §5.2's carrier table (Consign · CG Network / Shop · CG Network / Shop · 4W Plaza / Shop · Parcel / Local mall · ขนส่งตามตกลง). The cell for a step sits in its role's row; skipped steps are faded; auto steps are tagged `อัตโนมัติ`. Under the grid: a one-line route summary (e.g. `สาขา → SCDC → CMG`), the CN type for Normal and for Promotion, and a faded strip `ระยะถัดไป: Put away · Product select · ส่งกลับสาขา`. Clicking a cell opens a side card with `FLOW_COPY[step]`. Horizontal scroll inside the grid on narrow screens, never the page.
- `FlowDetail` (`/flow/detail`): the same scenario selector, then one card per non-skipped step in order: number, label, role, `what`, records, documents created, exceptions that can occur at this step (from §5.3), and a button `เปิดหน้าจอนี้ในแอป` that opens a seeded RTV currently waiting at that step for that scenario (fallback: any RTV waiting at that step) with the role switched to the step's role.
- Both pages link to `/tour` (`ดู Demo นำชม`).

- [ ] **Step 1: Write the failing tests**

```tsx
test('overview draws 10 steps and fades the skipped ones for 4W Plaza', async () => {
  renderAt('/flow');
  await userEvent.selectOptions(screen.getByLabelText('ประเภทการคืน'), 'SHOP:PLAZA_4W');
  expect(screen.getAllByTestId('flow-cell')).toHaveLength(10);
  expect(screen.getAllByTestId('flow-cell').filter(c => c.classList.contains('is-skipped'))).toHaveLength(2);
  expect(screen.getByText('สาขา → CMG')).toBeInTheDocument();
});
test('consign shows the automatic dispatch and the E-tax CN types', async () => {
  renderAt('/flow');
  await userEvent.selectOptions(screen.getByLabelText('ประเภทการคืน'), 'CONSIGN:CG_NETWORK');
  expect(screen.getByText('อัตโนมัติ')).toBeInTheDocument();
  expect(screen.getByText(/E-tax Consign/)).toBeInTheDocument();
  expect(screen.getByText(/E-tax Credit/)).toBeInTheDocument();
});
test('clicking a cell explains who does what', async () => {
  renderAt('/flow');
  await userEvent.click(screen.getAllByTestId('flow-cell')[4]);
  expect(await screen.findByRole('heading', { name: '5. เก็บสินค้าแล้ว' })).toBeInTheDocument();
});
test('"open this screen" lands on an RTV waiting at that step with the right role', async () => {
  renderAt('/flow/detail');
  const card = screen.getByTestId('flow-step-8');
  await userEvent.click(within(card).getByRole('button', { name: 'เปิดหน้าจอนี้ในแอป' }));
  expect(await screen.findByRole('button', { name: 'รับสินค้าเข้า CMG' })).toBeInTheDocument();
  expect(screen.getByLabelText('บทบาท')).toHaveValue('WH');
});
```

- [ ] **Step 2:** Run tests — expect FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm test` and `npm run typecheck` — expect PASS. Check both pages at 1366 px and 390 px widths.
- [ ] **Step 5:** Commit `feat: flow overview swimlane and detailed walkthrough`.

---

### Task 11: Dashboard, reset and handoff notes

**Files:**
- Create: `src/pages/Dashboard.tsx`, `src/domain/metrics.ts`, `README.md`
- Modify: `src/components/TopBar.tsx` (reset button)
- Test: `src/domain/metrics.test.ts`, `src/pages/Dashboard.test.tsx`

**Interfaces:**
- Consumes: `listRtvs`, `owner`, `holds`, `daysBetween`.
- Produces:

```ts
export interface Metrics {
  open: number; closed: number; cancelled: number;
  byStep: Record<Step, number>;                 // open RTVs by last completed step
  byOwner: { role: Role; count: number; oldestDays: number }[];   // open RTVs, sorted by count desc
  byHold: Record<Hold, { count: number; avgWaitDays: number }>;
  segments: { label: string; avgDays: number | null; n: number }[]; // เปิดคำสั่ง→เก็บ, เก็บ→CMG รับ, CMG รับ→CN
  shortBoxOpen: number;
}
export function computeMetrics(rtvs: Rtv[], now: string): Metrics;
```

Decisions:
- Segment times use the latest STEP event for steps 1, 5, 8, 10; an RTV counts in a segment only when both ends exist. `avgDays` is `null` when `n === 0` and renders as `—`.
- Dashboard layout: KPI tiles (งานเปิด, ปิดแล้ว, กล่องขาดที่ยังเปิด), a horizontal bar per step (plain CSS bars, brand red, value labelled), table `งานค้างตามผู้รับผิดชอบ` (role, count, oldest in days, link to the list filtered by that owner), table of the three holds with count and average wait, three segment tiles. No chart library.
- Reset: TopBar button `รีเซ็ตข้อมูล` → `confirm('ล้างข้อมูลที่ทดลองทำและกลับไปใช้ข้อมูลตั้งต้น?')` → `resetData()`, clear the tour state, go to `/`.
- `README.md` (Thai): what this is, `npm install` / `npm run dev` / `npm test` / `npm run build`, how to present (start at Flow → Demo นำชม → Dashboard), where the rules live (`src/domain/rules.ts`), how `src/api` maps to future REST endpoints (table: function → suggested method + path), and a pointer to spec §10 for the production stack proposal and §11 for open questions.

- [ ] **Step 1: Write the failing tests**

```ts
test('counts, owners and segments', () => {
  const now = '2026-11-12T03:00:00Z';
  const m = computeMetrics(buildSeed(new Date(now)), now);
  expect(m.open + m.closed + m.cancelled).toBe(buildSeed(new Date(now)).length);
  expect(Object.values(m.byStep).reduce((a, b) => a + b, 0)).toBe(m.open);
  expect(m.byOwner.reduce((a, o) => a + o.count, 0)).toBe(m.open);
  expect(m.byOwner.find(o => o.role === 'BRAND')!.count).toBeGreaterThanOrEqual(3);
  expect(m.segments.map(s => s.label)).toEqual(['เปิดคำสั่ง → เก็บ', 'เก็บ → CMG รับ', 'CMG รับ → CN']);
  m.segments.forEach(s => expect(s.avgDays).toBeGreaterThan(0));
});
test('no data gives nulls, not NaN', () => {
  const m = computeMetrics([], '2026-11-12T03:00:00Z');
  expect(m.segments.every(s => s.avgDays === null)).toBe(true);
  expect(m.byOwner).toEqual([]);
});
```

```tsx
test('dashboard shows who work is stuck with and reset restores the seed', async () => {
  renderAt('/dashboard', 'VIEWER');
  expect(await screen.findByRole('heading', { name: 'งานค้างตามผู้รับผิดชอบ' })).toBeInTheDocument();
  expect(screen.getByText('รอ RTV Note')).toBeInTheDocument();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const before = (await listRtvs()).length;
  await createRtv(shopInput, { role: 'BRAND', actor: 'a' });
  await userEvent.click(screen.getByRole('button', { name: 'รีเซ็ตข้อมูล' }));
  await waitFor(async () => expect((await listRtvs()).length).toBe(before));
});
```

- [ ] **Step 2:** Run tests — expect FAIL.
- [ ] **Step 3:** Implement metrics, dashboard, reset and README.
- [ ] **Step 4:** Run `npm test`, `npm run typecheck`, `npm run build` — all PASS. Open `dist/index.html` directly from the folder (file://) and confirm the list, a detail page, the tour and the dashboard work with no console errors.
- [ ] **Step 5:** Final pass against the spec's anti-goals (§2): a first-time viewer can start a tour from the home page in one click; the same RTV id is the headline on every role's screen; the mock-data banner is on every page.
- [ ] **Step 6:** Commit `feat: dashboard, data reset and README`.
