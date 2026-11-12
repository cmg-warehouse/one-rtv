import { screen, within } from '@testing-library/react';
import { BRANDS, DEMO_BRAND_ID } from '../data/masters';
import { holds, owner } from '../domain/rules';
import { renderAt, seeded } from '../testing';

test("Brand gets no actions on another brand's RTV at step 9 with a hold", async () => {
  const r = await seeded(x => x.step === 9 && holds(x).length > 0 && x.brandId !== DEMO_BRAND_ID);
  expect(owner(r)).toBe('BRAND');
  renderAt(`/rtv/${r.id}`, 'BRAND');
  await screen.findByRole('heading', { name: r.id });
  const actions = screen.getByTestId('actions');
  expect(within(actions).queryByRole('button')).toBeNull();
  expect(screen.queryByRole('heading', { name: /ออก CN/ })).toBeNull();
});

test("Brand cannot cancel or add documents on another brand's RTV", async () => {
  const r = await seeded(x => x.step < 5 && !x.cancelled && x.brandId !== DEMO_BRAND_ID);
  renderAt(`/rtv/${r.id}`, 'BRAND');
  await screen.findByRole('heading', { name: r.id });
  expect(screen.queryByRole('button', { name: 'ยกเลิกคำสั่ง' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'เพิ่มเลขเอกสาร' })).toBeNull();
});

test("Brand list shows only the demo brand's RTVs, with a note", async () => {
  await seeded(() => true);
  renderAt('/', 'BRAND');
  const rows = await screen.findAllByTestId('rtv-row');
  const name = BRANDS.find(b => b.id === DEMO_BRAND_ID)!.name;
  rows.forEach(row => expect(row).toHaveTextContent(name));
  expect(screen.getByText(`แสดงเฉพาะงานของ ${name}`)).toBeInTheDocument();
});

test('other roles still see every brand and no note', async () => {
  await seeded(() => true);
  renderAt('/', 'CS');
  const rows = await screen.findAllByTestId('rtv-row');
  expect(rows.some(row => !row.textContent!.includes(BRANDS[0].name))).toBe(true);
  expect(screen.queryByText(/แสดงเฉพาะงานของ/)).toBeNull();
});
