import type { ReactNode } from 'react';

/** Presentational 390 px phone-style frame used for the carrier's screens. */
export default function PhoneFrame({ children }: { children: ReactNode }) {
  return <div className="phone-frame"><div className="mobile">{children}</div></div>;
}
