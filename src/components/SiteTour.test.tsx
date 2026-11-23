import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

test('the site tour starts with the live-system preview and walks every menu', async () => {
  window.location.hash = '#/';
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'แนะนำเว็บ' }));
  const dialog = await screen.findByRole('dialog');
  expect(within(dialog).getByRole('heading')).toHaveTextContent('เริ่มที่นี่: ดูแบบระบบจริง');
  await userEvent.click(within(dialog).getByRole('button', { name: 'ถัดไป' }));
  expect(within(screen.getByRole('dialog')).getByRole('heading')).toHaveTextContent('รายการ RTV');
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ย้อนกลับ' }));
  expect(within(screen.getByRole('dialog')).getByRole('heading')).toHaveTextContent('ดูแบบระบบจริง');
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'ข้าม' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('every tour step points at something on the top bar', async () => {
  window.location.hash = '#/';
  render(<App />);
  await userEvent.click(screen.getByRole('button', { name: 'แนะนำเว็บ' }));
  for (;;) {
    const dialog = screen.getByRole('dialog');
    expect(document.querySelector('.site-tour-spot')).not.toBeNull();
    const next = within(dialog).queryByRole('button', { name: 'ถัดไป' });
    if (!next) break;
    await userEvent.click(next);
  }
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'เสร็จสิ้น' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
