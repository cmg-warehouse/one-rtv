import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetData } from '../api';
import { renderAt } from '../testing';

test("carrier sees only their carrier's jobs and can switch", async () => {
  await resetData();
  renderAt('/carrier', 'CARRIER');
  const cards = await screen.findAllByTestId('job-card');
  cards.forEach(c => expect(c).toHaveTextContent('4W Plaza'));
  expect(screen.getByRole('button', { name: '4W Plaza' })).toHaveAttribute('aria-pressed', 'true');
  await userEvent.click(screen.getByRole('button', { name: 'CG Network' }));
  (await screen.findAllByTestId('job-card')).forEach(c => expect(c).toHaveTextContent('CG Network'));
  expect(screen.getByRole('button', { name: 'CG Network' })).toHaveAttribute('aria-pressed', 'true');
});

test('the carrier nav entry shows only for the carrier role', async () => {
  renderAt('/carrier', 'CARRIER');
  expect(await screen.findByRole('link', { name: 'งานขนส่ง' })).toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText('บทบาท'), 'CS');
  expect(screen.queryByRole('link', { name: 'งานขนส่ง' })).toBeNull();
});
