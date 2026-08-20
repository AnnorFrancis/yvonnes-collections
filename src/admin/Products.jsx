import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search, PackagePlus, CloudUpload, X, Check, Pencil, ImagePlus,
  Trash2, Archive, ArchiveRestore, TriangleAlert, Tag, Boxes,
  CopyPlus, Images, ClipboardPaste, CircleAlert, Camera, Plus,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { DEPARTMENTS } from '../data/products';
import { BRAND, fmtPrice } from '../config';
import './styles/products.css';

// ── Products · the catalogue desk ───────────────────────────
// Built for speed. Nothing on this screen should ever force the
// owner to repeat herself: photos come in by the handful, prices
// move in one sweep, and editing walks straight down the list.

const SORTS = [
  { id: 'name', label: 'Name' },
  { id: 'price-desc', label: 'Price high to low' },
  { id: 'price-asc', label: 'Price low to high' },
  { id: 'stock-asc', label: 'Stock low to high' },
  { id: 'margin', label: 'Margin' },
];

const BADGES = [
  { id: '', label: 'No badge' },
  { id: 'New', label: 'New' },
  { id: 'Bestseller', label: 'Bestseller' },
  { id: 'Value', label: 'Value' },
];

const DEFAULT_DEPT = DEPARTMENTS[0]?.id ?? 'women';
const COST_GUESS = 0.58; // what the shop usually pays, used only as a suggestion

const PASTE_SAMPLE = [
  'name, department, price, cost, quantity',
  'Kente Trim Tote, Essentials, 150, 85, 12',
  'Sunday Lace Blouse, Women, 260, 150, 6',
  'Boys School Shorts, Kids, 70, 38, 20',
].join('\n');

// ── little helpers ──────────────────────────────────────────
const s = (n) => (n === 1 ? '' : 's');

const num = (v, fallback = 0) => {
  const cleaned = String(v ?? '').replace(/[^0-9.]/g, '');
  if (!cleaned) return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
};

const money = (v, fallback = 0) => Math.max(0, Math.round(num(v, fallback)));

const looksNumeric = (v) => /\d/.test(String(v ?? '')) && Number.isFinite(Number(String(v).replace(/[^0-9.]/g, '')));

const deptLabel = (id) => DEPARTMENTS.find((d) => d.id === id)?.label ?? id ?? '';

const matchDept = (raw) => {
  const key = String(raw ?? '').trim().toLowerCase();
  if (!key) return '';
  const hit = DEPARTMENTS.find((d) => d.id.toLowerCase() === key || d.label.toLowerCase() === key);
  return hit ? hit.id : null; // '' means "not given", null means "not recognised"
};

const marginPct = (price, cost) => {
  const p = Number(price) || 0;
  const c = Number(cost) || 0;
  if (p <= 0) return null;
  return Math.round(((p - c) / p) * 100);
};

const parseSizes = (raw) => {
  const list = String(raw ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return list.length ? list : ['One size'];
};

const titleFromFile = (file) =>
  String(file?.name ?? '')
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_\-.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .slice(0, 60);

// A calm stand-in tile for items whose photo has not been taken yet.
const PHOTO_PENDING =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500">` +
      `<rect width="400" height="500" fill="#ede7d9"/>` +
      `<circle cx="200" cy="250" r="64" fill="none" stroke="#6c7770" stroke-width="1.5"/>` +
      `<text x="200" y="250" font-family="Georgia, serif" font-size="56" fill="#3f4e44" ` +
      `text-anchor="middle" dominant-baseline="central">${BRAND.monogram}</text></svg>`
  );

const storyFor = (name, tagline) =>
  [String(tagline || '').trim(), `${name}, added on the shop floor and ready to sell today.`]
    .filter(Boolean)
    .join(' ');

