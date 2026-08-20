import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, UserPlus, Upload, X, Phone, MessageCircle, Trash2, Download,
  Eye, Pencil, Users, Crown, Wallet, Repeat, CheckCircle2, AlertTriangle,
  MapPin, Save, ShoppingBag,
} from 'lucide-react';
import { useStore, orderTotal, STATUS_LABEL } from '../context/StoreContext';
import { customerStats } from './metrics';
import { BRAND, fmtPrice } from '../config';
import './styles/customers.css';

// ── small helpers ───────────────────────────────────────────
const EASE = [0.16, 1, 0.3, 1];

const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const timeOf = (iso) => {
  const t = new Date(iso || 0).getTime();
  return Number.isFinite(t) ? t : 0;
};

const fmtDay = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
};

const fmtShort = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GH', { day: 'numeric', month: 'short' });
};

function agoText(iso) {
  if (!iso) return '';
  const then = new Date(iso);
  if (!Number.isFinite(then.getTime())) return '';
  // count calendar days, so an order last evening reads "yesterday"
  const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(new Date()) - midnight(then)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months <= 1 ? 'about a month ago' : `${months} months ago`;
}

// Ghana numbers arrive in every shape. Normalise to 0XXXXXXXXX or return ''.
function toNational(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.length === 12 && d.startsWith('233')) return `0${d.slice(3)}`;
  if (d.length === 13 && d.startsWith('0233')) return `0${d.slice(4)}`;
  if (d.length === 10 && d.startsWith('0')) return d;
  if (d.length === 9 && !d.startsWith('0')) return `0${d}`;
  return '';
}

const prettyPhone = (national) =>
  national ? `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}` : '';

// wa.me wants the international form with no plus and no spaces
function waNumber(raw) {
  const national = toNational(raw);
  if (!national) return '';
  return `233${national.slice(1)}`;
}

