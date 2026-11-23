import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getRtv, resetData } from '../api';
import { nextStep } from '../domain/rules';
import { renderAt, seeded } from '../testing';

async function scanAllByHand(phone: HTMLElement, boxes: string[]) {
  await userEvent.click(within(phone).getByRole('button', { name: 'พิมพ์เลขเอง' }));
  for (const no of boxes) {
    await userEvent.type(within(phone).getByLabelText('พิมพ์เลข'), no.slice(-3));
    await userEvent.click(within(phone).getByRole('button', { name: 'ตกลง' }));
  }
}

function sign(phone: HTMLElement) {
  const pad = within(phone).getByLabelText('ช่องลายเซ็น');
  fireEvent.pointerDown(pad, { clientX: 5, clientY: 5 });
  fireEvent.pointerMove(pad, { clientX: 40, clientY: 30 });
  fireEvent.pointerUp(pad);
}

/** Scan-first: open an order by its pickup slip QR (typed by hand here). */
async function openBySlip(phone: HTMLElement, rtvId: string) {
  await userEvent.click(within(phone).getByRole('button', { name: /สแกน QR ใบแจ้งเก็บ/ }));
  await userEvent.click(within(phone).getByRole('button', { name: 'พิมพ์เลขเอง' }));
  await userEvent.type(within(phone).getByLabelText('พิมพ์เลข'), rtvId);
  await userEvent.click(within(phone).getByRole('button', { name: 'ตกลง' }));
}

test('carrier home lists no jobs in advance: the order appears only after scanning its slip', async () => {
  const rtv = await seeded(r => r.carrier === 'PLAZA_4W' && nextStep(r)?.step === 5);
  renderAt('/mobile');
  const phone = await screen.findByRole('region', { name: /แอปขนส่ง/ });
  expect(within(phone).queryAllByTestId('m-job')).toHaveLength(0);
  await openBySlip(phone, rtv.id);
  expect(await within(phone).findByText('ข้อมูลออเดอร์')).toBeInTheDocument();
  expect(within(phone).getByText(rtv.id)).toBeInTheDocument();
  expect(within(phone).getByText('งานสาย (Route) – 4W Plaza')).toBeInTheDocument();
});

test('the driver confirms by box count + photo + store signature (no box scanning) and the RTV is collected', async () => {
  const rtv = await seeded(r => r.carrier === 'PLAZA_4W' && nextStep(r)?.step === 5);
  renderAt('/mobile');
  const phone = await screen.findByRole('region', { name: /แอปขนส่ง/ });
  await openBySlip(phone, rtv.id);
  await userEvent.click(await within(phone).findByRole('button', { name: 'เก็บสินค้า: นับกล่อง + ถ่ายรูป' }));
  expect(within(phone).getByLabelText('จำนวนกล่องที่รับ')).toHaveValue(String(rtv.boxes.length));
  await userEvent.type(within(phone).getByLabelText('ชื่อผู้ส่งมอบ'), 'คุณสาขา');
  sign(phone);
  // The photo is required.
  expect(within(phone).getByRole('button', { name: 'ยืนยันเก็บสินค้า' })).toBeDisabled();
  await userEvent.click(within(phone).getByRole('button', { name: /ถ่ายรูปกล่อง/ }));
  await userEvent.click(within(phone).getByRole('button', { name: 'ยืนยันเก็บสินค้า' }));
  expect(await within(phone).findByText('เก็บสินค้าแล้ว')).toBeInTheDocument();
  const after = await getRtv(rtv.id);
  expect(after?.step).toBe(5);
  expect(after?.shortBoxes).toBe(0);
});

test('an outside driver accepts with name and plate, which go on the RTV history', async () => {
  const rtv = await seeded(r => nextStep(r)?.step === 4 && r.carrier !== 'PARCEL');
  renderAt('/mobile');
  const phone = await screen.findByRole('region', { name: /แอปขนส่ง/ });
  await openBySlip(phone, rtv.id);
  await userEvent.click(await within(phone).findByRole('button', { name: 'รับงาน' }));
  expect(within(phone).getByRole('alert')).toHaveTextContent('ชื่อคนขับและทะเบียนรถ');
  await userEvent.type(within(phone).getByLabelText('ชื่อคนขับ'), 'คุณสมชาย');
  await userEvent.type(within(phone).getByLabelText('ทะเบียนรถ'), '70-1234');
  await userEvent.click(within(phone).getByRole('button', { name: 'รับงาน' }));
  expect(await within(phone).findByRole('button', { name: 'เก็บสินค้า: นับกล่อง + ถ่ายรูป' })).toBeInTheDocument();
  const after = await getRtv(rtv.id);
  expect(after?.step).toBe(4);
  expect(after?.events.at(-1)?.actor).toContain('คุณสมชาย · 70-1234');
});

test('a slip that is not ready for pickup explains why instead of opening', async () => {
  const rtv = await seeded(r => r.step === 1 && !r.cancelled && r.channel !== 'CONSIGN' && !r.promoId);
  renderAt('/mobile');
  const phone = await screen.findByRole('region', { name: /แอปขนส่ง/ });
  await openBySlip(phone, rtv.id);
  expect(await within(phone).findByRole('status')).toHaveTextContent('CS ยังไม่ปล่อยงานให้ขนส่ง');
});