// Phone photos are huge. Read with FileReader, then shrink onto a
// canvas so a hundred products still fit in the browser's storage.
function readImageFile(file, max = 720) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve('');
    reader.onload = () => {
      const raw = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        try {
          const w0 = img.naturalWidth || img.width || max;
          const h0 = img.naturalHeight || img.height || max;
          const scale = Math.min(1, max / Math.max(w0, h0));
          const w = Math.max(1, Math.round(w0 * scale));
          const h = Math.max(1, Math.round(h0 * scale));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(raw);
          ctx.fillStyle = '#fffdf8';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          return resolve(canvas.toDataURL('image/jpeg', 0.72));
        } catch {
          return resolve(raw);
        }
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

function useEscapeKey(handler, active = true) {
  const saved = useRef(handler);
  saved.current = handler;
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') saved.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);
}

// ── shared bits ─────────────────────────────────────────────
function Scrim({ children, onClose, lock = false }) {
  return (
    <motion.div
      className="qv-scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => {
        // A locked scrim holds its ground: too much work sits inside to
        // lose it to a stray click. Escape and Cancel still close it.
        if (!lock && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </motion.div>
  );
}

function ImagePicker({ value, onChange, label = 'Photo' }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    const data = await readImageFile(file);
    setBusy(false);
    if (data) onChange(data);
  };

  return (
    <div className="pr-imgpick">
      {value ? (
        <img className="pr-imgprev" src={value} alt="" />
      ) : (
        <div className="pr-imgprev">
          <ImagePlus size={22} strokeWidth={1.5} />
        </div>
      )}
      <div className="pr-imgpick-main">
        <label className="field" style={{ marginBottom: 0 }}>
          <span>{label}{value && value.startsWith('data:') ? ' · photo attached from this device' : ''}</span>
          <input
            value={value && value.startsWith('data:') ? '' : value}
            onChange={(e) => onChange(e.target.value.trim())}
            placeholder="Paste an image link, or choose one from this device"
          />
        </label>
        <div className="pr-imgbtns">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="button" className="pr-textbtn" onClick={() => fileRef.current?.click()}>
            <Camera size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 5 }} />
            {busy ? 'Reading the photo' : 'Choose from this device'}
          </button>
          {value && (
            <button type="button" className="pr-textbtn pr-textbtn--quiet" onClick={() => onChange('')}>
              Remove photo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MiniField({ label, children }) {
  return (
    <label className="pr-mini">
      <span>{label}</span>
      {children}
    </label>
  );
}

// ── Add one product ─────────────────────────────────────────
function AddModal({ dispatch, onClose, onDone }) {
  const blank = {
    name: '',
    dept: DEFAULT_DEPT,
    price: '',
    cost: '',
    qty: '10',
    tagline: '',
    sizes: 'S, M, L, XL',
    image: '',
  };
  const [form, setForm] = useState(blank);
  const [note, setNote] = useState('');
  useEscapeKey(onClose);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const price = money(form.price);
  const cost = money(form.cost);
  const canSave = form.name.trim().length > 0 && price > 0;
  const thinMargin = price > 0 && cost >= price;

  const build = () => ({
    name: form.name.trim(),
    dept: form.dept,
    price,
    cost: cost || Math.round(price * COST_GUESS),
    tagline: form.tagline.trim(),
    story: storyFor(form.name.trim(), form.tagline),
    image: form.image || PHOTO_PENDING,
    sizes: parseSizes(form.sizes),
    badge: 'New',
    sku: '',
  });

  const save = (again) => {
    if (!canSave) return;
    dispatch({ type: 'product/add', product: build(), qty: money(form.qty) });
    if (again) {
      setNote(`${form.name.trim()} is on the shelf. Add the next one.`);
      setForm({ ...blank, dept: form.dept, sizes: form.sizes, qty: form.qty });
      return;
    }
    onDone(`${form.name.trim()} was added to the catalogue.`);
    onClose();
  };

  return (
    <Scrim onClose={onClose}>
      <motion.form
        className="pr-modal pr-modal--sm"
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        <div className="pr-modal-head">
          <div>
            <h2>Add a product</h2>
            <span className="pr-progress">Ready to sell the moment you save</span>
          </div>
          <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="pr-modal-body">
          {note && (
            <div className="pr-flash pr-flash--modal">
              <Check size={15} /> {note}
            </div>
          )}

          <label className="field">
            <span>Product name</span>
            <input value={form.name} onChange={set('name')} placeholder="e.g. Gold Hoop Earrings" autoFocus />
          </label>

          <div className="field-row pr-field-row-stack">
            <label className="field">
              <span>Department</span>
              <select value={form.dept} onChange={set('dept')}>
                {DEPARTMENTS.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Opening stock</span>
              <input value={form.qty} onChange={set('qty')} inputMode="numeric" placeholder="10" />
            </label>
          </div>

          <div className="field-row pr-field-row-stack">
            <label className="field">
              <span>Selling price ({BRAND.currency})</span>
              <input value={form.price} onChange={set('price')} inputMode="decimal" placeholder="120" />
            </label>
            <label className="field">
              <span>What it cost you</span>
              <input value={form.cost} onChange={set('cost')} inputMode="decimal" placeholder="70" />
            </label>
          </div>

          {thinMargin && (
            <div className="pr-form-warn">
              <TriangleAlert size={15} />
              <span>
                That cost is not below the price, so this item earns nothing on paper. You can still save it if
                that is right.
              </span>
            </div>
          )}

          <label className="field">
            <span>Short line for the shop</span>
            <input value={form.tagline} onChange={set('tagline')} placeholder="Soft cotton, everyday fit" />
          </label>

          <label className="field">
            <span>Sizes (separate with commas)</span>
            <input value={form.sizes} onChange={set('sizes')} placeholder="S, M, L, XL" />
          </label>

          <ImagePicker value={form.image} onChange={(v) => setForm((f) => ({ ...f, image: v }))} />

          <p className="adm-form-note">
            Leave the cost blank and we will pencil in {Math.round(COST_GUESS * 100)}% of the price until you
            know the real one. No photo yet is fine, the shop shows a plain {BRAND.short} tile in the meantime.
          </p>
        </div>

        <div className="pr-modal-foot">
          <span className="pr-foot-note">
            {canSave ? 'Enter saves this product.' : 'A name and a price above zero are needed.'}
          </span>
          <button type="button" className="btn btn-outline btn-sm" disabled={!canSave} onClick={() => save(true)}>
            Save and add another
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!canSave}>
            <PackagePlus size={15} /> Add to catalogue
          </button>
        </div>
      </motion.form>
    </Scrim>
  );
}

// ── Bulk upload: photos, or a pasted list ───────────────────
function BulkModal({ dispatch, onClose, onDone }) {
  const [tab, setTab] = useState('photos');
  const [rows, setRows] = useState([]);
  const [drag, setDrag] = useState(false);
  const [reading, setReading] = useState(0);
  const [paste, setPaste] = useState('');
  const [pasteDept, setPasteDept] = useState(DEFAULT_DEPT);
  const fileRef = useRef(null);
  const seq = useRef(0);
  useEscapeKey(onClose);

  // ── photos ──
  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList || []).filter((f) => f && String(f.type).startsWith('image/'));
    if (!files.length) return;
    const made = files.map((f) => {
      seq.current += 1;
      return {
        key: `p${seq.current}`,
        image: '',
        loading: true,
        name: titleFromFile(f),
        dept: DEFAULT_DEPT,
        price: '',
        cost: '',
        qty: '1',
      };
    });
    setRows((rs) => {
      const last = rs[rs.length - 1];
      // a fresh batch inherits the department you were already using
      return [...rs, ...made.map((r) => ({ ...r, dept: last ? last.dept : r.dept }))];
    });
    setReading((n) => n + files.length);
    files.forEach((file, i) => {
      readImageFile(file).then((image) => {
        setRows((rs) => rs.map((r) => (r.key === made[i].key ? { ...r, image, loading: false } : r)));
        setReading((n) => Math.max(0, n - 1));
      });
    });
  }, []);

  const setRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const dropRow = (key) => setRows((rs) => rs.filter((r) => r.key !== key));
  const copyAbove = (index) =>
    setRows((rs) =>
      rs.map((r, i) =>
        i === index && rs[index - 1]
          ? { ...r, dept: rs[index - 1].dept, price: rs[index - 1].price, cost: rs[index - 1].cost, qty: rs[index - 1].qty }
          : r
      )
    );

  const rowReady = (r) => r.name.trim().length > 0 && money(r.price) > 0;
  const readyRows = rows.filter(rowReady);

  const addPhotos = () => {
    if (!readyRows.length) return;
    const products = readyRows.map((r) => {
      const price = money(r.price);
      return {
        name: r.name.trim(),
        dept: r.dept,
        price,
        cost: money(r.cost) || Math.round(price * COST_GUESS),
        tagline: '',
        story: storyFor(r.name.trim(), ''),
        image: r.image || PHOTO_PENDING,
        sizes: ['One size'],
        badge: 'New',
        sku: '',
      };
    });
    const quantities = readyRows.map((r) => money(r.qty, 1));
    dispatch({ type: 'product/addBulk', products, quantities });
    const skipped = rows.length - readyRows.length;
    onDone(
      `Added ${products.length} product${s(products.length)} from photos.` +
        (skipped ? ` ${skipped} row${s(skipped)} had no name or price, so ${skipped === 1 ? 'it was' : 'they were'} left behind.` : '')
    );
    onClose();
  };

  // ── pasted list ──
  const parsed = useMemo(() => {
    const good = [];
    const bad = [];
    const lines = String(paste).split(/\r?\n/);
    let seenFirst = false;

    lines.forEach((raw, i) => {
      const lineNo = i + 1;
      const line = raw.trim();
      if (!line) return;
      const cells = (line.includes('\t') ? line.split('\t') : line.split(',')).map((c) => c.trim());

      if (!seenFirst) {
        seenFirst = true;
        if (/^(name|product|product name|item)$/i.test(cells[0] || '')) return; // header row, skipped quietly
      }

      const name = cells[0] || '';
      let deptRaw = '';
      let priceRaw = '';
      let costRaw = '';
      let qtyRaw = '';

      if (cells.length >= 2 && looksNumeric(cells[1])) {
        // name, price, cost, quantity
        priceRaw = cells[1];
        costRaw = cells[2] ?? '';
        qtyRaw = cells[3] ?? '';
      } else {
        priceRaw = cells[2] ?? '';
        deptRaw = cells[1] ?? '';
        costRaw = cells[3] ?? '';
        qtyRaw = cells[4] ?? '';
      }

      if (!name) {
        bad.push({ lineNo, raw: line, why: 'no product name on this line' });
        return;
      }
      if (!priceRaw) {
        bad.push({ lineNo, raw: line, why: 'no price on this line' });
        return;
      }
      const price = money(priceRaw);
      if (price <= 0) {
        bad.push({ lineNo, raw: line, why: `the price "${priceRaw}" is not a number above zero` });
        return;
      }
      const dept = matchDept(deptRaw);
      if (dept === null) {
        bad.push({ lineNo, raw: line, why: `the department "${deptRaw}" is not one of ours` });
        return;
      }
      if (qtyRaw && !looksNumeric(qtyRaw)) {
        bad.push({ lineNo, raw: line, why: `the quantity "${qtyRaw}" is not a number` });
        return;
      }
      good.push({
        lineNo,
        name,
        dept: dept || pasteDept,
        price,
        cost: costRaw ? money(costRaw) : Math.round(price * COST_GUESS),
        qty: qtyRaw ? money(qtyRaw, 1) : 1,
      });
    });

    return { good, bad };
  }, [paste, pasteDept]);

  const addPasted = () => {
    if (!parsed.good.length) return;
    const products = parsed.good.map((r) => ({
      name: r.name,
      dept: r.dept,
      price: r.price,
      cost: r.cost,
      tagline: '',
      story: storyFor(r.name, ''),
      image: PHOTO_PENDING,
      sizes: ['One size'],
      badge: 'New',
      sku: '',
    }));
    dispatch({ type: 'product/addBulk', products, quantities: parsed.good.map((r) => r.qty) });
    onDone(
      `Added ${products.length} product${s(products.length)} from your list.` +
        (parsed.bad.length ? ` ${parsed.bad.length} line${s(parsed.bad.length)} could not be read.` : '')
    );
    onClose();
  };

  const submit = (e) => {
    e.preventDefault();
    if (tab === 'photos') addPhotos();
    else addPasted();
  };

  const canAdd = tab === 'photos' ? readyRows.length > 0 : parsed.good.length > 0;

  return (
    <Scrim onClose={onClose} lock>
      <motion.form
        className="pr-modal"
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        onSubmit={submit}
      >
        <div className="pr-modal-head">
          <div>
            <h2>Bulk upload</h2>
            <span className="pr-progress">Many products, one go</span>
          </div>
          <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="pr-modal-body">
          <div className="pr-tabs">
            <button type="button" className={`pr-tab ${tab === 'photos' ? 'on' : ''}`} onClick={() => setTab('photos')}>
              <Images size={15} /> Photos
            </button>
            <button type="button" className={`pr-tab ${tab === 'paste' ? 'on' : ''}`} onClick={() => setTab('paste')}>
              <ClipboardPaste size={15} /> Paste a list
            </button>
          </div>

          {tab === 'photos' ? (
            <>
              <div
                className={`pr-drop ${drag ? 'on' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  addFiles(e.dataTransfer?.files);
                }}
              >
                <CloudUpload size={30} strokeWidth={1.4} />
                <h3>Drop the day's photos here</h3>
                <p>Pick as many as you like at once. We shrink them so the shop stays quick.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>
                  <ImagePlus size={15} /> Choose photos
                </button>
                <p className="pr-drop-hint">
                  {reading > 0
                    ? `Reading ${reading} photo${s(reading)}, one moment.`
                    : 'We read the file name into the product name, so most rows only need a price.'}
                </p>
              </div>

              {rows.length > 0 && (
                <>
                  <div className="pr-review-head">
                    <span className={`pr-ready ${readyRows.length ? '' : 'none'}`}>
                      <i /> {readyRows.length} of {rows.length} ready
                    </span>
                    <button type="button" className="pr-textbtn pr-textbtn--quiet" onClick={() => setRows([])}>
                      Clear all photos
                    </button>
                  </div>

                  <div className="pr-review">
                    {rows.map((r, index) => {
                      const ready = rowReady(r);
                      return (
                        <div className={`pr-rrow ${ready ? '' : 'bad'}`} key={r.key}>
                          <div className="pr-rthumb">
                            {r.image ? <img src={r.image} alt="" /> : <span>{r.loading ? '...' : 'no photo'}</span>}
                          </div>
                          <div className="pr-rmain">
                            <MiniField label="Product name">
                              <input
                                value={r.name}
                                onChange={(e) => setRow(r.key, { name: e.target.value })}
                                className={r.name.trim() ? '' : 'bad'}
                                placeholder="Name this piece"
                              />
                            </MiniField>
                            <div className="pr-rfields">
                              <MiniField label="Department">
                                <select value={r.dept} onChange={(e) => setRow(r.key, { dept: e.target.value })}>
                                  {DEPARTMENTS.map((d) => (
                                    <option key={d.id} value={d.id}>{d.label}</option>
                                  ))}
                                </select>
                              </MiniField>
                              <MiniField label="Price">
                                <input
                                  value={r.price}
                                  inputMode="decimal"
                                  onChange={(e) => setRow(r.key, { price: e.target.value })}
                                  className={money(r.price) > 0 ? '' : 'bad'}
                                  placeholder="0"
                                />
                              </MiniField>
                              <MiniField label="Cost">
                                <input
                                  value={r.cost}
                                  inputMode="decimal"
                                  onChange={(e) => setRow(r.key, { cost: e.target.value })}
                                  placeholder="auto"
                                />
                              </MiniField>
                              <MiniField label="Qty">
                                <input
                                  value={r.qty}
                                  inputMode="numeric"
                                  onChange={(e) => setRow(r.key, { qty: e.target.value })}
                                  placeholder="1"
                                />
                              </MiniField>
                            </div>
                            {!ready && (
                              <span className="pr-rflag">
                                <CircleAlert size={13} />
                                {r.name.trim() ? 'Add a price or this one stays behind.' : 'Add a name and a price or this one stays behind.'}
                              </span>
                            )}
                          </div>
                          <div className="pr-racts">
                            <button
                              type="button"
                              className="pr-icon-btn"
                              title="Copy the row above"
                              aria-label="Copy the row above"
                              disabled={index === 0}
                              onClick={() => copyAbove(index)}
                            >
                              <CopyPlus size={14} />
                            </button>
                            <button
                              type="button"
                              className="pr-icon-btn pr-icon-btn--danger"
                              title="Remove this photo"
                              aria-label="Remove this photo"
                              onClick={() => dropRow(r.key)}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="pr-paste">
              <p className="pr-paste-help">
                One product per line, in the order <code>name, department, price, cost, quantity</code>. Commas or
                tabs both work, so a copy out of Excel drops straight in. A header line is fine. Leave the cost out
                and we pencil in {Math.round(COST_GUESS * 100)}% of the price, leave the quantity out and we open
                with 1 piece.
              </p>

              <div className="pr-paste-row">
                <label className="field">
                  <span>Department for lines that do not name one</span>
                  <select value={pasteDept} onChange={(e) => setPasteDept(e.target.value)}>
                    {DEPARTMENTS.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </label>
                <button type="button" className="pr-sample" onClick={() => setPaste(PASTE_SAMPLE)}>
                  Fill in an example
                </button>
              </div>

              <textarea
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={PASTE_SAMPLE}
                autoFocus
                aria-label="Paste your product list"
              />

              {paste.trim() && (
                <>
                  <div className="pr-review-head">
                    <span className={`pr-ready ${parsed.good.length ? '' : 'none'}`}>
                      <i /> {parsed.good.length} line{s(parsed.good.length)} ready
                      {parsed.bad.length ? `, ${parsed.bad.length} to fix` : ''}
                    </span>
                  </div>

                  {parsed.good.length > 0 && (
                    <div className="pr-scroll">
                      <table className="adm-table">
                        <thead>
                          <tr>
                            <th>Product</th>
                            <th>Department</th>
                            <th>Price</th>
                            <th>Cost</th>
                            <th>Margin</th>
                            <th>Opening stock</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsed.good.map((r) => {
                            const m = marginPct(r.price, r.cost);
                            return (
                              <tr key={`${r.lineNo}-${r.name}`}>
                                <td className="pr-name">{r.name}</td>
                                <td>{deptLabel(r.dept)}</td>
                                <td><span className="price">{fmtPrice(r.price)}</span></td>
                                <td className="pr-cost">{fmtPrice(r.cost)}</td>
                                <td className={`pr-margin ${m !== null && m < 15 ? 'thin' : ''}`}>
                                  {m === null ? '0%' : `${m}%`}
                                </td>
                                <td>{r.qty} {r.qty === 1 ? 'pc' : 'pcs'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {parsed.bad.length > 0 && (
                    <div className="pr-bad">
                      <h4>Lines we could not read</h4>
                      <ul>
                        {parsed.bad.map((b) => (
                          <li key={`${b.lineNo}-${b.why}`}>
                            <b>Line {b.lineNo}</b>
                            {b.why}. <q>{b.raw.slice(0, 60)}</q>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="pr-modal-foot">
          <span className="pr-foot-note">
            {tab === 'photos'
              ? 'Rows without a name or a price are skipped, nothing is lost.'
              : 'Only the good lines are added. Fix the rest and paste again.'}
          </span>
          <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!canAdd}>
            <Plus size={15} />
            {tab === 'photos'
              ? `Add all ${readyRows.length || ''}`.trim()
              : `Add all ${parsed.good.length || ''}`.trim()}
          </button>
        </div>
      </motion.form>
    </Scrim>
  );
}

// ── Edit, and keep walking down the list ────────────────────
function EditModal({ queue, startIndex, findProduct, stock, dispatch, onClose, onDone }) {
  const toForm = (p, qty) => ({
    name: p.name ?? '',
    dept: p.dept ?? DEFAULT_DEPT,
    price: String(p.price ?? ''),
    cost: String(p.cost ?? ''),
    qty: String(qty ?? 0),
    tagline: p.tagline ?? '',
    sizes: Array.isArray(p.sizes) ? p.sizes.join(', ') : '',
    badge: p.badge ?? '',
    image: p.image ?? '',
  });

  // The walk is frozen the moment it starts. Renaming or repricing an
  // item must not reshuffle the queue under the owner's hands.
  const walk = useRef(queue).current;
  const [index, setIndex] = useState(startIndex);
  const first = findProduct(walk[startIndex]);
  const [form, setForm] = useState(() => (first ? toForm(first, stock[first.id] ?? 0) : null));
  const [note, setNote] = useState('');
  useEscapeKey(onClose);

  const product = findProduct(walk[index]);
  if (!product || !form) return null;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const price = money(form.price);
  const cost = money(form.cost);
  const canSave = form.name.trim().length > 0 && price > 0;
  const m = marginPct(price, cost);

  const commit = () => {
    dispatch({
      type: 'product/update',
      id: product.id,
      patch: {
        name: form.name.trim(),
        dept: form.dept,
        price,
        cost,
        tagline: form.tagline.trim(),
        sizes: parseSizes(form.sizes),
        badge: form.badge || undefined,
        image: form.image || PHOTO_PENDING,
      },
    });
    const nextQty = money(form.qty);
    if (nextQty !== (stock[product.id] ?? 0)) {
      dispatch({ type: 'stock/set', id: product.id, qty: nextQty });
    }
  };

  const saveAndClose = () => {
    if (!canSave) return;
    commit();
    onDone(`${form.name.trim()} was saved.`);
    onClose();
  };

  const saveAndNext = () => {
    if (!canSave) return;
    commit();
    const savedName = form.name.trim();
    let i = index + 1;
    while (i < walk.length && !findProduct(walk[i])) i += 1;
    if (i >= walk.length) {
      onDone(`${savedName} was saved. That was the last product in this list.`);
      onClose();
      return;
    }
    const next = findProduct(walk[i]);
    setIndex(i);
    setForm(toForm(next, stock[next.id] ?? 0));
    setNote(`${savedName} saved. Now editing ${next.name}.`);
  };

  return (
    <Scrim onClose={onClose}>
      <motion.form
        className="pr-modal pr-modal--sm"
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        onSubmit={(e) => {
          e.preventDefault();
          saveAndClose();
        }}
      >
        <div className="pr-modal-head">
          <div>
            <h2>{product.name}</h2>
            <span className="pr-progress">
              Product {index + 1} of {walk.length} · {product.sku || 'no sku'}
            </span>
          </div>
          <button type="button" className="drawer-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="pr-modal-body">
          {note && (
            <div className="pr-flash pr-flash--modal">
              <Check size={15} /> {note}
            </div>
          )}

          <label className="field">
            <span>Product name</span>
            <input value={form.name} onChange={set('name')} autoFocus />
          </label>

          <div className="field-row pr-field-row-stack">
            <label className="field">
              <span>Department</span>
              <select value={form.dept} onChange={set('dept')}>
                {DEPARTMENTS.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>In stock</span>
              <input value={form.qty} onChange={set('qty')} inputMode="numeric" />
            </label>
          </div>

          <div className="field-row pr-field-row-stack">
            <label className="field">
              <span>Selling price ({BRAND.currency})</span>
              <input value={form.price} onChange={set('price')} inputMode="decimal" />
            </label>
            <label className="field">
              <span>What it cost you</span>
              <input value={form.cost} onChange={set('cost')} inputMode="decimal" />
            </label>
          </div>

          {price > 0 && cost >= price && (
            <div className="pr-form-warn">
              <TriangleAlert size={15} />
              <span>This price does not clear the cost, so every sale loses money. Save it only if that is right.</span>
            </div>
          )}

          <label className="field">
            <span>Short line for the shop</span>
            <input value={form.tagline} onChange={set('tagline')} />
          </label>

          <div className="field-row pr-field-row-stack">
            <label className="field">
              <span>Sizes (separate with commas)</span>
              <input value={form.sizes} onChange={set('sizes')} />
            </label>
            <label className="field">
              <span>Badge on the shop</span>
              <select value={form.badge} onChange={set('badge')}>
                {BADGES.map((b) => (
                  <option key={b.id} value={b.id}>{b.label}</option>
                ))}
              </select>
            </label>
          </div>

          <ImagePicker value={form.image} onChange={(v) => setForm((f) => ({ ...f, image: v }))} />

          <div className="pr-edit-meta">
            <span>Margin now <b>{m === null ? '0%' : `${m}%`}</b></span>
            <span>Profit per piece <b>{fmtPrice(Math.max(0, price - cost))}</b></span>
            <span>Stock value <b>{fmtPrice(cost * money(form.qty))}</b></span>
          </div>
        </div>

        <div className="pr-modal-foot">
          <span className="pr-foot-note">
            {canSave ? 'Enter saves and closes.' : 'A name and a price above zero are needed.'}
          </span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={!canSave}
            onClick={saveAndNext}
          >
            {index + 1 >= walk.length ? 'Save and finish' : 'Save and edit next'}
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!canSave}>
            <Check size={15} /> Save
          </button>
        </div>
      </motion.form>
    </Scrim>
  );
}

// ── The screen ──────────────────────────────────────────────
export function ProductsPage() {
  const { state, dispatch, managedProducts, findProduct } = useStore();

  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('all');
  const [sort, setSort] = useState('name');
  const [picked, setPicked] = useState([]);
  const [pop, setPop] = useState(null); // 'price' | 'restock' | 'delete'
  const [modal, setModal] = useState(null); // 'add' | 'bulk' | 'edit'
  const [editAt, setEditAt] = useState(0);
  const [flash, setFlash] = useState('');

  // price panel
  const [priceMode, setPriceMode] = useState('raise');
  const [pricePct, setPricePct] = useState('10');
  const [priceExact, setPriceExact] = useState('');
  // restock panel
  const [restockQty, setRestockQty] = useState('10');

  const timer = useRef(null);
  const say = useCallback((message) => {
    setFlash(message);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFlash(''), 5000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const archivedSet = useMemo(() => new Set(state.archived || []), [state.archived]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = managedProducts.filter((p) => {
      const isArchived = archivedSet.has(p.id);
      if (dept === 'archived') return isArchived;
      if (isArchived) return false;
      return dept === 'all' || p.dept === dept;
    });

    if (q) {
      list = list.filter((p) =>
        `${p.name ?? ''} ${p.sku ?? ''} ${p.tagline ?? ''}`.toLowerCase().includes(q)
      );
    }

    const qtyOf = (p) => state.stock[p.id] ?? 0;
    const sorted = [...list];
    if (sort === 'name') sorted.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    else if (sort === 'price-desc') sorted.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    else if (sort === 'price-asc') sorted.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    else if (sort === 'stock-asc') sorted.sort((a, b) => qtyOf(a) - qtyOf(b));
    else if (sort === 'margin') sorted.sort((a, b) => (marginPct(b.price, b.cost) ?? -1) - (marginPct(a.price, a.cost) ?? -1));
    return sorted;
  }, [managedProducts, archivedSet, dept, query, sort, state.stock]);

  // Only ever act on what is actually on screen.
  const visible = useMemo(() => new Set(rows.map((p) => p.id)), [rows]);
  const ids = useMemo(() => picked.filter((id) => visible.has(id)), [picked, visible]);
  const pickedSet = useMemo(() => new Set(ids), [ids]);
  const count = ids.length;
  const allTicked = rows.length > 0 && count === rows.length;

  const closePop = useCallback(() => setPop(null), []);
  useEscapeKey(closePop, modal === null && pop !== null);

  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAll = () => setPicked(allTicked ? [] : rows.map((p) => p.id));
  const clearPicked = () => {
    setPicked([]);
    setPop(null);
  };

  const lowThreshold = Number(state.settings?.lowStockThreshold) || 5;
  const archivedCount = archivedSet.size;
  const sample = count ? findProduct(ids[0]) : null;

  // ── bulk actions ──
  const applyPrice = () => {
    if (!count) return;
    if (priceMode === 'exact') {
      const exact = money(priceExact);
      if (exact <= 0) return;
      dispatch({ type: 'product/bulkUpdate', ids, patch: () => ({ price: exact }) });
      say(`${count} price${s(count)} set to ${fmtPrice(exact)}.`);
    } else {
      const pct = num(pricePct, 0);
      if (pct <= 0) return;
      const dir = priceMode === 'raise' ? 1 : -1;
      dispatch({
        type: 'product/bulkUpdate',
        ids,
        patch: (p) => ({ price: Math.max(1, Math.round((Number(p.price) || 0) * (1 + (dir * pct) / 100))) }),
      });
      say(`${count} price${s(count)} ${priceMode === 'raise' ? 'raised' : 'lowered'} by ${pct}%.`);
    }
    setPop(null);
  };

  const applyRestock = () => {
    const qty = money(restockQty);
    if (!count || qty <= 0) return;
    dispatch({ type: 'stock/bulkRestock', ids, qty });
    say(`Added ${qty} piece${s(qty)} to ${count} product${s(count)}.`);
    setPop(null);
  };

  const applyArchive = () => {
    if (!count) return;
    dispatch({ type: 'product/archive', ids });
    say(`${count} product${s(count)} archived. They are off the website but every past order keeps its record.`);
    clearPicked();
  };

  const applyRestore = () => {
    if (!count) return;
    dispatch({ type: 'product/restore', ids });
    say(`${count} product${s(count)} back on the website.`);
    clearPicked();
  };

  const applyDelete = () => {
    if (!count) return;
    dispatch({ type: 'product/delete', ids });
    say(`${count} product${s(count)} removed from the list.`);
    clearPicked();
  };

  // ── price preview line ──
  const previewPrice = () => {
    if (!sample) return null;
    const base = Number(sample.price) || 0;
    if (priceMode === 'exact') {
      const exact = money(priceExact);
      return exact > 0 ? exact : null;
    }
    const pct = num(pricePct, 0);
    if (pct <= 0) return null;
    const dir = priceMode === 'raise' ? 1 : -1;
    return Math.max(1, Math.round(base * (1 + (dir * pct) / 100)));
  };
  const preview = previewPrice();

  const openEdit = (index) => {
    setEditAt(index);
    setModal('edit');
  };

  const editQueue = useMemo(() => rows.map((p) => p.id), [rows]);

  return (
    <div className="pr">
      <div className="panel">
        <div className="pr-tools">
          <div className="pr-tools-row">
            <div className="pr-tools-left">
              <span className="shop-search">
                <Search size={15} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name or sku"
                  aria-label="Search products"
                />
                {query && (
                  <button type="button" className="pr-icon-btn" aria-label="Clear the search" onClick={() => setQuery('')}>
                    <X size={13} />
                  </button>
                )}
              </span>
              <span className="pr-count">
                <strong>{rows.length}</strong> product{s(rows.length)}
                {dept === 'archived' ? ' archived' : ' on the list'}
                {dept !== 'archived' && archivedCount > 0 ? `, ${archivedCount} archived` : ''}
              </span>
            </div>

            <div className="pr-tools-right">
              <button className="btn btn-outline btn-sm" onClick={() => setModal('bulk')}>
                <CloudUpload size={15} /> Bulk upload
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setModal('add')}>
                <PackagePlus size={15} /> Add product
              </button>
            </div>
          </div>

          <div className="pr-tools-row">
            <div className="shop-chips pr-chips">
              <button className={`chip ${dept === 'all' ? 'on' : ''}`} onClick={() => setDept('all')}>All</button>
              {DEPARTMENTS.map((d) => (
                <button key={d.id} className={`chip ${dept === d.id ? 'on' : ''}`} onClick={() => setDept(d.id)}>
                  {d.label}
                </button>
              ))}
              <button className={`chip ${dept === 'archived' ? 'on' : ''}`} onClick={() => setDept('archived')}>
                Archived{archivedCount ? ` (${archivedCount})` : ''}
              </button>
            </div>

            <div className="pr-sort-wrap">
              <span>Sort</span>
              <select className="pr-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort the list">
                {SORTS.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <AnimatePresence>
            {flash && (
              <motion.div
                className="pr-flash"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                <Check size={15} /> {flash}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {rows.length === 0 ? (
          <div className="pr-empty">
            {dept === 'archived' ? (
              <>
                <h3>Nothing is archived</h3>
                <p>
                  Archiving takes a product off the website while its sales history stays exactly where it is. Pick
                  a few items from the list and choose Archive.
                </p>
                <div className="pr-empty-acts">
                  <button className="btn btn-outline btn-sm" onClick={() => setDept('all')}>Back to the catalogue</button>
                </div>
              </>
            ) : query.trim() ? (
              <>
                <h3>Nothing matched that</h3>
                <p>No product answers to "{query.trim()}" in this department. Try a shorter word, or clear the search.</p>
                <div className="pr-empty-acts">
                  <button className="btn btn-outline btn-sm" onClick={() => { setQuery(''); setDept('all'); }}>
                    Clear the search
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('add')}>
                    <PackagePlus size={15} /> Add it as a new product
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3>{dept === 'all' ? 'No products yet' : 'This department is empty'}</h3>
                <p>
                  Nothing is listed under {dept === 'all' ? 'your catalogue' : deptLabel(dept)} yet. Add one
                  product, or send up the whole batch of photos at once.
                </p>
                <div className="pr-empty-acts">
                  <button className="btn btn-outline btn-sm" onClick={() => setModal('bulk')}>
                    <CloudUpload size={15} /> Bulk upload
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setModal('add')}>
                    <PackagePlus size={15} /> Add product
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="pr-scroll">
              <table className="adm-table pr-table">
                <thead>
                  <tr>
                    <th className="pr-tick">
                      <input
                        type="checkbox"
                        checked={allTicked}
                        ref={(el) => {
                          if (el) el.indeterminate = count > 0 && !allTicked;
                        }}
                        onChange={toggleAll}
                        aria-label="Select every product in this list"
                      />
                    </th>
                    <th />
                    <th>Product</th>
                    <th>Department</th>
                    <th>Price</th>
                    <th>Cost</th>
                    <th>Margin</th>
                    <th>Stock</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, index) => {
                    const qty = state.stock[p.id] ?? 0;
                    const low = qty <= lowThreshold;
                    const m = marginPct(p.price, p.cost);
                    const on = pickedSet.has(p.id);
                    return (
                      <tr key={p.id} className={on ? 'pr-on' : ''}>
                        <td className="pr-tick">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(p.id)}
                            aria-label={`Select ${p.name}`}
                          />
                        </td>
                        <td className="td-img">
                          <img src={p.image || PHOTO_PENDING} alt="" loading="lazy" />
                        </td>
                        <td>
                          <span className="pr-name">{p.name}</span>
                          {archivedSet.has(p.id) && <span className="pr-archtag">Archived</span>}
                          <span className="pr-tagline">
                            <span className="pr-sku">{p.sku || 'no sku'}</span>
                            {p.tagline ? ` · ${p.tagline}` : ''}
                          </span>
                        </td>
                        <td>{deptLabel(p.dept)}</td>
                        <td><span className="price">{fmtPrice(p.price ?? 0)}</span></td>
                        <td className="pr-cost">{fmtPrice(p.cost ?? 0)}</td>
                        <td className={`pr-margin ${m !== null && m < 15 ? 'thin' : ''}`}>
                          {m === null ? '0%' : `${m}%`}
                        </td>
                        <td>
                          <span className={`pill ${low ? 'pill--new' : 'pill--delivered'}`}>
                            {qty} {qty === 1 ? 'pc' : 'pcs'}
                          </span>
                        </td>
                        <td>
                          <button className="row-action" onClick={() => openEdit(index)}>
                            <Pencil size={12} /> Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="pr-swipe">Slide the table sideways to see cost, margin and stock.</p>
          </>
        )}
      </div>

      {/* ── sticky bulk bar ── */}
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            className="pr-bulk"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <AnimatePresence>
              {pop === 'price' && (
                <motion.div className="pr-pop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                  <h4><Tag size={14} /> Change the price on {count} product{s(count)}</h4>
                  <div className="pr-pop-row">
                    <div className="pr-seg">
                      <button className={`chip ${priceMode === 'raise' ? 'on' : ''}`} onClick={() => setPriceMode('raise')}>Raise by %</button>
                      <button className={`chip ${priceMode === 'lower' ? 'on' : ''}`} onClick={() => setPriceMode('lower')}>Lower by %</button>
                      <button className={`chip ${priceMode === 'exact' ? 'on' : ''}`} onClick={() => setPriceMode('exact')}>Set one price</button>
                    </div>
                    {priceMode === 'exact' ? (
                      <label className="field">
                        <span>New price ({BRAND.currency})</span>
                        <input
                          value={priceExact}
                          onChange={(e) => setPriceExact(e.target.value)}
                          inputMode="decimal"
                          placeholder="150"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPrice(); } }}
                        />
                      </label>
                    ) : (
                      <label className="field">
                        <span>Percent</span>
                        <input
                          value={pricePct}
                          onChange={(e) => setPricePct(e.target.value)}
                          inputMode="decimal"
                          placeholder="10"
                          autoFocus
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyPrice(); } }}
                        />
                      </label>
                    )}
                    <button className="btn btn-primary btn-sm" onClick={applyPrice}>Apply</button>
                    <button className="btn btn-outline btn-sm" onClick={closePop}>Cancel</button>
                  </div>
                  {sample && preview !== null && (
                    <p className="pr-note">
                      {sample.name} becomes <b>{fmtPrice(preview)}</b> (it is {fmtPrice(sample.price ?? 0)} now).
                      Past orders keep the price they were sold at.
                    </p>
                  )}
                </motion.div>
              )}

              {pop === 'restock' && (
                <motion.div className="pr-pop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                  <h4><Boxes size={14} /> Add stock to {count} product{s(count)}</h4>
                  <div className="pr-pop-row">
                    <div className="pr-seg">
                      {['5', '10', '20', '50'].map((n) => (
                        <button key={n} className={`chip ${restockQty === n ? 'on' : ''}`} onClick={() => setRestockQty(n)}>
                          +{n}
                        </button>
                      ))}
                    </div>
                    <label className="field">
                      <span>Pieces to add</span>
                      <input
                        value={restockQty}
                        onChange={(e) => setRestockQty(e.target.value)}
                        inputMode="numeric"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); applyRestock(); } }}
                      />
                    </label>
                    <button className="btn btn-primary btn-sm" onClick={applyRestock}>Add to stock</button>
                    <button className="btn btn-outline btn-sm" onClick={closePop}>Cancel</button>
                  </div>
                  <p className="pr-note">This adds on top of what is already on the shelf, it does not replace the count.</p>
                </motion.div>
              )}

              {pop === 'delete' && (
                <motion.div className="pr-pop" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
                  <h4><TriangleAlert size={14} /> Remove {count} product{s(count)}?</h4>
                  <p className="pr-warn">
                    <TriangleAlert size={15} />
                    <span>
                      Products you added yourself are removed for good. Items from the original catalogue are
                      archived instead of destroyed, so the orders that already sold them still add up correctly.
                    </span>
                  </p>
                  <div className="pr-pop-row">
                    <button className="btn btn-primary btn-sm" onClick={applyDelete}>Yes, remove them</button>
                    <button className="btn btn-outline btn-sm" onClick={closePop}>Keep them</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="pr-bulk-inner">
              <span className="pr-bulk-count">
                {count} product{s(count)} selected
              </span>
              <div className="pr-bulk-acts">
                <button className={`pr-bbtn ${pop === 'price' ? 'on' : ''}`} onClick={() => setPop(pop === 'price' ? null : 'price')}>
                  <Tag size={14} /> Change price
                </button>
                <button className={`pr-bbtn ${pop === 'restock' ? 'on' : ''}`} onClick={() => setPop(pop === 'restock' ? null : 'restock')}>
                  <Boxes size={14} /> Restock +{money(restockQty) || 0}
                </button>
                {dept === 'archived' ? (
                  <button className="pr-bbtn" onClick={applyRestore}>
                    <ArchiveRestore size={14} /> Restore
                  </button>
                ) : (
                  <button className="pr-bbtn" onClick={applyArchive}>
                    <Archive size={14} /> Archive
                  </button>
                )}
                <button
                  className={`pr-bbtn pr-bbtn--danger ${pop === 'delete' ? 'on' : ''}`}
                  onClick={() => setPop(pop === 'delete' ? null : 'delete')}
                >
                  <Trash2 size={14} /> Delete
                </button>
                <button className="pr-bbtn" onClick={clearPicked}>
                  <X size={14} /> Clear selection
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modal === 'add' && (
          <AddModal key="add" dispatch={dispatch} onClose={() => setModal(null)} onDone={say} />
        )}
        {modal === 'bulk' && (
          <BulkModal key="bulk" dispatch={dispatch} onClose={() => setModal(null)} onDone={say} />
        )}
        {modal === 'edit' && editQueue.length > 0 && (
          <EditModal
            key="edit"
            queue={editQueue}
            startIndex={Math.min(editAt, editQueue.length - 1)}
            findProduct={findProduct}
            stock={state.stock}
            dispatch={dispatch}
            onClose={() => setModal(null)}
            onDone={say}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
