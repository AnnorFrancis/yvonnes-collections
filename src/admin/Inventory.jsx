import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Boxes, Wallet, AlertTriangle, PackageX, Search, X, Plus, Minus, Check,
  PackageCheck, Globe, Store, RefreshCw, Info,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { lowStock, stockValue, productStats } from './metrics';
import { DEPARTMENTS } from '../data/products';
import { fmtPrice } from '../config';
import './styles/inventory.css';

// ── Inventory ───────────────────────────────────────────────
// The stock room, in one screen. Everything here writes straight
// into the shared store, so the website and the POS see the same
// numbers the moment they change.

const MAX_QTY = 9999;

const clampQty = (v) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, MAX_QTY);
};

const money = (n) => fmtPrice(Number.isFinite(Number(n)) ? Number(n) : 0);

const barWidth = (qty, max) => {
  const top = Number(max);
  if (!Number.isFinite(top) || top <= 0) return 0;
  const p = (clampQty(qty) / top) * 100;
  if (!Number.isFinite(p) || p <= 0) return 0;
  return Math.min(100, Math.round(p));
};

const deptLabel = (id) => {
  const found = DEPARTMENTS.find((d) => d.id === id);
  if (found) return found.label;
  if (!id) return 'Unsorted';
  return String(id).charAt(0).toUpperCase() + String(id).slice(1);
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const SORTS = [
  { id: 'urgent', label: 'Emptiest first' },
  { id: 'most', label: 'Fullest first' },
  { id: 'name', label: 'Name, A to Z' },
  { id: 'value', label: 'Highest value' },
  { id: 'dept', label: 'By department' },
];

// ── one row of the big table ────────────────────────────────
function StockRow({ row, threshold, barMax, checked, saved, onToggle, onSet }) {
  const out = row.qty === 0;
  const low = !out && row.qty <= threshold;

  return (
    <tr className={`${checked ? 'invp-row-on' : ''} ${out ? 'invp-row-out' : ''}`}>
      <td className="invp-check">
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(row.id)}
          aria-label={`Select ${row.name}`}
        />
      </td>
      <td className="td-img"><img src={row.image} alt="" loading="lazy" /></td>
      <td>
        <strong className="invp-name">{row.name}</strong>
        <span className="td-sub mono">{row.sku || 'No SKU yet'}</span>
      </td>
      <td className="invp-dept">{deptLabel(row.dept)}</td>
      <td className="invp-bar-cell">
        <div className={`inv-bar invp-bar ${out ? 'invp-bar--out' : low ? 'invp-bar--low' : ''}`}>
          <div style={{ width: `${barWidth(row.qty, barMax)}%` }} />
        </div>
        <span className="td-sub">
          {out ? 'Nothing on the shelf' : low ? 'Below your warning level' : 'Healthy'}
        </span>
      </td>
      <td>
        <span className={`invp-qty ${out ? 'is-out' : low ? 'is-low' : ''}`}>{row.qty}</span>
        <span className="td-sub">{row.qty === 1 ? 'piece' : 'pieces'}</span>
      </td>
      <td>
        <span className="price">{money(row.value)}</span>
        <span className="td-sub">{row.cost > 0 ? `${money(row.cost)} each` : 'cost price not set'}</span>
      </td>
      <td>
        <div className="invp-adjust">
          <Stepper qty={row.qty} name={row.name} onSet={(n) => onSet(row, n)} />
          <span className={`invp-saved ${saved ? 'on' : ''}`} aria-hidden={!saved}>
            <Check size={12} /> saved
          </span>
        </div>
      </td>
    </tr>
  );
}

