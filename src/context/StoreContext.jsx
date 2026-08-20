import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { PRODUCTS } from '../data/products';

// ── One store, two doors ────────────────────────────────────
// The website and the management system share this state. A web
// order appears in the BMS instantly; a POS sale moves the same
// stock the website sells from.
//
// Orders snapshot the name, price and cost of each line at the
// moment of sale, so changing a price later never rewrites history.

const KEY = 'yvonnes-store-v4';
const DAY = 86400000;

const daysAgo = (d, h = 10, m = 0) => {
  const t = new Date(Date.now() - d * DAY);
  t.setHours(h, m, 0, 0);
  return t.toISOString();
};

const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export const STATUS_FLOW = ['new', 'processing', 'ready', 'delivered'];
export const STATUS_LABEL = {
  new: 'New',
  processing: 'Packing',
  ready: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};
export const STATUS_NEXT = { new: 'processing', processing: 'ready', ready: 'delivered' };
export const STATUS_ACTION = {
  new: 'Start packing',
  processing: 'Send out',
  ready: 'Mark delivered',
};
// What the customer sees on the public tracking page
export const STATUS_PUBLIC = {
  new: 'Order received',
  processing: 'Packing your order',
  ready: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const DELIVERY_FEE = 30;
const FREE_DELIVERY_FROM = 500;
export const deliveryFor = (subtotal) => (subtotal >= FREE_DELIVERY_FROM ? 0 : DELIVERY_FEE);
export { DELIVERY_FEE, FREE_DELIVERY_FROM };

// ── seed helpers ────────────────────────────────────────────
function seedStock() {
  const stock = {};
  PRODUCTS.forEach((p, i) => {
    stock[p.id] = [24, 8, 15, 3, 30, 12, 18, 5, 22, 9][i % 10];
  });
  return stock;
}

const line = (id, qty, size) => {
  const p = PRODUCTS.find((x) => x.id === id);
  return {
    id, qty,
    size: size ?? p?.sizes?.[0] ?? 'One size',
    name: p?.name ?? id,
    price: p?.price ?? 0,
    cost: p?.cost ?? 0,
    image: p?.image ?? '',
  };
};

function buildOrder({ no, source, date, status, payment, customer, items, discount = 0 }) {
  const lines = items.map(([id, qty, size]) => line(id, qty, size));
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const delivery = source === 'pos' ? 0 : deliveryFor(subtotal);
  const timeline = [{ status: 'new', at: date, note: source === 'web' ? 'Order placed on the website' : 'Sold at the counter' }];
  STATUS_FLOW.slice(1, STATUS_FLOW.indexOf(status) + 1).forEach((s, i) => {
    timeline.push({ status: s, at: new Date(new Date(date).getTime() + (i + 1) * 3600000).toISOString(), note: '' });
  });
  return {
    id: `YC-${no}`,
    ref: `YC${no}${String(customer.phone || '0000').replace(/\D/g, '').slice(-3)}`,
    date, source, status, payment, customer,
    items: lines,
    subtotal, delivery, discount,
    total: subtotal + delivery - discount,
    timeline,
  };
}

const SEED_CUSTOMERS = [
  { id: 'c-1', name: 'Akosua Mensah', phone: '024 555 0192', area: 'East Legon', address: 'Boundary Rd, near the school', notes: '', createdAt: daysAgo(28), source: 'web' },
  { id: 'c-2', name: 'Kwame Boateng', phone: '020 555 0143', area: 'Tema', address: 'Community 5', notes: 'Prefers evening delivery', createdAt: daysAgo(24), source: 'web' },
  { id: 'c-3', name: 'Efua Asante', phone: '054 555 0177', area: 'Spintex', address: 'Manet Court', notes: '', createdAt: daysAgo(20), source: 'web' },
  { id: 'c-4', name: 'Yaw Darko', phone: '024 555 0781', area: 'Kumasi', address: 'Ahodwo', notes: '', createdAt: daysAgo(16), source: 'web' },
  { id: 'c-5', name: 'Ama Serwaa', phone: '055 555 0290', area: 'Osu', address: 'Oxford St', notes: 'Wholesale, buys in threes', createdAt: daysAgo(12), source: 'web' },
  { id: 'c-6', name: 'Kofi Adjei', phone: '027 555 0355', area: 'Achimota', address: 'Mile 7', notes: '', createdAt: daysAgo(9), source: 'web' },
  { id: 'c-7', name: 'Maame Yaa', phone: '024 555 0918', area: 'Cantonments', address: '', notes: '', createdAt: daysAgo(6), source: 'web' },
  { id: 'c-8', name: 'Nana Ama Owusu', phone: '020 555 0466', area: 'Airport Residential', address: '', notes: 'Regular, always asks for new watches', createdAt: daysAgo(3), source: 'manual' },
];

const cust = (i, extra = {}) => ({ ...SEED_CUSTOMERS[i], ...extra });
const walkIn = { name: 'Walk-in customer', phone: '', area: 'In-store', address: '', note: '' };

const SEED_ORDERS = [
  buildOrder({ no: 1041, source: 'web', date: daysAgo(0, 9, 12),  status: 'new',        payment: 'MTN MoMo',     customer: cust(0), items: [['w-01', 1], ['f-05', 1]] }),
  buildOrder({ no: 1040, source: 'pos', date: daysAgo(0, 8, 40),  status: 'delivered',  payment: 'Cash',         customer: walkIn,  items: [['k-02', 2]] }),
  buildOrder({ no: 1039, source: 'web', date: daysAgo(1, 18, 5),  status: 'processing', payment: 'Card',         customer: cust(1), items: [['f-01', 1]] }),
  buildOrder({ no: 1038, source: 'web', date: daysAgo(1, 13, 30), status: 'delivered',  payment: 'MTN MoMo',     customer: cust(2), items: [['t-01', 1], ['w-04', 1]] }),
  buildOrder({ no: 1037, source: 'pos', date: daysAgo(2, 15, 15), status: 'delivered',  payment: 'MTN MoMo',     customer: walkIn,  items: [['m-03', 1], ['m-05', 2]] }),
  buildOrder({ no: 1036, source: 'web', date: daysAgo(3, 11, 20), status: 'delivered',  payment: 'Telecel Cash', customer: cust(2), items: [['w-02', 1]] }),
  buildOrder({ no: 1035, source: 'web', date: daysAgo(4, 19, 0),  status: 'delivered',  payment: 'MTN MoMo',     customer: cust(3), items: [['f-02', 1], ['t-02', 1]] }),
  buildOrder({ no: 1034, source: 'pos', date: daysAgo(5, 12, 45), status: 'delivered',  payment: 'Card',         customer: walkIn,  items: [['w-05', 1]] }),
  buildOrder({ no: 1033, source: 'web', date: daysAgo(6, 16, 10), status: 'delivered',  payment: 'MTN MoMo',     customer: cust(4), items: [['w-06', 1], ['f-06', 2]] }),
  buildOrder({ no: 1032, source: 'pos', date: daysAgo(8, 10, 5),  status: 'delivered',  payment: 'Cash',         customer: walkIn,  items: [['k-01', 1], ['k-04', 1]] }),
  buildOrder({ no: 1031, source: 'web', date: daysAgo(11, 14, 25),status: 'delivered',  payment: 'AT Money',     customer: cust(5), items: [['m-07', 1]] }),
  buildOrder({ no: 1030, source: 'web', date: daysAgo(14, 9, 50), status: 'delivered',  payment: 'MTN MoMo',     customer: cust(6), items: [['t-04', 1], ['w-03', 2]] }),
  buildOrder({ no: 1029, source: 'pos', date: daysAgo(18, 17, 30),status: 'delivered',  payment: 'MTN MoMo',     customer: walkIn,  items: [['f-03', 1]] }),
  buildOrder({ no: 1028, source: 'web', date: daysAgo(23, 12, 0), status: 'delivered',  payment: 'Card',         customer: cust(7), items: [['m-01', 1], ['d-01', 2]] }),
  buildOrder({ no: 1027, source: 'pos', date: daysAgo(21, 11, 15),status: 'delivered',  payment: 'Cash',         customer: walkIn,  items: [['m-05', 3], ['f-06', 1]] }),
  buildOrder({ no: 1026, source: 'web', date: daysAgo(24, 15, 40),status: 'delivered',  payment: 'MTN MoMo',     customer: cust(0), items: [['t-03', 1]] }),
  buildOrder({ no: 1025, source: 'pos', date: daysAgo(27, 13, 20),status: 'delivered',  payment: 'MTN MoMo',     customer: walkIn,  items: [['m-08', 1], ['m-04', 1]] }),
  buildOrder({ no: 1024, source: 'web', date: daysAgo(29, 10, 30),status: 'delivered',  payment: 'Card',         customer: cust(3), items: [['f-01', 1]] }),

  // ── trading history, so every period has something to compare with ──
  buildOrder({ no: 1023, source: 'pos', date: daysAgo(33, 12, 10),status: 'delivered',  payment: 'Cash',         customer: walkIn,  items: [['f-05', 2], ['w-04', 1]] }),
  buildOrder({ no: 1022, source: 'web', date: daysAgo(35, 16, 30),status: 'delivered',  payment: 'MTN MoMo',     customer: cust(2), items: [['m-02', 1]] }),
  buildOrder({ no: 1021, source: 'pos', date: daysAgo(38, 10, 45),status: 'delivered',  payment: 'MTN MoMo',     customer: walkIn,  items: [['k-02', 1], ['k-04', 2]] }),
  buildOrder({ no: 1020, source: 'web', date: daysAgo(41, 14, 15),status: 'delivered',  payment: 'Card',         customer: cust(1), items: [['t-01', 1], ['w-01', 1]] }),
  buildOrder({ no: 1019, source: 'pos', date: daysAgo(44, 17, 0),  status: 'delivered',  payment: 'Cash',         customer: walkIn,  items: [['m-11', 1]] }),
  buildOrder({ no: 1018, source: 'web', date: daysAgo(47, 11, 25),status: 'delivered',  payment: 'MTN MoMo',     customer: cust(4), items: [['f-02', 1], ['m-06', 1]] }),
  buildOrder({ no: 1017, source: 'pos', date: daysAgo(51, 15, 5), status: 'delivered',  payment: 'MTN MoMo',     customer: walkIn,  items: [['w-02', 2]] }),
  buildOrder({ no: 1016, source: 'web', date: daysAgo(54, 9, 40),  status: 'delivered',  payment: 'Telecel Cash', customer: cust(6), items: [['t-04', 1]] }),
  buildOrder({ no: 1015, source: 'pos', date: daysAgo(58, 13, 50),status: 'delivered',  payment: 'Cash',         customer: walkIn,  items: [['d-01', 3], ['m-05', 1]] }),
  buildOrder({ no: 1014, source: 'web', date: daysAgo(62, 18, 20),status: 'delivered',  payment: 'MTN MoMo',     customer: cust(5), items: [['f-01', 1]] }),
  buildOrder({ no: 1013, source: 'pos', date: daysAgo(66, 12, 30),status: 'delivered',  payment: 'Card',         customer: walkIn,  items: [['m-01', 1], ['m-09', 1]] }),
  buildOrder({ no: 1012, source: 'web', date: daysAgo(70, 10, 10),status: 'delivered',  payment: 'MTN MoMo',     customer: cust(0), items: [['w-06', 1]] }),
  buildOrder({ no: 1011, source: 'pos', date: daysAgo(75, 16, 45),status: 'delivered',  payment: 'MTN MoMo',     customer: walkIn,  items: [['f-06', 3]] }),
  buildOrder({ no: 1010, source: 'web', date: daysAgo(80, 14, 0),  status: 'delivered',  payment: 'AT Money',     customer: cust(3), items: [['t-02', 1], ['k-01', 1]] }),
  buildOrder({ no: 1009, source: 'pos', date: daysAgo(86, 11, 35),status: 'delivered',  payment: 'Cash',         customer: walkIn,  items: [['w-05', 2], ['w-03', 1]] }),
  buildOrder({ no: 1008, source: 'web', date: daysAgo(92, 15, 15),status: 'delivered',  payment: 'MTN MoMo',     customer: cust(7), items: [['m-03', 1]] }),
  buildOrder({ no: 1007, source: 'pos', date: daysAgo(99, 13, 5), status: 'delivered',  payment: 'MTN MoMo',     customer: walkIn,  items: [['f-04', 1], ['k-03', 1]] }),
  buildOrder({ no: 1006, source: 'web', date: daysAgo(108, 17, 40),status: 'delivered', payment: 'Card',         customer: cust(2), items: [['m-04', 1], ['m-10', 1]] }),
  buildOrder({ no: 1005, source: 'pos', date: daysAgo(120, 12, 25),status: 'delivered', payment: 'Cash',         customer: walkIn,  items: [['t-03', 1]] }),
];

const SEED_NOTIFS = [
  { id: 'n-1', type: 'order', title: 'New website order', body: 'Akosua Mensah ordered 2 items, GH₵ 280', at: daysAgo(0, 9, 12), read: false, orderId: 'YC-1041' },
];

const initialState = {
  cart: [],
  orders: SEED_ORDERS,
  customers: SEED_CUSTOMERS,
  stock: seedStock(),
  extraProducts: [],
  edits: {},            // { productId: {name, price, cost, dept, tagline} } overrides for base products
  archived: [],         // product ids hidden from the shop
  notifications: SEED_NOTIFS,
  nextOrderNo: 1042,
  settings: { lowStockThreshold: 5, soundAlerts: true, pushAlerts: false },
};

// ── reducer ─────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ...action.payload };

    // ── cart ──
    case 'cart/add': {
      const { id, size, qty = 1 } = action;
      const found = state.cart.find((c) => c.id === id && c.size === size);
      const cart = found
        ? state.cart.map((c) => (c.id === id && c.size === size ? { ...c, qty: c.qty + qty } : c))
        : [...state.cart, { id, size, qty }];
      return { ...state, cart };
    }
    case 'cart/qty': {
      const cart = state.cart
        .map((c, i) => (i === action.index ? { ...c, qty: Math.max(0, c.qty + action.delta) } : c))
        .filter((c) => c.qty > 0);
      return { ...state, cart };
    }
    case 'cart/remove':
      return { ...state, cart: state.cart.filter((_, i) => i !== action.index) };
    case 'cart/clear':
      return { ...state, cart: [] };

    // ── orders ──
    case 'order/place': {
      const { source, payment, customer, items, discount = 0 } = action;
      const no = state.nextOrderNo;
      const date = new Date().toISOString();
      const lines = items.map((it) => {
        const p = [...state.extraProducts, ...PRODUCTS].find((x) => x.id === it.id);
        const e = state.edits[it.id] || {};
        return {
          id: it.id,
          qty: it.qty,
          size: it.size ?? p?.sizes?.[0] ?? 'One size',
          name: e.name ?? p?.name ?? it.id,
          price: e.price ?? p?.price ?? 0,
          cost: e.cost ?? p?.cost ?? 0,
          image: p?.image ?? '',
        };
      });
      const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
      const delivery = source === 'pos' ? 0 : deliveryFor(subtotal);
      const order = {
        id: `YC-${no}`,
        ref: `YC${no}${String(customer.phone || '0000').replace(/\D/g, '').slice(-3)}`,
        date, source,
        status: source === 'pos' ? 'delivered' : 'new',
        payment, customer, items: lines,
        subtotal, delivery, discount,
        total: subtotal + delivery - discount,
        timeline: [{
          status: source === 'pos' ? 'delivered' : 'new',
          at: date,
          note: source === 'web' ? 'Order placed on the website' : 'Sold at the counter',
        }],
      };

      const stock = { ...state.stock };
      lines.forEach((l) => { stock[l.id] = Math.max(0, (stock[l.id] ?? 0) - l.qty); });

      // a web customer who is new to us gets a record automatically
      let customers = state.customers;
      if (source === 'web' && customer.phone) {
        const exists = customers.some((c) => c.phone.replace(/\D/g, '') === customer.phone.replace(/\D/g, ''));
        if (!exists) {
          customers = [{
            id: uid('c'), name: customer.name, phone: customer.phone,
            area: customer.area || '', address: customer.address || '', notes: '',
            createdAt: date, source: 'web',
          }, ...customers];
        }
      }

      const notifications = [{
        id: uid('n'), type: 'order',
        title: source === 'web' ? 'New website order' : 'Counter sale recorded',
        body: `${customer.name || 'Walk-in'} · ${lines.reduce((n, l) => n + l.qty, 0)} item${lines.length === 1 ? '' : 's'} · GH₵ ${subtotal + delivery - discount}`,
        at: date, read: false, orderId: order.id,
      }, ...state.notifications].slice(0, 60);

      return {
        ...state,
        orders: [order, ...state.orders],
        stock, customers, notifications,
        nextOrderNo: no + 1,
        cart: source === 'web' ? [] : state.cart,
        lastOrder: order,
      };
    }
    case 'order/status': {
      const at = new Date().toISOString();
      const orders = state.orders.map((o) =>
        o.id === action.id
          ? { ...o, status: action.status, timeline: [...o.timeline, { status: action.status, at, note: action.note || '' }] }
          : o
      );
      return { ...state, orders };
    }
    case 'order/bulkStatus': {
      const at = new Date().toISOString();
      const ids = new Set(action.ids);
      const orders = state.orders.map((o) =>
        ids.has(o.id)
          ? { ...o, status: action.status, timeline: [...o.timeline, { status: action.status, at, note: '' }] }
          : o
      );
      return { ...state, orders };
    }
    case 'order/cancel': {
      const at = new Date().toISOString();
      const stock = { ...state.stock };
      const target = state.orders.find((o) => o.id === action.id);
      // cancelling returns the goods to the shelf
      if (target && target.status !== 'cancelled') {
        target.items.forEach((l) => { stock[l.id] = (stock[l.id] ?? 0) + l.qty; });
      }
      const orders = state.orders.map((o) =>
        o.id === action.id
          ? { ...o, status: 'cancelled', timeline: [...o.timeline, { status: 'cancelled', at, note: action.reason || '' }] }
          : o
      );
      return { ...state, orders, stock };
    }
    case 'order/delete':
      return { ...state, orders: state.orders.filter((o) => !action.ids.includes(o.id)) };

    // ── products ──
    case 'product/add': {
      const p = {
        ...action.product,
        id: uid('x'),
        sku: action.product.sku || `YC-${Math.floor(Math.random() * 900 + 100)}`,
      };
      return {
        ...state,
        extraProducts: [p, ...state.extraProducts],
        stock: { ...state.stock, [p.id]: action.qty ?? 0 },
      };
    }
    case 'product/addBulk': {
      const created = action.products.map((prod) => ({
        ...prod,
        id: uid('x'),
        sku: prod.sku || `YC-${Math.floor(Math.random() * 900 + 100)}`,
      }));
      const stock = { ...state.stock };
      created.forEach((p, i) => { stock[p.id] = action.quantities?.[i] ?? p.qty ?? 0; });
      return { ...state, extraProducts: [...created, ...state.extraProducts], stock };
    }
    case 'product/update': {
      const { id, patch } = action;
      const isExtra = state.extraProducts.some((p) => p.id === id);
      if (isExtra) {
        return {
          ...state,
          extraProducts: state.extraProducts.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        };
      }
      return { ...state, edits: { ...state.edits, [id]: { ...(state.edits[id] || {}), ...patch } } };
    }
    case 'product/bulkUpdate': {
      // action.patch is a function of the current product, so callers can
      // express things like "raise every selected price by 10%".
      const ids = new Set(action.ids);
      const edits = { ...state.edits };
      const extraProducts = state.extraProducts.map((p) =>
        ids.has(p.id) ? { ...p, ...action.patch(p) } : p
      );
      action.ids.forEach((id) => {
        if (state.extraProducts.some((p) => p.id === id)) return;
        const base = PRODUCTS.find((p) => p.id === id);
        if (!base) return;
        const current = { ...base, ...(edits[id] || {}) };
        edits[id] = { ...(edits[id] || {}), ...action.patch(current) };
      });
      return { ...state, edits, extraProducts };
    }
    case 'product/archive': {
      const ids = new Set([...state.archived, ...action.ids]);
      return { ...state, archived: [...ids] };
    }
    case 'product/restore':
      return { ...state, archived: state.archived.filter((id) => !action.ids.includes(id)) };
    case 'product/delete': {
      // custom products are removed outright; catalogue items are archived
      const custom = action.ids.filter((id) => state.extraProducts.some((p) => p.id === id));
      const base = action.ids.filter((id) => !custom.includes(id));
      const stock = { ...state.stock };
      custom.forEach((id) => { delete stock[id]; });
      return {
        ...state,
        extraProducts: state.extraProducts.filter((p) => !custom.includes(p.id)),
        archived: [...new Set([...state.archived, ...base])],
        stock,
      };
    }

    // ── stock ──
    case 'stock/set':
      return { ...state, stock: { ...state.stock, [action.id]: Math.max(0, action.qty) } };
    case 'stock/restock':
      return { ...state, stock: { ...state.stock, [action.id]: (state.stock[action.id] ?? 0) + action.qty } };
    case 'stock/bulkRestock': {
      const stock = { ...state.stock };
      action.ids.forEach((id) => { stock[id] = (stock[id] ?? 0) + action.qty; });
      return { ...state, stock };
    }

    // ── customers ──
    case 'customer/add':
      return {
        ...state,
        customers: [{ id: uid('c'), createdAt: new Date().toISOString(), source: 'manual', notes: '', ...action.customer }, ...state.customers],
      };
    case 'customer/addBulk': {
      const now = new Date().toISOString();
      const created = action.customers.map((c) => ({
        id: uid('c'), createdAt: now, source: 'manual', notes: '', area: '', address: '', ...c,
      }));
      return { ...state, customers: [...created, ...state.customers] };
    }
    case 'customer/update':
      return {
        ...state,
        customers: state.customers.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
    case 'customer/delete':
      return { ...state, customers: state.customers.filter((c) => !action.ids.includes(c.id)) };

    // ── notifications ──
    case 'notif/read':
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, read: true } : n)) };
    case 'notif/readAll':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    case 'notif/clear':
      return { ...state, notifications: [] };
    case 'notif/push':
      return {
        ...state,
        notifications: [{ id: uid('n'), at: new Date().toISOString(), read: false, type: 'system', ...action.notif }, ...state.notifications].slice(0, 60),
      };

    // ── settings ──
    case 'settings/set':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    case 'demo/reset':
      return { ...initialState, stock: seedStock() };

    default:
      return state;
  }
}

