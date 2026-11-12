import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getRtv, putRtv, resetData } from '../api';
import { DEMO_BRAND_ID, STORES } from '../data/masters';
import { cnType, holds } from '../domain/rules';
import { rtv as rtvFixture, toStep } from '../domain/testing';
import { renderAt, seeded } from '../testing';

test('E-tax Consign asks for exactly its CN documents', async () => {
  const r = await seeded(x => x.step === 9 && cnType(x.channel, x.saleType) === 'ETAX_CONSIGN' && holds(x).length === 0);
  renderAt(`/rtv/${r.id}`, 'ADMIN_CN');
  expect(await screen.findByRole('heading', { name: 'ออก CN — E-tax Consign' })).toBeInTheDocument();
  for (const l of ['Sale Return', 'Delivery', 'CN']) expect(screen.getByLabelText(l)).toBeInTheDocument();
  expect(screen.queryByLabelText('Matdoc')).toBeNull();
  expect(screen.getAllByText('✓').length).toBe(2);
});

test('CN is blocked while waiting for the mall note, then released by Brand', async () => {
  const r = await seeded(x => holds(x).length === 1 && holds(x)[0] === 'WAIT_RTV_NOTE');
  renderAt(`/rtv/${r.id}`, 'ADMIN_CN');
  expect(await screen.findByRole('button', { name: 'ออก CN และปิดงาน' })).toBeDisabled();
  expect(screen.getByText('รอ RTV Note')).toBeInTheDocument();
  expect(screen.getByText('ยังออก CN ไม่ได้: รอ RTV Note')).toBeInTheDocument();
  expect(screen.getByText(/รอมาแล้ว \d+ วัน/)).toBeInTheDocument();
  expect(screen.getByText(/ผู้ดำเนินการ: Brand \/ ฝ่ายขาย/)).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('บทบาท'), 'BRAND');
  await userEvent.type(await screen.findByLabelText('RTV Note (ห้าง)'), 'RN-889900');
  await userEvent.click(screen.getByRole('button', { name: 'บันทึกเลข' }));
  await userEvent.selectOptions(screen.getByLabelText('บทบาท'), 'ADMIN_CN');
  expect(await screen.findByRole('button', { name: 'ออก CN และปิดงาน' })).toBeEnabled();
});

test('closing shows the CN number and no further actions', async () => {
  const r = await seeded(x => x.step === 9 && cnType(x.channel, x.saleType) === 'MIM_SHOP' && holds(x).length === 0);
  renderAt(`/rtv/${r.id}`, 'ADMIN_CN');
  await userEvent.type(await screen.findByLabelText('Matdoc'), '5250009999');
  await userEvent.click(screen.getByRole('button', { name: 'ออก CN และปิดงาน' }));
  expect(await screen.findByText('ปิดงานแล้ว')).toBeInTheDocument();
  expect(within(screen.getByTestId('actions')).queryByRole('button')).toBeNull();
});

test('closing with a CN document shows its number', async () => {
  const r = await seeded(x => x.step === 9 && cnType(x.channel, x.saleType) === 'ETAX_CONSIGN' && holds(x).length === 0);
  renderAt(`/rtv/${r.id}`, 'ADMIN_CN');
  await userEvent.type(await screen.findByLabelText('Sale Return'), 'SR1');
  await userEvent.type(screen.getByLabelText('Delivery'), 'DL1');
  await userEvent.click(screen.getByRole('button', { name: 'ออก CN และปิดงาน' }));
  expect(await screen.findByText(/กรุณากรอกเอกสาร: CN/, { selector: '.error' })).toBeInTheDocument();
  await userEvent.type(screen.getByLabelText('CN'), 'CN-5551');
  await userEvent.click(screen.getByRole('button', { name: 'ออก CN และปิดงาน' }));
  expect(await screen.findByText('ปิดงานแล้ว')).toBeInTheDocument();
  expect(screen.getByText('เลข CN: CN-5551')).toBeInTheDocument();
});

