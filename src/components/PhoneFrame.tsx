import { createContext, useContext, useState, type ReactNode } from 'react';

/** The frame's footer element, once mounted; `null` outside a PhoneFrame. */
export const PhoneFooterContext = createContext<HTMLElement | null>(null);
export const useInPhone = () => useContext(PhoneFooterContext) !== null;

/** Presentational 390 px phone-style frame: a scrolling body plus a fixed footer slot for the primary action. */
export default function PhoneFrame({ children }: { children: ReactNode }) {
  const [footer, setFooter] = useState<HTMLDivElement | null>(null);
  return (
    <div className="phone-frame">
      <PhoneFooterContext.Provider value={footer}>
        <div className="phone-frame-body"><div className="mobile">{children}</div></div>
      </PhoneFooterContext.Provider>
      <div className="phone-frame-footer" ref={setFooter} />
    </div>
  );
}
