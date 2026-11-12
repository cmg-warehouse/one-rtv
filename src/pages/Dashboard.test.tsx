import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRtv, listRtvs } from '../api';
import { shopInput } from '../domain/testing';
import { renderAt } from '../testing';

test('dashboard shows who work is stuck with and reset restores the seed', async () => {
  renderAt('/dashboard', 'VIEWER');
  expect(await screen.findByRole('heading', { name: 'งานค้างตามผู้รับผิดชอบ' })).toBeInTheDocument();
  expect(screen.getByText('รอ RTV Note')).toBeInTheDocument();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const before = (await listRtvs()).length;
  await createRtv(shopInput, { role: 'BRAND', actor: 'a' });
  await userEvent.click(screen.getByRole('button', { name: 'รีเซ็ตข้อมูล' }));
  await waitFor(async () => expect((await listRtvs()).length).toBe(before));
});

test('shows KPI tiles, step bars and segment tiles', async () => {
  renderAt('/dashboard', 'VIEWER');
  expect(await screen.findByText('งานเปิด')).toBeInTheDocument();
  expect(screen.getByText('ปิดแล้ว')).toBeInTheDocument();
  expect(screen.getByText('กล่องขาดที่ยังเปิด')).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'งานเปิดตามสถานะ' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'เวลาเฉลี่ยแต่ละช่วง' })).toBeInTheDocument();
  expect(screen.getByText('เก็บ → CMG รับ')).toBeInTheDocument();
});

test('owner table links to the list filtered by that owner', async () => {
  renderAt('/dashboard', 'VIEWER');
  const table = (await screen.findByRole('heading', { name: 'งานค้างตามผู้รับผิดชอบ' })).nextElementSibling as HTMLElement;
  await userEvent.click(within(table).getAllByRole('link')[0]);
  expect(await screen.findByRole('heading', { name: 'รายการ RTV' })).toBeInTheDocument();
  expect(screen.getByText(/ค้างที่: /)).toBeInTheDocument();
  const rows = await screen.findAllByTestId('rtv-row');
  const label = rows[0].querySelector('[data-testid="owner"]')!.textContent;
  rows.forEach(r => expect(within(r).getByTestId('owner')).toHaveTextContent(label!));
});

test('home page offers the guided tour in one click', async () => {
  renderAt('/', 'VIEWER');
  expect(await screen.findByRole('link', { name: 'ดู Demo นำชม' })).toHaveAttribute('href', '/tour');
  expect(screen.getByRole('link', { name: 'ดู Flow ภาพรวม' })).toHaveAttribute('href', '/flow');
});

test('open work by step lists steps 1-9 only; the hold table has four rows and shows a dash for an empty hold', async () => {
  renderAt('/dashboard', 'VIEWER');
  const section = (await screen.findByRole('heading', { name: 'งานเปิดตามสถานะ' })).nextElementSibling as HTMLElement;
  const labels = [...section.querySelectorAll('.bar-label')].map(e => e.textContent);
  expect(labels).toHaveLength(9);
  expect(labels.some(l => l!.startsWith('10.'))).toBe(false);

  const holdTable = screen.getByRole('heading', { name: 'งานที่รอ Brand / ฝ่ายขาย' }).nextElementSibling as HTMLElement;
  const rows = within(holdTable).getAllByRole('row').slice(1);
  expect(rows.map(r => within(r).getAllByRole('cell')[0].textContent))
    .toEqual(['รอ Brand ยืนยันยอด', 'รอ RTV Note', 'รอเลข MIM', 'รอยืนยัน Promotion']);
  const mim = within(rows[2]).getAllByRole('cell');
  expect(mim[1]).toHaveTextContent('0');
  expect(mim[2]).toHaveTextContent('—');
  expect(mim[2]).not.toHaveTextContent('วัน');
});
