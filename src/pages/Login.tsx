import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LangToggle, tr } from '../i18n';
import { ROLE_LABELS } from '../state/session';
import { accounts, usePortal } from '../state/portal';

/** Sign-in screen of the "real system" preview. Any password works; picking a demo account fills the form. */
export default function Login() {
  const { signIn } = usePortal();
  const navigate = useNavigate();
  const list = accounts();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const a = list.find(x => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!a || !password) {
      setError(tr('อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'Incorrect email or password'));
      return;
    }
    signIn(a.id);
    navigate('/home');
  };

  return (
    <div className="login-page">
      <div className="login-top">
        <LangToggle />
      </div>
      <div className="login-card">
        <div className="login-brand">
          <img src="./crl-logo.svg" alt="CRL" />
          <strong>One RTV</strong>
        </div>
        <h1>{tr('เข้าสู่ระบบ', 'Sign in')}</h1>
        <p className="muted">{tr('ระบบติดตามสินค้าคืนผู้ขาย (RTV) ของ Central Retail Logistics', 'Return-to-vendor tracking for Central Retail Logistics')}</p>
        <form onSubmit={submit} className="login-form">
          <label>
            {tr('อีเมล', 'Email')}
            <input type="email" autoComplete="username" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} required />
          </label>
          <label>
            {tr('รหัสผ่าน', 'Password')}
            <input type="password" autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} required />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" className="btn btn-primary btn-block">{tr('เข้าสู่ระบบ', 'Sign in')}</button>
          <button type="button" className="btn btn-block" disabled title={tr('ระบบจริงจะใช้บัญชีองค์กร', 'The live system will use company accounts')}>
            {tr('เข้าสู่ระบบด้วยบัญชี Central (SSO)', 'Sign in with Central account (SSO)')}
          </button>
        </form>
      </div>

      <section className="login-accounts" aria-label={tr('บัญชีตัวอย่าง', 'Demo accounts')}>
        <h2>{tr('บัญชีตัวอย่าง', 'Demo accounts')}</h2>
        <p className="muted">{tr('กดเพื่อเข้าสู่ระบบเป็นบุคคลนั้น แต่ละบทบาทจะเห็นเมนูและงานของตัวเองเท่านั้น', 'Pick one to sign in as that person. Each role sees only its own menu and work.')}</p>
        <ul>
          {list.map(a => (
            <li key={a.id}>
              <button type="button" className="login-account" onClick={() => { signIn(a.id); navigate('/home'); }}>
                <span className="avatar" aria-hidden="true">{a.name().replace(/^คุณ/, '').trim().charAt(0)}</span>
                <span>
                  <strong>{a.name()}</strong>
                  <small>{ROLE_LABELS[a.role]} · {a.title()}</small>
                  <small className="mono">{a.email}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p><Link to="/">{tr('← กลับไปหน้า demo', '← Back to the demo')}</Link></p>
      </section>
      <footer className="mock-banner">{tr('ตัวอย่างหน้าตาระบบจริง — ข้อมูลจำลอง ยังไม่เชื่อมต่อ SAP / Sprint FC', 'Preview of the live system — demo data, not connected to SAP / Sprint FC')}</footer>
    </div>
  );
}
