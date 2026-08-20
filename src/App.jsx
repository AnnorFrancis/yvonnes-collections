import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Lenis from 'lenis';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Contact from './pages/Contact';
import Policies from './pages/Policies';
import Checkout from './pages/Checkout';
import Track from './pages/Track';

// The management system (and its charting library) only downloads
// when a staff member actually opens /admin.
const Admin = lazy(() => import('./admin/Admin'));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);
  return null;
}

// Routes mount immediately and fade in with CSS. Nothing waits on an
// exit animation, so moving between sections feels instant.
function SiteRoutes() {
  const location = useLocation();
  return (
    <div className="route-fade" key={location.pathname}>
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/track" element={<Track />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  const [cartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    if (isAdmin) return;
    // Native scrolling on touch devices: lighter and snappier on phones
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) return;
    const lenis = new Lenis({
      duration: 0.9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    let rafId;
    const raf = (time) => { lenis.raf(time); rafId = requestAnimationFrame(raf); };
    rafId = requestAnimationFrame(raf);
    return () => { lenis.destroy(); cancelAnimationFrame(rafId); };
  }, [isAdmin]);

  if (isAdmin) {
    return (
      <Suspense fallback={<div className="route-loading">Opening the management system</div>}>
        <Routes>
          <Route path="/admin/*" element={<Admin />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <>
      <ScrollToTop />
      <Navigation onOpenCart={() => setCartOpen(true)} />
      <main>
        <SiteRoutes />
      </main>
      <Footer />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
