import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Smartphone, CreditCard, Banknote, ShieldCheck, Check, Copy, MessageCircle } from 'lucide-react';
import { useStore, deliveryFor, FREE_DELIVERY_FROM } from '../context/StoreContext';
import { fmtPrice, BRAND } from '../config';
import { Reveal } from '../components/ProductBits';

const PAY_METHODS = [
  { id: 'MTN MoMo', icon: Smartphone, note: 'Prompt on your phone, instant' },
  { id: 'Telecel Cash', icon: Smartphone, note: 'Prompt on your phone, instant' },
  { id: 'AT Money', icon: Smartphone, note: 'Prompt on your phone, instant' },
  { id: 'Card', icon: CreditCard, note: 'Visa or Mastercard, secure' },
  { id: 'Cash on delivery', icon: Banknote, note: 'Accra and Tema only' },
];

const AREAS = [
  'Accra, same day', 'Tema, same day', 'Kasoa, next day',
  'Kumasi, 24 to 48h', 'Takoradi, 24 to 48h', 'Everywhere else, 48h',
];

export default function Checkout() {
  const { state, dispatch, cartLines, cartTotal } = useStore();
  const [form, setForm] = useState({ name: '', phone: '', area: AREAS[0], address: '', note: '' });
  const [payment, setPayment] = useState('MTN MoMo');
  const [phase, setPhase] = useState('form');
  const [placed, setPlaced] = useState(null);
  const [copied, setCopied] = useState(false);

  const delivery = deliveryFor(cartTotal);
  const canPlace = cartLines.length > 0 && form.name.trim() && form.phone.trim();

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const place = () => {
    if (!canPlace) return;
    setPhase('paying');
    setTimeout(() => {
      dispatch({
        type: 'order/place',
        source: 'web',
        payment,
        customer: {
          name: form.name.trim(),
          phone: form.phone.trim(),
          area: form.area.split(',')[0],
          address: form.address.trim(),
          note: form.note.trim(),
        },
        items: cartLines.map((c) => ({ id: c.id, qty: c.qty, size: c.size })),
      });
      setPlaced({ total: cartTotal + delivery });
      setPhase('done');
    }, 2000);
  };

  // the reducer stamps the real order; read it back for the tracking code
  const order = phase === 'done' ? state.lastOrder : null;

  const copyRef = () => {
    if (!order) return;
    navigator.clipboard?.writeText(order.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  if (cartLines.length === 0 && phase === 'form') {
    return (
      <div className="page">
        <div className="container shop-empty">
          <p>Your cart is empty. Nothing to check out yet.</p>
          <Link to="/shop" className="btn btn-primary">Browse the shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="container">
        <Reveal className="page-head">
          <span className="eyebrow">Almost yours</span>
          <h1>Check<em className="accent-italic">out</em></h1>
        </Reveal>

        <AnimatePresence mode="wait">
          {phase === 'done' ? (
            <motion.div
              key="done" className="co-done"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="co-done-seal"><Check size={30} strokeWidth={2.2} /></div>
              <h2>Order received</h2>
              <p className="co-done-big price">{fmtPrice(placed.total)} · {payment}</p>
              <p>
                Thank you, {form.name.trim().split(' ')[0]}. We are packing your order now and
                you will get a WhatsApp confirmation on {form.phone}.
              </p>

              {order && (
                <div className="co-ref">
                  <span className="qv-label">Your order number</span>
                  <div className="co-ref-row">
                    <strong>{order.id}</strong>
                    <button className="btn btn-sm btn-outline" onClick={copyRef}>
                      {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
                    </button>
                  </div>
                  <p className="co-ref-note">Keep this number. You can follow your delivery with it any time.</p>
                </div>
              )}

              <div className="co-done-actions">
                {order && (
                  <Link to={`/track?order=${order.id}`} className="btn btn-primary">Track this order</Link>
                )}
                <a
                  className="btn btn-outline"
                  href={`https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(
                    `Hello ${BRAND.name}, I just placed order ${order?.id ?? ''}.`
                  )}`}
                  target="_blank" rel="noreferrer"
                >
                  <MessageCircle size={15} /> Message the shop
                </a>
                <Link to="/shop" className="btn btn-outline">Keep shopping</Link>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" className="co-grid" exit={{ opacity: 0 }}>
              <div className="co-form">
                <h3 className="co-step">1 · Delivery details</h3>
                <div className="field-row">
                  <label className="field">
                    <span>Full name</span>
                    <input value={form.name} onChange={set('name')} placeholder="Ama Mensah" />
                  </label>
                  <label className="field">
                    <span>Phone, for MoMo and updates</span>
                    <input value={form.phone} onChange={set('phone')} placeholder="024 000 0000" inputMode="tel" />
                  </label>
                </div>
                <label className="field">
                  <span>Delivery area</span>
                  <select value={form.area} onChange={set('area')}>
                    {AREAS.map((a) => <option key={a}>{a}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Address or landmark</span>
                  <input value={form.address} onChange={set('address')} placeholder="House number, street, nearest landmark" />
                </label>
                <label className="field">
                  <span>Note for the rider, optional</span>
                  <input value={form.note} onChange={set('note')} placeholder="Call when you reach the junction" />
                </label>

                <h3 className="co-step">2 · How would you like to pay?</h3>
                <div className="pay-grid">
                  {PAY_METHODS.map((m) => (
                    <button
                      key={m.id}
                      className={`pay-card ${payment === m.id ? 'on' : ''}`}
                      onClick={() => setPayment(m.id)}
                      type="button"
                    >
                      <m.icon size={19} strokeWidth={1.6} />
                      <strong>{m.id}</strong>
                      <span>{m.note}</span>
                    </button>
                  ))}
                </div>
                <p className="co-secure"><ShieldCheck size={15} /> Payments secured by Paystack. Demo mode, no money moves.</p>
              </div>

              <aside className="co-summary">
                <h3>Your order</h3>
                {cartLines.map((c) => (
                  <div className="co-line" key={`${c.id}-${c.size}`}>
                    <img src={c.product.image} alt="" />
                    <div><strong>{c.product.name}</strong><span>Size {c.size} × {c.qty}</span></div>
                    <span className="price">{fmtPrice(c.product.price * c.qty)}</span>
                  </div>
                ))}
                <div className="co-totals">
                  <div><span>Subtotal</span><span className="price">{fmtPrice(cartTotal)}</span></div>
                  <div><span>Delivery</span><span className="price">{delivery === 0 ? 'Free' : fmtPrice(delivery)}</span></div>
                  <div className="co-grand"><span>Total</span><span className="price">{fmtPrice(cartTotal + delivery)}</span></div>
                </div>
                {delivery > 0 && (
                  <p className="co-free-note">Spend {fmtPrice(FREE_DELIVERY_FROM - cartTotal)} more for free delivery.</p>
                )}
                <button className="btn btn-primary btn-block" disabled={!canPlace || phase === 'paying'} onClick={place}>
                  {phase === 'paying' ? 'Confirming payment' : `Pay ${fmtPrice(cartTotal + delivery)}`}
                </button>
                {phase === 'paying' && (
                  <motion.p className="co-paying" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <span className="pulse-dot" /> Check your phone and approve the {payment} prompt.
                  </motion.p>
                )}
              </aside>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
