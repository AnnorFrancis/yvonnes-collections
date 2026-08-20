import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useStore, deliveryFor, FREE_DELIVERY_FROM } from '../context/StoreContext';
import { fmtPrice } from '../config';

export default function CartDrawer({ open, onClose }) {
  const { dispatch, cartLines, cartTotal } = useStore();
  const navigate = useNavigate();
  const delivery = deliveryFor(cartTotal);

  const checkout = () => {
    onClose();
    navigate('/checkout');
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="drawer-scrim"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="drawer"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            role="dialog" aria-label="Shopping cart"
          >
            <div className="drawer-head">
              <h3>Your cart</h3>
              <button className="drawer-close" aria-label="Close cart" onClick={onClose}><X size={20} /></button>
            </div>

            {cartLines.length === 0 ? (
              <div className="drawer-empty">
                <ShoppingBag size={38} strokeWidth={1} />
                <p>Your cart is empty.</p>
                <button className="btn btn-primary" onClick={() => { onClose(); navigate('/shop'); }}>
                  Browse the shop
                </button>
              </div>
            ) : (
              <>
                <div className="drawer-items">
                  {cartLines.map((c, i) => (
                    <div className="drawer-item" key={`${c.id}-${c.size}`}>
                      <img src={c.product.image} alt={c.product.name} />
                      <div className="drawer-item-info">
                        <strong>{c.product.name}</strong>
                        <span className="drawer-item-meta">Size {c.size}</span>
                        <span className="price">{fmtPrice(c.product.price * c.qty)}</span>
                      </div>
                      <div className="drawer-item-actions">
                        <div className="qty">
                          <button aria-label="Reduce quantity" onClick={() => dispatch({ type: 'cart/qty', index: i, delta: -1 })}><Minus size={14} /></button>
                          <span>{c.qty}</span>
                          <button aria-label="Increase quantity" onClick={() => dispatch({ type: 'cart/qty', index: i, delta: 1 })}><Plus size={14} /></button>
                        </div>
                        <button
                          className="drawer-remove"
                          aria-label={`Remove ${c.product.name}`}
                          onClick={() => dispatch({ type: 'cart/remove', index: i })}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="drawer-foot">
                  <div className="drawer-total">
                    <span>Subtotal</span>
                    <strong className="price">{fmtPrice(cartTotal)}</strong>
                  </div>
                  <p className="drawer-note">
                    {delivery === 0
                      ? 'Delivery is free on this order.'
                      : `Add ${fmtPrice(FREE_DELIVERY_FROM - cartTotal)} more for free delivery.`}
                  </p>
                  <button className="btn btn-primary btn-block" onClick={checkout}>Checkout</button>
                </div>
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
