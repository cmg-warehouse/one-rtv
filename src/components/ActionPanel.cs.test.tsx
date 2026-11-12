import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ACTORS, DEMO_BRAND_ID } from '../data/masters';
import { renderAt, seeded } from '../testing';

test('CS assigns parcel only with a tracking number, and no slip step follows', async () => {
  const r = await seeded(x => x.channel === 'SHOP' && x.step === 1 && !x.cancelled);
  renderAt(`/rtv/${r.id}`, 'CS');
  await userEvent.click(await screen.findByLabelText('Parcel'));
  await userEvent.type(screen.getByLabelText('วันนัดเก็บ'), '2026-11-20');
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันจัดขนส่ง' }));
  expect(await screen.findByText(/เลขพัสดุ/, { selector: '.error' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('เลขพัสดุ'), 'KEX123');
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันจัดขนส่ง' }));
  expect(await screen.findByRole('button', { name: 'บันทึกว่าขนส่งรับงานแล้ว' })).toBeInTheDocument();
});

test('CS issues a slip for 4W Plaza and can open the printable slip', async () => {
  const r = await seeded(x => x.carrier === 'PLAZA_4W' && x.step === 2);
  renderAt(`/rtv/${r.id}`, 'CS');
  await userEvent.click(await screen.findByRole('button', { name: 'ออกใบแจ้งเก็บ' }));
  expect(await screen.findByRole('link', { name: 'พิมพ์ใบแจ้งเก็บ' })).toHaveAttribute('href', expect.stringContaining(`/slip/${r.id}`));
});

test('action panel disappears when the role changes', async () => {
  const r = await seeded(x => x.step === 1 && x.channel === 'SHOP' && !x.cancelled);
  renderAt(`/rtv/${r.id}`, 'CS');
  await screen.findByRole('button', { name: 'ยืนยันจัดขนส่ง' });
  await userEvent.selectOptions(screen.getByLabelText('บทบาท'), 'WH');
  expect(screen.queryByRole('button', { name: 'ยืนยันจัดขนส่ง' })).toBeNull();
});

test('cancel needs a reason, then cancels the order', async () => {
  const r = await seeded(x => x.step === 1 && x.channel === 'SHOP' && !x.cancelled);
  renderAt(`/rtv/${r.id}`, 'CS');
  await userEvent.click(await screen.findByRole('button', { name: 'ยกเลิกคำสั่ง' }));
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันยกเลิก' }));
  expect(await screen.findByText(/เหตุผล/, { selector: '.error' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('เหตุผลที่ยกเลิก'), 'ร้านแจ้งผิด');
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันยกเลิก' }));
  expect(await screen.findByText('ยกเลิก: ร้านแจ้งผิด', { selector: 'p.error' })).toBeInTheDocument();
});

test('CS can clear the short-box flag with a note', async () => {
  const r = await seeded(x => x.shortBoxes > 0 && !x.cancelled);
  renderAt(`/rtv/${r.id}`, 'CS');
  await userEvent.click(await screen.findByRole('button', { name: 'ปิดธงกล่องขาด' }));
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันปิดธง' }));
  expect(await screen.findByText(/หมายเหตุ/, { selector: '.error' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('หมายเหตุ'), 'พบกล่องแล้ว');
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันปิดธง' }));
  expect(await screen.findByText(/ปิดธงกล่องขาด: พบกล่องแล้ว/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'ปิดธงกล่องขาด' })).toBeNull();
});

test('brand can add a document number', async () => {
  const r = await seeded(x => x.step < 5 && !x.cancelled && x.brandId === DEMO_BRAND_ID);
  renderAt(`/rtv/${r.id}`, 'BRAND');
  await userEvent.click(await screen.findByRole('button', { name: 'เพิ่มเลขเอกสาร' }));
  await userEvent.selectOptions(screen.getByLabelText('ประเภทเอกสาร'), 'SD10');
  await userEvent.type(screen.getByLabelText('เลขเอกสาร'), 'SD10-TEST-1');
  await userEvent.click(screen.getByRole('button', { name: 'บันทึกเลขเอกสาร' }));
  expect(await screen.findByText(/เพิ่มเลขเอกสาร: SD10 \/ RTV Form: SD10-TEST-1/)).toBeInTheDocument();
});

test('hand-made timeline rows carry the named demo actor, like seeded ones', async () => {
  const r = await seeded(x => x.carrier === 'PLAZA_4W' && x.step === 2);
  renderAt(`/rtv/${r.id}`, 'CS');
  await userEvent.click(await screen.findByRole('button', { name: 'ออกใบแจ้งเก็บ' }));
  await screen.findByRole('link', { name: 'พิมพ์ใบแจ้งเก็บ' });
  expect(screen.getAllByText(ACTORS.CS).length).toBeGreaterThan(0);
});
