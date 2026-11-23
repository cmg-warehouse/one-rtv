import { HashRouter, Link, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { LangProvider, tr } from './i18n';
import { PortalProvider, usePortal } from './state/portal';
import PortalShell from './components/PortalShell';
import Login from './pages/Login';
import PortalHome from './pages/PortalHome';
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
import Track from './pages/Track';
import MapView from './pages/MapView';
import MobileDemo from './pages/MobileDemo';
import { FlowReturnBar } from './pages/flowDemo';
import PromoList from './pages/PromoList';
import PromoNew from './pages/PromoNew';
import PromoDetail from './pages/PromoDetail';
import PromoSlip from './pages/PromoSlip';

/** React Router reuses a page when only `:id` changes; keying by id gives every RTV fresh form state. */
function RtvDetailRoute() {
  const { id = '' } = useParams();
  return <RtvDetail key={id} />;
}

function NotFound() {
  return (
    <div className="card empty">
      <p>{tr('ไม่พบหน้านี้', 'Page not found')}</p>
      <Link to="/">{tr('กลับไปหน้ารายการ', 'Back to the list')}</Link>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
          <Route path="/" element={<RtvList />} />
          <Route path="/home" element={<PortalHome />} />
          <Route path="/rtv/:id" element={<RtvDetailRoute />} />
          <Route path="/carrier" element={<CarrierJobs />} />
          <Route path="/tour" element={<Tour />} />
          <Route path="/new" element={<NewRtv />} />
          <Route path="/slip/:id" element={<PickupSlip />} />
          <Route path="/flow" element={<FlowOverview />} />
          <Route path="/flow/detail" element={<FlowDetail />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:id" element={<Track />} />
          <Route path="/map" element={<MapView />} />
          <Route path="/mobile" element={<MobileDemo />} />
          <Route path="/promo" element={<PromoList />} />
          <Route path="/promo/new" element={<PromoNew />} />
          <Route path="/promo/:id" element={<PromoDetail />} />
          <Route path="/promo/:id/slip" element={<PromoSlip />} />
          <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  const { account } = usePortal();
  if (pathname === '/login') return <Login />;
  // "Real system" preview: signed in, the person's own layout and nothing of the demo.
  if (account) return <PortalShell><AppRoutes /></PortalShell>;
  if (pathname === '/home') return <Navigate to="/login" replace />;
  return (
    <>
      <TopBar />
      <FlowReturnBar />
      <main className="container">
        <AppRoutes />
      </main>
      <TourOverlay />
      <footer className="mock-banner">{tr('ข้อมูลจำลองเพื่อการสาธิต — ยังไม่เชื่อมต่อ SAP / Sprint FC', 'Demo data — not connected to SAP / Sprint FC')}</footer>
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <PortalProvider>
        <HashRouter>
          <LangProvider>
            <AppShell />
          </LangProvider>
        </HashRouter>
      </PortalProvider>
    </SessionProvider>
  );
}
