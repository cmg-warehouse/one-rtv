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
  const r = await seeded(x => x.boxes.length > 1 && x.boxes.every(b => !!b.mim));
  const mim = r.boxes[1].mim!; // any box's own MIM finds the RTV
  renderAt('/');
  await screen.findAllByTestId('rtv-row');
  await userEvent.type(screen.getByPlaceholderText('ค้นหาเลข RTV / MIM / TK / CN'), mim + '{Enter}');
  expect(await screen.findByRole('heading', { name: r.id }, { timeout: 5000 })).toBeInTheDocument();
});
test('search with several matches lists them under ?q=', async () => {
  await seeded(() => true);
  renderAt('/');
  await userEvent.type(screen.getByPlaceholderText('ค้นหาเลข RTV / MIM / TK / CN'), 'RTV-CMG{Enter}');
  expect(await screen.findByRole('heading', { name: 'ผลการค้นหา "RTV-CMG"' })).toBeInTheDocument();
  expect((await screen.findAllByTestId('rtv-row')).length).toBeGreaterThan(1);
});
test('"ยกเลิก" is its own status filter, and step filters leave cancelled orders out', async () => {
  const c = await seeded(x => !!x.cancelled);
  renderAt('/', 'CS');
  await screen.findAllByTestId('rtv-row');
  const status = screen.getByLabelText('สถานะ');
  await userEvent.selectOptions(status, 'CANCELLED');
  const rows = await screen.findAllByTestId('rtv-row');
  expect(rows.length).toBeGreaterThan(0);
  rows.forEach(row => expect(row).toHaveTextContent('ยกเลิก'));
  await userEvent.selectOptions(status, String(c.step));
  expect(screen.queryByText(c.id)).toBeNull();
});
test('rows show the opening date, newest first, and any column header sorts both ways', async () => {
  await seeded(() => true);
  renderAt('/', 'CS');
  await screen.findAllByTestId('rtv-row');
  const ages = () => screen.getAllByTestId('age').map(c => Number(c.textContent));
  const opened = screen.getAllByTestId('opened').map(c => c.textContent ?? '');
  expect(opened[0]).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  const ageHead = screen.getByRole('button', { name: /อายุงาน/ });
  await userEvent.click(ageHead);
  expect(ageHead.closest('th')).toHaveAttribute('aria-sort', 'ascending');
  const up = ages();
  expect(up).toEqual([...up].sort((a, b) => a - b));
  await userEvent.click(ageHead);
  expect(ageHead.closest('th')).toHaveAttribute('aria-sort', 'descending');
  const down = ages();
  expect(down).toEqual([...down].sort((a, b) => b - a));
});
test('"รอ Brand ยืนยันยอด" filters orders whose count did not match, and the row says what it waits for', async () => {
  const { holds } = await import('../domain/rules');
  const r = await seeded(x => holds(x).includes('WAIT_BRAND_QTY'));
  renderAt('/', 'CS');
  await screen.findAllByTestId('rtv-row');
  await userEvent.selectOptions(screen.getByLabelText('สถานะ'), 'HOLD:WAIT_BRAND_QTY');
  const rows = await screen.findAllByTestId('rtv-row');
  rows.forEach(row => expect(row).toHaveTextContent('รอ Brand ยืนยันยอด'));
  expect(rows.some(row => row.textContent!.includes(r.id))).toBe(true);
});
test('"กล่องขาด" shows orders with an open short-box flag, linked from ?status=SHORT', async () => {
  const r = await seeded(x => x.shortBoxes > 0 && !x.cancelled);
  renderAt('/?status=SHORT', 'CS');
  const rows = await screen.findAllByTestId('rtv-row');
  expect(screen.getByLabelText('สถานะ')).toHaveValue('SHORT');
  rows.forEach(row => expect(row).toHaveTextContent(/กล่องขาด \d/));
  expect(rows.some(row => row.textContent!.includes(r.id))).toBe(true);
});
