import { orderTotal, orderProfit, orderUnits, periodStart, ordersInPeriod } from '../context/StoreContext';

const DAY = 86400000;
export const dayKey = (iso) => new Date(iso).toDateString();
export const isLive = (o) => o.status !== 'cancelled';

// ── headline numbers for a period ───────────────────────────
export function summarise(orders, periodId) {
  const inPeriod = ordersInPeriod(orders, periodId).filter(isLive);

  // the equivalent window immediately before, for a like-for-like trend
  const start = periodStart(periodId).getTime();
  const span = periodId === 'all' ? 0 : Date.now() - start;
  const prev = span
    ? orders.filter((o) => {
        const t = new Date(o.date).getTime();
        return t >= start - span && t < start && isLive(o);
      })
    : [];

  const sum = (list, fn) => list.reduce((s, o) => s + fn(o), 0);
  const revenue = sum(inPeriod, orderTotal);
  const profit = sum(inPeriod, orderProfit);
  const prevRevenue = sum(prev, orderTotal);
  const prevProfit = sum(prev, orderProfit);

  // Only compare against a window that actually had trade in it. A jump
  // measured off one small order reads as a wild percentage and tells
  // the owner nothing useful.
  const change = (now, before) =>
    prev.length >= 2 && before > 0 ? Math.round(((now - before) / before) * 100) : null;

  return {
    orders: inPeriod,
    count: inPeriod.length,
    revenue,
    profit,
    margin: revenue > 0 ? Math.round((profit / revenue) * 100) : 0,
    units: sum(inPeriod, orderUnits),
    average: inPeriod.length ? Math.round(revenue / inPeriod.length) : 0,
    web: inPeriod.filter((o) => o.source === 'web'),
    pos: inPeriod.filter((o) => o.source === 'pos'),
    revenueChange: change(revenue, prevRevenue),
    profitChange: change(profit, prevProfit),
  };
}

// ── time series, bucketed to suit the window ────────────────
export function series(orders, periodId) {
  const live = orders.filter(isLive);
  const now = new Date();

  const bucketByDay = (n, fmt) =>
    [...Array(n)].map((_, i) => {
      const d = new Date(now.getTime() - (n - 1 - i) * DAY);
      const key = d.toDateString();
      const day = live.filter((o) => dayKey(o.date) === key);
      return {
        label: d.toLocaleDateString('en-GH', fmt),
        web: day.filter((o) => o.source === 'web').reduce((s, o) => s + orderTotal(o), 0),
        pos: day.filter((o) => o.source === 'pos').reduce((s, o) => s + orderTotal(o), 0),
        profit: day.reduce((s, o) => s + orderProfit(o), 0),
      };
    });

  const bucketByMonth = (n) =>
    [...Array(n)].map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
      const month = live.filter((o) => {
        const t = new Date(o.date);
        return t.getFullYear() === d.getFullYear() && t.getMonth() === d.getMonth();
      });
      return {
        label: d.toLocaleDateString('en-GH', { month: 'short' }),
        web: month.filter((o) => o.source === 'web').reduce((s, o) => s + orderTotal(o), 0),
        pos: month.filter((o) => o.source === 'pos').reduce((s, o) => s + orderTotal(o), 0),
        profit: month.reduce((s, o) => s + orderProfit(o), 0),
      };
    });

  if (periodId === 'today') {
    // hour by hour through trading hours
    const key = now.toDateString();
    const today = live.filter((o) => dayKey(o.date) === key);
    return [...Array(12)].map((_, i) => {
      const hour = 8 + i;
      const slot = today.filter((o) => new Date(o.date).getHours() === hour);
      return {
        label: `${hour}:00`,
        web: slot.filter((o) => o.source === 'web').reduce((s, o) => s + orderTotal(o), 0),
        pos: slot.filter((o) => o.source === 'pos').reduce((s, o) => s + orderTotal(o), 0),
        profit: slot.reduce((s, o) => s + orderProfit(o), 0),
      };
    });
  }
  if (periodId === '7') return bucketByDay(7, { weekday: 'short' });
  if (periodId === '30') return bucketByDay(30, { day: 'numeric' });
  if (periodId === '90') return bucketByMonth(3);
  return bucketByMonth(12);
}

// ── product performance ─────────────────────────────────────
export function productStats(orders, periodId = 'all') {
  const inPeriod = ordersInPeriod(orders, periodId).filter(isLive);
  const agg = {};
  inPeriod.forEach((o) =>
    o.items.forEach((l) => {
      agg[l.id] = agg[l.id] || { id: l.id, name: l.name, image: l.image, units: 0, revenue: 0, profit: 0 };
      agg[l.id].units += l.qty;
      agg[l.id].revenue += l.price * l.qty;
      agg[l.id].profit += (l.price - (l.cost ?? 0)) * l.qty;
    })
  );
  return Object.values(agg).sort((a, b) => b.revenue - a.revenue);
}

export function departmentStats(orders, findProduct, periodId = 'all') {
  const inPeriod = ordersInPeriod(orders, periodId).filter(isLive);
  const agg = {};
  inPeriod.forEach((o) =>
    o.items.forEach((l) => {
      const dept = findProduct(l.id)?.dept ?? 'other';
      agg[dept] = (agg[dept] || 0) + l.price * l.qty;
    })
  );
  return agg;
}

export function paymentStats(orders, periodId = 'all') {
  const inPeriod = ordersInPeriod(orders, periodId).filter(isLive);
  const agg = {};
  inPeriod.forEach((o) => { agg[o.payment] = (agg[o.payment] || 0) + orderTotal(o); });
  return Object.entries(agg).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

// ── customers ───────────────────────────────────────────────
export function customerStats(customers, orders) {
  const live = orders.filter(isLive);
  return customers
    .map((c) => {
      const digits = (c.phone || '').replace(/\D/g, '');
      const theirs = live.filter((o) => {
        const p = (o.customer?.phone || '').replace(/\D/g, '');
        return (digits && p === digits) || o.customer?.name === c.name;
      });
      const spent = theirs.reduce((s, o) => s + orderTotal(o), 0);
      return {
        ...c,
        orders: theirs.length,
        spent,
        last: theirs[0]?.date ?? null,
        history: theirs,
      };
    })
    .sort((a, b) => b.spent - a.spent);
}

// ── stock ───────────────────────────────────────────────────
export function lowStock(products, stock, threshold = 5) {
  return products
    .map((p) => ({ ...p, qty: stock[p.id] ?? 0 }))
    .filter((p) => p.qty <= threshold)
    .sort((a, b) => a.qty - b.qty);
}

export function stockValue(products, stock) {
  return products.reduce((s, p) => s + (stock[p.id] ?? 0) * (p.cost ?? 0), 0);
}
