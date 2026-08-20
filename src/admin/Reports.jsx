import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  ArrowDownRight, ArrowUpRight, BarChart3, Check, Download, Globe, Minus, Printer, Store,
} from 'lucide-react';
import {
  useStore, orderTotal, orderProfit, orderUnits, ordersInPeriod, PERIODS, STATUS_LABEL,
} from '../context/StoreContext';
import {
  summarise, series, productStats, departmentStats, paymentStats, customerStats,
} from './metrics';
import { DEPARTMENTS } from '../data/products';
import { BRAND, fmtPrice } from '../config';
import './styles/reports.css';

/* ── Reports · the shop's books, in plain language ───────────
   Everything on this page answers to one period switcher. Nothing
   is estimated: every figure is read from the same orders the POS
   and the website write to. */

const TIP = {
  background: '#fffdf8',
  border: '1px solid rgba(30,45,38,0.18)',
  color: '#1E2D26',
  borderRadius: 10,
  fontSize: 12,
};
const COLOUR = { web: '#8C4A2A', pos: '#1E2D26', profit: '#B8613D' };

const num = (n) => (Number.isFinite(Number(n)) ? Number(n) : 0);
const pct = (part, whole) => (num(whole) > 0 ? Math.round((num(part) / num(whole)) * 100) : 0);
const money0 = (n) => Math.round(num(n));

// how the previous window is described, per period
const SINCE = {
  today: 'on yesterday',
  7: 'on the 7 days before',
  30: 'on the 30 days before',
  90: 'on the 90 days before',
  365: 'on the year before',
  all: '',
};

// how each bucket of the chart is described
const BUCKETS = {
  today: { word: 'hour', note: 'Hour by hour, 8:00am to 7:00pm' },
  7: { word: 'day', note: 'Day by day, the last 7 days' },
  30: { word: 'day', note: 'Day by day, the last 30 days' },
  90: { word: 'month', note: 'Month by month, the last 3 months' },
  365: { word: 'month', note: 'Month by month, the last 12 months' },
  all: { word: 'month', note: 'Month by month, the last 12 months' },
};

// what each payment method means for money actually reaching the shop
const SETTLEMENT = {
  'MTN MoMo': 'Mobile money lands in the merchant wallet the same day, so cash for restocking is never tied up.',
  'Telecel Cash': 'Telecel Cash lands the same day, so the money is ready for restocking straight away.',
  'AT Money': 'AT Money lands the same day, so the money is ready for restocking straight away.',
  Card: 'Card takes a few working days to reach the bank, so leave a little room before you count on that money.',
  Cash: 'Cash sits in the drawer immediately, so count it and bank it at closing to keep the float honest.',
  'Cash on delivery': 'Cash on delivery only arrives when the rider comes back, so reconcile riders at the end of every day.',
};

const CHANNEL_CSV = { web: 'Website', pos: 'Counter' };
const SOURCE_CSV = { web: 'Website', manual: 'Added by staff', pos: 'Counter' };

// ── CSV helpers ─────────────────────────────────────────────
// A byte order mark up front is what makes Excel read the cedi sign
// and Ghanaian names correctly instead of turning them into symbols.
const BOM = String.fromCharCode(0xfeff);

const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n');

const fileStamp = () => {
  const d = new Date();
  const two = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;
};

