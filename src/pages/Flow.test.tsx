import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, test } from 'vitest';
import { resetData } from '../api';
import { renderAt } from '../testing';

beforeEach(async () => { localStorage.clear(); await resetData(); });

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
test('parcel puts steps 4-5 in the CS row, and detail hides skipped steps', async () => {
  renderAt('/flow/detail?s=SHOP:PARCEL');
  expect(screen.queryByTestId('flow-step-3')).not.toBeInTheDocument();
  expect(screen.getByTestId('flow-step-4')).toHaveTextContent('CS คลัง');
});
test('the two pages link to each other keeping the scenario', async () => {
  renderAt('/flow?s=SHOP:PLAZA_4W');
  expect(screen.getByRole('link', { name: /flow ละเอียด/i })).toHaveAttribute('href', '/flow/detail?s=SHOP%3APLAZA_4W');
  expect(screen.getByRole('link', { name: 'ดู Demo นำชม' })).toHaveAttribute('href', '/tour');
});
test('each role lane row carries its lane class', () => {
  const { container } = renderAt('/flow');
  for (const r of ['BRAND', 'CS', 'CARRIER', 'SCDC', 'WH', 'ADMIN_CN', 'VIEWER']) {
    expect(container.querySelector(`.flow-row.lane-${r}`)).not.toBeNull();
  }
});
test('promotion pickup flow: the coordinator lane opens it, the combined slip is automatic, SCDC depends on the brand', async () => {
  const { container } = renderAt('/flow?s=PROMO:SCDC');
  expect(container.querySelector('.flow-row.lane-PROMO')).not.toBeNull();
  expect(screen.getByText('แจ้งงานเก็บโปร')).toBeInTheDocument();
  expect(screen.getByText('ออกใบแจ้งเก็บรวม')).toBeInTheDocument();
  expect(screen.getByText('หน้างานโปร → SCDC คลองส่งน้ำ → CMG กม.20')).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('ประเภทการคืน'), 'PROMO:CMG');
  expect(screen.getByText('หน้างานโปร → CMG กม.20')).toBeInTheDocument();
  expect(screen.getAllByTestId('flow-cell').filter(c => c.classList.contains('is-skipped'))).toHaveLength(2);
});
test('the coordinator lane is hidden for ordinary returns', () => {
  const { container } = renderAt('/flow?s=SHOP:PLAZA_4W');
  expect(container.querySelector('.flow-row.lane-PROMO')).toBeNull();
});
