import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, X, Copy, Check, ArrowRight, Trash2, Phone, MapPin,
  MessageCircle, Store, Globe, Inbox, Ban, Package, Truck,
  CheckCircle2, ClipboardList, StickyNote,
} from 'lucide-react';
import {
  useStore, orderTotal, orderUnits, STATUS_LABEL, STATUS_FLOW,
  STATUS_NEXT, STATUS_ACTION, STATUS_PUBLIC, PERIODS, ordersInPeriod,
} from '../context/StoreContext';
import { BRAND, fmtPrice } from '../config';
import './styles/orders.css';

// ── small helpers ───────────────────────────────────────────
const STATUS_ICON = {
  new: ClipboardList,
  processing: Package,
  ready: Truck,
  delivered: CheckCircle2,
  cancelled: Ban,
};

// Notes written onto the timeline when staff move an order along.
const ADVANCE_NOTE = {
  processing: 'Packing started',
  ready: 'Handed to the rider',
  delivered: 'Customer received the order',
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'new', label: STATUS_LABEL.new },
  { id: 'processing', label: STATUS_LABEL.processing },
  { id: 'ready', label: STATUS_LABEL.ready },
  { id: 'delivered', label: STATUS_LABEL.delivered },
  { id: 'cancelled', label: STATUS_LABEL.cancelled },
  { id: 'web', label: 'Website' },
  { id: 'pos', label: 'Walk-in' },
];

const SORTS = [
  { id: 'newest', label: 'Newest first' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'biggest', label: 'Biggest value' },
];

const money = (n) => fmtPrice(Number.isFinite(Number(n)) ? Number(n) : 0);

// stands in for a product photo that will not load, so no broken icon shows
const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

const asDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};
const dayText = (iso) => {
  const d = asDate(iso);
  return d ? d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' }) : 'No date';
};
const fullDayText = (iso) => {
  const d = asDate(iso);
  return d ? d.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) : 'No date';
};
const timeText = (iso) => {
  const d = asDate(iso);
  return d ? d.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }) : '';
};

const digitsOnly = (v) => String(v || '').replace(/\D/g, '');

// 024 555 0192 becomes 233245550192 so WhatsApp can open the chat.
const waNumber = (phone) => {
  const d = digitsOnly(phone);
  if (!d) return '';
  if (d.startsWith('233')) return d;
  if (d.startsWith('0')) return `233${d.slice(1)}`;
  return `233${d}`;
};

const pillClass = (status) =>
  status === 'ready' ? 'pill ord-pill--ready'
    : status === 'cancelled' ? 'pill ord-pill--cancelled'
      : `pill pill--${status}`;

const itemSummary = (o) =>
  (o.items || []).length
    ? o.items.map((l) => `${l.name || 'Item'} x${l.qty}`).join(', ')
    : 'No items on this order';

const safeUnits = (o) => (Array.isArray(o.items) ? Number(orderUnits(o)) || 0 : 0);

const subtotalOf = (o) =>
  Number(o.subtotal ?? (o.items || []).reduce((s, l) => s + (Number(l.price) || 0) * (Number(l.qty) || 0), 0)) || 0;

