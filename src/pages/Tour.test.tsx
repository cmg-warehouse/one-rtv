import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveTour } from '../tour/runner';
import { renderAt } from '../testing';

beforeEach(() => saveTour(null));
afterEach(() => saveTour(null));

test('starting a story switches role and shows narration', async () => {
  renderAt('/tour');
  await userEvent.click((await screen.findAllByRole('button', { name: 'เริ่ม' }))[0]);
  expect(await screen.findByText(/ขั้น 1 \/ 7/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
  expect(await screen.findByText(/ขั้น 2 \/ 7/)).toBeInTheDocument();
  expect(screen.getByLabelText('บทบาท')).toHaveValue('CS');
});
test('lists five stories with their step counts', async () => {
  renderAt('/tour');
  expect(await screen.findAllByRole('button', { name: 'เริ่ม' })).toHaveLength(5);
  expect(screen.getByText(/^7 ขั้น/)).toBeInTheDocument();
});
test('back works, and the last step shows the finish panel as viewer', async () => {
  renderAt('/tour');
  await userEvent.click((await screen.findAllByRole('button', { name: 'เริ่ม' }))[3]);
  expect(await screen.findByText(/ขั้น 1 \/ 8/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
  await screen.findByText(/ขั้น 2 \/ 8/);
  await userEvent.click(screen.getByRole('button', { name: 'ย้อนกลับ' }));
  expect(await screen.findByText(/ขั้น 1 \/ 8/)).toBeInTheDocument();
  for (let i = 1; i <= 8; i++) {
    await userEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
    await screen.findByText(i < 8 ? new RegExp(`ขั้น ${i + 1} / 8`) : 'จบเรื่องนี้แล้ว');
  }
  expect(screen.getByLabelText('บทบาท')).toHaveValue('VIEWER');
  expect(screen.getByRole('link', { name: 'ดู timeline ของ RTV นี้' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('link', { name: 'กลับไปเลือกเรื่อง' }));
  expect(screen.queryByRole('button', { name: 'ถัดไป' })).toBeNull();
});
test('clicking the real button advances the tour without running the step', async () => {
  renderAt('/tour');
  await userEvent.click((await screen.findAllByRole('button', { name: 'เริ่ม' }))[0]);
  await screen.findByText(/ขั้น 1 \/ 7/);
  await userEvent.click(await screen.findByRole('radio', { name: 'งานสาย (Route) – 4W Plaza' }));
  await userEvent.type(screen.getByLabelText('วันนัดเก็บ'), '2026-12-01');
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันจัดขนส่ง' }));
  expect(await screen.findByText(/ขั้น 2 \/ 7/)).toBeInTheDocument();
});
test('the primary button gets the highlight class', async () => {
  renderAt('/tour');
  await userEvent.click((await screen.findAllByRole('button', { name: 'เริ่ม' }))[0]);
  const btn = await screen.findByRole('button', { name: 'ยืนยันจัดขนส่ง' });
  expect(btn).toHaveClass('tour-highlight');
});

test('the promotion pickup story walks the pickup pages, then follows the demo brand RTV', async () => {
  renderAt('/tour');
  await userEvent.click((await screen.findAllByRole('button', { name: 'เริ่ม' }))[4]);
  expect(await screen.findByText(/ขั้น 1 \/ 9/)).toBeInTheDocument();
  expect(screen.getByLabelText('บทบาท')).toHaveValue('CS');
  expect(await screen.findByRole('button', { name: 'ส่งต่อขนส่ง (งานจองรถ)' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'ถัดไป' }));
  expect(await screen.findByText(/ขั้น 2 \/ 9/)).toBeInTheDocument();
  expect(screen.getByLabelText('บทบาท')).toHaveValue('CARRIER');
  await userEvent.click(screen.getByRole('button', { name: 'ย้อนกลับ' }));
  expect(await screen.findByText(/ขั้น 1 \/ 9/)).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'ส่งต่อขนส่ง (งานจองรถ)' })).toBeInTheDocument();
});