// ── minus / number / plus ───────────────────────────────────
function Stepper({ qty, name, onSet, compact = false }) {
  const [draft, setDraft] = useState(String(qty));

  useEffect(() => { setDraft(String(qty)); }, [qty]);

  const commit = () => {
    const next = draft.trim() === '' ? qty : clampQty(draft);
    setDraft(String(next));
    if (next !== qty) onSet(next);
  };

  return (
    <div className={`invp-step ${compact ? 'invp-step--sm' : ''}`}>
      <button
        type="button"
        onClick={() => onSet(Math.max(0, qty - 1))}
        disabled={qty <= 0}
        aria-label={`Take one off ${name}`}
      >
        <Minus size={14} />
      </button>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
        inputMode="numeric"
        aria-label={`Pieces of ${name} in stock`}
      />
      <button
        type="button"
        onClick={() => onSet(clampQty(qty + 1))}
        disabled={qty >= MAX_QTY}
        aria-label={`Add one to ${name}`}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

// ── a card in the "needs restocking" shelf ──────────────────
function RestockCard({ p, threshold, sold, saved, onRestock, onSet }) {
  const [draft, setDraft] = useState('');
  const out = p.qty === 0;
  const cardMax = Math.max(1, threshold) * 2;

  const submit = (e) => {
    e.preventDefault();
    if (draft.trim() === '') return;
    onSet(p, clampQty(draft));
    setDraft('');
  };

  return (
    <motion.div
      className={`invp-card ${out ? 'invp-card--out' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="invp-card-top">
        <img src={p.image} alt="" loading="lazy" />
        <div className="invp-card-id">
          <strong>{p.name}</strong>
          <span className="td-sub">{p.sku || 'No SKU yet'} · {deptLabel(p.dept)}</span>
        </div>
        <span className={`pill ${out ? 'invp-pill--out' : 'invp-pill--low'}`}>
          {out ? 'Out of stock' : `${p.qty} left`}
        </span>
      </div>

      <div className={`inv-bar invp-bar ${out ? 'invp-bar--out' : 'invp-bar--low'}`}>
        <div style={{ width: `${barWidth(p.qty, cardMax)}%` }} />
      </div>

      <span className="invp-card-hint">
        {sold > 0
          ? `${plural(sold, 'piece', 'pieces')} sold in the last 30 days`
          : 'No sales in the last 30 days'}
      </span>

      <div className="invp-card-actions">
        <button type="button" className="row-action" onClick={() => onRestock(p, 10)}>
          <Plus size={12} /> 10
        </button>
        <button type="button" className="row-action" onClick={() => onRestock(p, 25)}>
          <Plus size={12} /> 25
        </button>
        <form className="invp-set" onSubmit={submit}>
          <label className="invp-set-label" htmlFor={`inv-exact-${p.id}`}>Set exact</label>
          <input
            id={`inv-exact-${p.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            placeholder={String(p.qty)}
            aria-label={`Set the exact number of ${p.name} in stock`}
          />
          <button type="submit" className="row-action" disabled={draft.trim() === ''}>Save</button>
        </form>
        <span className={`invp-saved ${saved ? 'on' : ''}`} aria-hidden={!saved}>
          <Check size={12} /> saved
        </span>
      </div>
    </motion.div>
  );
}

// ── the low stock warning level ─────────────────────────────
function ThresholdControl({ value, onChange }) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => { setDraft(String(value)); }, [value]);

  const commit = () => {
    const next = draft.trim() === '' ? value : Math.min(99, Math.max(1, clampQty(draft) || 1));
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <div className="invp-thresh">
      <span>Warn me at</span>
      <div className="invp-step invp-step--sm">
        <button
          type="button"
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          aria-label="Lower the low stock warning level"
        >
          <Minus size={13} />
        </button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
          inputMode="numeric"
          aria-label="Low stock warning level"
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(99, value + 1))}
          disabled={value >= 99}
          aria-label="Raise the low stock warning level"
        >
          <Plus size={13} />
        </button>
      </div>
      <span className="invp-thresh-unit">{value === 1 ? 'piece left' : 'pieces left'}</span>
    </div>
  );
}

