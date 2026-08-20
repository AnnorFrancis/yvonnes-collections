import { useState } from 'react';
import { MapPin, Phone, Clock, MessageCircle, Check } from 'lucide-react';
import { Reveal } from '../components/ProductBits';
import { EDITORIAL } from '../data/products';
import { BRAND } from '../config';

export default function Contact() {
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.message.trim()) return;
    setSent(true);
  };

  return (
    <div className="page">
      <div className="container">
        <Reveal className="page-head">
          <span className="eyebrow">Find us</span>
          <h1>Visit <em className="accent-italic">the shop</em></h1>
        </Reveal>

        <div className="contact-grid">
          <Reveal className="contact-media">
            <img src={EDITORIAL.rail} alt="Inside the shop" />
          </Reveal>

          <div className="contact-info">
            {[
              { icon: MapPin, title: 'The shop', lines: [BRAND.address, BRAND.city] },
              { icon: Clock, title: 'Opening hours', lines: [BRAND.hours, 'Sundays, closed'] },
              { icon: Phone, title: 'Call us', lines: [BRAND.phone] },
              { icon: MessageCircle, title: 'WhatsApp', lines: ['Send a photo of what you want.', 'We will check your size and reserve it.'] },
            ].map((c, i) => (
              <Reveal key={c.title} delay={i * 0.07} className="contact-card">
                <c.icon size={20} strokeWidth={1.5} />
                <h3>{c.title}</h3>
                {c.lines.map((l) => <p key={l}>{l}</p>)}
              </Reveal>
            ))}

            <Reveal delay={0.3} className="contact-form">
              {sent ? (
                <div style={{ textAlign: 'center', padding: '18px 0' }}>
                  <div className="co-done-seal" style={{ width: 54, height: 54, marginBottom: 16 }}><Check size={22} /></div>
                  <h3>Message received</h3>
                  <p style={{ color: 'var(--ink-soft)', fontSize: 14 }}>
                    Thank you, {form.name.split(' ')[0]}. We reply within the hour during opening times.
                  </p>
                </div>
              ) : (
                <form onSubmit={submit}>
                  <h3>Send us a message</h3>
                  <div className="field-row">
                    <label className="field">
                      <span>Your name</span>
                      <input value={form.name} onChange={set('name')} placeholder="Ama Mensah" />
                    </label>
                    <label className="field">
                      <span>Phone</span>
                      <input value={form.phone} onChange={set('phone')} placeholder="024 000 0000" inputMode="tel" />
                    </label>
                  </div>
                  <label className="field">
                    <span>What are you looking for?</span>
                    <textarea rows={4} value={form.message} onChange={set('message')} placeholder="I saw a watch on your Instagram..." />
                  </label>
                  <button className="btn btn-primary" type="submit" disabled={!form.name.trim() || !form.message.trim()}>
                    Send message
                  </button>
                </form>
              )}
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
}
