import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  ArrowUpRight, ArrowDownRight, Minus, Coins, Wallet, ShoppingBag, Receipt,
  Globe, Store, Package, TriangleAlert, ArrowRight, Check, Plus, X, Clock,
  CircleCheck,
} from 'lucide-react';
import {
  useStore, orderTotal, orderUnits,
  STATUS_LABEL, STATUS_NEXT, STATUS_ACTION, PERIODS,
} from '../context/StoreContext';
import { summarise, series, productStats, lowStock } from './metrics';
import { fmtPrice } from '../config';
import './styles/dashboard.css';

// ── palette (recharts wants real colour strings) ─────────────
const C_WEB = '#8C4A2A';
const C_POS = '#1E2D26';
const C_PROFIT = '#4A7C59';
const TOOLTIP_STYLE = {
  background: '#fffdf8',
  border: '1px solid rgba(30,45,38,0.18)',
  color: '#1E2D26',
  borderRadius: 10,
  fontSize: 12,
};

// ── small guards, so nothing ever prints NaN ─────────────────
const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const money = (n) => fmtPrice(num(n));

const shortMoney = (v) => {
  const n = num(v);
  if (Math.abs(n) >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
};

// how the previous window is described under each money figure
const PREV_NOTE = {
  today: 'on yesterday',
  7: 'on the 7 days before',
  30: 'on the 30 days before',
  90: 'on the 90 days before',
  365: 'on last year',
  all: '',
};

const RANGE_NOTE = {
  today: 'Today, from opening until now',
  7: 'The last 7 days, today included',
  30: 'The last 30 days',
  90: 'The last 90 days, month by month',
  365: 'This year, month by month',
  all: 'Everything on record',
};

function ago(iso, now) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const ms = now - then;
  if (ms < 60000) return 'just now';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// ── the small green up / red down trend indicator ────────────
// It stays short on purpose. The window it is compared against is
// spelled out on the note line underneath, where text can wrap.
function Change({ value }) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return <span className="dash-change dash-change--none">no prior data</span>;
  }
  const v = Math.round(Number(value));
  if (v === 0) {
    return (
      <span className="dash-change is-flat">
        <Minus size={12} strokeWidth={2.4} /> level
      </span>
    );
  }
  const up = v > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`dash-change ${up ? 'is-up' : 'is-down'}`}>
      <Icon size={12} strokeWidth={2.4} />
      {up ? '+' : ''}{v}%
    </span>
  );
}

