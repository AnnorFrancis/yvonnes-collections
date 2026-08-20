import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag, Menu, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BRAND } from '../config';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/shop', label: 'Products' },
  { to: '/track', label: 'Track order' },
  { to: '/contact', label: 'Visit us' },
  { to: '/policies', label: 'Delivery' },
];

// One standard header on every page: brand left, section links center,
// cart right. Collapses to a burger menu on small screens.
export default function Navigation({ onOpenCart }) {
  const [menu, setMenu] = useState(false);
  const [solid, setSolid] = useState(false);
  const { cartCount } = useStore();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
      <header className={`header ${solid ? 'header--solid' : ''}`}>
        <Link to="/" className="header-brand" aria-label={BRAND.name}>
          <span className="header-seal">{BRAND.monogram}</span>
          <span className="header-word">
            {BRAND.short}
            <em>Collections</em>
          </span>
        </Link>

        <nav className="header-nav" aria-label="Sections">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="header-actions">
          <button className="header-cart" onClick={onOpenCart} aria-label="Open cart">
            <ShoppingBag size={19} strokeWidth={1.7} />
            <span className="header-cart-label">Cart</span>
            {cartCount > 0 && <span className="header-badge">{cartCount}</span>}
          </button>
          <button className="header-burger" aria-label="Open menu" onClick={() => setMenu(true)}>
            <Menu size={22} strokeWidth={1.7} />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div
            className="menu-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <button className="menu-close" aria-label="Close menu" onClick={() => setMenu(false)}>
              <X size={26} strokeWidth={1.5} />
            </button>
            <nav className="menu-links">
              {LINKS.map((l, i) => (
                <motion.div
                  key={l.to}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.05, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link to={l.to} onClick={() => setMenu(false)}>{l.label}</Link>
                </motion.div>
              ))}
            </nav>
            <p className="menu-foot">{BRAND.address} · {BRAND.phone}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
