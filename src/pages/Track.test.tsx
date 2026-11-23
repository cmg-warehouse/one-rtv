import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetData } from '../api';
import { renderAt, seeded } from '../testing';

test('searching any document number opens the tracking view with milestones and box status', async () => {
  const rtv = await seeded(r => r.step === 9 && r.docs.some(d => d.type === 'TK') && !r.cancelled);
  const tk = rtv.docs.find(d => d.type === 'TK')!.value;
  renderAt('/track');
  await userEvent.type(screen.getByLabelText('เลขติดตาม'), tk);
  await userEvent.click(screen.getByRole('button', { name: 'ติดตาม' }));
  expect(await screen.findByRole('heading', { name: rtv.id })).toBeInTheDocument();
  const ms = screen.getAllByTestId('milestone');
  expect(ms).toHaveLength(7);
  expect(ms.filter(m => m.dataset.state === 'current')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'สถานะรายกล่อง' })).toBeInTheDocument();
});

test('the landing page lists RTVs on a truck right now', async () => {
  await resetData();
  renderAt('/track');
  expect(await screen.findByRole('heading', { name: 'กำลังขนส่งตอนนี้' })).toBeInTheDocument();
  expect((await screen.findAllByText(/กำลัง(ขนส่ง|ส่งต่อ)ไป/)).length).toBeGreaterThan(0);
});

test('the map page counts open RTVs by where the goods are', async () => {
  await resetData();
  renderAt('/map');
  expect(await screen.findByRole('img', { name: /แผนที่ประเทศไทย/ })).toBeInTheDocument();
  await userEvent.click(await screen.findByRole('button', { name: /^\d+\s*กำลังขนส่ง$/ }));
  expect(screen.getByRole('heading', { name: /^กำลังขนส่ง \(\d+\)$/ })).toBeInTheDocument();
});
