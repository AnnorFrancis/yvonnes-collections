import { useState } from 'react';
import { Routes, Route, NavLink, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Store, PackageSearch, Boxes, ClipboardList,
  Users, BarChart3, Globe, LogOut, Settings as SettingsIcon, RotateCcw,
} from 'lucide-react';
import { BRAND, fmtPrice } from '../config';
import { useStore } from '../context/StoreContext';
import Dashboard from './Dashboard';
import POS from './POS';
import Reports from './Reports';
import { OrdersPage } from './Orders';
import { ProductsPage } from './Products';
import { InventoryPage } from './Inventory';
import { CustomersPage } from './Customers';
import { NotificationBell, NotificationWatcher, AlertSettings } from './Notifications';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/pos', label: 'POS · Counter', icon: Store },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/products', label: 'Products', icon: PackageSearch },
  { to: '/admin/inventory', label: 'Inventory', icon: Boxes },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
];

const TITLES = {
  '/admin': 'Dashboard',
  '/admin/pos': 'Point of sale',
  '/admin/orders': 'Orders',
  '/admin/products': 'Products',
  '/admin/inventory': 'Inventory',
  '/admin/customers': 'Customers',
  '/admin/reports': 'Reports',
  '/admin/settings': 'Settings',
};

function Login({ onEnter }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(0);

  const submit = (e) => {
    e.preventDefault();
    if (pin.length === 4) onEnter();
    else setShake((s) => s + 1);
  };

  return (
    <div className="adm-login">
      <motion.form
        key={shake}
        onSubmit={submit}
        className="adm-login-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0, x: shake ? [0, -8, 8, -5, 5, 0] : 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="adm-login-seal">{BRAND.monogram}</div>
        <h1>{BRAND.name}</h1>
        <p className="adm-login-sub">Business Management System</p>
        <input
          className="adm-pin"
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="••••"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          aria-label="Staff PIN"
          autoFocus
        />
        <button className="btn btn-primary btn-block" type="submit">Open the till</button>
        <p className="adm-login-hint">Demo PIN 0000 · connected live to the website</p>
        <Link to="/" className="adm-login-back">Back to the website</Link>
      </motion.form>
    </div>
  );
}

function SettingsPage() {
  const { state, dispatch, managedProducts } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="set-grid">
      <AlertSettings />

      <div className="panel">
        <div className="panel-head"><h2>Shop details</h2></div>
        <div className="set-rows">
          <div><span>Shop name</span><strong>{BRAND.name}</strong></div>
          <div><span>Address</span><strong>{BRAND.address}</strong></div>
          <div><span>Phone</span><strong>{BRAND.phone}</strong></div>
          <div><span>Opening hours</span><strong>{BRAND.hours}</strong></div>
          <div><span>Products managed</span><strong>{managedProducts.length}</strong></div>
          <div><span>Customers on record</span><strong>{state.customers.length}</strong></div>
        </div>
        <p className="panel-footnote">
          These come from one settings file, so rebranding the whole system is a single change.
        </p>
      </div>

      <div className="panel">
        <div className="panel-head"><h2>Demo controls</h2></div>
        <p className="panel-note" style={{ marginBottom: 14 }}>
          Reset puts the demo back to its starting figures: {state.orders.length} orders,
          {' '}{state.customers.length} customers and the original stock levels.
        </p>
        {confirmReset ? (
          <div className="set-confirm">
            <p>This clears every order and customer added during the demo. Continue?</p>
            <div className="set-confirm-actions">
              <button className="btn btn-sm btn-outline" onClick={() => setConfirmReset(false)}>Keep my data</button>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => { dispatch({ type: 'demo/reset' }); setConfirmReset(false); }}
              >
                Yes, reset the demo
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-outline btn-sm" onClick={() => setConfirmReset(true)}>
            <RotateCcw size={14} /> Reset demo data
          </button>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('yc-admin') === '1');
  const location = useLocation();
  const { state } = useStore();

  if (!authed) {
    return <Login onEnter={() => { sessionStorage.setItem('yc-admin', '1'); setAuthed(true); }} />;
  }

  const title = TITLES[location.pathname] || 'Dashboard';
  const today = new Date().toLocaleDateString('en-GH', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayKey = new Date().toDateString();
  const takings = state.orders
    .filter((o) => new Date(o.date).toDateString() === todayKey && o.status !== 'cancelled')
    .reduce((s, o) => s + (o.total ?? 0), 0);

  return (
    <div className="adm">
      <NotificationWatcher />

      <aside className="adm-side">
        <div className="adm-side-brand">
          <span className="nav-seal">{BRAND.monogram}</span>
          <div>
            <strong>{BRAND.name}</strong>
            <span>Management</span>
          </div>
        </div>
        <nav className="adm-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              <n.icon size={17} strokeWidth={1.6} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="adm-side-foot">
          <Link to="/"><Globe size={15} /> View website</Link>
          <button onClick={() => { sessionStorage.removeItem('yc-admin'); setAuthed(false); }}>
            <LogOut size={15} /> Lock the till
          </button>
        </div>
      </aside>

      <div className="adm-main">
        <header className="adm-top">
          <div>
            <h1>{title}</h1>
            <span className="adm-date">{today}</span>
          </div>
          <div className="adm-top-right">
            <span className="adm-takings">
              Today <strong className="price">{fmtPrice(takings)}</strong>
            </span>
            <span className="adm-store-badge"><span className="pulse-dot" /> Live with the website</span>
            <NotificationBell />
          </div>
        </header>
        <div className="adm-content">
          <Routes>
            <Route index element={<Dashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