export default function Dashboard() {
  const { state, dispatch, managedProducts } = useStore();
  const [period, setPeriod] = useState('7');
  const [chartMode, setChartMode] = useState('revenue');
  const [flash, setFlash] = useState(null);          // { zone, text }
  const [confirmPack, setConfirmPack] = useState(false);
  const [peekId, setPeekId] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  // keeps "3 hr ago" honest without hammering the app
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), 2800);
    return () => clearTimeout(t);
  }, [flash]);

  const orders = state.orders || [];
  const threshold = num(state.settings?.lowStockThreshold) || 5;

  const s = useMemo(() => summarise(orders, period), [orders, period]);
  const chartData = useMemo(() => series(orders, period), [orders, period]);
  const top = useMemo(() => productStats(orders, period).slice(0, 5), [orders, period]);
  const low = useMemo(
    () => lowStock(managedProducts, state.stock || {}, threshold),
    [managedProducts, state.stock, threshold]
  );

  const webRevenue = useMemo(() => s.web.reduce((t, o) => t + num(orderTotal(o)), 0), [s.web]);
  const posRevenue = useMemo(() => s.pos.reduce((t, o) => t + num(orderTotal(o)), 0), [s.pos]);
  const sourceTotal = webRevenue + posRevenue;
  const webShare = sourceTotal > 0 ? Math.round((webRevenue / sourceTotal) * 100) : 0;
  const sourceData = [
    { name: 'Website', value: webRevenue },
    { name: 'Counter', value: posRevenue },
  ];

  const chartHasData = chartData.some((d) => num(d.web) + num(d.pos) + num(d.profit) > 0);

  // the action queue is deliberately not filtered by the period:
  // an order from last week still needs packing today.
  const queue = useMemo(
    () => orders
      .filter((o) => o.status === 'new' || o.status === 'processing')
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date)),
    [orders]
  );
  const newCount = queue.filter((o) => o.status === 'new').length;
  const latest = orders.slice(0, 6);
  const peek = peekId ? orders.find((o) => o.id === peekId) : null;

  const topMaxUnits = top.reduce((m, p) => Math.max(m, num(p.units)), 0) || 1;

  // ── actions ────────────────────────────────────────────────
  const advance = useCallback((o) => {
    const next = STATUS_NEXT[o.status];
    if (!next) return;
    dispatch({ type: 'order/status', id: o.id, status: next, note: 'Moved on from the dashboard' });
    setFlash({ zone: 'queue', text: `${o.id} is now ${STATUS_LABEL[next].toLowerCase()}.` });
  }, [dispatch]);

  const packAllNew = useCallback(() => {
    const ids = queue.filter((o) => o.status === 'new').map((o) => o.id);
    if (!ids.length) return;
    dispatch({ type: 'order/bulkStatus', ids, status: 'processing' });
    setConfirmPack(false);
    setFlash({ zone: 'queue', text: `${ids.length} order${ids.length === 1 ? '' : 's'} moved to packing.` });
  }, [dispatch, queue]);

  const restock = useCallback((p) => {
    dispatch({ type: 'stock/restock', id: p.id, qty: 10 });
    setFlash({ zone: 'stock', text: `Added 10 to ${p.name}. Now ${num(state.stock?.[p.id]) + 10} on the shelf.` });
  }, [dispatch, state.stock]);

  // Escape closes the order peek
  useEffect(() => {
    if (!peekId) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setPeekId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [peekId]);

  const prevNote = PREV_NOTE[period] ?? '';
  // only name the comparison window when there really was one
  const cmp = (change) =>
    (Number.isFinite(Number(change)) && prevNote ? `${prevNote} · ` : '');

  const kpis = [
    {
      key: 'revenue',
      icon: Coins,
      label: 'Revenue',
      value: money(s.revenue),
      change: s.revenueChange,
      note: `${cmp(s.revenueChange)}${num(s.count)} order${num(s.count) === 1 ? '' : 's'} counted`,
    },
    {
      key: 'profit',
      icon: Wallet,
      label: 'Profit',
      value: money(s.profit),
      change: s.profitChange,
      note: `${cmp(s.profitChange)}${num(s.margin)}% margin`,
    },
    {
      key: 'orders',
      icon: ShoppingBag,
      label: 'Orders',
      value: String(num(s.count)),
      change: undefined,
      note: `${num(s.web.length)} online, ${num(s.pos.length)} at the counter`,
    },
    {
      key: 'average',
      icon: Receipt,
      label: 'Average order',
      value: money(s.average),
      change: undefined,
      note: num(s.count) ? 'what a typical basket is worth' : 'no baskets yet in this window',
    },
  ];

  const tiles = [
    { key: 'web', icon: Globe, label: 'Website orders', value: num(s.web.length), sub: money(webRevenue), to: '/admin/orders' },
    { key: 'pos', icon: Store, label: 'Counter sales', value: num(s.pos.length), sub: money(posRevenue), to: '/admin/pos' },
    { key: 'units', icon: Package, label: 'Items sold', value: num(s.units), sub: 'pieces off the shelf', to: '/admin/reports' },
    {
      key: 'low', icon: TriangleAlert, label: 'Low stock', value: low.length,
      sub: low.length ? 'need restocking today' : 'every shelf is healthy',
      to: '/admin/inventory', alert: low.length > 0,
    },
  ];

  const fade = (i = 0) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, delay: Math.min(i * 0.05, 0.3), ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <div className="dash">
      {/* ── period switcher ── */}
      <div className="dash-bar">
        <div className="shop-chips dash-chips" role="group" aria-label="Choose a period">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip ${period === p.id ? 'on' : ''}`}
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <span className="dash-range">{RANGE_NOTE[period] ?? 'Selected period'}</span>
      </div>

      <div className="adm-grid">
        {/* ── headline numbers ── */}
        <div className="kpi-row">
          {kpis.map((k, i) => (
            <motion.div className="kpi dash-kpi" key={k.key} {...fade(i)}>
              <k.icon size={17} strokeWidth={1.6} />
              <span className="kpi-label">{k.label}</span>
              <strong className="kpi-value">{k.value}</strong>
              <span className="kpi-sub dash-kpi-foot">
                {k.change !== undefined && <Change value={k.change} />}
                <span className="dash-kpi-note">{k.note}</span>
              </span>
            </motion.div>
          ))}
        </div>

        {/* ── operational tiles ── */}
        <div className="dash-tiles">
          {tiles.map((t, i) => (
            <motion.div key={t.key} {...fade(i + 4)}>
              <Link to={t.to} className={`kpi dash-tile ${t.alert ? 'kpi--alert' : ''}`}>
                <t.icon size={16} strokeWidth={1.7} />
                <span className="kpi-label">{t.label}</span>
                <strong className="dash-tile-value">{t.value}</strong>
                <span className="kpi-sub">{t.sub}</span>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* ── revenue / profit chart ── */}
        <motion.section className="panel dash-wide" {...fade(8)}>
          <div className="panel-head">
            <h2>{chartMode === 'revenue' ? 'Money coming in' : 'Profit kept'}</h2>
            <div className="shop-chips dash-toggle">
              <button
                type="button"
                className={`chip ${chartMode === 'revenue' ? 'on' : ''}`}
                aria-pressed={chartMode === 'revenue'}
                onClick={() => setChartMode('revenue')}
              >
                Revenue
              </button>
              <button
                type="button"
                className={`chip ${chartMode === 'profit' ? 'on' : ''}`}
                aria-pressed={chartMode === 'profit'}
                onClick={() => setChartMode('profit')}
              >
                Profit
              </button>
            </div>
          </div>

          {chartHasData ? (
            <>
              <ResponsiveContainer width="100%" height={252}>
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="dashWeb" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C_WEB} stopOpacity={0.52} />
                      <stop offset="100%" stopColor={C_WEB} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="dashPos" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C_POS} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={C_POS} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="dashProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C_PROFIT} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={C_PROFIT} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" stroke="#6C7770" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                  <YAxis stroke="#6C7770" tickLine={false} axisLine={false} fontSize={11} width={46} tickFormatter={shortMoney} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: '#1E2D26', fontWeight: 700 }}
                    cursor={{ stroke: 'rgba(30,45,38,0.2)', strokeWidth: 1 }}
                    formatter={(v, name) => [
                      money(v),
                      name === 'web' ? 'Website' : name === 'pos' ? 'Counter' : 'Profit',
                    ]}
                  />
                  {chartMode === 'revenue' && (
                    <Area type="monotone" dataKey="web" stackId="1" stroke={C_WEB} strokeWidth={2} fill="url(#dashWeb)" />
                  )}
                  {chartMode === 'revenue' && (
                    <Area type="monotone" dataKey="pos" stackId="1" stroke={C_POS} strokeWidth={2} fill="url(#dashPos)" />
                  )}
                  {chartMode === 'profit' && (
                    <Area type="monotone" dataKey="profit" stroke={C_PROFIT} strokeWidth={2} fill="url(#dashProfit)" />
                  )}
                </AreaChart>
              </ResponsiveContainer>
              <div className="chart-legend">
                {chartMode === 'revenue' ? (
                  <>
                    <span><i style={{ background: C_WEB }} /> Website · {money(webRevenue)}</span>
                    <span><i style={{ background: C_POS }} /> Counter · {money(posRevenue)}</span>
                  </>
                ) : (
                  <span><i style={{ background: C_PROFIT }} /> Profit kept · {money(s.profit)}</span>
                )}
              </div>
            </>
          ) : (
            <div className="dash-empty">
              <h3>Nothing sold in this window yet</h3>
              <p>Pick a wider period above, or ring up a sale at the counter and watch it land here.</p>
              <Link to="/admin/pos" className="btn btn-outline btn-sm">Open the POS</Link>
            </div>
          )}
        </motion.section>

        {/* ── where sales come from ── */}
        <motion.section className="panel dash-narrow" {...fade(9)}>
          <div className="panel-head">
            <h2>Where sales come from</h2>
          </div>
          {sourceTotal > 0 ? (
            <>
              <div className="dash-donut-wrap">
                <ResponsiveContainer width="100%" height={196}>
                  <PieChart>
                    <Pie data={sourceData} dataKey="value" innerRadius={56} outerRadius={82} paddingAngle={3} stroke="none">
                      <Cell fill={C_WEB} />
                      <Cell fill={C_POS} />
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [money(v), n]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="dash-donut-center">
                  <strong>{webShare}%</strong>
                  <span>website</span>
                </div>
              </div>
              <div className="chart-legend chart-legend--wrap">
                <span><i style={{ background: C_WEB }} /> Website · {money(webRevenue)}</span>
                <span><i style={{ background: C_POS }} /> Counter · {money(posRevenue)}</span>
              </div>
            </>
          ) : (
            <div className="dash-empty">
              <h3>No sales to split yet</h3>
              <p>Once orders come in, you will see how much the website brings versus the shop floor.</p>
            </div>
          )}
        </motion.section>

        {/* ── the working half: two balanced columns ── */}
        <div className="dash-lower">
        <div className="dash-col">
        {/* ── needs attention ── */}
        <motion.section className="panel" {...fade(10)}>
          <div className="panel-head">
            <h2>Needs attention {queue.length > 0 && <span className="dash-count">{queue.length}</span>}</h2>
            {newCount > 1 && !confirmPack && (
              <button type="button" className="row-action" onClick={() => setConfirmPack(true)}>
                <Check size={13} /> Start packing all {newCount} new
              </button>
            )}
            {queue.length === 0 && <Link to="/admin/orders" className="panel-link">Order history →</Link>}
          </div>

          <AnimatePresence initial={false}>
            {confirmPack && (
              <motion.div
                className="dash-confirm"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                <span>Move {newCount} new order{newCount === 1 ? '' : 's'} into packing?</span>
                <div className="dash-confirm-btns">
                  <button type="button" className="btn btn-primary btn-sm" onClick={packAllNew} autoFocus>Yes, start packing</button>
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setConfirmPack(false)}>Leave them</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {flash?.zone === 'queue' && (
              <motion.p
                className="dash-flash"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <CircleCheck size={14} /> {flash.text}
              </motion.p>
            )}
          </AnimatePresence>

          {queue.length === 0 ? (
            <div className="dash-calm">
              <span className="dash-calm-seal"><CircleCheck size={22} strokeWidth={1.6} /></span>
              <h3>Everything is handled</h3>
              <p>No order is waiting on you. Every sale has been packed and sent out.</p>
              <Link to="/admin/pos" className="btn btn-outline btn-sm">Ring up a sale</Link>
            </div>
          ) : (
            <>
              <div className="dash-queue">
                {queue.slice(0, 6).map((o) => (
                  <div className="dash-queue-row" key={o.id}>
                    <button
                      type="button"
                      className="dash-queue-main"
                      aria-label={`Open order ${o.id}`}
                      onClick={() => setPeekId(o.id)}
                    >
                      <span className="dash-queue-id mono">{o.id}</span>
                      <span className="dash-queue-who">
                        {o.customer?.name || 'Walk-in customer'}
                        <span className="td-sub">
                          {o.customer?.area || 'In-store'} · {orderUnits(o)} item{orderUnits(o) === 1 ? '' : 's'} · <Clock size={11} /> {ago(o.date, now)}
                        </span>
                      </span>
                    </button>
                    <span className="price dash-queue-total">{money(orderTotal(o))}</span>
                    <span className={`pill pill--${o.status} dash-pill--${o.status}`}>{STATUS_LABEL[o.status]}</span>
                    <button type="button" className="row-action" onClick={() => advance(o)}>
                      {STATUS_ACTION[o.status] || 'Move on'} <ArrowRight size={13} />
                    </button>
                  </div>
                ))}
              </div>
              {queue.length > 6 && (
                <p className="panel-footnote">
                  <Link to="/admin/orders" className="panel-link">
                    {queue.length - 6} more waiting in Orders →
                  </Link>
                </p>
              )}
            </>
          )}
        </motion.section>

        {/* ── latest orders ── */}
        <motion.section className="panel" {...fade(11)}>
          <div className="panel-head">
            <h2>
              Latest orders
              <span className="live-chip"><span className="pulse-dot" /> live</span>
            </h2>
            <Link to="/admin/orders" className="panel-link">All orders →</Link>
          </div>
          {latest.length === 0 ? (
            <div className="dash-empty">
              <h3>No orders yet</h3>
              <p>The moment someone checks out on the website, or you ring up a sale, it shows here.</p>
              <Link to="/admin/pos" className="btn btn-outline btn-sm">Open the POS</Link>
            </div>
          ) : (
            <div className="dash-scroll">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((o) => (
                    <tr
                      key={o.id}
                      className="dash-row"
                      tabIndex={0}
                      role="button"
                      aria-label={`Open order ${o.id}`}
                      onClick={() => setPeekId(o.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPeekId(o.id); }
                      }}
                    >
                      <td className="mono">
                        {o.id}
                        <span className="td-sub">{o.source === 'web' ? 'Website' : 'Counter'}</span>
                      </td>
                      <td>
                        {o.customer?.name || 'Walk-in customer'}
                        <span className="td-sub">{o.customer?.area || 'In-store'}</span>
                      </td>
                      <td className="td-items">
                        {o.items.map((l) => `${l.name} x${l.qty}`).join(', ')}
                      </td>
                      <td>{o.payment}</td>
                      <td className="price">{money(orderTotal(o))}</td>
                      <td>
                        <span className={`pill pill--${o.status} dash-pill--${o.status}`}>
                          {STATUS_LABEL[o.status] || o.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.section>

        </div>

        <div className="dash-col">
        {/* ── top sellers ── */}
        <motion.section className="panel" {...fade(12)}>
          <div className="panel-head">
            <h2>Top sellers</h2>
            <Link to="/admin/reports" className="panel-link">Reports →</Link>
          </div>
          {top.length === 0 ? (
            <div className="dash-empty">
              <h3>No sales in this window</h3>
              <p>Choose a longer period to see which pieces move fastest.</p>
            </div>
          ) : (
            <div className="top-list">
              {top.map((p, i) => (
                <div className="top-item" key={p.id}>
                  <span className="top-rank mono">{i + 1}</span>
                  <img src={p.image} alt="" loading="lazy" />
                  <div className="dash-top-info">
                    <strong>{p.name}</strong>
                    <span>{num(p.units)} sold</span>
                    <div className="inv-bar dash-top-bar">
                      <div style={{ width: `${Math.max(6, (num(p.units) / topMaxUnits) * 100)}%` }} />
                    </div>
                  </div>
                  <span className="price">{money(p.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── low stock ── */}
        <motion.section className="panel" {...fade(13)}>
          <div className="panel-head">
            <h2>Running low</h2>
            <Link to="/admin/inventory" className="panel-link">Inventory →</Link>
          </div>

          <AnimatePresence initial={false}>
            {flash?.zone === 'stock' && (
              <motion.p
                className="dash-flash"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <CircleCheck size={14} /> {flash.text}
              </motion.p>
            )}
          </AnimatePresence>

          {low.length === 0 ? (
            <div className="dash-calm">
              <span className="dash-calm-seal"><Package size={20} strokeWidth={1.6} /></span>
              <h3>Shelves are full</h3>
              <p>Nothing has dropped to {threshold} pieces or fewer.</p>
            </div>
          ) : (
            <>
              <div className="dash-stock">
                {low.slice(0, 5).map((p) => (
                  <div className={`dash-stock-row ${num(p.qty) === 0 ? 'is-out' : ''}`} key={p.id}>
                    <img src={p.image} alt="" loading="lazy" />
                    <div className="dash-stock-info">
                      <strong>{p.name}</strong>
                      <div className="inv-bar">
                        <div style={{ width: `${Math.min(100, (num(p.qty) / threshold) * 100)}%` }} />
                      </div>
                      <span className="dash-stock-qty">
                        {num(p.qty) === 0 ? 'Out of stock' : `${num(p.qty)} left`}
                      </span>
                    </div>
                    <button type="button" className="row-action" onClick={() => restock(p)}>
                      <Plus size={13} /> 10
                    </button>
                  </div>
                ))}
              </div>
              <p className="panel-footnote">
                {low.length > 5
                  ? <Link to="/admin/inventory" className="panel-link">{low.length - 5} more items are low →</Link>
                  : `Alert set at ${threshold} pieces or fewer.`}
              </p>
            </>
          )}
        </motion.section>
        </div>
        </div>
      </div>

      {/* ── order peek ── */}
      <AnimatePresence>
        {peek && (
          <motion.div
            className="qv-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setPeekId(null)}
            role="presentation"
          >
            <motion.div
              className="adm-form dash-peek"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={`Order ${peek.id}`}
            >
              <div className="dash-peek-head">
                <div>
                  <h3>{peek.id}</h3>
                  <span className="mono">
                    Ref {peek.ref} · {new Date(peek.date).toLocaleString('en-GH', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <button type="button" className="drawer-close" onClick={() => setPeekId(null)} aria-label="Close" autoFocus>
                  <X size={18} />
                </button>
              </div>

              <div className="dash-peek-who">
                <strong>{peek.customer?.name || 'Walk-in customer'}</strong>
                <span>
                  {[peek.customer?.phone, peek.customer?.area, peek.customer?.address]
                    .filter(Boolean).join(' · ') || 'Sold at the counter'}
                </span>
                {peek.customer?.note ? <span className="dash-peek-note">Note: {peek.customer.note}</span> : null}
              </div>

              <div className="dash-peek-lines">
                {peek.items.map((l, i) => (
                  <div className="dash-peek-line" key={`${l.id}-${l.size}-${i}`}>
                    <span>{l.name} <em>{l.size}</em> x{l.qty}</span>
                    <span className="price">{money(num(l.price) * num(l.qty))}</span>
                  </div>
                ))}
              </div>

              <div className="dash-peek-totals">
                <div><span>Subtotal</span><span className="price">{money(peek.subtotal)}</span></div>
                <div><span>Delivery</span><span className="price">{num(peek.delivery) ? money(peek.delivery) : 'Free'}</span></div>
                {num(peek.discount) > 0 && (
                  <div><span>Discount</span><span className="price">- {money(peek.discount)}</span></div>
                )}
                <div className="dash-peek-grand">
                  <span>Total paid ({peek.payment})</span>
                  <span className="price">{money(orderTotal(peek))}</span>
                </div>
              </div>

              <div className="dash-peek-timeline">
                {(peek.timeline || []).map((t, i) => (
                  <div key={`${t.status}-${i}`}>
                    <strong>{STATUS_LABEL[t.status] || t.status}</strong>
                    <span>
                      {new Date(t.at).toLocaleString('en-GH', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                      {t.note ? ` · ${t.note}` : ''}
                    </span>
                  </div>
                ))}
              </div>

              <div className="dash-peek-actions">
                {STATUS_NEXT[peek.status] ? (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => advance(peek)}>
                    {STATUS_ACTION[peek.status]} <ArrowRight size={14} />
                  </button>
                ) : (
                  <span className={`pill pill--${peek.status} dash-pill--${peek.status}`}>
                    {STATUS_LABEL[peek.status] || peek.status}
                  </span>
                )}
                <Link to="/admin/orders" className="btn btn-outline btn-sm">Open in Orders</Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
