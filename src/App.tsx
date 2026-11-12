import { HashRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './state/session';
import TopBar from './components/TopBar';

const PAGES: { path: string; title: string }[] = [
  { path: '/', title: 'รายการ RTV' },
  { path: '/rtv/:id', title: 'รายละเอียด RTV' },
  { path: '/new', title: 'สร้างรายการ RTV' },
  { path: '/slip/:id', title: 'ใบรับสินค้า' },
  { path: '/carrier', title: 'ขนส่ง' },
  { path: '/dashboard', title: 'Dashboard' },
  { path: '/flow', title: 'Flow' },
  { path: '/flow/detail', title: 'Flow รายละเอียด' },
  { path: '/tour', title: 'Demo นำชม' },
];

export default function App() {
  return (
    <SessionProvider>
      <HashRouter>
        <TopBar />
        <main className="container">
          <Routes>
            {PAGES.map((p) => (
              <Route key={p.path} path={p.path} element={<h1>{p.title}</h1>} />
            ))}
          </Routes>
        </main>
        <footer className="mock-banner">ข้อมูลจำลองเพื่อการสาธิต — ยังไม่เชื่อมต่อ SAP / Sprint FC</footer>
      </HashRouter>
    </SessionProvider>
  );
}
