import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getPromo, getRtv, listPromos, resetData } from '../api';
import { renderAt } from '../testing';

beforeEach(async () => { await resetData(); });

test('the seed has the Fashion Island pickup from the e-mail: 21 pallets, two 6W trucks confirmed', async () => {
  const fi = (await listPromos()).find(e => e.storeId === 'venue-01')!;
  expect(fi.status).toBe('CONFIRMED');
  expect(fi.lines.reduce((n, l) => n + l.pallets, 0) + fi.extras.reduce((n, x) => n + x.pallets, 0)).toBe(21);
  renderAt(`/promo/${fi.id}`, 'BRAND');
  expect(await screen.findByRole('heading', { name: 'ยืนยันรถเก็บโปร' })).toBeInTheDocument();
  expect(screen.getByText('70-1234 กทม.')).toBeInTheDocument();
});

test('the coordinator announces a pickup and every brand gets an RTV', async () => {
  renderAt('/promo/new', 'PROMO');
  await userEvent.type(await screen.findByLabelText('ชื่องาน'), 'ทดสอบงานโปร');
  await userEvent.selectOptions(screen.getByLabelText('สถานที่เก็บ'), 'venue-04');
  await userEvent.type(screen.getByLabelText('ผู้ประสานงานหน้างาน'), 'คุณทดสอบ');
  await userEvent.type(screen.getByLabelText('เบอร์โทรหน้างาน'), '080');
  await userEvent.selectOptions(screen.getByLabelText('แถว 1: แบรนด์'), 'JH');
  await userEvent.type(screen.getByLabelText('แถว 1: กล่อง'), '50');
  await userEvent.type(screen.getByLabelText('แถว 1: พาเลท'), '2');
  await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มแบรนด์' }));
  await userEvent.selectOptions(screen.getByLabelText('แถว 2: แบรนด์'), 'CW');
  await userEvent.type(screen.getByLabelText('แถว 2: กล่อง'), '10');
  await userEvent.type(screen.getByLabelText('แถว 2: พาเลท'), '1');
  expect(screen.getByText(/ระบบแนะนำ 4W × 1 สำหรับ 3 พาเลท/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'แจ้งงานและออกเลข RTV ทุกแบรนด์' }));
  expect(await screen.findByRole('heading', { name: 'ทดสอบงานโปร' })).toBeInTheDocument();
  const table = screen.getByRole('heading', { name: 'แบรนด์ในงาน' }).nextElementSibling as HTMLElement;
  const links = within(table).getAllByRole('link');
  expect(links).toHaveLength(2);
  const rtv = await getRtv(links[0].textContent!);
  expect(rtv).toMatchObject({ brandId: 'JH', saleType: 'PROMO', step: 1 });
});

test('CS forwards, the carrier confirms trucks and records the pickup', async () => {
  const req = (await listPromos()).find(e => e.status === 'REQUESTED')!;
  const { unmount } = renderAt(`/promo/${req.id}`, 'CS');
  await userEvent.click(await screen.findByRole('button', { name: 'ส่งต่อขนส่ง (งานจองรถ)' }));
  expect(await screen.findByText('ส่งต่อขนส่งแล้ว รอยืนยันรถ')).toBeInTheDocument();
  unmount();

  renderAt(`/promo/${req.id}`, 'CARRIER');
  await userEvent.type(await screen.findByLabelText('คันที่ 1: ทะเบียน'), '70-9999');
  await userEvent.type(screen.getByLabelText('คันที่ 1: คนขับ'), 'คุณขับ');
  await userEvent.click(screen.getByRole('button', { name: 'ยืนยันรถ และแจ้งทุกแบรนด์' }));
  expect(await screen.findByRole('heading', { name: 'ยืนยันรถเก็บโปร' })).toBeInTheDocument();

  const first = req.lines[0];
  const boxes = screen.getByLabelText(`${first.brandId}: กล่องที่เก็บได้`);
  await userEvent.clear(boxes);
  await userEvent.type(boxes, String(first.boxes + 3));
  await userEvent.click(screen.getByRole('button', { name: /บันทึกการเก็บ/ }));
  expect(await screen.findByText('เกิน 3')).toBeInTheDocument();
  expect((await getPromo(req.id))?.status).toBe('PICKED');
  expect((await getRtv(first.rtvId))?.boxes).toHaveLength(first.boxes + 3);
});

test('a promotion RTV sends its pickup steps to the pickup page', async () => {
  const req = (await listPromos()).find(e => e.status === 'REQUESTED')!;
  renderAt(`/rtv/${req.lines[0].rtvId}`, 'CS');
  expect(await screen.findByRole('link', { name: 'ไปที่งานเก็บโปร' })).toHaveAttribute('href', `/promo/${req.id}`);
});

test('a brand sees only pickups with its own brand', async () => {
  renderAt('/promo', 'BRAND');
  await screen.findByText('Mid Month Sale @ เซ็นทรัลเวิลด์');
  const rows = screen.getAllByRole('row').slice(1);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveTextContent('เซ็นทรัลเวิลด์');
});
