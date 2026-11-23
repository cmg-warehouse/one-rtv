import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PreviewIntro, { playPreviewIntro } from './PreviewIntro';

test('the preview cut scene shows the logo and can be skipped', async () => {
  render(<PreviewIntro enabled />);
  expect(screen.queryByRole('img', { name: 'One RTV' })).toBeNull();
  act(() => playPreviewIntro());
  expect(screen.getByRole('img', { name: 'One RTV' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'ข้าม' }));
  expect(screen.queryByRole('img', { name: 'One RTV' })).toBeNull();
});

test('the cut scene stays off under the test runner by default', () => {
  render(<PreviewIntro />);
  act(() => playPreviewIntro());
  expect(screen.queryByRole('img', { name: 'One RTV' })).toBeNull();
});
