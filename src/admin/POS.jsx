import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, Plus, Minus, Trash2, X, Check, CheckCheck, Printer, Copy,
  MessageCircle, Banknote, Smartphone, CreditCard, UserCheck, Percent,
  Tag, ShoppingBag, TriangleAlert, RotateCcw, Store, ScanLine,
} from 'lucide-react';
import { useStore, orderTotal } from '../context/StoreContext';
import { DEPARTMENTS } from '../data/products';
import { BRAND, fmtPrice } from '../config';
import './styles/pos.css';

// ── The counter screen ──────────────────────────────────────
// Staff live on this page all day, so every action is one tap
// away and nothing is hidden behind a menu. Tap a tile to ring
// an item, tap Complete sale, hand over the receipt.

const PAYMENTS = [
  { id: 'Cash', icon: Banknote },
  { id: 'MTN MoMo', icon: Smartphone },
  { id: 'Telecel Cash', icon: Smartphone },
  { id: 'AT Money', icon: Smartphone },
  { id: 'Card', icon: CreditCard },
];

const WALK_IN = { name: 'Walk-in customer', phone: '', area: 'In-store', address: '', note: '' };

// a transparent placeholder so a missing photo never shows a broken icon
const BLANK = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 4 5%22%3E%3C/svg%3E';