async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the old school way
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// ── the screen ──────────────────────────────────────────────
export function OrdersPage() {
  const { state, dispatch } = useStore();
  const orders = state.orders || [];

  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [flash, setFlash] = useState('');

  const flashTimer = useRef(null);
  const headBox = useRef(null);

  const say = (msg) => {
    setFlash(msg);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 3200);
  };
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  // ── filtering ──
  const scoped = useMemo(() => {
    const inPeriod = ordersInPeriod(orders, period);
    const q = query.trim().toLowerCase();
    const qDigits = digitsOnly(query);
    if (!q) return inPeriod;
    return inPeriod.filter((o) => {
      const name = (o.customer?.name || '').toLowerCase();
      const phone = digitsOnly(o.customer?.phone);
      return (
        (o.id || '').toLowerCase().includes(q) ||
        (o.ref || '').toLowerCase().includes(q) ||
        name.includes(q) ||
        (qDigits.length >= 3 && phone.includes(qDigits))
      );
    });
  }, [orders, period, query]);

  const counts = useMemo(() => {
    const c = { all: scoped.length, web: 0, pos: 0, new: 0, processing: 0, ready: 0, delivered: 0, cancelled: 0 };
    scoped.forEach((o) => {
      if (o.source === 'web') c.web += 1;
      if (o.source === 'pos') c.pos += 1;
      if (c[o.status] !== undefined) c[o.status] += 1;
    });
    return c;
  }, [scoped]);

  const shown = useMemo(() => {
    const list = scoped.filter((o) => {
      if (filter === 'all') return true;
      if (filter === 'web' || filter === 'pos') return o.source === filter;
      return o.status === filter;
    });
    const stamp = (o) => { const d = asDate(o.date); return d ? d.getTime() : 0; };
    const byDate = (a, b) => stamp(b) - stamp(a);
    if (sort === 'oldest') return [...list].sort((a, b) => stamp(a) - stamp(b));
    if (sort === 'biggest') return [...list].sort((a, b) => (Number(orderTotal(b)) || 0) - (Number(orderTotal(a)) || 0));
    return [...list].sort(byDate);
  }, [scoped, filter, sort]);

  const shownValue = shown.reduce(
    (s, o) => (o.status === 'cancelled' ? s : s + (Number(orderTotal(o)) || 0)),
    0
  );

  // ── selection ──
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedSet.has(o.id)),
    [orders, selectedSet]
  );

  useEffect(() => {
    // an order that got deleted should never stay selected
    setSelected((sel) => {
      const live = new Set(orders.map((o) => o.id));
      const next = sel.filter((id) => live.has(id));
      return next.length === sel.length ? sel : next;
    });
  }, [orders]);

  const visibleIds = shown.map((o) => o.id);
  const allVisibleOn = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someVisibleOn = visibleIds.some((id) => selectedSet.has(id));

  useEffect(() => {
    if (headBox.current) headBox.current.indeterminate = someVisibleOn && !allVisibleOn;
  }, [someVisibleOn, allVisibleOn]);

  const toggleOne = (id) =>
    setSelected((sel) => (sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]));

  const toggleVisible = () => {
    setConfirmDelete(false);
    setSelected((sel) => {
      if (allVisibleOn) return sel.filter((id) => !visibleIds.includes(id));
      return [...new Set([...sel, ...visibleIds])];
    });
  };

  const clearSelection = () => { setSelected([]); setConfirmDelete(false); };

  // ── actions ──
  const advance = (o) => {
    const next = STATUS_NEXT[o.status];
    if (!next) return;
    dispatch({ type: 'order/status', id: o.id, status: next, note: ADVANCE_NOTE[next] || '' });
    say(`${o.id} is now ${STATUS_LABEL[next].toLowerCase()}.`);
  };

  const bulkStatus = (status) => {
    const targets = selectedOrders.filter((o) => o.status !== 'cancelled' && o.status !== status);
    if (!targets.length) {
      say('Nothing to change. Those orders are already there or cancelled.');
      return;
    }
    dispatch({ type: 'order/bulkStatus', ids: targets.map((o) => o.id), status });
    const skipped = selectedOrders.length - targets.length;
    say(
      `${targets.length} order${targets.length === 1 ? '' : 's'} marked ${STATUS_LABEL[status].toLowerCase()}` +
      (skipped ? `, ${skipped} left alone (already there or cancelled).` : '.')
    );
    clearSelection();
  };

  const doDelete = () => {
    const n = selectedOrders.length;
    if (!n) return;
    const ids = selectedOrders.map((o) => o.id);
    dispatch({ type: 'order/delete', ids });
    if (openId && ids.includes(openId)) setOpenId(null);
    say(`${n} order${n === 1 ? '' : 's'} removed from the book.`);
    clearSelection();
  };

  const resetFilters = () => {
    setFilter('all');
    setQuery('');
    setPeriod('all');
    setSort('newest');
  };

  // ── drawer ──
  const openOrder = openId ? orders.find((o) => o.id === openId) : null;
  useEffect(() => {
    if (openId && !orders.some((o) => o.id === openId)) setOpenId(null);
  }, [openId, orders]);

  const filtersOn = filter !== 'all' || query.trim() !== '' || period !== 'all';
  const periodLabel = (PERIODS.find((p) => p.id === period) || {}).label || 'All time';

  return (
    <div className="ord-page">
      <div className="panel ord-toolbar">
        <div className="shop-chips ord-chips">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`chip ${filter === f.id ? 'on' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
              <span className="ord-chip-n">{counts[f.id] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className="ord-tools">
          <div className="shop-search ord-search">
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Order no, tracking code, name or phone"
              aria-label="Search orders"
            />
            {query && (
              <button type="button" className="ord-clear" aria-label="Clear search" onClick={() => setQuery('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className="ord-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Period"
          >
            {PERIODS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>

          <select
            className="ord-select"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort orders"
          >
            {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>

          <span className="ord-count">
            <span className="live-chip"><span className="pulse-dot" /> live</span>
            Showing {shown.length} of {orders.length} order{orders.length === 1 ? '' : 's'}
            <span className="ord-count-sub">{periodLabel} · <span className="price">{money(shownValue)}</span> booked</span>
          </span>
        </div>
      </div>

      <AnimatePresence>
        {flash && (
          <motion.p
            className="ord-flash"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            <Check size={15} /> {flash}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="panel ord-panel">
        {shown.length === 0 ? (
          <div className="ord-empty">
            <Inbox size={38} strokeWidth={1} />
            {orders.length === 0 ? (
              <>
                <h3>No orders yet</h3>
                <p>The moment someone checks out on the website, or you ring a sale on the POS, it lands right here.</p>
                <Link className="btn btn-primary btn-sm" to="/admin/pos">Open the POS</Link>
              </>
            ) : (
              <>
                <h3>Nothing matches that</h3>
                <p>
                  {filtersOn
                    ? 'Try widening the period or clearing the search. Your other orders are still safe in the book.'
                    : 'There is nothing to show for this view.'}
                </p>
                <button type="button" className="btn btn-outline btn-sm" onClick={resetFilters}>
                  Show all orders
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="ord-tablewrap">
            <table className="adm-table ord-table">
              <thead>
                <tr>
                  <th className="ord-cb">
                    <input
                      ref={headBox}
                      type="checkbox"
                      className="ord-check"
                      checked={allVisibleOn}
                      onChange={toggleVisible}
                      aria-label="Select every order shown"
                    />
                  </th>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => {
                  const on = selectedSet.has(o.id);
                  const units = safeUnits(o);
                  const next = STATUS_NEXT[o.status];
                  return (
                    <tr
                      key={o.id}
                      className={`ord-row ${on ? 'on' : ''}`}
                      tabIndex={0}
                      onClick={() => setOpenId(o.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(o.id); }}
                    >
                      <td className="ord-cb" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="ord-check"
                          checked={on}
                          onChange={() => toggleOne(o.id)}
                          aria-label={`Select order ${o.id}`}
                        />
                      </td>
                      <td>
                        <span className="mono ord-id">{o.id}</span>
                        <span className="td-sub ord-src">
                          {o.source === 'web' ? <Globe size={11} /> : <Store size={11} />}
                          {o.source === 'web' ? 'Website' : 'Walk-in'}
                        </span>
                      </td>
                      <td className="ord-nowrap">
                        {dayText(o.date)}
                        <span className="td-sub">{timeText(o.date)}</span>
                      </td>
                      <td>
                        {o.customer?.name || 'Walk-in customer'}
                        <span className="td-sub">{o.customer?.phone || o.customer?.area || 'No phone on file'}</span>
                      </td>
                      <td className="td-items">
                        <span className="ord-items-text">{itemSummary(o)}</span>
                        <span className="td-sub">{units} item{units === 1 ? '' : 's'}</span>
                      </td>
                      <td className="ord-nowrap">{o.payment || 'Not recorded'}</td>
                      <td className="price ord-nowrap">{money(orderTotal(o))}</td>
                      <td><span className={pillClass(o.status)}>{STATUS_LABEL[o.status] || o.status}</span></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {next ? (
                          <button type="button" className="row-action" onClick={() => advance(o)}>
                            {STATUS_ACTION[o.status]} <ArrowRight size={12} />
                          </button>
                        ) : (
                          <button type="button" className="row-action ord-view" onClick={() => setOpenId(o.id)}>
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {shown.length > 0 && (
          <p className="panel-footnote">
            Tap any row to open the full order, message the customer on WhatsApp or cancel it.
          </p>
        )}
      </div>

      <AnimatePresence>
        {selectedOrders.length > 0 && (
          <motion.div
            className="ord-bulkbar"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {confirmDelete ? (
              <>
                <span className="ord-bulk-count ord-bulk-count--warn">
                  <Trash2 size={15} />
                  Delete {selectedOrders.length} order{selectedOrders.length === 1 ? '' : 's'} for good?
                  <span className="ord-bulk-sub">This wipes them from the book. Stock is not returned, so cancel instead if the goods came back.</span>
                </span>
                <div className="ord-bulk-btns">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>
                    Keep them
                  </button>
                  <button type="button" className="btn btn-sm ord-btn-danger" onClick={doDelete}>
                    Yes, delete
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="ord-bulk-count">
                  <strong>{selectedOrders.length}</strong> selected
                  <button type="button" className="ord-bulk-clear" onClick={clearSelection}>Clear</button>
                </span>
                <div className="ord-bulk-btns">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => bulkStatus('processing')}>
                    <Package size={14} /> Mark packing
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => bulkStatus('ready')}>
                    <Truck size={14} /> Mark out for delivery
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => bulkStatus('delivered')}>
                    <CheckCircle2 size={14} /> Mark delivered
                  </button>
                  <button type="button" className="btn btn-sm ord-btn-danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {openOrder && (
          <OrderDrawer
            key={openOrder.id}
            order={openOrder}
            onClose={() => setOpenId(null)}
            onAdvance={advance}
            onSay={say}
            dispatch={dispatch}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── order detail drawer ─────────────────────────────────────
function OrderDrawer({ order, onClose, onAdvance, onSay, dispatch }) {
  const [copied, setCopied] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const copyTimer = useRef(null);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (cancelOpen) setCancelOpen(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancelOpen, onClose]);

  const o = order;
  const c = o.customer || {};
  const next = STATUS_NEXT[o.status];
  const sub = subtotalOf(o);
  const delivery = Number(o.delivery) || 0;
  const discount = Number(o.discount) || 0;
  const total = Number(orderTotal(o)) || 0;
  const units = safeUnits(o);

  const steps = Array.isArray(o.timeline) && o.timeline.length
    ? o.timeline
    : [{ status: o.status, at: o.date, note: '' }];
  const pending = o.status === 'cancelled' || !STATUS_FLOW.includes(o.status)
    ? []
    : STATUS_FLOW.slice(STATUS_FLOW.indexOf(o.status) + 1);

  const wa = waNumber(c.phone);
  const waHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
      `Hello ${c.name || 'there'}, this is ${BRAND.name}. Your order ${o.id} (tracking ${o.ref}) is ${STATUS_PUBLIC[o.status] || STATUS_LABEL[o.status]}. Thank you for shopping with us.`
    )}`
    : '';

  const doCopy = async () => {
    const ok = await copyText(o.ref || o.id);
    if (!ok) { onSay('Could not reach the clipboard. Long press the code to copy it.'); return; }
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  };

  const submitCancel = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    dispatch({ type: 'order/cancel', id: o.id, reason: reason.trim() || 'Cancelled by the shop' });
    onSay(`${o.id} cancelled. The items went back on the shelf.`);
    setCancelOpen(false);
    setReason('');
  };

  return (
    <>
      <motion.div
        className="qv-scrim ord-scrim"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.aside
        className="ord-drawer"
        role="dialog"
        aria-label={`Order ${o.id}`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
      >
        <header className="ord-dhead">
          <div>
            <h2>{o.id}</h2>
            <span className="ord-dhead-sub">
              {o.source === 'web' ? <Globe size={12} /> : <Store size={12} />}
              {o.source === 'web' ? 'Website order' : 'Sold at the counter'} · {fullDayText(o.date)}, {timeText(o.date)}
            </span>
          </div>
          <button type="button" className="drawer-close" aria-label="Close order" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="ord-dbody">
          <div className="ord-refrow">
            <div>
              <span className="ord-mini">Tracking code</span>
              <strong className="mono ord-ref">{o.ref || o.id}</strong>
            </div>
            <button type="button" className={`row-action ${copied ? 'ord-copied' : ''}`} onClick={doCopy}>
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>

          <div className="ord-statusrow">
            <span className={pillClass(o.status)}>{STATUS_LABEL[o.status] || o.status}</span>
            <span className="ord-mini">Customer sees: {STATUS_PUBLIC[o.status] || STATUS_LABEL[o.status]}</span>
          </div>

          <section className="ord-block">
            <h3>Progress</h3>
            <ol className="ord-timeline">
              {steps.map((s, i) => {
                const Icon = STATUS_ICON[s.status] || ClipboardList;
                const current = i === steps.length - 1;
                return (
                  <li
                    key={`${s.status}-${s.at}-${i}`}
                    className={`ord-step ${current ? 'now' : 'done'} ${s.status === 'cancelled' ? 'off' : ''}`}
                  >
                    <span className="ord-step-dot"><Icon size={12} /></span>
                    <div>
                      <strong>{STATUS_LABEL[s.status] || s.status}</strong>
                      <span className="ord-step-when">{dayText(s.at)}, {timeText(s.at)}</span>
                      {s.note ? <span className="ord-step-note">{s.note}</span> : null}
                    </div>
                  </li>
                );
              })}
              {pending.map((s) => {
                const Icon = STATUS_ICON[s] || ClipboardList;
                return (
                  <li key={`pending-${s}`} className="ord-step wait">
                    <span className="ord-step-dot"><Icon size={12} /></span>
                    <div>
                      <strong>{STATUS_LABEL[s]}</strong>
                      <span className="ord-step-when">Not yet</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="ord-block">
            <h3>Customer</h3>
            <div className="ord-cust">
              <strong>{c.name || 'Walk-in customer'}</strong>
              {c.phone ? (
                <a className="ord-custline ord-link" href={`tel:${digitsOnly(c.phone)}`}>
                  <Phone size={13} /> {c.phone}
                </a>
              ) : (
                <span className="ord-custline ord-muted"><Phone size={13} /> No phone on file</span>
              )}
              {(c.area || c.address) && (
                <span className="ord-custline">
                  <MapPin size={13} />
                  {[c.area, c.address].filter(Boolean).join(' · ')}
                </span>
              )}
              {c.note ? (
                <span className="ord-custline ord-note"><StickyNote size={13} /> {c.note}</span>
              ) : null}

              {wa ? (
                <a
                  className="btn btn-outline btn-sm btn-block ord-wa"
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle size={15} /> Message on WhatsApp
                </a>
              ) : (
                <p className="ord-mini ord-muted">Add a phone number to this customer and you can message them from here.</p>
              )}
            </div>
          </section>

          <section className="ord-block">
            <h3>{units} item{units === 1 ? '' : 's'}</h3>
            <div className="ord-lines">
              {(o.items || []).map((l, i) => (
                <div className="ord-line" key={`${l.id}-${l.size}-${i}`}>
                  {l.image
                    ? <img src={l.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.src = BLANK_IMG; }} />
                    : <span className="ord-line-img" aria-hidden="true" />}
                  <div className="ord-line-info">
                    <strong>{l.name || 'Item'}</strong>
                    <span className="td-sub">
                      {l.size ? `Size ${l.size} · ` : ''}{l.qty} x {money(l.price)}
                    </span>
                  </div>
                  <span className="price">{money((Number(l.price) || 0) * (Number(l.qty) || 0))}</span>
                </div>
              ))}
              {(o.items || []).length === 0 && <p className="ord-mini ord-muted">No items were recorded on this order.</p>}
            </div>
          </section>

          <section className="ord-block">
            <h3>Money</h3>
            <div className="ord-money">
              <div><span>Subtotal</span><span className="price">{money(sub)}</span></div>
              {(delivery > 0 || o.source === 'web') && (
                <div>
                  <span>Delivery</span>
                  <span className="price">{delivery > 0 ? money(delivery) : 'Free'}</span>
                </div>
              )}
              {discount > 0 && (
                <div><span>Discount</span><span className="price">-{money(discount)}</span></div>
              )}
              <div className="ord-money-total">
                <span>Total</span>
                <span className="price">{money(total)}</span>
              </div>
              <div className="ord-money-pay"><span>Paid with</span><span>{o.payment || 'Not recorded'}</span></div>
            </div>
          </section>
        </div>

        <footer className="ord-dfoot">
          {cancelOpen ? (
            <form className="ord-cancelbox" onSubmit={submitCancel}>
              <strong>Cancel {o.id}?</strong>
              <p>Every item on this order goes straight back onto the shelf, so your stock counts stay honest.</p>
              <label className="field">
                <span>Reason (the customer never sees this)</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitCancel(e); }}
                  placeholder="e.g. Customer changed her mind"
                  autoFocus
                />
              </label>
              <div className="ord-cancelbtns">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setCancelOpen(false)}>
                  Keep the order
                </button>
                <button type="submit" className="btn btn-sm ord-btn-danger">
                  Yes, cancel it
                </button>
              </div>
            </form>
          ) : (
            <>
              {next && (
                <button type="button" className="btn btn-primary btn-block" onClick={() => onAdvance(o)}>
                  {STATUS_ACTION[o.status]} <ArrowRight size={15} />
                </button>
              )}
              {o.status === 'delivered' && (
                <p className="ord-done"><CheckCircle2 size={15} /> Delivered and closed. Nothing left to do.</p>
              )}
              {o.status === 'cancelled' && (
                <p className="ord-done ord-done--off"><Ban size={15} /> Cancelled. The stock is back on the shelf.</p>
              )}
              {o.status !== 'cancelled' && o.status !== 'delivered' && (
                <button type="button" className="ord-cancel-link" onClick={() => setCancelOpen(true)}>
                  Cancel order
                </button>
              )}
            </>
          )}
        </footer>
      </motion.aside>
    </>
  );
}
