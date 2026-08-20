import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, ReceiptText, Package, Truck, Home, Check, Ban,
  Clock, MapPin, MessageCircle, RotateCcw, ShoppingBag,
} from 'lucide-react';
import { useStore, STATUS_FLOW, STATUS_PUBLIC } from '../context/StoreContext';
import { BRAND, fmtPrice } from '../config';
import '../styles/track.css';

// ── Public order tracking ───────────────────────────────────
// Customers type the number from their confirmation message plus the
// phone they ordered with. We read the same live store the shop uses,
// so the moment the shop marks an order packed, this page says so.

const clean = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const digits = (v) => String(v ?? '').replace(/\D/g, '');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const money = (v) => fmtPrice(num(v));

const safeDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

const timeLabel = (iso) => {
  const d = safeDate(iso);
  if (!d) return '';
  return d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const dateLabel = (iso) => {
  const d = safeDate(iso);
  if (!d) return '';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const dayLabel = (iso) => {
  const d = safeDate(iso);
  if (!d) return '';
  const a = new Date(d); a.setHours(0, 0, 0, 0);
  const b = new Date(); b.setHours(0, 0, 0, 0);
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `on ${dateLabel(iso)}`;
};

const STEP_ICON = { new: ReceiptText, processing: Package, ready: Truck, delivered: Home };

const STATUS_BLURB = {
  new: 'We have your order and we are getting it ready for you.',
  processing: 'Your items are being packed at the shop right now.',
  ready: 'Your parcel has left the shop and is on its way to you.',
  delivered: 'Delivered. Thank you for shopping with us.',
  cancelled: 'This order was cancelled, so nothing is on the way.',
};

const TIMELINE_NOTE = {
  new: 'We received your order.',
  processing: 'Your items are being packed at the shop.',
  ready: 'Handed over to our rider for delivery.',
  delivered: 'Delivered to you. Enjoy it.',
  cancelled: 'The order was cancelled.',
};

// Places our own riders reach the same day
const FAST_AREAS = [
  'accra', 'tema', 'in-store', 'east legon', 'legon', 'spintex', 'osu', 'achimota',
  'cantonments', 'airport', 'labone', 'labadi', 'madina', 'adenta', 'dansoman',
  'teshie', 'lapaz', 'la paz', 'dome', 'haatso', 'kaneshie', 'tesano', 'abelemkpe',
  'ridge', 'sakumono', 'baatsona', 'circle', 'dzorwulu', 'community', 'ashaiman',
];
const isFastArea = (area) => {
  const a = String(area ?? '').toLowerCase().trim();
  return a.length > 0 && FAST_AREAS.some((f) => a.includes(f));
};

function estimateArrival(order) {
  if (!order || order.status === 'delivered' || order.status === 'cancelled') return null;
  const placed = safeDate(order.date);
  const hours = placed ? (Date.now() - placed.getTime()) / 3600000 : 0;
  const late = 'It is taking a little longer than usual. Send us a message and we will chase it for you.';
  if (isFastArea(order.customer?.area)) {
    if (hours <= 30) {
      return {
        line: 'Expected today before evening.',
        sub: `${order.customer.area} runs go out the same day, so please keep your phone close.`,
      };
    }
    return { line: 'Expected today, our rider is on this one.', sub: late };
  }
  if (hours <= 48) {
    return {
      line: 'Expected within 24 to 48 hours.',
      sub: 'We will call you shortly before the rider reaches you.',
    };
  }
  return { line: 'Expected very soon, it is already on the road.', sub: late };
}

function lookup(orders, rawNumber, rawPhone) {
  const q = clean(rawNumber);
  const tail = digits(rawPhone).slice(-4);
  if (!q || tail.length < 4) return { order: null, reason: 'short' };

  const byNumber = (orders ?? []).filter((o) => {
    const keys = [clean(o.id), clean(o.ref)];
    if (keys.includes(q)) return true;
    return /^\d+$/.test(q) && keys.includes(`YC${q}`);
  });
  if (byNumber.length === 0) return { order: null, reason: 'none' };

  const hit = byNumber.find((o) => {
    const stored = digits(o.customer?.phone);
    return stored.length >= 4 && stored.slice(-4) === tail;
  });
  return hit ? { order: hit, reason: 'ok' } : { order: null, reason: 'phone', id: byNumber[0].id };
}

const waLink = (text) => `https://wa.me/${BRAND.whatsapp}?text=${encodeURIComponent(text)}`;

export default function Track() {
  const { state } = useStore();
  const [params, setParams] = useSearchParams();
  const deepLinked = useRef((params.get('order') ?? '').trim().length > 0);

  const [orderNo, setOrderNo] = useState(() => (params.get('order') ?? '').trim());
  const [phone, setPhone] = useState('');
  const [foundId, setFoundId] = useState(null);
  const [error, setError] = useState('');
  const numberRef = useRef(null);

  // Read the order back out of the live store every render, so a status
  // change made at the shop shows up here without a refresh.
  const order = useMemo(
    () => (foundId ? state.orders.find((o) => o.id === foundId) ?? null : null),
    [foundId, state.orders],
  );

  // If the shop removes an order while a customer is looking at it
  useEffect(() => {
    if (foundId && !order) {
      setFoundId(null);
      setError('That order is no longer in our records. Please send us a message and we will sort it out.');
    }
  }, [foundId, order]);

  // An order placed on this device this session, offered as a shortcut
  const recent = useMemo(() => {
    const last = state.lastOrder;
    if (!last || digits(last.customer?.phone).length < 4) return null;
    return state.orders.some((o) => o.id === last.id) ? last : null;
  }, [state.lastOrder, state.orders]);

  const search = (numberValue, phoneValue) => {
    const res = lookup(state.orders, numberValue, phoneValue);
    if (res.order) {
      setError('');
      setFoundId(res.order.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setFoundId(null);
    if (res.reason === 'phone') {
      setError(`We found ${res.id}, but that phone number does not match the one on the order. Please try the number you used when you ordered.`);
    } else {
      setError('We could not find an order with those details. Please check the number on your confirmation message, or message us on WhatsApp and we will look it up for you.');
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!clean(orderNo)) {
      setError('Please type your order number first.');
      numberRef.current?.focus();
      return;
    }
    if (digits(phone).length < 4) {
      setError('Please type the phone number you used on the order.');
      return;
    }
    search(orderNo, phone);
  };

  const trackAnother = () => {
    setFoundId(null);
    setOrderNo('');
    setPhone('');
    setError('');
    deepLinked.current = false;
    if (params.get('order')) setParams({}, { replace: true });
    requestAnimationFrame(() => numberRef.current?.focus());
  };

  const useRecent = () => {
    if (!recent) return;
    setOrderNo(recent.id);
    setPhone(recent.customer?.phone ?? '');
    search(recent.id, recent.customer?.phone ?? '');
  };

  const cancelled = order?.status === 'cancelled';
  const stepIndex = order ? STATUS_FLOW.indexOf(order.status) : -1;
  const eta = estimateArrival(order);
  const timeline = order ? [...(order.timeline ?? [])] : [];
  const cancelNote = cancelled
    ? (timeline.filter((t) => t.status === 'cancelled').pop()?.note ?? '')
    : '';

  const firstAt = (status) => timeline.find((t) => t.status === status)?.at ?? null;

  return (
    <div className="page">
      <div className="container trk">
        <motion.div
          className="page-head"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="eyebrow">Order tracking</span>
          <h1>Where is my <em className="accent-italic">order</em>?</h1>
          <p className="trk-lede">
            Type your order number and the phone number you used, and we will show you exactly
            how far your parcel has reached.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!order ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <form className="trk-card trk-form" onSubmit={submit} noValidate>
                <div className="field-row">
                  <label className="field">
                    <span>Order number</span>
                    <input
                      ref={numberRef}
                      value={orderNo}
                      onChange={(e) => { setOrderNo(e.target.value); if (error) setError(''); }}
                      placeholder="YC-1041"
                      autoFocus={!deepLinked.current}
                      autoComplete="off"
                      spellCheck="false"
                      aria-label="Order number or tracking reference"
                    />
                  </label>
                  <label className="field">
                    <span>Phone used on the order</span>
                    <input
                      value={phone}
                      onChange={(e) => { setPhone(e.target.value); if (error) setError(''); }}
                      placeholder="024 000 0000"
                      inputMode="tel"
                      autoFocus={deepLinked.current}
                      autoComplete="tel"
                      aria-label="Phone number used on the order"
                    />
                  </label>
                </div>

                <div className="trk-form-actions">
                  <button type="submit" className="btn btn-primary">
                    <Search size={16} strokeWidth={1.8} /> Track my order
                  </button>
                  {recent && (
                    <button type="button" className="trk-quick" onClick={useRecent}>
                      Track {recent.id}, the one you just placed
                    </button>
                  )}
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      className="trk-error"
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      role="status"
                    >
                      <p>{error}</p>
                      <a
                        className="btn btn-outline btn-sm"
                        href={waLink(`Hello ${BRAND.name}, I am trying to track my order${clean(orderNo) ? ` ${orderNo}` : ''}. Please can you help me check it?`)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <MessageCircle size={15} strokeWidth={1.8} /> WhatsApp the shop
                      </a>
                    </motion.div>
                  )}
                </AnimatePresence>

                <p className="trk-hint">
                  Your order number is in the confirmation message we sent you. It looks like
                  YC-1041, and the longer tracking reference works too. Spaces and small letters
                  are fine.
                </p>
              </form>

              <p className="trk-footnote">
                Nothing to track yet? <Link to="/shop" className="trk-inline-link">Have a look at what is in the shop</Link>,
                or call us on {BRAND.phone}.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={order.id}
              className="trk-result"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <section className="trk-card trk-summary">
                <p className="trk-found">
                  <Check size={15} strokeWidth={2.4} />
                  {cancelled
                    ? 'Found it. Here are the full details of this order.'
                    : 'Found it. Here is where your order has reached.'}
                </p>

                <div className="trk-idline">
                  <span className="trk-idchip">{order.id}</span>
                  <span className="trk-ref">Tracking reference {order.ref}</span>
                </div>
                <p className="trk-placed">
                  Placed {dayLabel(order.date)} at {timeLabel(order.date)}
                  {order.payment ? ` · ${order.payment === 'Cash on delivery' ? 'Paying cash on delivery' : `Paid with ${order.payment}`}` : ''}
                </p>

                <h2 className={`trk-status-h ${cancelled ? 'is-cancelled' : ''}`}>
                  {STATUS_PUBLIC[order.status] ?? 'On its way'}
                </h2>
                <p className="trk-status-sub">{STATUS_BLURB[order.status] ?? 'Your order is with our team.'}</p>

                {!cancelled && order.status !== 'delivered' && (
                  <span className="trk-live"><span className="pulse-dot" /> This page updates itself as the shop works on your order</span>
                )}

                {cancelled ? (
                  <div className="trk-cancelled">
                    <span className="trk-cancelled-icon"><Ban size={20} strokeWidth={1.8} /></span>
                    <div>
                      <strong>This order was cancelled</strong>
                      <p>{cancelNote || 'Nothing is on the way and nothing more will be charged. If this was a mistake, message us and we will put it right.'}</p>
                    </div>
                  </div>
                ) : (
                  <ol className="trk-steps">
                    {STATUS_FLOW.map((s, i) => {
                      const done = order.status === 'delivered' || i < stepIndex;
                      const now = order.status !== 'delivered' && i === stepIndex;
                      const Icon = STEP_ICON[s] ?? Package;
                      const at = firstAt(s);
                      return (
                        <li key={s} className={`trk-step ${done ? 'is-done' : ''} ${now ? 'is-now' : ''}`}>
                          <span className="trk-step-dot">
                            {done ? <Check size={18} strokeWidth={2.6} /> : <Icon size={17} strokeWidth={1.8} />}
                          </span>
                          <span className="trk-step-text">
                            <span className="trk-step-label">{STATUS_PUBLIC[s]}</span>
                            <span className="trk-step-when">
                              {at ? `${dateLabel(at)}, ${timeLabel(at)}` : now ? 'Happening now' : 'Still to come'}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}

                {eta && (
                  <div className="trk-eta">
                    <Clock size={17} strokeWidth={1.8} />
                    <div>
                      <strong>{eta.line}</strong>
                      <span>{eta.sub}</span>
                    </div>
                  </div>
                )}
              </section>

              <div className="trk-cols">
                <div className="trk-colstack">
                  <section className="trk-card trk-block">
                    <h3>Every update on this order</h3>
                    <ol className="trk-log">
                      {timeline.length === 0 ? (
                        <li><div className="trk-log-body"><strong>Order received</strong><span>{dateLabel(order.date)}, {timeLabel(order.date)}</span></div></li>
                      ) : (
                        timeline.map((t, i) => (
                          <li key={`${t.status}-${t.at}-${i}`}>
                            <div className="trk-log-body">
                              <strong>{STATUS_PUBLIC[t.status] ?? 'Update'}</strong>
                              <span className="trk-log-when">{dateLabel(t.at)}, {timeLabel(t.at)}</span>
                              <p>{t.note || TIMELINE_NOTE[t.status] || 'Your order moved along.'}</p>
                            </div>
                          </li>
                        ))
                      )}
                    </ol>
                  </section>

                  <section className="trk-card trk-block">
                    <h3>What you bought</h3>
                    {(order.items ?? []).length === 0 ? (
                      <p className="trk-empty">No items were recorded on this order. Please message us and we will check it.</p>
                    ) : (
                      <div className="trk-items">
                        {order.items.map((l, i) => (
                          <div className="trk-item" key={`${l.id}-${l.size}-${i}`}>
                            <div className="trk-item-media">
                              {l.image
                                ? <img src={l.image} alt={l.name} loading="lazy" decoding="async" />
                                : <ShoppingBag size={18} strokeWidth={1.6} />}
                            </div>
                            <div className="trk-item-info">
                              <strong>{l.name || 'Item'}</strong>
                              <span>{l.size ? `Size ${l.size} · ` : ''}{num(l.qty)} {num(l.qty) === 1 ? 'piece' : 'pieces'}</span>
                            </div>
                            <span className="price trk-item-price">{money(num(l.price) * num(l.qty))}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>

                <div className="trk-colstack">
                  <section className="trk-card trk-block">
                    <h3>Delivering to</h3>
                    <div className="trk-where">
                      <MapPin size={17} strokeWidth={1.8} />
                      <div>
                        <strong>{order.customer?.area || 'Area not given'}</strong>
                        <p>{order.customer?.address || 'No address on file, so our rider will call you for directions.'}</p>
                        {order.customer?.note && <p className="trk-where-note">Your note: {order.customer.note}</p>}
                      </div>
                    </div>
                    <div className="trk-money">
                      <div><span>Subtotal</span><span className="price">{money(order.subtotal)}</span></div>
                      <div>
                        <span>Delivery</span>
                        <span className="price">{num(order.delivery) === 0 ? 'Free' : money(order.delivery)}</span>
                      </div>
                      {num(order.discount) > 0 && (
                        <div><span>Discount</span><span className="price">less {money(order.discount)}</span></div>
                      )}
                      <div className="trk-total"><span>Total</span><span className="price">{money(order.total)}</span></div>
                    </div>
                  </section>

                  <section className="trk-card trk-block trk-help">
                    <h3>Need a hand?</h3>
                    <p>Ask us anything about this order and we will reply on WhatsApp. Please keep your order number handy.</p>
                    <a
                      className="btn btn-primary btn-block"
                      href={waLink(`Hello ${BRAND.name}, I would like to ask about my order ${order.id} (${order.ref}).`)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle size={16} strokeWidth={1.8} /> Message us about this order
                    </a>
                    <p className="trk-help-phone">Or call the shop on {BRAND.phone}. {BRAND.hours}.</p>
                  </section>
                </div>
              </div>

              <div className="trk-actions">
                <button type="button" className="btn btn-outline" onClick={trackAnother}>
                  <RotateCcw size={16} strokeWidth={1.8} /> Track another order
                </button>
                <Link to="/shop" className="btn btn-outline">
                  <ShoppingBag size={16} strokeWidth={1.8} /> Keep shopping
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
