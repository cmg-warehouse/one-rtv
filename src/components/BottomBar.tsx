import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PhoneFooterContext } from './PhoneFrame';

/** Inside a PhoneFrame: renders children in the frame's fixed footer. Elsewhere: inline. */
export default function BottomBar({ children }: { children: ReactNode }) {
  const footer = useContext(PhoneFooterContext);
  if (!footer) return <>{children}</>;
  return createPortal(<div className="bottom-bar"><div className="bottom-bar-inner">{children}</div></div>, footer);
}
