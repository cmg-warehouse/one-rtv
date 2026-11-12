import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { listRtvs, resetData } from '../api';
import { renderAt, seeded } from '../testing';

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
test('header badges show owner, and hold banner uses the hold label', async () => {
  const r = await seeded(x => x.step === 9 && x.channel === 'CONSIGN' && !x.docs.some(d => d.type === 'RTV_NOTE') && !x.cancelled);
  renderAt(`/rtv/${r.id}`);
  await screen.findByRole('heading', { name: r.id });
  expect(screen.getByText('ค้างที่: Brand / ฝ่ายขาย')).toBeInTheDocument();
  expect(screen.getByText('รอ RTV Note')).toBeInTheDocument();
});
test('cancelled RTV shows cancelled badge and timeline reason', async () => {
  const r = await seeded(x => !!x.cancelled);
  renderAt(`/rtv/${r.id}`);
  await screen.findByRole('heading', { name: r.id });
  expect(screen.getByText('ยกเลิกแล้ว')).toBeInTheDocument();
  expect(screen.getAllByText(`ยกเลิก: ${r.cancelled!.reason}`).length).toBeGreaterThan(0);
});
test('timeline lists newest event first', async () => {
  const r = await seeded(x => x.step >= 3 && !x.cancelled);
  renderAt(`/rtv/${r.id}`);
  await screen.findByRole('heading', { name: r.id });
  const items = screen.getAllByRole('listitem').filter(li => li.closest('.timeline'));
  expect(items).toHaveLength(r.events.length);
  expect(items[0]).toHaveTextContent(r.events[r.events.length - 1].actor);
});
test('top-bar search with no match shows an inline message', async () => {
  renderAt('/');
  await userEvent.type(screen.getByPlaceholderText('ค้นหาเลข RTV / MIM / TK / CN'), 'ไม่มีเลขนี้99{Enter}');
  expect(await screen.findByText('ไม่พบเลขนี้')).toBeInTheDocument();
});
test('navigating between two RTVs resets the forms to the new RTV', async () => {
  await resetData();
  const step8 = (await listRtvs()).filter(r => r.step === 8 && !r.cancelled);
  const a = step8[0];
  const b = step8.find(r => r.boxes.length !== a.boxes.length)!;
  expect(b).toBeDefined();
  renderAt(`/rtv/${a.id}`, 'WH');
  await userEvent.type(await screen.findByLabelText('เลข TK'), 'TK-OLD');
  const countA = (await screen.findAllByTestId('count-row')).length;
  expect(countA).toBe(a.boxes.length);
  await userEvent.type(screen.getByPlaceholderText('ค้นหาเลข RTV / MIM / TK / CN'), `${b.id}{Enter}`);
  expect(await screen.findByRole('heading', { name: b.id })).toBeInTheDocument();
  expect(screen.getByLabelText('เลข TK')).toHaveValue('');
  const rows = screen.getAllByTestId('count-row');
  expect(rows).toHaveLength(b.boxes.length);
  rows.forEach(row => expect(within(row).getByRole('spinbutton')).toHaveValue(null));
});
