import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

test('top bar shows CRL logo, search box and all 7 roles', () => {
  render(<App />);
  expect(screen.getByAltText('CRL')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('ค้นหาเลข RTV / MIM / TK / CN')).toBeInTheDocument();
  expect(within(screen.getByLabelText('บทบาท')).getAllByRole('option')).toHaveLength(7);
});
test('chosen role survives a remount', async () => {
  const { unmount } = render(<App />);
  await userEvent.selectOptions(screen.getByLabelText('บทบาท'), 'WH');
  unmount(); render(<App />);
  expect(screen.getByLabelText('บทบาท')).toHaveValue('WH');
});
test('footer banner states the data is mock', () => {
  render(<App />);
  expect(screen.getByText('ข้อมูลจำลองเพื่อการสาธิต — ยังไม่เชื่อมต่อ SAP / Sprint FC')).toBeInTheDocument();
});
