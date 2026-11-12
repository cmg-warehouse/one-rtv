import { useState } from 'react';
import { act, type Action } from '../../api';
import type { Rtv } from '../../domain/types';
import { useSession } from '../../state/session';

/** Runs one API action for the current role; keeps the Thai error message for the form to show. */
export function useAct(rtv: Rtv, onDone: () => void) {
  const { role, actor } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: Action): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await act(rtv.id, action, { role, actor });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด');
      setBusy(false);
      return false;
    }
    setBusy(false);
    onDone();
    return true;
  }

  return { run, error, busy, setError };
}

export function ErrorLine({ message }: { message: string | null }) {
  return message ? <p className="error" role="alert">{message}</p> : null;
}
