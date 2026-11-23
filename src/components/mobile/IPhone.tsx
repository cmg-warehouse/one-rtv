import type { ReactNode } from 'react';
import { tr } from '../../i18n';

/** Presentational iPhone mock (Dynamic Island, status bar, home indicator). `dark` switches the status bar for camera screens. */
export default function IPhone({ children, dark = false, label }: { children: ReactNode; dark?: boolean; label: string }) {
  return (
    <figure className="iphone-wrap">
      <div className="iphone" role="region" aria-label={label}>
        <div className={`iphone-screen${dark ? ' is-dark' : ''}`}>
          <div className="iphone-status" aria-hidden="true">
            <span className="iphone-time">9:41</span>
            <span className="iphone-island" />
            <span className="iphone-icons">
              <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="5" y="5" width="3" height="6" rx="1" /><rect x="10" y="2.5" width="3" height="8.5" rx="1" /><rect x="15" y="0" width="3" height="11" rx="1" /></svg>
              <svg width="16" height="11" viewBox="0 0 16 11"><path d="M8 2.2c2.2 0 4.2.9 5.7 2.3l1.1-1.1A9.6 9.6 0 0 0 8 .6 9.6 9.6 0 0 0 1.2 3.4l1.1 1.1A8 8 0 0 1 8 2.2Zm0 3.2c1.3 0 2.5.5 3.4 1.4l1.1-1.1A6.4 6.4 0 0 0 8 3.8c-1.8 0-3.4.7-4.5 1.9l1.1 1.1c.9-.9 2.1-1.4 3.4-1.4Zm0 3.2c.5 0 .9.2 1.2.5L8 10.4 6.8 9.1c.3-.3.7-.5 1.2-.5Z" /></svg>
              <span className="iphone-battery"><span /></span>
            </span>
          </div>
          <div className="iphone-content">{children}</div>
          <div className="iphone-home" aria-hidden="true" />
        </div>
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

/** App header with an optional back button, as on iOS. */
export function AppBar({ title, onBack, right, dark }: { title: string; onBack?: () => void; right?: ReactNode; dark?: boolean }) {
  return (
    <header className={`ma-bar${dark ? ' is-dark' : ''}`}>
      {onBack ? <button type="button" className="ma-back" onClick={onBack} aria-label={tr('ย้อนกลับ', 'Back')}>‹</button> : <span className="ma-back-spacer" />}
      <span className="ma-title">{title}</span>
      <span className="ma-right">{right}</span>
    </header>
  );
}