const StoreCtx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init) => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
      return saved ? { ...init, ...saved } : init;
    } catch {
      return init;
    }
  });

  // persist (throttled to an animation frame so bulk actions stay smooth)
  const saveRef = useRef();
  useEffect(() => {
    cancelAnimationFrame(saveRef.current);
    saveRef.current = requestAnimationFrame(() => {
      const { cart, orders, customers, stock, extraProducts, edits, archived, notifications, nextOrderNo, settings } = state;
      localStorage.setItem(KEY, JSON.stringify({ cart, orders, customers, stock, extraProducts, edits, archived, notifications, nextOrderNo, settings }));
    });
    return () => cancelAnimationFrame(saveRef.current);
  }, [state]);

  const value = useMemo(() => {
    const archived = new Set(state.archived);
    const merged = [
      ...state.extraProducts,
      ...PRODUCTS.map((p) => (state.edits[p.id] ? { ...p, ...state.edits[p.id] } : p)),
    ];
    const allProducts = merged.filter((p) => !archived.has(p.id));   // live in the shop
    const managedProducts = merged;                                   // everything the BMS can see

    const findProduct = (id) => merged.find((p) => p.id === id);

    const cartLines = state.cart
      .map((c) => {
        const p = findProduct(c.id);
        return p ? { ...c, product: p } : null;
      })
      .filter(Boolean);
    const cartCount = cartLines.reduce((n, c) => n + c.qty, 0);
    const cartTotal = cartLines.reduce((n, c) => n + c.product.price * c.qty, 0);

    const unread = state.notifications.filter((n) => !n.read).length;

    return {
      state, dispatch,
      allProducts, managedProducts, findProduct,
      cartLines, cartCount, cartTotal,
      unread,
    };
  }, [state]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export const useStore = () => useContext(StoreCtx);

// ── shared calculations ─────────────────────────────────────
export const orderTotal = (o) => o.total ?? o.items.reduce((s, l) => s + l.price * l.qty, 0);
export const orderProfit = (o) =>
  o.status === 'cancelled' ? 0 : o.items.reduce((s, l) => s + (l.price - (l.cost ?? 0)) * l.qty, 0) - (o.discount ?? 0);
export const orderUnits = (o) => o.items.reduce((s, l) => s + l.qty, 0);

export const PERIODS = [
  { id: 'today', label: 'Today', days: 1 },
  { id: '7', label: '7 days', days: 7 },
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '90 days', days: 90 },
  { id: '365', label: 'This year', days: 365 },
  { id: 'all', label: 'All time', days: null },
];

export function periodStart(periodId) {
  if (periodId === 'all') return new Date(0);
  const d = new Date();
  if (periodId === 'today') { d.setHours(0, 0, 0, 0); return d; }
  const days = Number(periodId);
  const s = new Date(Date.now() - (days - 1) * DAY);
  s.setHours(0, 0, 0, 0);
  return s;
}

export function ordersInPeriod(orders, periodId) {
  const start = periodStart(periodId).getTime();
  return orders.filter((o) => new Date(o.date).getTime() >= start);
}