test('fewer boxes than announced are flagged as short', async () => {
  const rtv = await seeded(r => r.carrier === 'PLAZA_4W' && nextStep(r)?.step === 5 && r.boxes.length > 1);
  renderAt('/mobile');
  const phone = await screen.findByRole('region', { name: /แอปขนส่ง/ });
  await openBySlip(phone, rtv.id);
  await userEvent.click(await within(phone).findByRole('button', { name: 'เก็บสินค้า: นับกล่อง + ถ่ายรูป' }));
  await userEvent.click(within(phone).getByRole('button', { name: 'ลดจำนวนกล่อง' }));
  expect(within(phone).getByText(/กล่องขาด 1 กล่อง/)).toBeInTheDocument();
  await userEvent.click(within(phone).getByRole('button', { name: /ถ่ายรูปกล่อง/ }));
  await userEvent.type(within(phone).getByLabelText('ชื่อผู้ส่งมอบ'), 'คุณสาขา');
  sign(phone);
  await userEvent.click(within(phone).getByRole('button', { name: 'ยืนยันเก็บสินค้า' }));
  expect(await within(phone).findByText('เก็บสินค้าแล้ว')).toBeInTheDocument();
  expect((await getRtv(rtv.id))?.shortBoxes).toBe(1);
});

test('the combined promotion slip opens every brand on the driver phone; count + photo + signature collects them all', async () => {
  const { listPromos, getPromo } = await import('../api');
  await resetData();
  const fi = (await listPromos()).find(e => e.status === 'CONFIRMED')!;
  renderAt(`/promo/${fi.id}/slip`, 'CARRIER');
  await userEvent.click(await screen.findByRole('button', { name: 'จำลองการสแกน QR ด้วยมือถือคนขับ' }));
  const phone = await screen.findByRole('region', { name: 'มือถือคนขับที่สแกน QR ใบนี้' });
  // The simulated camera reads the slip by itself after a moment.
  expect(await within(phone).findByText(fi.name, {}, { timeout: 4000 })).toBeInTheDocument();
  for (const l of fi.lines) expect(within(phone).getByText(new RegExp(`^${l.brandId} ·`))).toBeInTheDocument();
  await userEvent.click(within(phone).getByRole('button', { name: 'เริ่มนับของที่หน้างาน' }));
  await userEvent.click(within(phone).getByRole('button', { name: `เพิ่ม ${fi.lines[0].brandId} กล่อง` }));
  expect(within(phone).getByText('เกิน 1')).toBeInTheDocument();
  await userEvent.click(within(phone).getByRole('button', { name: /ถัดไป/ }));
  await userEvent.click(within(phone).getByRole('button', { name: /ถ่ายรูป/ }));
  await userEvent.type(within(phone).getByLabelText('ชื่อผู้ส่งมอบ'), 'คุณนก');
  sign(phone);
  await userEvent.click(within(phone).getByRole('button', { name: /ยืนยันเก็บสินค้า/ }));
  expect(await within(phone).findByText('เก็บสินค้าโปรแล้ว')).toBeInTheDocument();
  const after = await getPromo(fi.id);
  expect(after?.status).toBe('PICKED');
  expect(after?.lines[0].pickedBoxes).toBe(fi.lines[0].boxes + 1);
});

test('scanning an RTV that has not reached the warehouse says where it is, not "not found"', async () => {
  const rtv = await seeded(r => r.step === 5 && r.carrier === 'CG_NETWORK' && !r.cancelled);
  renderAt('/mobile');
  const phone = await screen.findByRole('region', { name: /แอปคลัง/ });
  await userEvent.click(within(phone).getByRole('button', { name: /สแกนรับสินค้า/ }));
  await userEvent.click(within(phone).getByRole('button', { name: 'พิมพ์เลขเอง' }));
  await userEvent.type(within(phone).getByLabelText('พิมพ์เลข'), rtv.id);
  await userEvent.click(within(phone).getByRole('button', { name: 'ตกลง' }));
  expect(await within(phone).findByRole('status')).toHaveTextContent('กำลังขนส่งไป SCDC');
});

test('warehouse scans boxes in, then counts: the RTV reaches step 9', async () => {
  const rtv = await seeded(r => nextStep(r)?.step === 8 && r.shortBoxes === 0);
  renderAt('/mobile');
  const phone = await screen.findByRole('region', { name: /แอปคลัง/ });
  await userEvent.click((await within(phone).findAllByTestId('m-inbound')).find(c => c.textContent?.includes(rtv.id))!);
  await scanAllByHand(phone, rtv.boxes.map(b => b.no));
  await userEvent.click(within(phone).getByRole('button', { name: `ยืนยันรับเข้า ${rtv.boxes.length} กล่อง` }));
  expect(await within(phone).findByText(/รับเข้าแล้ว/)).toBeInTheDocument();
  expect((await getRtv(rtv.id))?.step).toBe(8);
  expect(within(phone).getAllByTestId('m-count-row')).toHaveLength(rtv.boxes.length);
  await userEvent.click(within(phone).getByRole('button', { name: 'ยืนยันผลตรวจนับ' }));
  expect(await within(phone).findByText('ตรวจนับเสร็จ')).toBeInTheDocument();
  const after = await getRtv(rtv.id);
  expect(after?.step).toBe(9);
  expect(after?.docs.some(d => d.type === 'TK')).toBe(true);
});
