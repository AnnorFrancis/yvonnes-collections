import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, Plus } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { DEPARTMENTS } from '../data/products';
import { fmtPrice } from '../config';

// ── Reveal: scroll-triggered entrance ───────────────────────
// One shared IntersectionObserver for the whole page, handing off to a
// CSS animation. A motion component per section measured layout on every
// scroll and cost real milliseconds on phones.
let sharedObserver = null;
function getObserver() {
  if (!sharedObserver && typeof IntersectionObserver !== 'undefined') {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            sharedObserver.unobserve(e.target);
          }
        });
      },
      { rootMargin: '0px 0px 12% 0px' }
    );
  }
  return sharedObserver;
}

export function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = getObserver();
    if (!io) { el.classList.add('is-in'); return; }
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

// ── ProductCard ─────────────────────────────────────────────
// Uses a pure CSS entrance rather than a motion component: a shop
// page renders 30+ of these and CSS keeps scrolling smooth on phones.
export function ProductCard({ product, onQuickView, index = 0 }) {
  const { dispatch } = useStore();
  const [added, setAdded] = useState(false);
  const deptLabel = DEPARTMENTS.find((d) => d.id === product.dept)?.label;

  const quickAdd = (e) => {
    e.stopPropagation();
    dispatch({ type: 'cart/add', id: product.id, size: product.sizes?.[0] ?? 'One size' });
    setAdded(true);
    setTimeout(() => setAdded(false), 1000);
  };

  return (
    <div className="pcard" style={{ animationDelay: `${Math.min(index, 7) * 0.045}s` }}>
      <button className="pcard-media" onClick={() => onQuickView(product)} aria-label={`View ${product.name}`}>
        <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
        <span className="pcard-badge">{product.badge ?? deptLabel}</span>
      </button>
      <button className="pcard-add" onClick={quickAdd} aria-label={`Add ${product.name} to cart`}>
        {added ? <Check size={16} /> : <Plus size={16} />}
      </button>
      <div className="pcard-info">
        <h3>{product.name}</h3>
        <span className="price">{fmtPrice(product.price)}</span>
      </div>
      <p className="pcard-tagline">{product.tagline}</p>
    </div>
  );
}

// ── QuickView modal ─────────────────────────────────────────
export function QuickView({ product, onClose }) {
  const { dispatch, state } = useStore();
  const [size, setSize] = useState(null);
  const [added, setAdded] = useState(false);
  const stock = state.stock[product?.id] ?? 0;

  const add = () => {
    const chosen = size || product.sizes?.[0] || 'One size';
    dispatch({ type: 'cart/add', id: product.id, size: chosen });
    setAdded(true);
    setTimeout(onClose, 850);
  };

  return (
    <AnimatePresence>
      {product && (
        <motion.div
          className="qv-scrim"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          <motion.div
            className="qv"
            initial={{ opacity: 0, y: 24, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog" aria-label={product.name}
          >
            <button className="qv-close" aria-label="Close" onClick={onClose}><X size={19} /></button>
            <div className="qv-media"><img src={product.image} alt={product.name} /></div>
            <div className="qv-body">
              {product.badge && <span className="pcard-badge qv-badge">{product.badge}</span>}
              <h2>{product.name}</h2>
              <p className="qv-tagline">{product.tagline}</p>
              <p className="qv-story">{product.story}</p>
              <div className="qv-price price">{fmtPrice(product.price)}</div>

              {product.sizes && (
                <div className="qv-sizes">
                  <span className="qv-label">Size</span>
                  <div className="qv-size-row">
                    {product.sizes.map((s) => (
                      <button
                        key={s}
                        className={`qv-size ${size === s ? 'on' : ''}`}
                        onClick={() => setSize(s)}
                      >{s}</button>
                    ))}
                  </div>
                </div>
              )}

              <button
                className={`btn btn-block ${added ? 'btn-added' : 'btn-primary'}`}
                onClick={add}
                disabled={stock === 0}
              >
                {stock === 0 ? 'Sold out' : added ? (<><Check size={16} /> Added to cart</>) : 'Add to cart'}
              </button>
              <p className="qv-note">
                {stock > 0 && stock <= 5
                  ? `Only ${stock} left in the shop`
                  : 'Pay with MoMo or card. Delivered nationwide in 24 to 48 hours.'}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