function waLink(customer) {
  const num = waNumber(customer.phone);
  if (!num) return '';
  const msg = `Hello ${firstName(customer.name)}, this is ${BRAND.name} in ${BRAND.city}. Thank you for shopping with us.`;
  return `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

const SOURCE_LABEL = { web: 'Website', manual: 'Added by hand', pos: 'Counter' };

const PILL_CLASS = {
  new: 'pill--new',
  processing: 'pill--processing',
  ready: 'cust-pill--ready',
  delivered: 'pill--delivered',
  cancelled: 'cust-pill--cancelled',
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'web', label: 'From the website' },
  { id: 'hand', label: 'Added by hand' },
  { id: 'repeat', label: 'Repeat customers' },
];

const SORTS = [
  { id: 'spend', label: 'Top spenders' },
  { id: 'orders', label: 'Most orders' },
  { id: 'newest', label: 'Newest' },
  { id: 'name', label: 'Name A to Z' },
];

function sortRows(list, sortId) {
  const rows = [...list];
  if (sortId === 'orders') return rows.sort((a, b) => b.orders - a.orders || b.spent - a.spent);
  if (sortId === 'newest') return rows.sort((a, b) => timeOf(b.createdAt) - timeOf(a.createdAt));
  if (sortId === 'name') return rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  return rows.sort((a, b) => b.spent - a.spent || String(a.name || '').localeCompare(String(b.name || '')));
}

// ── CSV out ─────────────────────────────────────────────────
function toCsv(rows) {
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(cell).join(',')).join('\r\n');
}

function downloadCsv(filename, rows) {
  // the BOM keeps Excel happy with names and the cedi sign
  const blob = new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── paste parser for the import list ────────────────────────
const SAMPLE_PASTE = `Name, Phone, Area
Adwoa Boakye, 024 411 0982, Madina
Selina Tetteh, 0207730451, Dansoman
Joseph Nkrumah, +233 55 902 3311, Tema
Gifty Owusu, 026 880 1245, Kasoa`;

function parseImport(text, customers) {
  const known = new Set(customers.map((c) => toNational(c.phone)).filter(Boolean));
  const seen = new Set();
  const lines = String(text || '').split(/\r?\n/);
  const rows = [];
  let checkedHeader = false;

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;

    if (!checkedHeader) {
      checkedHeader = true;
      const low = line.toLowerCase();
      if (low.includes('name') && /phone|number|contact/.test(low)) return; // header row, skip it
    }

    const parts = line.split(/\t|,|;/).map((s) => s.trim());
    const name = parts[0] || '';
    const phoneRaw = parts[1] || '';
    const area = parts[2] || '';
    const national = toNational(phoneRaw);

    let reason = '';
    if (!name) reason = 'Add a name for this line';
    else if (!phoneRaw) reason = 'Add a phone number';
    else if (!national) reason = 'That phone number does not look right';
    else if (known.has(national)) reason = 'Already in your list';
    else if (seen.has(national)) reason = 'Repeated further up this paste';

    if (!reason && national) seen.add(national);

    rows.push({
      key: `l-${i}`,
      line: i + 1,
      name: name || '(no name)',
      phone: national ? prettyPhone(national) : phoneRaw || '(no phone)',
      area,
      ok: !reason,
      reason,
    });
  });

  return rows;
}

// ── add / edit customer modal ───────────────────────────────
function CustomerModal({ title, cta, initial, customers, ignoreId, onClose, onSave, onOpenDuplicate }) {
  const [form, setForm] = useState(initial);
  const [tried, setTried] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const national = toNational(form.phone);
  const nameOk = form.name.trim().length > 1;
  const phoneOk = Boolean(national);
  const duplicate = phoneOk
    ? customers.find((c) => c.id !== ignoreId && toNational(c.phone) === national)
    : null;
  const canSave = nameOk && phoneOk && !duplicate;

  const submit = (e) => {
    e.preventDefault();
    setTried(true);
    if (!canSave) return;
    onSave({
      name: form.name.trim(),
      phone: prettyPhone(national),
      area: form.area.trim(),
      address: form.address.trim(),
      notes: form.notes.trim(),
    });
  };

  return (
    <motion.div
      className="qv-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.form
        className="adm-form cust-modal"
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.34, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2>{title}</h2>
          <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <label className="field">
          <span>Customer name</span>
          <input
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Akosua Mensah"
            autoFocus
          />
        </label>
        {tried && !nameOk && <p className="cust-hint cust-hint--bad">Please put in a full name.</p>}

        <label className="field">
          <span>Phone number</span>
          <input
            value={form.phone}
            onChange={set('phone')}
            inputMode="tel"
            placeholder="024 555 0192"
          />
        </label>
        {form.phone.trim() && !phoneOk && (
          <p className="cust-hint cust-hint--bad">
            Use a Ghana number such as 024 555 0192, 0245550192 or +233 24 555 0192.
          </p>
        )}
        {tried && !form.phone.trim() && (
          <p className="cust-hint cust-hint--bad">A phone number is how you reach them, please add one.</p>
        )}

        {duplicate && (
          <div className="cust-warn">
            <AlertTriangle size={16} />
            <div>
              <strong>{prettyPhone(national)} is already saved.</strong>
              <span>It belongs to {duplicate.name}. Save the details on that record instead.</span>
            </div>
            {onOpenDuplicate && (
              <button type="button" className="row-action" onClick={() => onOpenDuplicate(duplicate.id)}>
                Open it
              </button>
            )}
          </div>
        )}

        <div className="field-row">
          <label className="field">
            <span>Area</span>
            <input value={form.area} onChange={set('area')} placeholder="e.g. East Legon" />
          </label>
          <label className="field">
            <span>Landmark or address</span>
            <input value={form.address} onChange={set('address')} placeholder="Boundary Rd, near the school" />
          </label>
        </div>

        <label className="field">
          <span>Notes</span>
          <textarea
            value={form.notes}
            onChange={set('notes')}
            rows={3}
            placeholder="Anything worth remembering. Sizes, delivery times, what they like."
          />
        </label>

        <p className="adm-form-note">
          Area and address are optional, they simply make delivery easier later.
        </p>
        <button className="btn btn-primary btn-block" type="submit" disabled={!canSave}>
          {cta}
        </button>
      </motion.form>
    </motion.div>
  );
}

// ── import list modal ───────────────────────────────────────
function ImportModal({ customers, onClose, onImport }) {
  const [text, setText] = useState('');
  const parsed = useMemo(() => parseImport(text, customers), [text, customers]);
  const good = parsed.filter((p) => p.ok);
  const bad = parsed.length - good.length;

  const run = () => {
    if (!good.length) return;
    onImport(good.map((g) => ({ name: g.name, phone: g.phone, area: g.area })));
  };

  return (
    <motion.div
      className="qv-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="adm-form cust-modal cust-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Import a customer list"
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.34, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2>Import a customer list</h2>
          <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="adm-form-note">
          One customer per line, written as name, phone, area. Commas or tabs both work, so you can
          paste straight out of Excel. A heading line is fine, it gets skipped.
        </p>

        <label className="field">
          <span>Paste the list</span>
          <textarea
            className="cust-paste"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={'Adwoa Boakye, 024 411 0982, Madina\nSelina Tetteh, 0207730451, Dansoman'}
            autoFocus
          />
        </label>

        <div className="cust-import-bar">
          <button type="button" className="row-action" onClick={() => setText(SAMPLE_PASTE)}>
            Fill in an example
          </button>
          {text.trim() && (
            <button type="button" className="row-action" onClick={() => setText('')}>
              Clear
            </button>
          )}
          <span className="panel-note">
            {parsed.length === 0
              ? 'Nothing pasted yet'
              : `${plural(good.length, 'line')} ready${bad ? `, ${bad} to fix` : ''}`}
          </span>
        </div>

        {parsed.length > 0 && (
          <div className="cust-preview">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Line</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Area</th>
                  <th>Check</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((p) => (
                  <tr key={p.key} className={p.ok ? '' : 'cust-row-bad'}>
                    <td className="mono">{p.line}</td>
                    <td>{p.name}</td>
                    <td className="mono">{p.phone}</td>
                    <td>{p.area || '-'}</td>
                    <td>
                      {p.ok ? (
                        <span className="cust-tag cust-tag--ok">Ready</span>
                      ) : (
                        <span className="cust-tag cust-tag--bad">{p.reason}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button className="btn btn-primary btn-block" type="button" onClick={run} disabled={!good.length}>
          {good.length ? `Import all (${good.length})` : 'Import all'}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── customer detail drawer ──────────────────────────────────
function CustomerDrawer({ customer, onClose, onEdit, onSaveNotes }) {
  const [note, setNote] = useState(customer.notes || '');
  const [saved, setSaved] = useState(false);
  const lastId = useRef(customer.id);

  useEffect(() => {
    if (lastId.current === customer.id) return;
    lastId.current = customer.id;
    setNote(customer.notes || '');
    setSaved(false);
  }, [customer.id, customer.notes]);

  useEffect(() => {
    if (!saved) return undefined;
    const t = setTimeout(() => setSaved(false), 2600);
    return () => clearTimeout(t);
  }, [saved]);

  const wa = waLink(customer);
  const average = customer.orders > 0 ? Math.round(customer.spent / customer.orders) : 0;
  const dirty = note !== (customer.notes || '');

  return (
    <motion.div
      className="cust-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.aside
        className="cust-drawer"
        role="dialog"
        aria-modal="true"
        aria-label={`${customer.name} details`}
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.4, ease: EASE }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cust-drawer-head">
          <div>
            <h3>{customer.name}</h3>
            <span className={`cust-badge cust-badge--${customer.source === 'web' ? 'web' : 'hand'}`}>
              {SOURCE_LABEL[customer.source] || 'Added by hand'}
            </span>
            {customer.createdAt && (
              <span className="cust-drawer-since">On your list since {fmtDay(customer.createdAt)}</span>
            )}
          </div>
          <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="cust-drawer-body">
          <div className="cust-stat-row">
            <div className="cust-stat">
              <span className="kpi-label">Lifetime spend</span>
              <strong className="price">{fmtPrice(customer.spent || 0)}</strong>
            </div>
            <div className="cust-stat">
              <span className="kpi-label">Orders</span>
              <strong>{customer.orders || 0}</strong>
            </div>
            <div className="cust-stat">
              <span className="kpi-label">Average order</span>
              <strong className="price">{fmtPrice(average)}</strong>
            </div>
          </div>

          <div className="cust-contact">
            {customer.phone ? (
              <a className="cust-contact-row" href={`tel:${toNational(customer.phone) || customer.phone}`}>
                <Phone size={15} />
                <span className="mono">{customer.phone}</span>
              </a>
            ) : (
              <div className="cust-contact-row cust-contact-row--empty">
                <Phone size={15} />
                <span>No phone number saved yet</span>
              </div>
            )}
            <div className="cust-contact-row cust-contact-row--plain">
              <MapPin size={15} />
              <span>
                {customer.area || 'Area not saved'}
                {customer.address ? `, ${customer.address}` : ''}
              </span>
            </div>
          </div>

          <div className="cust-drawer-actions">
            {wa && (
              <a className="btn btn-primary btn-sm" href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle size={15} /> Message on WhatsApp
              </a>
            )}
            <button type="button" className="btn btn-outline btn-sm" onClick={() => onEdit(customer.id)}>
              <Pencil size={14} /> Edit details
            </button>
          </div>

          <div className="cust-section">
            <div className="cust-section-head">
              <h4>Notes</h4>
              <AnimatePresence>
                {saved && (
                  <motion.span
                    className="cust-saved"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <CheckCircle2 size={13} /> Saved
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
            <label className="field">
              <span className="cust-sr">Notes about this customer</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Sizes, delivery times, what they always ask for."
              />
            </label>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              disabled={!dirty}
              onClick={() => {
                onSaveNotes(customer.id, note.trim());
                setSaved(true);
              }}
            >
              <Save size={14} /> Save notes
            </button>
          </div>

          <div className="cust-section">
            <div className="cust-section-head">
              <h4>Order history</h4>
              <span className="panel-note">{plural(customer.orders || 0, 'order')}</span>
            </div>

            {customer.history && customer.history.length > 0 ? (
              <div className="cust-hist">
                {customer.history.map((o) => (
                  <div className="cust-hist-row" key={o.id}>
                    <div className="cust-hist-main">
                      <strong className="mono">{o.id}</strong>
                      <span className="td-sub">
                        {fmtDay(o.date)} · {plural(o.items.reduce((n, l) => n + l.qty, 0), 'item')} ·{' '}
                        {o.source === 'web' ? 'Website' : 'Counter'}
                      </span>
                    </div>
                    <div className="cust-hist-side">
                      <span className="price">{fmtPrice(orderTotal(o))}</span>
                      <span className={`pill ${PILL_CLASS[o.status] || 'pill--new'}`}>
                        {STATUS_LABEL[o.status] || o.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cust-mini-empty">
                <ShoppingBag size={20} />
                <p>No orders yet. The moment they buy, on the website or at the counter, it lands here.</p>
              </div>
            )}
          </div>
        </div>
      </motion.aside>
    </motion.div>
  );
}

// ── the page ────────────────────────────────────────────────
export function CustomersPage() {
  const { state, dispatch } = useStore();

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('spend');
  const [selected, setSelected] = useState([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const [flash, setFlash] = useState(null);
  const headCheck = useRef(null);

  const say = (text) => setFlash({ id: Date.now(), text });

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 3600);
    return () => clearTimeout(t);
  }, [flash]);

  const rows = useMemo(
    () => customerStats(state.customers, state.orders),
    [state.customers, state.orders]
  );

  // ── summary numbers ──
  const summary = useMemo(() => {
    const now = new Date();
    const thisMonth = rows.filter((c) => {
      if (!c.last) return false;
      const d = new Date(c.last);
      if (Number.isNaN(d.getTime())) return false;
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const buyers = rows.filter((c) => c.spent > 0);
    const totalSpent = buyers.reduce((s, c) => s + c.spent, 0);
    const best = rows.reduce((top, c) => (!top || c.spent > top.spent ? c : top), null);

    return {
      total: rows.length,
      thisMonth,
      buyers: buyers.length,
      average: buyers.length > 0 ? Math.round(totalSpent / buyers.length) : 0,
      best: best && best.spent > 0 ? best : null,
      repeat: rows.filter((c) => c.orders > 1).length,
    };
  }, [rows]);

  // ── search, filter, sort ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = q.replace(/\D/g, '');

    const matched = rows.filter((c) => {
      if (filter === 'web' && c.source !== 'web') return false;
      if (filter === 'hand' && c.source === 'web') return false;
      if (filter === 'repeat' && c.orders <= 1) return false;
      if (!q) return true;
      const phoneDigits = String(c.phone || '').replace(/\D/g, '');
      return (
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.area || '').toLowerCase().includes(q) ||
        String(c.address || '').toLowerCase().includes(q) ||
        (qDigits.length >= 3 && phoneDigits.includes(qDigits))
      );
    });

    return sortRows(matched, sort);
  }, [rows, query, filter, sort]);

  // ── selection ──
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const selectedRows = useMemo(() => rows.filter((c) => selectedSet.has(c.id)), [rows, selectedSet]);
  const shownSelected = filtered.filter((c) => selectedSet.has(c.id)).length;
  const allShownPicked = filtered.length > 0 && shownSelected === filtered.length;

  useEffect(() => {
    if (headCheck.current) {
      headCheck.current.indeterminate = shownSelected > 0 && !allShownPicked;
    }
  }, [shownSelected, allShownPicked]);

  const toggleOne = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const toggleAllShown = () => {
    if (allShownPicked) {
      const shown = new Set(filtered.map((c) => c.id));
      setSelected((s) => s.filter((id) => !shown.has(id)));
    } else {
      setSelected((s) => [...new Set([...s, ...filtered.map((c) => c.id)])]);
    }
  };

  const clearSelection = () => {
    setSelected([]);
    setConfirmDelete(false);
  };

  // ── escape closes the top layer ──
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (confirmDelete) setConfirmDelete(false);
      else if (importing) setImporting(false);
      else if (adding) setAdding(false);
      else if (editingId) setEditingId(null);
      else if (viewingId) setViewingId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmDelete, importing, adding, editingId, viewingId]);

  // ── actions ──
  const exportSelected = () => {
    if (!selectedRows.length) return;
    const head = [
      'Name', 'Phone', 'Area', 'Address', 'Orders', 'Total spent (GHS)',
      'Last order', 'Added on', 'Where from', 'Notes',
    ];
    const body = selectedRows.map((c) => [
      c.name || '',
      c.phone || '',
      c.area || '',
      c.address || '',
      c.orders || 0,
      c.spent || 0,
      c.last ? fmtDay(c.last) : 'No orders yet',
      c.createdAt ? fmtDay(c.createdAt) : '',
      SOURCE_LABEL[c.source] || 'Added by hand',
      c.notes || '',
    ]);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`yvonnes-customers-${stamp}.csv`, [head, ...body]);
    say(`${plural(selectedRows.length, 'customer')} saved to your downloads as a CSV file.`);
  };

  const runDelete = () => {
    const ids = selectedRows.map((c) => c.id);
    if (!ids.length) return;
    dispatch({ type: 'customer/delete', ids });
    if (viewingId && ids.includes(viewingId)) setViewingId(null);
    if (editingId && ids.includes(editingId)) setEditingId(null);
    clearSelection();
    say(`${plural(ids.length, 'customer')} removed. Their past orders stay in your records.`);
  };

  const viewing = viewingId ? rows.find((c) => c.id === viewingId) : null;
  const editing = editingId ? state.customers.find((c) => c.id === editingId) : null;

  const emptyShop = rows.length === 0;

  return (
    <div className="cust">
      {/* ── summary tiles ── */}
      <div className="cust-tiles">
        <div className="kpi">
          <Users size={18} strokeWidth={1.6} />
          <span className="kpi-label">Customers on record</span>
          <span className="kpi-value">{summary.total}</span>
          <span className="kpi-sub">
            {summary.repeat > 0
              ? `${summary.repeat} ${summary.repeat === 1 ? 'has' : 'have'} come back more than once`
              : 'Website orders add people here on their own'}
          </span>
        </div>

        <div className="kpi">
          <Repeat size={18} strokeWidth={1.6} />
          <span className="kpi-label">Bought this month</span>
          <span className="kpi-value">{summary.thisMonth}</span>
          <span className="kpi-sub">
            {summary.total > 0 ? `of ${summary.total} on your list` : 'Nobody on the list yet'}
          </span>
        </div>

        <div className="kpi">
          <Crown size={18} strokeWidth={1.6} />
          <span className="kpi-label">Best customer</span>
          <span className="kpi-value cust-value-name">{summary.best ? summary.best.name : 'Not yet'}</span>
          <span className="kpi-sub">
            {summary.best
              ? `${fmtPrice(summary.best.spent)} across ${plural(summary.best.orders, 'order')}`
              : 'No sales recorded yet'}
          </span>
        </div>

        <div className="kpi">
          <Wallet size={18} strokeWidth={1.6} />
          <span className="kpi-label">Average spend</span>
          <span className="kpi-value">{fmtPrice(summary.average)}</span>
          <span className="kpi-sub">
            {summary.buyers > 0
              ? `Across ${plural(summary.buyers, 'paying customer')}`
              : 'No sales recorded yet'}
          </span>
        </div>
      </div>

      {/* ── main panel ── */}
      <div className="panel">
        <div className="cust-toolbar">
          <div className="cust-toolbar-line">
            <label className="shop-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, phone or area"
                aria-label="Search customers"
              />
              {query && (
                <button type="button" className="cust-clear" aria-label="Clear search" onClick={() => setQuery('')}>
                  <X size={13} />
                </button>
              )}
            </label>

            <select
              className="cust-select"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Sort customers"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>

            <div className="cust-toolbar-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setImporting(true)}>
                <Upload size={15} /> Import list
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                <UserPlus size={15} /> Add customer
              </button>
            </div>
          </div>

          <div className="cust-toolbar-line cust-toolbar-line--chips">
            <div className="shop-chips">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`chip ${filter === f.id ? 'on' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="panel-note">
              {filtered.length === rows.length
                ? plural(rows.length, 'customer')
                : `${filtered.length} of ${rows.length} shown`}
            </span>
          </div>
        </div>

        <AnimatePresence>
          {flash && (
            <motion.div
              className="cust-flash"
              key={flash.id}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE }}
            >
              <CheckCircle2 size={15} /> {flash.text}
            </motion.div>
          )}
        </AnimatePresence>

        {emptyShop ? (
          <div className="cust-empty">
            <Users size={26} />
            <h3>No customers yet</h3>
            <p>
              Every website order saves the buyer here on its own. You can also add the regulars you
              already know, or paste a list you keep on your phone.
            </p>
            <div className="cust-empty-actions">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
                <UserPlus size={15} /> Add your first customer
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setImporting(true)}>
                <Upload size={15} /> Import a list
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cust-empty">
            <Search size={26} />
            <h3>Nothing matched that</h3>
            <p>No customer here fits the search or the filter you picked.</p>
            <div className="cust-empty-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => { setQuery(''); setFilter('all'); }}
              >
                Show everybody again
              </button>
            </div>
          </div>
        ) : (
          <div className="cust-tablewrap">
            <table className="adm-table cust-table">
              <thead>
                <tr>
                  <th className="cust-col-check">
                    <input
                      ref={headCheck}
                      className="cust-check"
                      type="checkbox"
                      checked={allShownPicked}
                      onChange={toggleAllShown}
                      aria-label="Select every customer shown"
                    />
                  </th>
                  <th>Customer</th>
                  <th className="cust-col-hide">Phone</th>
                  <th className="cust-col-hide">Area</th>
                  <th className="cust-col-hide">Orders</th>
                  <th>Total spent</th>
                  <th className="cust-col-hide">Last order</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const picked = selectedSet.has(c.id);
                  return (
                    <tr key={c.id} className={picked ? 'cust-row-on' : ''}>
                      <td className="cust-col-check">
                        <input
                          className="cust-check"
                          type="checkbox"
                          checked={picked}
                          onChange={() => toggleOne(c.id)}
                          aria-label={`Select ${c.name}`}
                        />
                      </td>
                      <td>
                        <div className="cust-name">
                          <button type="button" className="cust-name-btn" onClick={() => setViewingId(c.id)}>
                            {c.name}
                          </button>
                          <span className={`cust-badge cust-badge--${c.source === 'web' ? 'web' : 'hand'}`}>
                            {SOURCE_LABEL[c.source] || 'Added by hand'}
                          </span>
                        </div>
                        <span className="td-sub cust-sub-lg">
                          {c.createdAt ? `On the list since ${fmtShort(c.createdAt)}` : 'On the list'}
                        </span>
                        <span className="td-sub cust-sub-sm">
                          {c.orders > 0 ? plural(c.orders, 'order') : 'No orders yet'}
                          {c.area ? ` · ${c.area}` : ''}
                        </span>
                      </td>
                      <td className="cust-col-hide">
                        {c.phone ? (
                          <a className="mono cust-tel" href={`tel:${toNational(c.phone) || c.phone}`}>
                            {c.phone}
                          </a>
                        ) : (
                          <span className="td-sub">Not saved</span>
                        )}
                      </td>
                      <td className="cust-col-hide">{c.area || '-'}</td>
                      <td className="cust-col-hide">{c.orders || 0}</td>
                      <td>
                        <span className="price">{fmtPrice(c.spent || 0)}</span>
                      </td>
                      <td className="cust-col-hide">
                        {c.last ? (
                          <>
                            {fmtShort(c.last)}
                            <span className="td-sub">{agoText(c.last)}</span>
                          </>
                        ) : (
                          <span className="td-sub">No orders yet</span>
                        )}
                      </td>
                      <td>
                        <div className="cust-actions">
                          <button type="button" className="row-action" onClick={() => setViewingId(c.id)}>
                            <Eye size={12} /> View
                          </button>
                          <button type="button" className="row-action" onClick={() => setEditingId(c.id)}>
                            <Pencil size={12} /> Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!emptyShop && (
          <p className="panel-footnote">
            Website buyers are saved here automatically. Counter sales join the list once you take a
            phone number at the till.
          </p>
        )}
      </div>

      {/* ── bulk bar ── */}
      <AnimatePresence>
        {selectedRows.length > 0 && (
          <motion.div
            className="cust-bulk"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 14 }}
            transition={{ duration: 0.28, ease: EASE }}
          >
            {confirmDelete ? (
              <>
                <span className="cust-bulk-count cust-bulk-count--warn">
                  <AlertTriangle size={15} />
                  Remove {plural(selectedRows.length, 'customer')} from the list?
                </span>
                <span className="cust-bulk-note">Their past orders stay in your records.</span>
                <div className="cust-bulk-actions">
                  <button type="button" className="btn btn-sm cust-btn-danger" onClick={runDelete}>
                    Yes, remove them
                  </button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmDelete(false)}>
                    Keep them
                  </button>
                </div>
              </>
            ) : (
              <>
                <span className="cust-bulk-count">
                  <CheckCircle2 size={15} />
                  {plural(selectedRows.length, 'customer')} selected
                </span>
                <div className="cust-bulk-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={exportSelected}>
                    <Download size={14} /> Export selected (CSV)
                  </button>
                  <button type="button" className="btn btn-outline btn-sm cust-btn-danger-out" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={14} /> Delete
                  </button>
                  <button type="button" className="row-action" onClick={clearSelection}>
                    Clear selection
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── layers ── */}
      <AnimatePresence>
        {adding && (
          <CustomerModal
            key="add"
            title="Add a customer"
            cta="Save to my customer list"
            initial={{ name: '', phone: '', area: '', address: '', notes: '' }}
            customers={state.customers}
            ignoreId={null}
            onClose={() => setAdding(false)}
            onSave={(data) => {
              dispatch({ type: 'customer/add', customer: data });
              setAdding(false);
              say(`${firstName(data.name)} is on your customer list now.`);
            }}
            onOpenDuplicate={(id) => {
              setAdding(false);
              setViewingId(id);
            }}
          />
        )}

        {editing && (
          <CustomerModal
            key={`edit-${editing.id}`}
            title="Edit customer"
            cta="Save changes"
            initial={{
              name: editing.name || '',
              phone: editing.phone || '',
              area: editing.area || '',
              address: editing.address || '',
              notes: editing.notes || '',
            }}
            customers={state.customers}
            ignoreId={editing.id}
            onClose={() => setEditingId(null)}
            onSave={(data) => {
              dispatch({ type: 'customer/update', id: editing.id, patch: data });
              setEditingId(null);
              say(`${firstName(data.name)}'s details are updated.`);
            }}
            onOpenDuplicate={(id) => {
              setEditingId(null);
              setViewingId(id);
            }}
          />
        )}

        {importing && (
          <ImportModal
            key="import"
            customers={state.customers}
            onClose={() => setImporting(false)}
            onImport={(list) => {
              dispatch({ type: 'customer/addBulk', customers: list });
              setImporting(false);
              say(`${plural(list.length, 'customer')} added to your list.`);
            }}
          />
        )}

        {viewing && (
          <CustomerDrawer
            key={`view-${viewing.id}`}
            customer={viewing}
            onClose={() => setViewingId(null)}
            onEdit={(id) => {
              setViewingId(null);
              setEditingId(id);
            }}
            onSaveNotes={(id, notes) => dispatch({ type: 'customer/update', id, patch: { notes } })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
