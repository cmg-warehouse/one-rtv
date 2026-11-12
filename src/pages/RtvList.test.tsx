import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderAt, seeded } from '../testing';

test('"ค้างที่ฉัน" narrows the list to the current role', async () => {
  renderAt('/', 'ADMIN_CN');
  await screen.findAllByTestId('rtv-row');
  await userEvent.click(screen.getByLabelText('ค้างที่ฉัน'));
  const rows = await screen.findAllByTestId('rtv-row');
  expect(rows.length).toBeGreaterThan(0);
  rows.forEach(row => expect(within(row).getByTestId('owner')).toHaveTextContent('Admin CN'));
});
test('viewer owns nothing', async () => {
  renderAt('/', 'VIEWER');
  await userEvent.click(await screen.findByLabelText('ค้างที่ฉัน'));
  expect(await screen.findByText('ไม่มีงานที่ค้างอยู่กับบทบาทนี้')).toBeInTheDocument();
});
test('search with one match opens its detail', async () => {
  const r = await seeded(x => x.docs.some(d => d.type === 'MIM'));
  renderAt('/');
  await userEvent.type(screen.getByPlaceholderText('ค้นหาเลข RTV / MIM / TK / CN'), r.docs.find(d => d.type === 'MIM')!.value + '{Enter}');
  expect(await screen.findByRole('heading', { name: r.id })).toBeInTheDocument();
});
test('search with several matches lists them under ?q=', async () => {
  await seeded(() => true);
  renderAt('/');
  await userEvent.type(screen.getByPlaceholderText('ค้นหาเลข RTV / MIM / TK / CN'), 'RTV-CMG{Enter}');
  expect(await screen.findByRole('heading', { name: 'ผลการค้นหา "RTV-CMG"' })).toBeInTheDocument();
  expect((await screen.findAllByTestId('rtv-row')).length).toBeGreaterThan(1);
});
