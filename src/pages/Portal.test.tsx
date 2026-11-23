import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { getLang, setLang } from '../i18n';

beforeEach(() => {
  sessionStorage.clear();
  window.location.hash = '#/login';
});

test('a Brand signs in and sees only the Brand menu, with no demo controls', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: /คุณพลอย/ }));
  const menu = await screen.findByRole('navigation', { name: 'เมนูหลัก' });
  const items = within(menu).getAllByRole('link').map(a => a.textContent);
  expect(items.some(t => t?.includes('RTV ของฉัน'))).toBe(true);
  expect(items.some(t => t?.includes('เปิด RTV ใหม่'))).toBe(true);
  expect(items.some(t => t?.includes('Dashboard'))).toBe(false);
  expect(screen.queryByLabelText('บทบาท')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('คุณพลอย');
  expect(screen.getAllByText('งานที่รอคุณ').length).toBeGreaterThan(0);
});

test('a CS user gets the dashboard; signing out returns to the sign-in page', async () => {
  render(<App />);
  await userEvent.type(await screen.findByLabelText('อีเมล'), 'nan.cs@crl.example');
  await userEvent.type(screen.getByLabelText('รหัสผ่าน'), 'x');
  await userEvent.click(screen.getAllByRole('button', { name: 'เข้าสู่ระบบ' })[0]);
  const menu = await screen.findByRole('navigation', { name: 'เมนูหลัก' });
  expect(within(menu).getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'ออกจากระบบ' }));
  expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
});

test('a wrong email is refused', async () => {
  render(<App />);
  await userEvent.type(await screen.findByLabelText('อีเมล'), 'nobody@x.example');
  await userEvent.type(screen.getByLabelText('รหัสผ่าน'), 'x');
  await userEvent.click(screen.getAllByRole('button', { name: 'เข้าสู่ระบบ' })[0]);
  expect(await screen.findByRole('alert')).toHaveTextContent('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
});

test('the EN | TH switch changes the language and remembers it', async () => {
  render(<App />);
  await userEvent.click(await screen.findByRole('button', { name: 'EN' }));
  expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  expect(getLang()).toBe('en');
  await userEvent.click(screen.getByRole('button', { name: 'TH' }));
  expect(await screen.findByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeInTheDocument();
  setLang('th');
});
