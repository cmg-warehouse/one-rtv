import { HashRouter, Link, Route, Routes, useParams } from 'react-router-dom';
import { SessionProvider } from './state/session';
import TopBar from './components/TopBar';
import RtvDetail from './pages/RtvDetail';
import NewRtv from './pages/NewRtv';
import PickupSlip from './pages/PickupSlip';
import RtvList from './pages/RtvList';
import CarrierJobs from './pages/CarrierJobs';
import Tour from './pages/Tour';
import FlowOverview from './pages/FlowOverview';
import FlowDetail from './pages/FlowDetail';
import Dashboard from './pages/Dashboard';
import TourOverlay from './components/TourOverlay';

/** React Router reuses a page when only `:id` changes; keying by id gives every RTV fresh form state. */
function RtvDetailRoute() {
  const { id = '' } = useParams();
  return <RtvDetail key={id} />;
}

function NotFound() {
  return (
    <div className="card empty">
      <p>ไม่พบหน้านี้</p>
      <Link to="/">กลับไปหน้ารายการ</Link>
    </div>
  );
}

export function AppShell() {
  return (
    <>
      <TopBar />
      <main className="container">
        <Routes>
          <Route path="/" element={<RtvList />} />
          <Route path="/rtv/:id" element={<RtvDetailRoute />} />
          <Route path="/carrier" element={<CarrierJobs />} />
          <Route path="/tour" element={<Tour />} />
          <Route path="/new" element={<NewRtv />} />
          <Route path="/slip/:id" element={<PickupSlip />} />
          <Route path="/flow" element={<FlowOverview />} />
          <Route path="/flow/detail" element={<FlowDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<NotFound />} />
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