// ── small guards, so no figure can ever print as NaN ─────────
const safe = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const money = (n) => fmtPrice(Math.round(safe(n)));
const num = (v) => {
  const n = parseFloat(String(v ?? '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const digitsOf = (s) => String(s ?? '').replace(/\D/g, '');
const flatten = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sizesOf = (p) => (p && Array.isArray(p.sizes) && p.sizes.length ? p.sizes : ['One size']);
const lineKey = (id, size) => `${id}::${size}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function stamp(iso) {
  const d = new Date(iso);
  const when = Number.isNaN(d.getTime()) ? new Date() : d;
  return {
    day: when.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
    time: when.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }),
  };
}

// 024 555 0192 becomes 233245550192 so WhatsApp opens the right chat
function waNumber(phone) {
  const d = digitsOf(phone);
  if (!d) return '';
  if (d.startsWith('233')) return d;
  if (d.startsWith('0')) return `233${d.slice(1)}`;
  if (d.length === 9) return `233${d}`;
  return d;
}

// the receipt as plain text, for WhatsApp and for the clipboard
function receiptText(r) {
  const o = r.order;
  const { day, time } = stamp(o.date);
  const out = [BRAND.name, BRAND.address, `Tel ${BRAND.phone}`, ''];
  out.push(`Receipt ${o.id}`);
  out.push(`${day}, ${time}`);
  if (o.customer?.name && o.customer.name !== WALK_IN.name) {
    out.push(`Customer: ${o.customer.name}${o.customer.phone ? ` (${o.customer.phone})` : ''}`);
  }
  out.push('');
  (o.items || []).forEach((l) => {
    const size = l.size && l.size !== 'One size' ? ` (${l.size})` : '';
    out.push(`${l.qty} x ${l.name}${size}   ${money(safe(l.price) * safe(l.qty))}`);
  });
  out.push('');
  out.push(`Subtotal: ${money(o.subtotal)}`);
  if (safe(o.discount) > 0) out.push(`Discount: -${money(o.discount)}`);
  out.push(`TOTAL: ${money(o.total)}`);
  out.push(`Paid by ${o.payment}`);
  if (r.cash && r.tendered > 0) {
    out.push(`Cash given: ${money(r.tendered)}`);
    out.push(`Change: ${money(r.change)}`);
  }
  out.push('');
  out.push('Thank you for shopping with us. Please come again.');
  return out.join('\n');
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the old way
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

export default function POS() {
  const { state, dispatch, allProducts, findProduct } = useStore();

  const [dept, setDept] = useState('all');
  const [query, setQuery] = useState('');
  const [sale, setSale] = useState([]);                 // [{ key, id, size, qty }]
  const [discountMode, setDiscountMode] = useState('percent');
  const [discountInput, setDiscountInput] = useState('');
  const [customerId, setCustomerId] = useState(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [payment, setPayment] = useState('Cash');
  const [tendered, setTendered] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [note, setNote] = useState(null);               // inline feedback line
  const [justAdded, setJustAdded] = useState(null);
  const [copyState, setCopyState] = useState('idle');   // idle | done | failed

  const noteTimer = useRef(null);
  const addedTimer = useRef(null);
  const copyTimer = useRef(null);
  const pending = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => () => {
    clearTimeout(noteTimer.current);
    clearTimeout(addedTimer.current);
    clearTimeout(copyTimer.current);
  }, []);

  const flash = (text, tone = 'ok') => {
    setNote({ text, tone, id: Date.now() });
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => setNote(null), 2800);
  };

  // ── today at the counter ──────────────────────────────────
  const today = useMemo(() => {
    const key = new Date().toDateString();
    const list = state.orders.filter(
      (o) => o.source === 'pos' && o.status !== 'cancelled' && new Date(o.date).toDateString() === key
    );
    return {
      count: list.length,
      revenue: list.reduce((s, o) => s + safe(orderTotal(o)), 0),
      units: list.reduce((s, o) => s + o.items.reduce((n, l) => n + safe(l.qty), 0), 0),
    };
  }, [state.orders]);

  // ── catalogue ─────────────────────────────────────────────
  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = dept === 'all' ? allProducts : allProducts.filter((p) => p.dept === dept);
    if (q) {
      const flat = flatten(q);
      list = list.filter(
        (p) =>
          String(p.name ?? '').toLowerCase().includes(q) ||
          String(p.tagline ?? '').toLowerCase().includes(q) ||
          (flat.length > 1 && flatten(p.sku).includes(flat))
      );
    }
    return [...list].sort((a, b) => {
      const outA = (state.stock[a.id] ?? 0) <= 0 ? 1 : 0;
      const outB = (state.stock[b.id] ?? 0) <= 0 ? 1 : 0;
      if (outA !== outB) return outA - outB;
      return String(a.name ?? '').localeCompare(String(b.name ?? ''));
    });
  }, [allProducts, dept, query, state.stock]);

  const unitsOf = (id) => sale.reduce((n, l) => (l.id === id ? n + l.qty : n), 0);

  // ── the sale ──────────────────────────────────────────────
  const saleLines = useMemo(
    () =>
      sale.map((l) => {
        const p = findProduct(l.id);
        return {
          ...l,
          product: p,
          name: p?.name ?? 'Item no longer listed',
          price: safe(p?.price),
          image: p?.image || BLANK,
          sizes: sizesOf(p),
        };
      }),
    [sale, findProduct]
  );

  const units = saleLines.reduce((n, l) => n + l.qty, 0);
  const subtotal = saleLines.reduce((s, l) => s + l.price * l.qty, 0);

  const discountAsked = num(discountInput);
  const discount = useMemo(() => {
    if (subtotal <= 0 || discountAsked <= 0) return 0;
    const raw =
      discountMode === 'percent'
        ? (subtotal * Math.min(100, discountAsked)) / 100
        : discountAsked;
    return Math.min(subtotal, Math.max(0, Math.round(raw)));
  }, [subtotal, discountMode, discountAsked]);

  const total = Math.max(0, subtotal - discount);
  const discountCapped =
    discountAsked > 0 &&
    subtotal > 0 &&
    (discountMode === 'percent' ? discountAsked > 100 : Math.round(discountAsked) > subtotal);

  const tenderedValue = Math.max(0, Math.round(num(tendered)));
  const showChange = payment === 'Cash' && tendered.trim() !== '';
  const change = tenderedValue - total;

  const tenderOptions = useMemo(() => {
    if (total <= 0) return [];
    const set = new Set([total]);
    [50, 100, 200].forEach((step) => {
      const up = Math.ceil(total / step) * step;
      if (up > total) set.add(up);
    });
    return [...set].sort((a, b) => a - b).slice(0, 4);
  }, [total]);

  const attached = customerId ? state.customers.find((c) => c.id === customerId) : null;

  const customerMatches = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    const qd = digitsOf(q);
    return state.customers
      .filter(
        (c) =>
          String(c.name ?? '').toLowerCase().includes(q) ||
          (qd.length > 1 && digitsOf(c.phone).includes(qd))
      )
      .slice(0, 5);
  }, [customerQuery, state.customers]);

  // ── actions ───────────────────────────────────────────────
  function addToSale(p, size) {
    if (!p) return false;
    const available = state.stock[p.id] ?? 0;
    if (available <= 0) {
      flash(`${p.name} is out of stock.`, 'warn');
      return false;
    }
    if (unitsOf(p.id) >= available) {
      flash(`Only ${plural(available, 'piece')} of ${p.name} left on the shelf.`, 'warn');
      return false;
    }

    const chosen = size ?? sizesOf(p)[0];
    const key = lineKey(p.id, chosen);
    setSale((prev) => {
      const already = prev.reduce((n, l) => (l.id === p.id ? n + l.qty : n), 0);
      if (already >= available) return prev;
      return prev.some((l) => l.key === key)
        ? prev.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l))
        : [...prev, { key, id: p.id, size: chosen, qty: 1 }];
    });

    setJustAdded(p.id);
    clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setJustAdded(null), 700);
    flash(`${p.name} added. Subtotal ${money(subtotal + safe(p.price))}.`);
    return true;
  }

  function step(key, delta) {
    setSale((prev) => {
      const line = prev.find((l) => l.key === key);
      if (!line) return prev;
      if (delta > 0) {
        const available = state.stock[line.id] ?? 0;
        const already = prev.reduce((n, l) => (l.id === line.id ? n + l.qty : n), 0);
        if (already >= available) return prev;
      }
      return prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0);
    });
  }

  function removeLine(key) {
    setSale((prev) => prev.filter((l) => l.key !== key));
  }

  function changeSize(key, size) {
    setSale((prev) => {
      const line = prev.find((l) => l.key === key);
      if (!line) return prev;
      const next = lineKey(line.id, size);
      if (next === key) return prev;
      if (prev.some((l) => l.key === next)) {
        return prev
          .filter((l) => l.key !== key)
          .map((l) => (l.key === next ? { ...l, qty: l.qty + line.qty } : l));
      }
      return prev.map((l) => (l.key === key ? { ...l, key: next, size } : l));
    });
  }

  function resetSale() {
    setSale([]);
    setDiscountInput('');
    setDiscountMode('percent');
    setCustomerId(null);
    setCustomerQuery('');
    setPayment('Cash');
    setTendered('');
    setConfirmClear(false);
  }

  function onSearchSubmit(e) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const flat = flatten(q);
    const exact = allProducts.filter((p) => flatten(p.sku) === flat);
    const tail = flat.length > 1 ? allProducts.filter((p) => flatten(p.sku).endsWith(flat)) : [];
    const hit =
      exact[0] ||
      (tail.length === 1 ? tail[0] : null) ||
      (products.length === 1 ? products[0] : null);

    if (hit) {
      if (addToSale(hit)) {
        setQuery('');
        searchRef.current?.focus();
      }
      return;
    }
    if (products.length > 1) {
      flash(`${products.length} items match that. Tap the one you want.`);
      return;
    }
    flash(`Nothing in the shop matches "${q}".`, 'warn');
  }

  function completeSale() {
    if (saleLines.length === 0) return;

    const customer = attached
      ? {
          name: attached.name,
          phone: attached.phone || '',
          area: attached.area || 'In-store',
          address: attached.address || '',
          note: '',
        }
      : { ...WALK_IN };

    const cash = payment === 'Cash';
    pending.current = {
      cash,
      tendered: cash ? tenderedValue : 0,
      change: cash && tenderedValue > 0 ? Math.max(0, tenderedValue - total) : 0,
      // used only if the store somehow hands back no order
      snapshot: {
        id: `YC-${safe(state.nextOrderNo)}`,
        date: new Date().toISOString(),
        payment,
        customer,
        items: saleLines.map((l) => ({
          id: l.id, qty: l.qty, size: l.size, name: l.name, price: l.price,
        })),
        subtotal,
        discount,
        total,
      },
    };

    dispatch({
      type: 'order/place',
      source: 'pos',
      payment,
      customer,
      items: sale.map((l) => ({ id: l.id, qty: l.qty, size: l.size })),
      discount,
    });

    resetSale();
    setQuery('');
  }

  // the store writes the order, we pick the real one up for the receipt
  useEffect(() => {
    if (!pending.current) return;
    const { snapshot, ...rest } = pending.current;
    pending.current = null;
    const placed = state.orders[0];
    setReceipt({ order: placed && placed.source === 'pos' ? placed : snapshot, ...rest });
    setCopyState('idle');
  }, [state.orders]);

  function closeReceipt() {
    setReceipt(null);
    setCopyState('idle');
    clearTimeout(copyTimer.current);
  }

  // Escape closes whatever is open, receipt first
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (receipt) closeReceipt();
      else if (confirmClear) setConfirmClear(false);
      else if (customerQuery) setCustomerQuery('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [receipt, confirmClear, customerQuery]);

  // ── receipt sharing ───────────────────────────────────────
  const receiptBody = receipt ? receiptText(receipt) : '';
  const receiptPhone = receipt ? waNumber(receipt.order?.customer?.phone) : '';
  const receiptFirstName = String(receipt?.order?.customer?.name ?? '').split(' ')[0];

  function shareWhatsApp() {
    const text = encodeURIComponent(receiptBody);
    const url = receiptPhone ? `https://wa.me/${receiptPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  async function copyReceipt() {
    const ok = await copyToClipboard(receiptBody);
    setCopyState(ok ? 'done' : 'failed');
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyState('idle'), 3000);
  }

  // ── render ────────────────────────────────────────────────
  return (
    <div className="till">
      <div className="till-head">
        <div className="till-head-live">
          <span className="live-chip"><span className="pulse-dot" /> Till open</span>
          <span className="till-head-figure">
            Counter takings today
            <strong className="price">{money(today.revenue)}</strong>
            <em>{plural(today.count, 'sale')}, {plural(today.units, 'item')}</em>
          </span>
        </div>
        <span className="panel-note">{plural(allProducts.length, 'item')} on the shelf</span>
      </div>

      {/* ── catalogue ── */}
      <section className="till-catalogue">
        <form className="till-tools" onSubmit={onSearchSubmit}>
          <div className="shop-search till-search">
            <Search size={14} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a name or a code"
              aria-label="Search the shelf by name or code"
              autoFocus
            />
            {query && (
              <button type="button" className="till-clear-search" onClick={() => setQuery('')} aria-label="Clear the search">
                <X size={13} />
              </button>
            )}
          </div>

          <div className="shop-chips till-chips">
            <button type="button" className={`chip ${dept === 'all' ? 'on' : ''}`} onClick={() => setDept('all')}>
              All
            </button>
            {DEPARTMENTS.map((d) => (
              <button
                key={d.id}
                type="button"
                className={`chip ${dept === d.id ? 'on' : ''}`}
                onClick={() => setDept(d.id)}
              >
                {d.label}
              </button>
            ))}
          </div>

          <p className="till-hint">
            <ScanLine size={13} /> Type a code like YC-M01 and press Enter to ring it up straight away.
          </p>
        </form>

        {/* one element that swaps its own text, so quick taps never queue
            behind an exit animation */}
        <AnimatePresence>
          {note && (
            <motion.p
              key="till-flash"
              className={`till-flash till-flash--${note.tone}`}
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22 }}
            >
              {note.tone === 'warn' ? <TriangleAlert size={15} /> : <Check size={15} />}
              {note.text}
            </motion.p>
          )}
        </AnimatePresence>

        {products.length === 0 ? (
          <div className="till-empty">
            <Search size={22} />
            <p>Nothing matches that search.</p>
            <span>Try a shorter word, or clear the filters to see the whole shelf.</span>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { setQuery(''); setDept('all'); }}
            >
              Show everything
            </button>
          </div>
        ) : (
          <div className="till-grid">
            {products.map((p) => {
              const qty = state.stock[p.id] ?? 0;
              const out = qty <= 0;
              const low = !out && qty <= (state.settings?.lowStockThreshold ?? 5);
              const inSale = unitsOf(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`till-tile ${out ? 'is-out' : ''} ${justAdded === p.id ? 'is-added' : ''}`}
                  onClick={() => addToSale(p)}
                  disabled={out}
                  aria-label={`Add ${p.name}, ${money(p.price)}, to the sale`}
                >
                  <span className="till-tile-shot">
                    <img
                      src={p.image || BLANK}
                      alt=""
                      loading="lazy"
                      onError={(e) => { e.currentTarget.src = BLANK; }}
                    />
                    {inSale > 0 && <span className="till-tile-count">{inSale}</span>}
                    <span className={`till-tile-stock ${low ? 'is-low' : ''} ${out ? 'is-out' : ''}`}>
                      {out ? 'Out of stock' : `${qty} left`}
                    </span>
                    {justAdded === p.id && (
                      <span className="till-tile-tick"><Check size={20} /></span>
                    )}
                  </span>
                  <span className="till-tile-body">
                    <strong>{p.name}</strong>
                    <span className="price">{money(p.price)}</span>
                    <em className="till-tile-sku">{p.sku || p.id}</em>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ── current sale ── */}
      <aside className="till-sale">
        <div className="till-sale-head">
          <h2><ShoppingBag size={15} /> Current sale</h2>
          <span className="till-sale-count">{units > 0 ? plural(units, 'item') : 'Empty'}</span>
        </div>

        {saleLines.length === 0 ? (
          <div className="till-sale-empty">
            <Store size={22} />
            <p>Nothing on the counter yet.</p>
            <span>Tap an item on the left to start, or type its code in the search box and press Enter.</span>
          </div>
        ) : (
          <div className="till-lines">
            {saleLines.map((l) => {
              const available = state.stock[l.id] ?? 0;
              const atMax = unitsOf(l.id) >= available;
              return (
                <div className="till-line" key={l.key}>
                  <img
                    className="till-line-shot"
                    src={l.image}
                    alt=""
                    onError={(e) => { e.currentTarget.src = BLANK; }}
                  />
                  <div className="till-line-main">
                    <strong>{l.name}</strong>
                    <span className="till-line-meta">
                      <span className="price">{money(l.price)}</span> each
                      {l.sizes.length > 1 ? (
                        <select
                          value={l.size}
                          onChange={(e) => changeSize(l.key, e.target.value)}
                          aria-label={`Size for ${l.name}`}
                        >
                          {l.sizes.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <em>{l.size}</em>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="till-line-remove"
                    onClick={() => removeLine(l.key)}
                    aria-label={`Take ${l.name} off the sale`}
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="till-line-foot">
                    <div className="till-qty">
                      <button type="button" onClick={() => step(l.key, -1)} aria-label={`One less ${l.name}`}>
                        <Minus size={12} />
                      </button>
                      <span>{l.qty}</span>
                      <button
                        type="button"
                        onClick={() => step(l.key, 1)}
                        disabled={atMax}
                        aria-label={`One more ${l.name}`}
                        title={atMax ? 'That is everything on the shelf' : undefined}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span className="price till-line-total">{money(l.price * l.qty)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* discount */}
        <div className="till-block">
          <div className="till-block-head">
            <span className="till-block-title">Discount</span>
            <div className="till-seg">
              <button
                type="button"
                className={discountMode === 'percent' ? 'on' : ''}
                onClick={() => setDiscountMode('percent')}
              >
                <Percent size={11} /> Percent
              </button>
              <button
                type="button"
                className={discountMode === 'amount' ? 'on' : ''}
                onClick={() => setDiscountMode('amount')}
              >
                <Tag size={11} /> Amount
              </button>
            </div>
          </div>
          <div className="till-input">
            <input
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value.replace(/[^\d.]/g, ''))}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              inputMode="decimal"
              placeholder="0"
              aria-label={discountMode === 'percent' ? 'Discount percent' : 'Discount amount in cedis'}
            />
            <span>{discountMode === 'percent' ? '%' : BRAND.currency}</span>
          </div>
          {discount > 0 && (
            <p className="till-block-note">
              Taking {money(discount)} off. {discountCapped ? 'Capped so the total never goes below zero.' : `The customer pays ${money(total)}.`}
            </p>
          )}
        </div>

        {/* customer */}
        <div className="till-block">
          <div className="till-block-head">
            <span className="till-block-title">Customer</span>
            {!attached && <span className="till-block-note till-block-note--quiet">Walk-in</span>}
          </div>

          {attached ? (
            <div className="till-customer">
              <span className="till-customer-icon"><UserCheck size={15} /></span>
              <div>
                <strong>{attached.name}</strong>
                <span className="till-customer-sub">
                  {attached.phone || 'No phone on file'}{attached.area ? ` · ${attached.area}` : ''}
                </span>
              </div>
              <button
                type="button"
                className="till-detach"
                onClick={() => { setCustomerId(null); setCustomerQuery(''); flash('Back to a walk-in sale.'); }}
                aria-label={`Take ${attached.name} off this sale`}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (customerMatches[0]) {
                  setCustomerId(customerMatches[0].id);
                  setCustomerQuery('');
                  flash(`${customerMatches[0].name} is on this sale.`);
                }
              }}
            >
              <div className="shop-search till-search till-search--sm">
                <Search size={13} />
                <input
                  value={customerQuery}
                  onChange={(e) => setCustomerQuery(e.target.value)}
                  placeholder="Search a name or number"
                  aria-label="Search customers by name or phone number"
                />
              </div>
              {customerQuery.trim() && (
                customerMatches.length > 0 ? (
                  <ul className="till-cust-list">
                    {customerMatches.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerId(c.id);
                            setCustomerQuery('');
                            flash(`${c.name} is on this sale.`);
                          }}
                        >
                          <strong>{c.name}</strong>
                          <span>{c.phone || 'No phone'}{c.area ? ` · ${c.area}` : ''}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="till-block-note">
                    Nobody on record matches that. The sale stays as a walk-in.
                  </p>
                )
              )}
            </form>
          )}
        </div>

        {/* payment */}
        <div className="till-block">
          <span className="till-block-title">Payment</span>
          <div className="till-pays">
            {PAYMENTS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`till-pay ${payment === m.id ? 'on' : ''}`}
                onClick={() => setPayment(m.id)}
                aria-pressed={payment === m.id}
              >
                <m.icon size={15} strokeWidth={1.7} /> {m.id}
              </button>
            ))}
          </div>

          {payment === 'Cash' && (
            <div className="till-cash">
              <div className="till-input">
                <span>{BRAND.currency}</span>
                <input
                  value={tendered}
                  onChange={(e) => setTendered(e.target.value.replace(/[^\d.]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  inputMode="decimal"
                  placeholder="Cash given"
                  aria-label="Cash given by the customer"
                />
              </div>
              {tenderOptions.length > 0 && (
                <div className="till-tenders">
                  {tenderOptions.map((v) => (
                    <button key={v} type="button" className="till-tender" onClick={() => setTendered(String(v))}>
                      {v === total ? 'Exact' : money(v)}
                    </button>
                  ))}
                </div>
              )}
              {showChange && (
                change >= 0 ? (
                  <p className="till-change">
                    <CheckCheck size={14} /> Change due <strong className="price">{money(change)}</strong>
                  </p>
                ) : (
                  <p className="till-change is-short">
                    <TriangleAlert size={14} />
                    Short by <strong className="price">{money(-change)}</strong>. Collect the rest before you finish.
                  </p>
                )
              )}
            </div>
          )}
        </div>

        {/* totals */}
        <div className="till-totals">
          <div className="till-row">
            <span>Subtotal</span>
            <span className="price">{money(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="till-row till-row--off">
              <span>Discount</span>
              <span className="price">-{money(discount)}</span>
            </div>
          )}
          <div className="till-row till-row--grand">
            <span>Total</span>
            <strong className="price">{money(total)}</strong>
          </div>
        </div>

        <div className="till-actions">
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={saleLines.length === 0}
            onClick={completeSale}
          >
            Complete sale · {money(total)}
          </button>

          {confirmClear ? (
            <div className="till-confirm">
              <p>Clear this sale and start again? The items go back on the shelf.</p>
              <div className="till-confirm-row">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmClear(false)}>
                  Keep it
                </button>
                <button
                  type="button"
                  className="btn btn-sm till-danger"
                  onClick={() => { resetSale(); flash('Sale cleared. Ready for the next customer.'); }}
                >
                  Yes, clear it
                </button>
              </div>
            </div>
          ) : (
            saleLines.length > 0 && (
              <button type="button" className="till-clear-btn" onClick={() => setConfirmClear(true)}>
                <RotateCcw size={13} /> Clear sale
              </button>
            )
          )}
        </div>
      </aside>

      {/* ── receipt ── */}
      <AnimatePresence>
        {receipt && (
          <motion.div
            className="qv-scrim till-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeReceipt}
          >
            <motion.div
              className="till-receipt"
              role="dialog"
              aria-modal="true"
              aria-label="Sale receipt"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="drawer-close till-receipt-close till-noprint"
                onClick={closeReceipt}
                aria-label="Close the receipt"
              >
                <X size={18} />
              </button>

              <div className="till-receipt-seal"><Check size={20} /></div>
              <h3>{BRAND.name}</h3>
              <p className="till-receipt-sub">{BRAND.address}</p>
              <p className="till-receipt-sub">Tel {BRAND.phone}</p>

              <div className="till-receipt-meta">
                <span>{receipt.order.id}</span>
                <span>{stamp(receipt.order.date).day}, {stamp(receipt.order.date).time}</span>
              </div>

              {receipt.order.customer?.name && receipt.order.customer.name !== WALK_IN.name && (
                <p className="till-receipt-cust">
                  Sold to {receipt.order.customer.name}
                  {receipt.order.customer.phone ? ` · ${receipt.order.customer.phone}` : ''}
                </p>
              )}

              <div className="till-receipt-lines">
                {(receipt.order.items || []).map((l, i) => (
                  <div key={`${l.id}-${l.size}-${i}`}>
                    <span>
                      {l.qty} x {l.name}
                      {l.size && l.size !== 'One size' ? ` (${l.size})` : ''}
                    </span>
                    <span>{money(safe(l.price) * safe(l.qty))}</span>
                  </div>
                ))}
              </div>

              <div className="till-receipt-sums">
                <div><span>Subtotal</span><span>{money(receipt.order.subtotal)}</span></div>
                {safe(receipt.order.discount) > 0 && (
                  <div><span>Discount</span><span>-{money(receipt.order.discount)}</span></div>
                )}
                <div className="till-receipt-grand"><span>Total</span><span>{money(receipt.order.total)}</span></div>
                <div><span>Paid by</span><span>{receipt.order.payment}</span></div>
                {receipt.cash && receipt.tendered > 0 && (
                  <>
                    <div><span>Cash given</span><span>{money(receipt.tendered)}</span></div>
                    <div><span>Change given</span><span>{money(receipt.change)}</span></div>
                  </>
                )}
              </div>

              <p className="till-receipt-thanks">Thank you for shopping with us. Please come again.</p>

              <div className="till-receipt-actions till-noprint">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => window.print()}>
                  <Printer size={14} /> Print
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={shareWhatsApp}>
                  <MessageCircle size={14} /> {receiptPhone ? `Send to ${receiptFirstName}` : 'WhatsApp'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={copyReceipt}>
                  {copyState === 'done' ? <Check size={14} /> : <Copy size={14} />}
                  {copyState === 'done' ? 'Copied' : 'Copy'}
                </button>
              </div>

              {copyState !== 'idle' && (
                <p className="till-receipt-note till-noprint">
                  {copyState === 'done'
                    ? 'Receipt copied. Paste it anywhere you like.'
                    : 'Copying is blocked in this browser. Use WhatsApp or Print instead.'}
                </p>
              )}

              <button type="button" className="btn btn-primary btn-block till-noprint" onClick={closeReceipt}>
                <RotateCcw size={14} /> New sale
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
