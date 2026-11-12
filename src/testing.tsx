import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { listRtvs, resetData } from './api';
import { AppShell } from './App';
import type { Role, Rtv } from './domain/types';
import { SessionProvider } from './state/session';

export function renderAt(path: string, role?: Role) {
  if (role) localStorage.setItem('one-rtv.role', role);
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppShell />
      </MemoryRouter>
    </SessionProvider>,
  );
}

export async function seeded(pred: (r: Rtv) => boolean): Promise<Rtv> {
  await resetData();
  const found = (await listRtvs()).find(pred);
  if (!found) throw new Error('seeded(): no seeded RTV matches the predicate');
  return found;
}
