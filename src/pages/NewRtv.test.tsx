import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { STORES } from '../data/masters';
import { resetData } from '../api';
import { renderAt } from '../testing';

const consignStore = STORES.find(s => s.channel === 'CONSIGN')!;
const shopStore = STORES.find(s => s.channel === 'SHOP')!;

beforeEach(async () => { await resetData(); });

test('brand opens a consign order and gets a number at step 2 (auto)', async () => {
  renderAt('/new', 'BRAND');
  await userEvent.selectOptions(await screen.findByLabelText('สาขา'), consignStore.id);
  expect(screen.getByLabelText('ช่องทาง')).toHaveValue('Consign');
  expect(screen.getByLabelText('RTV Note (ห้าง)')).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('กล่อง 1: จำนวนชิ้นตามเอกสาร'), '10');
  await userEvent.click(screen.getByRole('button', { name: 'เปิดคำสั่งและออกเลข RTV' }));
  expect(await screen.findByRole('heading', { name: /^RTV-CMG-\d{4}-\d{5}$/ })).toBeInTheDocument();
  expect(screen.getByText(/อัตโนมัติ: เข้ารอบรถ CG Network/)).toBeInTheDocument();
});

test('a box with no piece count is refused', async () => {
  renderAt('/new', 'BRAND');
  await userEvent.selectOptions(await screen.findByLabelText('สาขา'), shopStore.id);
  await userEvent.click(screen.getByRole('button', { name: 'เปิดคำสั่งและออกเลข RTV' }));
  expect(screen.getByText('กรอกจำนวนชิ้นของทุกกล่อง (ตัวเลขมากกว่า 0)')).toBeInTheDocument();
});

test('RTV Note (ห้าง) is hidden for shop stores; boxes can be added and removed', async () => {
  renderAt('/new', 'BRAND');
  await userEvent.selectOptions(await screen.findByLabelText('สาขา'), shopStore.id);
  expect(screen.queryByLabelText('RTV Note (ห้าง)')).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: '+ เพิ่มกล่อง' }));
  expect(screen.getByLabelText('กล่อง 2: จำนวนชิ้นตามเอกสาร')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'ลบกล่อง 2' }));
  expect(screen.queryByLabelText('กล่อง 2: จำนวนชิ้นตามเอกสาร')).toBeNull();
  expect(screen.queryByRole('button', { name: 'ลบกล่อง 1' })).toBeNull();
});

test('non-brand roles cannot open an order', async () => {
  renderAt('/new', 'WH');
  expect(await screen.findByText('เฉพาะ Brand / ฝ่ายขาย')).toBeInTheDocument();
});
