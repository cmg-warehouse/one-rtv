import { screen } from '@testing-library/react';
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
