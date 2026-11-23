import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { nextStep } from '../domain/rules';
import { renderAt, seeded } from '../testing';

test('slip shows the slip number, RTV id and a print button', async () => {
  const r = await seeded(x => x.docs.some(d => d.type === 'PICKUP_SLIP'));
  renderAt(`/slip/${r.id}`);
  const slip = r.docs.find(d => d.type === 'PICKUP_SLIP')!.value;
  expect(await screen.findByText(slip)).toBeInTheDocument();
  expect(screen.getByText(r.id)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'พิมพ์' })).toBeInTheDocument();
});

test('slip page says so when no slip was issued', async () => {
  const r = await seeded(x => !x.docs.some(d => d.type === 'PICKUP_SLIP'));
  renderAt(`/slip/${r.id}`);
  expect(await screen.findByText('ยังไม่ได้ออกใบแจ้งเก็บ')).toBeInTheDocument();
});

test('the way back leads to this RTV and the slip is marked as a demo sample', async () => {
  const r = await seeded(x => x.docs.some(d => d.type === 'PICKUP_SLIP'));
  renderAt(`/slip/${r.id}`);
  expect(await screen.findByRole('link', { name: 'กลับไปหน้า RTV นี้' })).toHaveAttribute('href', `/rtv/${r.id}`);
  expect(screen.getByText('ตัวอย่างเพื่อการสาธิต')).toBeInTheDocument();
  expect(screen.getByText('ตัวอย่างเพื่อการสาธิต').closest('.no-print')).toBeNull();
});

test('tapping the QR opens a carrier phone beside the slip that scans it and shows the order', async () => {
  const r = await seeded(x => x.docs.some(d => d.type === 'PICKUP_SLIP') && nextStep(x)?.step === 4);
  renderAt(`/slip/${r.id}`);
  await userEvent.click(await screen.findByRole('button', { name: 'จำลองการสแกน QR ด้วยมือถือขนส่ง' }));
  const phone = await screen.findByRole('region', { name: 'มือถือขนส่งที่สแกน QR ใบนี้' });
  expect(await within(phone).findByText('ข้อมูลออเดอร์')).toBeInTheDocument();
  expect(within(phone).getByText(r.id)).toBeInTheDocument();
  expect(within(phone).getByRole('button', { name: 'รับงาน' })).toBeInTheDocument();
});
