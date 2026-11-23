import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getRtv } from '../api';
import { renderAt, seeded } from '../testing';

test('carrier accepts the job with the carrier wording', async () => {
  const r = await seeded(x => x.carrier === 'PLAZA_4W' && x.step === 3);
  renderAt(`/rtv/${r.id}`, 'CARRIER');
  await userEvent.click(await screen.findByRole('button', { name: 'รับงาน' }));
  expect(await screen.findByRole('button', { name: 'เก็บสินค้าแล้ว' })).toBeInTheDocument();
});

test('failed pickup with a reason goes back to CS', async () => {
  const r = await seeded(x => x.carrier === 'PLAZA_4W' && x.step === 4);
  renderAt(`/rtv/${r.id}`, 'CARRIER');
  await userEvent.click(await screen.findByRole('button', { name: 'เก็บไม่สำเร็จ' }));
  await userEvent.click(screen.getByLabelText('ร้านปิด'));
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันเก็บไม่สำเร็จ' }));
  expect(await screen.findByText(/ค้างที่: CS คลัง/)).toBeInTheDocument();
  expect(screen.getByText(/เก็บไม่สำเร็จ: ร้านปิด/)).toBeInTheDocument();
});

test('failed pickup with "other" needs a free-text reason', async () => {
  const r = await seeded(x => x.carrier === 'PLAZA_4W' && x.step === 4);
  renderAt(`/rtv/${r.id}`, 'CARRIER');
  await userEvent.click(await screen.findByRole('button', { name: 'เก็บไม่สำเร็จ' }));
  await userEvent.click(screen.getByLabelText('อื่นๆ'));
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันเก็บไม่สำเร็จ' }));
  expect(await screen.findByText(/เหตุผล/, { selector: '.error' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('ระบุเหตุผล'), 'รถเสีย');
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันเก็บไม่สำเร็จ' }));
  expect(await screen.findByText(/เก็บไม่สำเร็จ: รถเสีย/)).toBeInTheDocument();
});

test('SCDC receives and forwards a CG Network job', async () => {
  const r = await seeded(x => x.carrier === 'CG_NETWORK' && x.step === 5);
  renderAt(`/rtv/${r.id}`, 'SCDC');
  await userEvent.click(await screen.findByRole('button', { name: 'รับเข้า SCDC' }));
  await userEvent.click(await screen.findByRole('button', { name: 'ส่งต่อ CMG' }));
  expect(await screen.findByText(/ค้างที่: คลัง CMG/)).toBeInTheDocument();
});

test('warehouse receiving fewer boxes raises the short-box flag', async () => {
  const r = await seeded(x => x.carrier === 'PLAZA_4W' && x.step === 5 && x.boxes.length >= 2);
  renderAt(`/rtv/${r.id}`, 'WH');
  const input = await screen.findByLabelText('จำนวนกล่องที่รับ');
  await userEvent.clear(input);
  await userEvent.type(input, String(r.boxes.length - 1));
  expect(screen.getByText(/กล่องขาด 1 กล่อง/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'รับสินค้าเข้า CMG' }));
  expect(await screen.findByText('กล่องขาด 1 กล่อง', { selector: '.badge' })).toBeInTheDocument();
});

test('count mismatch puts the RTV on hold for Brand', async () => {
  const r = await seeded(x => x.step === 8 && x.shortBoxes === 0);
  renderAt(`/rtv/${r.id}`, 'WH');
  await userEvent.type(await screen.findByLabelText('เลข TK'), 'TK777');
  for (const [i, b] of r.boxes.entries()) {
    await userEvent.type(screen.getByLabelText(`${b.no}: จำนวนชิ้นที่นับได้`), String(i === 0 ? b.expectedPcs - 1 : b.expectedPcs));
  }
  expect(screen.getAllByTestId('count-row')[0]).toHaveClass('count-diff');
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันผลตรวจนับ' }));
  expect(await screen.findByText('รอ Brand ยืนยันยอด')).toBeInTheDocument();
});

test('non-numeric box count shows the Thai error and changes nothing', async () => {
  const r = await seeded(x => x.step === 5 && x.carrier === 'PLAZA_4W');
  renderAt(`/rtv/${r.id}`, 'WH');
  const input = await screen.findByLabelText('จำนวนกล่องที่รับ');
  await userEvent.clear(input);
  await userEvent.click(screen.getByRole('button', { name: 'รับสินค้าเข้า CMG' }));
  expect(await screen.findByText(/จำนวนกล่อง/, { selector: '.error' })).toBeInTheDocument();
  expect((await getRtv(r.id))!.step).toBe(5);
});

test('on a consign order the reason form closes after a failed pickup is logged, so it cannot be logged twice', async () => {
  const r = await seeded(x => x.channel === 'CONSIGN' && x.step === 4 && !x.cancelled);
  renderAt('/carrier', 'CARRIER');
  await userEvent.click(await screen.findByRole('button', { name: 'GIC (CG Network)' }));
  await userEvent.click(await screen.findByRole('link', { name: r.id }));
  await userEvent.click(await screen.findByRole('button', { name: 'เก็บไม่สำเร็จ' }));
  await userEvent.click(screen.getByLabelText('ร้านปิด'));
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันเก็บไม่สำเร็จ' }));
  expect(await screen.findByText(/เก็บไม่สำเร็จ: ร้านปิด/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'ยืนยันเก็บไม่สำเร็จ' })).toBeNull();
  expect(screen.getByRole('button', { name: 'เก็บไม่สำเร็จ' })).toBeInTheDocument();
  const after = (await getRtv(r.id))!;
  expect(after.events.filter(e => e.kind === 'PICKUP_FAILED')).toHaveLength(1);
});
