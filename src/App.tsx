import { HashRouter, Route, Routes } from 'react-router-dom';
import { SessionProvider } from './state/session';
import TopBar from './components/TopBar';
import RtvDetail from './pages/RtvDetail';
import NewRtv from './pages/NewRtv';
import PickupSlip from './pages/PickupSlip';
import RtvList from './pages/RtvList';
import CarrierJobs from './pages/CarrierJobs';
import Tour from './pages/Tour';
import TourOverlay from './components/TourOverlay';

const PAGES: { path: string; title: string }[] = [
  { path: '/dashboard', title: 'Dashboard' },
  { path: '/flow', title: 'Flow' },
  { path: '/flow/detail', title: 'Flow รายละเอียด' },
];

export function AppShell() {
  return (
    <>
      <TopBar />
      <main className="container">
        <Routes>
          <Route path="/" element={<RtvList />} />
          <Route path="/rtv/:id" element={<RtvDetail />} />
          <Route path="/carrier" element={<CarrierJobs />} />
          <Route path="/tour" element={<Tour />} />
          <Route path="/new" element={<NewRtv />} />
          <Route path="/slip/:id" element={<PickupSlip />} />
          {PAGES.map((p) => (
            <Route key={p.path} path={p.path} element={<h1>{p.title}</h1>} />
          ))}
        </Routes>
      </main>
      <TourOverlay />
      <footer className="mock-banner">ข้อมูลจำลองเพื่อการสาธิต — ยังไม่เชื่อมต่อ SAP / Sprint FC</footer>
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </SessionProvider>
  );
}