function saveCsv(name, rows) {
  const blob = new Blob([BOM + toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// ── small pieces ────────────────────────────────────────────
function Trend({ value, since }) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return <span className="rp-trend rp-trend--flat"><Minus size={12} /> No earlier window to compare</span>;
  }
  const v = Number(value);
  if (v === 0) return <span className="rp-trend rp-trend--flat"><Minus size={12} /> Level {since}</span>;
  const up = v > 0;
  return (
    <span className={`rp-trend ${up ? 'rp-trend--up' : 'rp-trend--down'}`}>
      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {up ? 'Up' : 'Down'} {Math.abs(v)}% {since}
    </span>
  );
}

function Blank({ title, hint, children }) {
  return (
    <div className="rp-blank">
      <BarChart3 size={19} strokeWidth={1.5} />
      <strong>{title}</strong>
      <p>{hint}</p>
      {children}
    </div>
  );
}

function BarRow({ label, amount, share, width, tone }) {
  return (
    <div className={`rp-barrow rp-tone-${tone}`}>
      <span className="rp-barrow-label">
        {label}
        <em>{share}% of takings</em>
      </span>
      <span className="price rp-barrow-amount">{fmtPrice(amount)}</span>
      <div className="rp-barrow-track">
        <div className="rp-barrow-fill" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function ChannelCard({ icon: Icon, title, blurb, stats, sharePct, tone }) {
  return (
    <div className={`panel rp-channel rp-channel--${tone}`}>
      <div className="rp-channel-head">
        <Icon size={16} strokeWidth={1.7} />
        <h3>{title}</h3>
      </div>
      <p className="rp-channel-blurb">{blurb}</p>
      <div className="rp-channel-figs">
        <div>
          <span className="kpi-label">Orders</span>
          <strong>{stats.count}</strong>
        </div>
        <div>
          <span className="kpi-label">Revenue</span>
          <strong className="price">{fmtPrice(stats.revenue)}</strong>
        </div>
        <div>
          <span className="kpi-label">Average order</span>
          <strong className="price">{fmtPrice(stats.average)}</strong>
        </div>
      </div>
      <div className="rp-channel-track">
        <div className="rp-channel-fill" style={{ width: `${sharePct}%` }} />
      </div>
      <span className="rp-channel-note">{sharePct}% of takings in this window</span>
    </div>
  );
}

// ── the page ────────────────────────────────────────────────
export default function Reports() {
  const { state, findProduct } = useStore();
  const [period, setPeriod] = useState('30');
  const [sortBy, setSortBy] = useState('revenue');
  const [showAll, setShowAll] = useState(false);
  const [done, setDone] = useState('');
  const doneTimer = useRef(null);

  const orders = state.orders || [];

  const m = useMemo(() => summarise(orders, period), [orders, period]);
  const chart = useMemo(() => series(orders, period), [orders, period]);
  const products = useMemo(() => productStats(orders, period), [orders, period]);
  const depts = useMemo(
    () => departmentStats(orders, findProduct, period),
    [orders, findProduct, period]
  );
  const pays = useMemo(() => paymentStats(orders, period), [orders, period]);

  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? '30 days';
  const since = SINCE[period] ?? '';
  const bucket = BUCKETS[period] ?? BUCKETS['30'];

  // ── headline strip ──
  const cogs = Math.max(0, num(m.revenue) - num(m.profit));
  const webOrders = m.web || [];
  const posOrders = m.pos || [];
  const kpis = [
    { label: 'Revenue', value: fmtPrice(num(m.revenue)), money: true, sub: <Trend value={m.revenueChange} since={since} /> },
    { label: 'Cost of goods', value: fmtPrice(cogs), money: true, sub: `${pct(cogs, m.revenue)}% of what came in` },
    { label: 'Profit kept', value: fmtPrice(num(m.profit)), money: true, sub: <Trend value={m.profitChange} since={since} /> },
    { label: 'Margin', value: `${num(m.margin)}%`, sub: 'kept on every cedi sold' },
    { label: 'Orders', value: num(m.count), sub: `${webOrders.length} online, ${posOrders.length} at the counter` },
    { label: 'Units sold', value: num(m.units), sub: m.count > 0 ? `${(num(m.units) / m.count).toFixed(1)} items an order` : 'nothing sold yet' },
    { label: 'Average order', value: fmtPrice(num(m.average)), money: true, sub: 'across every sale in this window' },
  ];

  // ── chart ──
  const hasChart = chart.some((d) => num(d.web) !== 0 || num(d.pos) !== 0 || num(d.profit) !== 0);
  const tickInterval = chart.length > 10 ? Math.max(1, Math.ceil(chart.length / 6) - 1) : 0;
  const axisMoney = (v) => {
    const n = num(v);
    if (n >= 1000) return `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
    return String(Math.round(n));
  };

  // ── best sellers ──
  const ranked = useMemo(() => {
    const list = [...products];
    if (sortBy === 'units') list.sort((a, b) => num(b.units) - num(a.units));
    else if (sortBy === 'profit') list.sort((a, b) => num(b.profit) - num(a.profit));
    else list.sort((a, b) => num(b.revenue) - num(a.revenue));
    return list;
  }, [products, sortBy]);
  const shown = showAll ? ranked : ranked.slice(0, 10);

  // ── departments ──
  const deptRows = useMemo(() => {
    const rows = Object.entries(depts || {}).map(([id, value]) => ({
      id,
      label: DEPARTMENTS.find((d) => d.id === id)?.label ?? 'Other',
      value: num(value),
    }));
    return rows.sort((a, b) => b.value - a.value);
  }, [depts]);
  const deptTop = deptRows[0]?.value ?? 0;
  const deptTotal = deptRows.reduce((s, r) => s + r.value, 0);

  // ── payments ──
  const payTop = pays[0]?.value ?? 0;
  const payTotal = pays.reduce((s, p) => s + num(p.value), 0);
  const payLeader = pays[0];
  const paySentence = payLeader
    ? `${payLeader.name} leads with ${pct(payLeader.value, payTotal)}% of takings in this window. ${
        SETTLEMENT[payLeader.name] ??
        'Check how quickly this one settles before you plan your restocking.'
      }`
    : 'No payments recorded in this window yet.';

  // ── channels ──
  const channel = (list) => {
    const revenue = list.reduce((s, o) => s + num(orderTotal(o)), 0);
    return {
      count: list.length,
      revenue,
      average: list.length ? Math.round(revenue / list.length) : 0,
    };
  };
  const web = channel(webOrders);
  const pos = channel(posOrders);
  const channelLine = (() => {
    if (m.count === 0) return 'Once sales start coming in, this is where you see which door is busier.';
    if (web.revenue === pos.revenue) return 'The website and the counter brought in exactly the same money in this window.';
    const leadWeb = web.revenue > pos.revenue;
    const lead = leadWeb ? web : pos;
    const other = leadWeb ? pos : web;
    const gap = other.revenue > 0 ? Math.round(((lead.revenue - other.revenue) / other.revenue) * 100) : 100;
    const name = leadWeb ? 'The website' : 'The counter';
    const bigger = lead.average > other.average
      ? `${leadWeb ? 'Online' : 'Counter'} baskets are also bigger, at ${fmtPrice(lead.average)} on average.`
      : `${leadWeb ? 'Counter' : 'Online'} baskets are bigger though, at ${fmtPrice(other.average)} on average.`;
    return `${name} brought in ${gap}% more money in this window. ${bigger}`;
  })();

  // ── exports ──
  const flash = (msg) => {
    setDone(msg);
    clearTimeout(doneTimer.current);
    doneTimer.current = setTimeout(() => setDone(''), 6000);
  };
  useEffect(() => () => clearTimeout(doneTimer.current), []);
  useEffect(() => {
    if (!done) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDone(''); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [done]);

  const exportOrders = () => {
    const list = ordersInPeriod(orders, period);
    const rows = [[
      'Order', 'Reference', 'Date', 'Time', 'Channel', 'Status', 'Payment',
      'Customer', 'Phone', 'Area', 'Items', 'Units',
      'Subtotal (GHS)', 'Delivery (GHS)', 'Discount (GHS)', 'Total (GHS)', 'Profit (GHS)',
    ]];
    list.forEach((o) => {
      const when = new Date(o.date);
      rows.push([
        o.id,
        o.ref ?? '',
        when.toLocaleDateString('en-GH'),
        when.toLocaleTimeString('en-GH', { hour: '2-digit', minute: '2-digit' }),
        CHANNEL_CSV[o.source] ?? o.source,
        STATUS_LABEL[o.status] ?? o.status,
        o.payment ?? '',
        o.customer?.name ?? 'Walk-in customer',
        o.customer?.phone ?? '',
        o.customer?.area ?? '',
        (o.items || []).map((l) => `${l.name} x${l.qty} (${l.size})`).join('; '),
        orderUnits(o),
        money0(o.subtotal),
        money0(o.delivery),
        money0(o.discount),
        money0(orderTotal(o)),
        money0(orderProfit(o)),
      ]);
    });
    saveCsv(`yvonnes-orders-${fileStamp()}.csv`, rows);
    flash(`Orders file saved, ${list.length} order${list.length === 1 ? '' : 's'} from ${periodLabel.toLowerCase()}.`);
  };

  const exportProducts = () => {
    const rows = [[
      'Rank', 'Product', 'SKU', 'Department', 'Units sold',
      'Revenue (GHS)', 'Profit (GHS)', 'Margin (%)',
    ]];
    ranked.forEach((p, i) => {
      const src = findProduct(p.id);
      rows.push([
        i + 1,
        p.name ?? p.id,
        src?.sku ?? '',
        DEPARTMENTS.find((d) => d.id === src?.dept)?.label ?? 'Other',
        num(p.units),
        money0(p.revenue),
        money0(p.profit),
        pct(p.profit, p.revenue),
      ]);
    });
    saveCsv(`yvonnes-products-${fileStamp()}.csv`, rows);
    flash(`Product performance saved, ${ranked.length} product${ranked.length === 1 ? '' : 's'} that sold in ${periodLabel.toLowerCase()}.`);
  };

  const exportCustomers = () => {
    const list = customerStats(state.customers || [], orders);
    const rows = [[
      'Name', 'Phone', 'Area', 'Address', 'Orders', 'Total spent (GHS)',
      'Last order', 'Customer since', 'Added by', 'Notes',
    ]];
    list.forEach((c) => {
      rows.push([
        c.name ?? '',
        c.phone ?? '',
        c.area ?? '',
        c.address ?? '',
        num(c.orders),
        money0(c.spent),
        c.last ? new Date(c.last).toLocaleDateString('en-GH') : 'No orders yet',
        c.createdAt ? new Date(c.createdAt).toLocaleDateString('en-GH') : '',
        SOURCE_CSV[c.source] ?? 'Added by staff',
        c.notes ?? '',
      ]);
    });
    saveCsv(`yvonnes-customers-${fileStamp()}.csv`, rows);
    flash(`Customer book saved, ${list.length} customer${list.length === 1 ? '' : 's'} with their full history.`);
  };

  const printSummary = () => {
    const previous = document.title;
    document.title = `${BRAND.name} sales report, ${periodLabel.toLowerCase()}`;
    window.print();
    setTimeout(() => { document.title = previous; }, 600);
  };

  const printedOn = new Date().toLocaleDateString('en-GH', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  const orderCount = ordersInPeriod(orders, period).length;
  const customerCount = (state.customers || []).length;

  const rise = { duration: 0.4, ease: [0.16, 1, 0.3, 1] };

  return (
    <div className="rp-root">
      {/* only ever seen on paper */}
      <div className="rp-print-head">
        <div>
          <strong>{BRAND.name}</strong>
          <span>Sales report, {periodLabel.toLowerCase()}</span>
        </div>
        <span>Printed {printedOn}</span>
      </div>

      <div className="rp-bar rp-noprint">
        <div className="rp-bar-left">
          <div className="shop-chips rp-chips">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`chip ${period === p.id ? 'on' : ''}`}
                aria-pressed={period === p.id}
                onClick={() => { setPeriod(p.id); setShowAll(false); }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="rp-bar-line">
            {m.count > 0
              ? `Over ${periodLabel.toLowerCase()} you sold ${fmtPrice(num(m.revenue))} across ${m.count} order${m.count === 1 ? '' : 's'} and kept ${fmtPrice(num(m.profit))}.`
              : `Nothing was sold in ${periodLabel.toLowerCase()}. Try a longer period, or record a sale at the counter.`}
          </p>
        </div>
        <button type="button" className="btn btn-outline btn-sm rp-print-btn" onClick={printSummary}>
          <Printer size={14} /> Printed summary
        </button>
      </div>

      <motion.div
        className="rp-kpis"
        key={period}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={rise}
      >
        {kpis.map((k) => (
          <div className="kpi rp-kpi" key={k.label}>
            <span className="kpi-label">{k.label}</span>
            <strong className={`kpi-value ${k.money ? 'price' : ''}`}>{k.value}</strong>
            <span className="kpi-sub">{k.sub}</span>
          </div>
        ))}
      </motion.div>

      {/* Revenue and profit over time */}
      <motion.div className="panel rp-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={rise}>
        <div className="panel-head">
          <h2>Revenue and profit over time</h2>
          <span className="panel-note">{bucket.note}</span>
        </div>
        {hasChart ? (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={chart} margin={{ top: 8, right: 6, left: -8, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(30,45,38,0.08)" />
                <XAxis
                  dataKey="label"
                  stroke="#6C7770"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  interval={tickInterval}
                />
                <YAxis
                  stroke="#6C7770"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={54}
                  tickFormatter={axisMoney}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(140,74,42,0.06)' }}
                  contentStyle={TIP}
                  labelStyle={{ color: '#1E2D26', fontWeight: 700 }}
                  formatter={(v, n) => [fmtPrice(num(v)), n]}
                />
                <Bar dataKey="web" name="Website revenue" stackId="rev" fill={COLOUR.web} maxBarSize={34} />
                <Bar dataKey="pos" name="Counter revenue" stackId="rev" fill={COLOUR.pos} maxBarSize={34} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="profit" name="Profit" stroke={COLOUR.profit} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
            <div className="chart-legend">
              <span><i style={{ background: COLOUR.web }} /> Website revenue</span>
              <span><i style={{ background: COLOUR.pos }} /> Counter revenue</span>
              <span><i className="rp-legend-line" style={{ background: COLOUR.profit }} /> Profit kept</span>
            </div>
            <p className="panel-footnote">
              Each bar stacks website takings on counter takings for that {bucket.word}. The line is what was left
              after the stock had been paid for.
            </p>
          </>
        ) : (
          <Blank
            title="No takings in this window"
            hint="Nothing was sold in the period you picked, so there is nothing to plot yet."
          >
            <div className="rp-blank-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPeriod('all')}>
                Show all time
              </button>
              <Link className="btn btn-primary btn-sm" to="/admin/pos">Record a counter sale</Link>
            </div>
          </Blank>
        )}
      </motion.div>

      {/* Best sellers */}
      <motion.div className="panel rp-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={rise}>
        <div className="panel-head">
          <h2>Best sellers</h2>
          <div className="shop-chips rp-sort rp-noprint">
            <span className="rp-sort-label">Rank by</span>
            {[
              { id: 'revenue', label: 'Revenue' },
              { id: 'units', label: 'Units' },
              { id: 'profit', label: 'Profit' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip ${sortBy === s.id ? 'on' : ''}`}
                aria-pressed={sortBy === s.id}
                onClick={() => setSortBy(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {ranked.length > 0 ? (
          <>
            <div className="rp-scroll">
              <table className="adm-table rp-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th className="rp-right">Units</th>
                    <th className="rp-right">Revenue</th>
                    <th className="rp-right">Profit</th>
                    <th className="rp-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p, i) => {
                    const margin = pct(p.profit, p.revenue);
                    return (
                      <tr key={p.id}>
                        <td className="mono rp-rank">{i + 1}</td>
                        <td className="td-img">
                          <div className="rp-prod">
                            {p.image
                              ? <img src={p.image} alt="" loading="lazy" />
                              : <span className="rp-thumb">{String(p.name || '?').charAt(0)}</span>}
                            <span className="rp-prod-name">{p.name}</span>
                          </div>
                        </td>
                        <td className="rp-right">{num(p.units)}</td>
                        <td className="rp-right price">{fmtPrice(num(p.revenue))}</td>
                        <td className="rp-right price">{fmtPrice(num(p.profit))}</td>
                        <td className="rp-right">
                          <span className={`rp-margin ${margin < 20 ? 'low' : ''}`}>{margin}%</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rp-table-foot">
              <span className="panel-footnote">
                Showing {shown.length} of {ranked.length} product{ranked.length === 1 ? '' : 's'} that sold in {periodLabel.toLowerCase()}.
              </span>
              {ranked.length > 10 && (
                <button type="button" className="panel-link rp-noprint" onClick={() => setShowAll((v) => !v)}>
                  {showAll ? 'Show the top 10 only' : `Show all ${ranked.length}`}
                </button>
              )}
            </div>
          </>
        ) : (
          <Blank
            title="No products sold yet"
            hint="As soon as something leaves the shelf, it shows up here with its units, revenue and margin."
          >
            <div className="rp-blank-actions">
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setPeriod('all')}>
                Show all time
              </button>
            </div>
          </Blank>
        )}
      </motion.div>

      {/* Departments and payments */}
      <div className="rp-cols">
        <motion.div className="panel rp-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={rise}>
          <div className="panel-head">
            <h2>Revenue by department</h2>
            <span className="panel-note">
              <span className="price">{fmtPrice(deptTotal)}</span> of goods, delivery not counted
            </span>
          </div>
          {deptRows.length > 0 ? (
            <div className="rp-bars">
              {deptRows.map((d, i) => (
                <BarRow
                  key={d.id}
                  tone={(i % 6) + 1}
                  label={d.label}
                  amount={d.value}
                  share={pct(d.value, deptTotal)}
                  width={deptTop > 0 ? Math.max(3, Math.round((d.value / deptTop) * 100)) : 0}
                />
              ))}
            </div>
          ) : (
            <Blank
              title="No department sales yet"
              hint="Sell anything from Women, Men, Kids, Footwear, Watches or Essentials and the split appears here."
            />
          )}
          {deptRows.length > 0 && (
            <p className="panel-footnote">
              {deptRows[0].label} is carrying this window at {pct(deptRows[0].value, deptTotal)}% of takings.
              Keep that rail full.
            </p>
          )}
        </motion.div>

        <motion.div className="panel rp-panel" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={rise}>
          <div className="panel-head">
            <h2>How customers pay</h2>
            <span className="panel-note">{pays.length} method{pays.length === 1 ? '' : 's'} used</span>
          </div>
          {pays.length > 0 ? (
            <div className="rp-bars">
              {pays.map((p, i) => (
                <BarRow
                  key={p.name}
                  tone={(i % 6) + 1}
                  label={p.name}
                  amount={num(p.value)}
                  share={pct(p.value, payTotal)}
                  width={payTop > 0 ? Math.max(3, Math.round((num(p.value) / payTop) * 100)) : 0}
                />
              ))}
            </div>
          ) : (
            <Blank
              title="No payments in this window"
              hint="Momo, card and cash all get counted here the moment a sale goes through."
            />
          )}
          <p className="panel-footnote">{paySentence}</p>
        </motion.div>
      </div>

      {/* Website versus counter */}
      <motion.div className="rp-block" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={rise}>
        <div className="rp-block-head">
          <h2>Website versus counter</h2>
          <span className="panel-note">Both doors, same books, {periodLabel.toLowerCase()}</span>
        </div>
        <div className="rp-channels">
          <ChannelCard
            icon={Globe}
            tone="web"
            title="Website"
            blurb="Orders placed online and packed by your team."
            stats={web}
            sharePct={pct(web.revenue, m.revenue)}
          />
          <ChannelCard
            icon={Store}
            tone="pos"
            title="Counter"
            blurb="Walk-in sales rung up on the shop floor."
            stats={pos}
            sharePct={pct(pos.revenue, m.revenue)}
          />
        </div>
        <p className="panel-footnote rp-channel-line">{channelLine}</p>
      </motion.div>

      {/* Export */}
      <motion.div className="panel rp-panel rp-noprint" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={rise}>
        <div className="panel-head">
          <h2>Take the numbers with you</h2>
          <span className="panel-note">Files save straight to this device</span>
        </div>
        <div className="rp-exports">
          <button type="button" className="btn btn-outline rp-export" onClick={exportOrders}>
            <Download size={15} />
            <span>
              <strong>Orders</strong>
              <em>{orderCount} row{orderCount === 1 ? '' : 's'}, {periodLabel.toLowerCase()}</em>
            </span>
          </button>
          <button type="button" className="btn btn-outline rp-export" onClick={exportProducts}>
            <Download size={15} />
            <span>
              <strong>Products performance</strong>
              <em>{ranked.length} row{ranked.length === 1 ? '' : 's'}, units, revenue and margin</em>
            </span>
          </button>
          <button type="button" className="btn btn-outline rp-export" onClick={exportCustomers}>
            <Download size={15} />
            <span>
              <strong>Customers</strong>
              <em>{customerCount} row{customerCount === 1 ? '' : 's'}, all time</em>
            </span>
          </button>
        </div>
        {done && (
          <p className="rp-done" role="status">
            <Check size={14} /> {done}
          </p>
        )}
        <p className="panel-footnote">
          Every file opens in Excel, Google Sheets or anything your accountant uses. Nothing leaves this device
          unless you send it.
        </p>
      </motion.div>
    </div>
  );
}