// ── page ────────────────────────────────────────────────────
export function InventoryPage() {
  const { state, dispatch, allProducts } = useStore();

  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('all');
  const [alertFilter, setAlertFilter] = useState('all');   // all | low | out
  const [sort, setSort] = useState('urgent');
  const [selected, setSelected] = useState([]);
  const [bulkAmount, setBulkAmount] = useState('10');
  const [confirmZero, setConfirmZero] = useState(false);
  const [flash, setFlash] = useState(null);

  const flashTimer = useRef(0);
  const headBox = useRef(null);
  const confirmBtn = useRef(null);
  const tableTop = useRef(null);

  const rawThreshold = Number(state.settings?.lowStockThreshold);
  const threshold = Number.isFinite(rawThreshold) && rawThreshold >= 1 ? Math.floor(rawThreshold) : 5;

  const say = (msg, id = null) => {
    window.clearTimeout(flashTimer.current);
    setFlash({ msg, id, key: Date.now() });
    flashTimer.current = window.setTimeout(() => setFlash(null), 2800);
  };
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  // ── data ──
  const rows = useMemo(
    () => allProducts.map((p) => {
      const qty = clampQty(state.stock[p.id]);
      const cost = Number(p.cost) > 0 ? Number(p.cost) : 0;
      return { ...p, dept: p.dept || 'unsorted', qty, cost, value: qty * cost };
    }),
    [allProducts, state.stock]
  );

  const sold30 = useMemo(() => {
    const map = {};
    productStats(state.orders, '30').forEach((s) => { map[s.id] = s.units; });
    return map;
  }, [state.orders]);

  const needList = useMemo(
    () => lowStock(allProducts, state.stock, threshold).map((p) => ({ ...p, qty: clampQty(p.qty) })),
    [allProducts, state.stock, threshold]
  );

  const totalUnits = rows.reduce((s, r) => s + r.qty, 0);
  const totalValue = stockValue(allProducts, state.stock);
  const outCount = rows.filter((r) => r.qty === 0).length;
  const lowCount = rows.filter((r) => r.qty > 0 && r.qty <= threshold).length;

  const barMax = useMemo(() => {
    const highest = rows.reduce((m, r) => (r.qty > m ? r.qty : m), 0);
    return Math.max(10, threshold * 3, highest);
  }, [rows, threshold]);

  const deptChips = useMemo(() => {
    const counts = {};
    rows.forEach((r) => { counts[r.dept] = (counts[r.dept] || 0) + 1; });
    const known = DEPARTMENTS.filter((d) => counts[d.id]).map((d) => ({ id: d.id, label: d.label, n: counts[d.id] }));
    const extra = Object.keys(counts)
      .filter((id) => !DEPARTMENTS.some((d) => d.id === id))
      .map((id) => ({ id, label: deptLabel(id), n: counts[id] }));
    return [...known, ...extra];
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (dept !== 'all' && r.dept !== dept) return false;
      if (alertFilter === 'low' && r.qty > threshold) return false;
      if (alertFilter === 'out' && r.qty !== 0) return false;
      if (!q) return true;
      return `${r.name} ${r.sku || ''} ${deptLabel(r.dept)}`.toLowerCase().includes(q);
    });
    const byName = (a, b) => String(a.name).localeCompare(String(b.name));
    if (sort === 'most') return [...list].sort((a, b) => b.qty - a.qty || byName(a, b));
    if (sort === 'name') return [...list].sort(byName);
    if (sort === 'value') return [...list].sort((a, b) => b.value - a.value || byName(a, b));
    if (sort === 'dept') return [...list].sort((a, b) => deptLabel(a.dept).localeCompare(deptLabel(b.dept)) || byName(a, b));
    return [...list].sort((a, b) => a.qty - b.qty || byName(a, b));
  }, [rows, query, dept, alertFilter, sort, threshold]);

  const shownUnits = visible.reduce((s, r) => s + r.qty, 0);
  const shownValue = visible.reduce((s, r) => s + r.value, 0);

  // selection only ever holds products that still exist
  useEffect(() => {
    const ids = new Set(rows.map((r) => r.id));
    setSelected((prev) => {
      const next = prev.filter((id) => ids.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [rows]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visibleIds = visible.map((r) => r.id);
  const allShownPicked = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const partlyPicked = selected.length > 0 && !allShownPicked;

  useEffect(() => {
    if (headBox.current) headBox.current.indeterminate = partlyPicked;
  }, [partlyPicked]);

  useEffect(() => {
    if (confirmZero && confirmBtn.current) confirmBtn.current.focus();
  }, [confirmZero]);

  // Escape backs out of the confirm, then out of the selection
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (confirmZero) { setConfirmZero(false); return; }
      if (selected.length) setSelected([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmZero, selected.length]);

  // ── actions ──
  const setQty = (p, qty) => {
    const next = clampQty(qty);
    dispatch({ type: 'stock/set', id: p.id, qty: next });
    say(`${p.name} is now ${plural(next, 'piece', 'pieces')} in stock.`, p.id);
  };

  const restock = (p, add) => {
    dispatch({ type: 'stock/restock', id: p.id, qty: add });
    say(`Added ${add} to ${p.name}. Now ${plural(clampQty(p.qty + add), 'piece', 'pieces')}.`, p.id);
  };

  const toggleOne = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const toggleAllShown = () => {
    setConfirmZero(false);
    setSelected((prev) => {
      if (allShownPicked) return prev.filter((id) => !visibleIds.includes(id));
      const merged = new Set(prev);
      visibleIds.forEach((id) => merged.add(id));
      return [...merged];
    });
  };

  const bulkRestock = (e) => {
    if (e) e.preventDefault();
    const amount = clampQty(bulkAmount);
    if (!selected.length) return;
    if (amount <= 0) { say('Type how many pieces to add first.'); return; }
    dispatch({ type: 'stock/bulkRestock', ids: selected, qty: amount });
    say(`Added ${amount} to ${plural(selected.length, 'product', 'products')}.`);
    setSelected([]);
  };

  const bulkZero = () => {
    const n = selected.length;
    selected.forEach((id) => dispatch({ type: 'stock/set', id, qty: 0 }));
    say(`${plural(n, 'product', 'products')} marked as sold out.`);
    setConfirmZero(false);
    setSelected([]);
  };

  const changeThreshold = (n) => {
    const next = Math.min(99, Math.max(1, Math.floor(Number(n)) || 1));
    if (next === threshold) return;
    dispatch({ type: 'settings/set', patch: { lowStockThreshold: next } });
    say(`Low stock warning set to ${plural(next, 'piece', 'pieces')}.`);
  };

  const clearFilters = () => {
    setQuery('');
    setDept('all');
    setAlertFilter('all');
  };

  const jumpToTable = (filter) => {
    setAlertFilter(filter);
    setSort('urgent');
    // clear the sticky header rather than hiding the panel behind it
    if (tableTop.current) {
      const top = tableTop.current.getBoundingClientRect().top + window.scrollY - 96;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    }
  };

  const filtersOn = query.trim() !== '' || dept !== 'all' || alertFilter !== 'all';

  return (
    <div className="invp">
      <AnimatePresence initial={false}>
        {flash && (
          <motion.div
            key="flash"
            className="invp-flash"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="invp-flash-inner"><Check size={15} /> {flash.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── the four numbers she checks first ── */}
      <div className="kpi-row invp-kpis">
        <div className="kpi">
          <Boxes size={17} strokeWidth={1.6} />
          <span className="kpi-label">Units in stock</span>
          <strong className="kpi-value">{totalUnits}</strong>
          <span className="kpi-sub">across {plural(rows.length, 'product', 'products')}</span>
        </div>

        <div className="kpi">
          <Wallet size={17} strokeWidth={1.6} />
          <span className="kpi-label">Stock value at cost</span>
          <strong className="kpi-value price">{money(totalValue)}</strong>
          <span className="kpi-sub">what the shelves are worth today</span>
        </div>

        <button
          type="button"
          className={`kpi invp-kpi-btn ${lowCount > 0 ? 'kpi--alert' : ''}`}
          onClick={() => jumpToTable(lowCount > 0 ? 'low' : 'all')}
        >
          <AlertTriangle size={17} strokeWidth={1.6} />
          <span className="kpi-label">Running low</span>
          <strong className="kpi-value">{lowCount}</strong>
          <span className="kpi-sub">at or below {plural(threshold, 'piece', 'pieces')}</span>
        </button>

        <button
          type="button"
          className={`kpi invp-kpi-btn ${outCount > 0 ? 'kpi--alert' : ''}`}
          onClick={() => jumpToTable(outCount > 0 ? 'out' : 'all')}
        >
          <PackageX size={17} strokeWidth={1.6} />
          <span className="kpi-label">Out of stock</span>
          <strong className="kpi-value">{outCount}</strong>
          <span className="kpi-sub">{outCount > 0 ? 'nothing left to sell' : 'nothing has sold out'}</span>
        </button>
      </div>

      {/* ── needs restocking ── */}
      <section className="panel">
        <div className="panel-head">
          <h2>
            <AlertTriangle size={15} strokeWidth={1.8} />
            Needs restocking
            {needList.length > 0 && <span className="invp-count">{needList.length}</span>}
          </h2>
          <ThresholdControl value={threshold} onChange={changeThreshold} />
        </div>

        {needList.length === 0 ? (
          <div className="invp-empty">
            {rows.length === 0 ? (
              <>
                <Boxes size={22} />
                <strong>Nothing to count yet</strong>
                <p>Add your products first. Anything that runs low will show up right here.</p>
                <Link className="btn btn-outline btn-sm" to="/admin/products">Go to Products</Link>
              </>
            ) : (
              <>
                <PackageCheck size={22} />
                <strong>Everything is well stocked</strong>
                <p>Nothing is at or below {plural(threshold, 'piece', 'pieces')} right now. This list fills itself as things sell.</p>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="invp-cards">
              <AnimatePresence initial={false}>
                {needList.map((p) => (
                  <RestockCard
                    key={p.id}
                    p={p}
                    threshold={threshold}
                    sold={sold30[p.id] || 0}
                    saved={flash?.id === p.id}
                    onRestock={restock}
                    onSet={setQty}
                  />
                ))}
              </AnimatePresence>
            </div>
            <p className="panel-footnote">
              Emptiest shelf first. Whatever you add here is on sale on the website and on the POS straight away.
            </p>
          </>
        )}
      </section>

      {/* ── the full stock list ── */}
      <section className="panel" ref={tableTop}>
        <div className="panel-head">
          <h2><Boxes size={15} strokeWidth={1.8} /> All stock</h2>
          <div className="shop-tools invp-tools">
            <span className="shop-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a name or SKU"
                aria-label="Search stock by name or SKU"
              />
              {query !== '' && (
                <button type="button" className="invp-clear" onClick={() => setQuery('')} aria-label="Clear the search">
                  <X size={13} />
                </button>
              )}
            </span>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort the stock list">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div className="shop-chips invp-chips">
          <button type="button" className={`chip ${dept === 'all' ? 'on' : ''}`} onClick={() => setDept('all')}>
            All ({rows.length})
          </button>
          {deptChips.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`chip ${dept === d.id ? 'on' : ''}`}
              onClick={() => setDept(d.id)}
            >
              {d.label} ({d.n})
            </button>
          ))}
          <span className="invp-chip-gap" />
          <button
            type="button"
            className={`chip invp-chip-icon ${alertFilter === 'low' ? 'on' : ''}`}
            onClick={() => setAlertFilter((v) => (v === 'low' ? 'all' : 'low'))}
          >
            <AlertTriangle size={12} /> Low stock only
          </button>
          <button
            type="button"
            className={`chip invp-chip-icon ${alertFilter === 'out' ? 'on' : ''}`}
            onClick={() => setAlertFilter((v) => (v === 'out' ? 'all' : 'out'))}
          >
            <PackageX size={12} /> Sold out only
          </button>
        </div>

        <p className="invp-result">
          Showing {visible.length} of {plural(rows.length, 'product', 'products')} · {plural(shownUnits, 'piece', 'pieces')} · <span className="price">{money(shownValue)}</span> at cost
        </p>

        {rows.length === 0 ? (
          <div className="invp-empty">
            <Boxes size={22} />
            <strong>No products yet</strong>
            <p>Once a product is in the catalogue, every piece you buy in and every piece you sell is counted here.</p>
            <Link className="btn btn-outline btn-sm" to="/admin/products">Add your first product</Link>
          </div>
        ) : visible.length === 0 ? (
          <div className="invp-empty">
            <Search size={22} />
            <strong>Nothing matches that</strong>
            <p>
              {query.trim() ? `No product here answers to "${query.trim()}".` : 'No product fits these filters.'} Try a shorter word, or clear the filters and start again.
            </p>
            <button type="button" className="btn btn-outline btn-sm" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : (
          <div className="invp-scroll">
            <table className="adm-table invp-table">
              <thead>
                <tr>
                  <th className="invp-check">
                    <input
                      ref={headBox}
                      type="checkbox"
                      checked={allShownPicked}
                      onChange={toggleAllShown}
                      aria-label="Select every product shown"
                    />
                  </th>
                  <th aria-label="Photo" />
                  <th>Product</th>
                  <th>Department</th>
                  <th>Stock level</th>
                  <th>In stock</th>
                  <th>Value at cost</th>
                  <th>Adjust</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <StockRow
                    key={r.id}
                    row={r}
                    threshold={threshold}
                    barMax={barMax}
                    checked={selectedSet.has(r.id)}
                    saved={flash?.id === r.id}
                    onToggle={toggleOne}
                    onSet={setQty}
                  />
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8}>
                    <div className="invp-total">
                      <span>{filtersOn ? 'Total for what you are viewing' : 'Total for the whole shop'}</span>
                      <span>
                        <strong>{shownUnits}</strong> {shownUnits === 1 ? 'piece' : 'pieces'} ·{' '}
                        <span className="price">{money(shownValue)}</span> at cost
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        <AnimatePresence>
          {selected.length > 0 && (
            <motion.div
              className="invp-bulk"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {confirmZero ? (
                <div className="invp-confirm">
                  <p>
                    Mark {plural(selected.length, 'product', 'products')} as sold out? They stay in the catalogue,
                    but the website will show them as finished until you restock.
                  </p>
                  <button ref={confirmBtn} type="button" className="btn btn-sm invp-b-danger" onClick={bulkZero}>
                    Yes, mark sold out
                  </button>
                  <button type="button" className="btn btn-sm invp-b-ghost" onClick={() => setConfirmZero(false)}>
                    Leave them
                  </button>
                </div>
              ) : (
                <>
                  <div className="invp-bulk-count">
                    <strong>{plural(selected.length, 'product', 'products')} selected</strong>
                    <span className="invp-bulk-sub">Escape clears the selection</span>
                  </div>
                  <form className="invp-bulk-form" onSubmit={bulkRestock}>
                    <label className="invp-bulk-label" htmlFor="invp-bulk-amount">Add</label>
                    <input
                      id="invp-bulk-amount"
                      value={bulkAmount}
                      onChange={(e) => setBulkAmount(e.target.value.replace(/[^0-9]/g, ''))}
                      inputMode="numeric"
                      aria-label="How many pieces to add to each selected product"
                    />
                    <span className="invp-bulk-sub">to each</span>
                    <button type="submit" className="btn btn-sm invp-b-light">
                      <RefreshCw size={13} /> Restock selected
                    </button>
                  </form>
                  <div className="invp-bulk-more">
                    <button type="button" className="btn btn-sm invp-b-ghost" onClick={() => setConfirmZero(true)}>
                      Mark sold out
                    </button>
                    <button type="button" className="btn btn-sm invp-b-ghost" onClick={() => setSelected([])}>
                      <X size={13} /> Clear
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ── how the numbers move on their own ── */}
      <section className="panel">
        <div className="panel-head">
          <h2><Info size={15} strokeWidth={1.8} /> How stock moves</h2>
          <span className="panel-note">You only type a number when you buy new goods in.</span>
        </div>
        <div className="invp-notes">
          <div className="invp-note">
            <span className="invp-note-ico"><Globe size={15} /></span>
            <div>
              <strong>A sale on the website</strong>
              <span>The moment a customer checks out, those pieces come off this page by themselves.</span>
            </div>
          </div>
          <div className="invp-note">
            <span className="invp-note-ico"><Store size={15} /></span>
            <div>
              <strong>A sale at the counter</strong>
              <span>The POS does exactly the same thing the second you take the money.</span>
            </div>
          </div>
          <div className="invp-note">
            <span className="invp-note-ico"><RefreshCw size={15} /></span>
            <div>
              <strong>An order that gets cancelled</strong>
              <span>Those pieces go straight back onto the shelf here, so your count stays honest.</span>
            </div>
          </div>
          <div className="invp-note">
            <span className="invp-note-ico"><AlertTriangle size={15} /></span>
            <div>
              <strong>Anything running low</strong>
              <span>At {plural(threshold, 'piece', 'pieces')} or fewer it jumps to the top of this page and onto the dashboard.</span>
            </div>
          </div>
        </div>
        <p className="panel-footnote">
          Stock value uses the cost price you paid, not the shelf price, so it tells you what your money is sitting in.
        </p>
      </section>
    </div>
  );
}
