import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetData } from '../api';
import { renderAt } from '../testing';

beforeEach(async () => {
  sessionStorage.clear();
  await resetData();
});

test('a flow step opens a waiting RTV as that role, and the bar leads back to the same step', async () => {
  renderAt('/flow', 'CS');
  await userEvent.click(await screen.findByRole('button', { name: 'ลองทำขั้น 6 ใน demo' }));
  expect(screen.getByLabelText('บทบาท')).toHaveValue('SCDC');
  expect(await screen.findByRole('heading', { level: 1, name: /^RTV-CMG-/ })).toBeInTheDocument();
  expect(screen.getByText(/กำลังลองขั้น 6/)).toBeInTheDocument();

  await userEvent.click(screen.getByRole('link', { name: '← กลับไป Flow ภาพรวม' }));
  expect(await screen.findByRole('heading', { name: 'Flow ภาพรวม — ใครทำอะไร' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'รายละเอียดขั้นตอน' })).toHaveTextContent('6.');
  expect(screen.queryByText(/กำลังลองขั้น/)).toBeNull();
});

test('carrier and warehouse steps open the phone apps; skipped steps have no try button', async () => {
  renderAt('/flow?s=SHOP:PLAZA_4W');
  expect(await screen.findByRole('button', { name: 'ลองทำขั้น 4 ใน demo' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'ลองทำขั้น 6 ใน demo' })).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'ลองทำขั้น 8 ใน demo' }));
  expect(await screen.findByRole('region', { name: /แอปคลัง/ })).toBeInTheDocument();
  expect(screen.getByText(/กำลังลองขั้น 8/)).toBeInTheDocument();
});
