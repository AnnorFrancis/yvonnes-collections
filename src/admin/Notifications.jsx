import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell, BellRing, BellOff, ShoppingBag, Truck, UserPlus, Banknote,
  AlertTriangle, Info, CheckCheck, Trash2, ArrowRight, Volume2, Smartphone,
} from 'lucide-react';
import { useStore, orderTotal } from '../context/StoreContext';
import { fmtPrice } from '../config';
import './styles/notifications.css';

// ── The shop's ears ─────────────────────────────────────────
// One bell in the header, one silent watcher that reacts the moment
// a new order lands, and one settings card so the owner decides how
// loud the shop gets.

// ── time, written the way a person says it ──────────────────
const ts = (value) => {
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
};

const startOfDay = (millis) => {
  const d = new Date(millis);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

function relativeTime(value) {
  const then = ts(value);
  if (!then) return '';
  const now = Date.now();
  const diff = now - then;

  if (diff < 45000) return 'just now';

  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins} min ago`;

  const hours = Math.round(diff / 3600000);
  const dayGap = Math.round((startOfDay(now) - startOfDay(then)) / 86400000);

  // Count in hours for half a day, and for anything still dated today.
  // After that a person says "yesterday", then just gives the date.
  if (hours < 24 && (hours < 12 || dayGap === 0)) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  if (dayGap <= 1) return 'yesterday';

  const d = new Date(then);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

function fullTime(value) {
  const t = ts(value);
  if (!t) return '';
  return new Date(t).toLocaleString('en-GH', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit',
  });
}

// ── an icon that matches what happened ──────────────────────
function iconFor(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('order') || t.includes('sale')) return { Icon: ShoppingBag, tone: 'order' };
  if (t.includes('stock') || t.includes('inventory')) return { Icon: AlertTriangle, tone: 'warn' };
  if (t.includes('customer')) return { Icon: UserPlus, tone: 'ok' };
  if (t.includes('deliver') || t.includes('status')) return { Icon: Truck, tone: 'ok' };
  if (t.includes('pay') || t.includes('money') || t.includes('cash')) return { Icon: Banknote, tone: 'ok' };
  if (t.includes('warn') || t.includes('alert') || t.includes('low')) return { Icon: AlertTriangle, tone: 'warn' };
  return { Icon: Info, tone: 'info' };
}

// ── a short two tone chime, built in the browser ────────────
// No sound files to download, so it works offline in the shop.
function playChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume();

    const now = ctx.currentTime;
    const tone = (freq, start, dur, peak) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.03);
    };

    tone(659.25, 0, 0.26, 0.18);    // E5
    tone(987.77, 0.15, 0.42, 0.15); // B5

    setTimeout(() => { try { ctx.close(); } catch { /* already closed */ } }, 1500);
  } catch {
    // Browsers keep audio silent until someone clicks something.
    // Nothing to fix here, the bell still shows the alert.
  }
}

// ── the bell in the header ──────────────────────────────────
export function NotificationBell() {
  const { state, dispatch, unread } = useStore();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [flash, setFlash] = useState('');
  const [, setTick] = useState(0);

  const wrapRef = useRef(null);
  const bellRef = useRef(null);
  const flashTimer = useRef(0);

  const items = useMemo(() => {
    const list = Array.isArray(state.notifications) ? state.notifications : [];
    return [...list].sort((a, b) => ts(b?.at) - ts(a?.at));
  }, [state.notifications]);

  const say = useCallback((message) => {
    setFlash(message);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(''), 2600);
  }, []);

  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const close = useCallback(() => {
    setOpen(false);
    setConfirmClear(false);
    setFlash('');
  }, []);

  // Escape closes, and so does a click anywhere outside the bell.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      // Escape steps back one level: first out of the confirm, then out
      // of the panel. Nothing gets cleared by accident.
      if (confirmClear) { setConfirmClear(false); return; }
      close();
      bellRef.current?.focus();
    };
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [open, close, confirmClear]);

  // While the panel is open, keep "5 min ago" honest.
  useEffect(() => {
    if (!open) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [open]);

  const openItem = (n) => {
    if (!n.read) dispatch({ type: 'notif/read', id: n.id });
    if (n.orderId) {
      close();
      navigate('/admin/orders');
    }
  };

  const markAll = () => {
    if (unread === 0) return;
    dispatch({ type: 'notif/readAll' });
    say('All alerts marked as read.');
  };

  const clearAll = () => {
    dispatch({ type: 'notif/clear' });
    setConfirmClear(false);
    say('Alerts cleared.');
  };

  const badge = unread > 99 ? '99+' : unread;

  return (
    <div className="ntf-wrap" ref={wrapRef}>
      <button
        ref={bellRef}
        type="button"
        className={`ntf-bell ${open ? 'on' : ''}`}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts, none unread'}
      >
        {unread > 0
          ? <BellRing size={18} strokeWidth={1.7} />
          : <Bell size={18} strokeWidth={1.7} />}
        {unread > 0 && (
          <motion.span
            className="ntf-badge"
            key={unread}
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 18 }}
          >
            {badge}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="ntf-scrim"
            className="ntf-scrim"
            onClick={close}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.div
            key="ntf-panel"
            className="ntf-panel"
            role="dialog"
            aria-label="Alerts"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="ntf-grab" aria-hidden="true" />

            <div className="ntf-head">
              <h3>Alerts</h3>
              <span className="ntf-head-count">
                {items.length === 0
                  ? 'nothing yet'
                  : unread > 0
                    ? `${unread} unread`
                    : 'all read'}
              </span>
              <button
                type="button"
                className="ntf-act"
                onClick={markAll}
                disabled={unread === 0}
                title="Mark every alert as read"
              >
                <CheckCheck size={13} /> Mark all read
              </button>
              <button
                type="button"
                className="ntf-act ntf-act--danger"
                onClick={() => setConfirmClear(true)}
                disabled={items.length === 0 || confirmClear}
                title="Remove every alert from this list"
              >
                <Trash2 size={13} /> Clear
              </button>
            </div>

            {flash && (
              <div className="ntf-flash">
                <CheckCheck size={14} /> {flash}
              </div>
            )}

            {confirmClear && (
              <div className="ntf-confirm">
                <p>
                  Clear {items.length} alert{items.length === 1 ? '' : 's'}? The orders stay
                  safe, only this list is emptied.
                </p>
                <div className="ntf-confirm-row">
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => setConfirmClear(false)}
                    autoFocus
                  >
                    Keep them
                  </button>
                  <button type="button" className="btn btn-sm ntf-btn-danger" onClick={clearAll}>
                    Yes, clear
                  </button>
                </div>
              </div>
            )}

            <div className="ntf-list">
              {items.length === 0 ? (
                <div className="ntf-empty">
                  <BellOff size={26} strokeWidth={1.4} />
                  <strong>No alerts yet.</strong>
                  <span>New orders will appear here.</span>
                </div>
              ) : (
                items.map((n) => {
                  const { Icon, tone } = iconFor(n.type);
                  return (
                    <button
                      type="button"
                      key={n.id}
                      className={`ntf-item ${n.read ? '' : 'unread'}`}
                      onClick={() => openItem(n)}
                      title={n.orderId ? `Open the orders board (${n.orderId})` : 'Mark as read'}
                    >
                      <span className={`ntf-ico ntf-ico--${tone}`}>
                        <Icon size={15} strokeWidth={1.7} />
                      </span>
                      <span className="ntf-txt">
                        <span className="ntf-title">
                          {!n.read && <i className="ntf-dot" />}
                          {n.title || 'Alert'}
                        </span>
                        {n.body && <span className="ntf-body">{n.body}</span>}
                      </span>
                      <span className="ntf-when" title={fullTime(n.at)}>
                        {relativeTime(n.at)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {items.length > 0 && (
              <div className="ntf-foot">
                <span className="ntf-foot-note">Tap an order alert to open it</span>
                <button
                  type="button"
                  className="ntf-foot-link"
                  onClick={() => { close(); navigate('/admin/orders'); }}
                >
                  Orders board <ArrowRight size={13} />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── the silent watcher ──────────────────────────────────────
// Sits in the layout, renders nothing, and reacts the moment the
// order list grows while a staff member has the BMS open.
export function NotificationWatcher() {
  const { state } = useStore();
  const count = Array.isArray(state.orders) ? state.orders.length : 0;
  const seen = useRef(null);

  const latest = state.orders?.[0];
  const settings = state.settings || {};

  useEffect(() => {
    // The first render just records where we started. No chime for
    // orders that were already on the books when the page opened.
    if (seen.current === null) {
      seen.current = count;
      return;
    }
    if (count <= seen.current) {
      seen.current = count;
      return;
    }
    seen.current = count;
    if (!latest) return;

    if (settings.soundAlerts) playChime();

    if (settings.pushAlerts) {
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const who = latest.customer?.name || 'Walk-in customer';
          const note = new Notification(
            latest.source === 'pos' ? `Counter sale ${latest.id}` : `New order ${latest.id}`,
            {
              body: `${who}, ${fmtPrice(orderTotal(latest))}`,
              tag: latest.id,
              lang: 'en',
            }
          );
          note.onclick = () => {
            try { window.focus(); note.close(); } catch { /* tab already gone */ }
          };
        }
      } catch {
        // Some browsers refuse to construct notifications directly.
        // The in-app bell already has the alert either way.
      }
    }
    // Only the arrival of a new order should trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  return null;
}

// ── alert settings card ─────────────────────────────────────
function askPermission() {
  return new Promise((resolve) => {
    try {
      const result = Notification.requestPermission((p) => resolve(p));
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(() => resolve('default'));
      }
    } catch {
      resolve('default');
    }
  });
}

export function AlertSettings() {
  const { state, dispatch } = useStore();
  const settings = state.settings || {};
  const sound = !!settings.soundAlerts;
  const push = !!settings.pushAlerts;

  const [msg, setMsg] = useState(null); // { tone, text }
  const [asking, setAsking] = useState(false);
  const msgTimer = useRef(0);

  const say = (tone, text, sticky = false) => {
    setMsg({ tone, text });
    clearTimeout(msgTimer.current);
    if (!sticky) msgTimer.current = setTimeout(() => setMsg(null), 6000);
  };

  useEffect(() => () => clearTimeout(msgTimer.current), []);

  const toggleSound = () => {
    const next = !sound;
    dispatch({ type: 'settings/set', patch: { soundAlerts: next } });
    if (next) {
      playChime();
      say('ok', 'Chime on. That is the sound you will hear when an order lands.');
    } else {
      say('note', 'Chime off. Alerts still land quietly in the bell.');
    }
  };

  const togglePush = async () => {
    if (push) {
      dispatch({ type: 'settings/set', patch: { pushAlerts: false } });
      say('note', 'Pop-ups off. The bell at the top still catches every order.');
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      say('warn', 'This browser cannot show pop-up alerts. The bell keeps working, so nothing is missed.', true);
      return;
    }

    if (Notification.permission === 'granted') {
      dispatch({ type: 'settings/set', patch: { pushAlerts: true } });
      say('ok', 'Pop-ups on. A new order now pops up even when you are on another tab.');
      return;
    }

    if (Notification.permission === 'denied') {
      say('warn', 'Your browser has blocked pop-ups for this site, so this stays off. Tap the padlock beside the web address, allow notifications, then switch it on again.', true);
      return;
    }

    setAsking(true);
    const result = await askPermission();
    setAsking(false);

    if (result === 'granted') {
      dispatch({ type: 'settings/set', patch: { pushAlerts: true } });
      say('ok', 'Pop-ups on. A new order now pops up even when you are on another tab.');
    } else if (result === 'denied') {
      say('warn', 'The browser said no, so pop-ups stay off. You can change that from the padlock beside the web address.', true);
    } else {
      say('note', 'No answer from the browser yet, so pop-ups stay off. Switch it on again and choose Allow when asked.');
    }
  };

  const testAlert = () => {
    dispatch({
      type: 'notif/push',
      notif: {
        type: 'system',
        title: 'Test alert',
        body: 'This is only a test. A real order shows the customer, the items and the amount.',
      },
    });
    if (sound) playChime();
    say('ok', 'Test alert sent. Check the bell at the top of the screen.');
  };

  return (
    <div className="panel ntf-set">
      <div className="panel-head">
        <h2><BellRing size={16} strokeWidth={1.7} /> Alerts</h2>
        <span className="panel-note">How the shop hears about a new order</span>
      </div>

      <div className="ntf-set-row">
        <div>
          <div className="ntf-set-name"><Volume2 size={15} strokeWidth={1.7} /> Chime on a new order</div>
          <p className="ntf-set-sub">
            A short two tone chime plays on this device the moment an order comes in from the
            website or the counter.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={sound}
          aria-label="Chime on a new order"
          className={`ntf-switch ${sound ? 'on' : ''}`}
          onClick={toggleSound}
        >
          <span className="ntf-knob" />
        </button>
      </div>

      <div className="ntf-set-row">
        <div>
          <div className="ntf-set-name"><Smartphone size={15} strokeWidth={1.7} /> Pop-up alerts</div>
          <p className="ntf-set-sub">
            A small pop-up from the browser, so you see the order even when this tab is behind
            something else. Your browser will ask for permission the first time.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={push}
          aria-label="Pop-up alerts"
          className={`ntf-switch ${push ? 'on' : ''}`}
          onClick={togglePush}
          disabled={asking}
        >
          <span className="ntf-knob" />
        </button>
      </div>

      {msg && (
        <div className={`ntf-msg ntf-msg--${msg.tone}`}>
          {msg.tone === 'warn'
            ? <AlertTriangle size={14} strokeWidth={1.8} />
            : <Info size={14} strokeWidth={1.8} />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="ntf-set-actions">
        <button type="button" className="btn btn-outline btn-sm" onClick={testAlert}>
          Send a test alert
        </button>
        <span className="ntf-set-hint">
          {sound ? 'Sound is on, so you will hear it too.' : 'Sound is off, so this one arrives quietly.'}
        </span>
      </div>

      <p className="panel-footnote">
        Once this system is running on a live server, these alerts reach your phone even when the
        shop is closed. What you are seeing today is the in-app alert working on this device.
      </p>
    </div>
  );
}