test('Brand can ask for a recount', async () => {
  const r = await seeded(x => holds(x).includes('WAIT_BRAND_QTY'));
  renderAt(`/rtv/${r.id}`, 'BRAND');
  expect(await screen.findByRole('columnheader', { name: 'คลังนับได้' })).toBeInTheDocument();
  await userEvent.click(await screen.findByRole('button', { name: 'ขอให้นับใหม่' }));
  expect(await screen.findByText(/ค้างที่: คลัง CMG/)).toBeInTheDocument();
});

test('Brand confirms the counted quantity', async () => {
  const r = await seeded(x => holds(x).length === 1 && holds(x)[0] === 'WAIT_BRAND_QTY' && x.brandId === DEMO_BRAND_ID);
  renderAt(`/rtv/${r.id}`, 'BRAND');
  await userEvent.click(await screen.findByRole('button', { name: 'ยืนยันตามยอดที่คลังนับ' }));
  expect(await screen.findByText(/ค้างที่: Admin CN/)).toBeInTheDocument();
});

test('Brand confirms a promotion', async () => {
  const r = await seeded(x => holds(x).length === 1 && holds(x)[0] === 'WAIT_PROMO');
  renderAt(`/rtv/${r.id}`, 'BRAND');
  await userEvent.click(await screen.findByRole('button', { name: 'ยืนยันยอด Promotion' }));
  expect(await screen.findByText(/ค้างที่: Admin CN/)).toBeInTheDocument();
});

test('Admin CN list groups open work under the four CN types', async () => {
  await seeded(() => true);
  renderAt('/', 'ADMIN_CN');
  await userEvent.click(await screen.findByLabelText('ค้างที่ฉัน'));
  for (const name of ['MIM Shop', 'Temp Shop', 'E-tax Consign', 'E-tax Credit']) {
    expect(await screen.findByRole('heading', { name })).toBeInTheDocument();
  }
});

test('a Shop order opened without MIM waits for it at step 9, Brand adds it, then Admin CN closes', async () => {
  await resetData();
  renderAt('/new', 'BRAND');
  const shop = STORES.find(s => s.channel === 'SHOP')!;
  await userEvent.selectOptions(await screen.findByLabelText('สาขา'), shop.id);
  await userEvent.type(screen.getByLabelText('กล่อง 1: จำนวนชิ้นตามเอกสาร'), '10');
  await userEvent.click(screen.getByRole('button', { name: 'เปิดคำสั่งและออกเลข RTV' }));
  const heading = await screen.findByRole('heading', { name: /^RTV-CMG-\d{4}-\d{5}$/ });
  const created = (await getRtv(heading.textContent!))!;
  await putRtv(toStep(created, 9));

  expect(within(await screen.findByRole('status')).getByText('รอเลข MIM')).toBeInTheDocument();
  expect(screen.getByText(/ค้างที่: Brand/)).toBeInTheDocument();
  await userEvent.type(await screen.findByLabelText('MIM'), '26009911');
  await userEvent.click(screen.getByRole('button', { name: 'บันทึกเลข' }));

  await userEvent.selectOptions(screen.getByLabelText('บทบาท'), 'ADMIN_CN');
  await userEvent.type(await screen.findByLabelText('Matdoc'), '5250000001');
  await userEvent.click(screen.getByRole('button', { name: 'ออก CN และปิดงาน' }));
  expect(await screen.findByText('ปิดงานแล้ว')).toBeInTheDocument();
});

test('Admin CN sees the CN button disabled with the missing document named while MIM is absent', async () => {
  await resetData();
  const shopNoMim = toStep(rtvFixture({ id: 'RTV-CMG-2611-90001', channel: 'SHOP', carrier: 'CG_NETWORK', boxes: [{ no: 'RTV-CMG-2611-90001-B01', expectedPcs: 10 }] }), 9);
  await putRtv(shopNoMim);
  renderAt(`/rtv/${shopNoMim.id}`, 'ADMIN_CN');
  expect(await screen.findByRole('button', { name: 'ออก CN และปิดงาน' })).toBeDisabled();
  expect(screen.getByText('ขาด MIM')).toBeInTheDocument();
  expect(screen.getByText('ยังออก CN ไม่ได้: รอเลข MIM')).toBeInTheDocument();
});
