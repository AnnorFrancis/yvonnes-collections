import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Plus, Truck, Smartphone, BadgeCheck, RefreshCw } from 'lucide-react';
import { SLIDES, DEPARTMENTS, BEST_SELLERS, EDITORIAL, byDept } from '../data/products';
import { ProductCard, QuickView, Reveal } from '../components/ProductBits';
import { BRAND } from '../config';

const EASE = [0.16, 1, 0.3, 1];
const SLIDE_SECONDS = 6.5;

// ── Cinematic slider ────────────────────────────────────────
function Slider() {
  const [[index, dir], setIndex] = useState([0, 1]);
  const slide = SLIDES[index];
  const next = SLIDES[(index + 1) % SLIDES.length];

  const go = useCallback((d) => {
    setIndex(([i]) => [(i + d + SLIDES.length) % SLIDES.length, d]);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // Deterministic autoplay; the progress bar below is purely visual
  useEffect(() => {
    const t = setTimeout(() => go(1), SLIDE_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [index, go]);

  const title = slide.title.split(' ');

  return (
    <section className="slider" aria-label="Featured departments">
      <AnimatePresence mode="popLayout" custom={dir}>
        <motion.div className="slide" key={slide.id}>
          <motion.div
            className="slide-panelA"
            initial={{ x: dir > 0 ? '6%' : '-6%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: dir > 0 ? '-4%' : '4%', opacity: 0 }}
            transition={{ duration: 1, ease: EASE }}
          >
            <motion.img
              src={slide.imageA} alt=""
              fetchPriority="high" decoding="async"
              initial={{ scale: 1.1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 7, ease: 'linear' }}
            />
          </motion.div>

          <motion.div
            className="slide-panelB"
            initial={{ y: 46, opacity: 0, rotate: 1.5 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -30, opacity: 0 }}
            transition={{ duration: 0.9, delay: 0.25, ease: EASE }}
          >
            <img src={slide.imageB} alt="" decoding="async" />
          </motion.div>

          <div className="slide-copy">
            <motion.span
              className="eyebrow"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
            >
              {slide.eyebrow}
            </motion.span>

            <h1 className="slide-title">
              {title.map((word, wi) => (
                <span className="word" key={wi}>
                  {word.split('').map((ch, ci) => (
                    <motion.span
                      className="ch" key={ci}
                      initial={{ y: '110%' }} animate={{ y: 0 }}
                      transition={{ duration: 0.7, delay: 0.35 + (wi * 4 + ci) * 0.045, ease: EASE }}
                    >{ch}</motion.span>
                  ))}
                  {wi < title.length - 1 && <span className="ch">&nbsp;</span>}
                </span>
              ))}
            </h1>

            <motion.span
              className="slide-accent"
              initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.85 }}
            >
              everything {slide.accent}
            </motion.span>

            <motion.p
              className="slide-line"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1 }}
            >
              {slide.line}
            </motion.p>

            <motion.div
              className="slide-actions"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.12 }}
            >
              <Link to={`/shop?dept=${slide.dept}`} className="btn btn-primary">Shop {slide.title.toLowerCase()}</Link>
              <Link to="/shop" className="btn btn-outline">All products</Link>
            </motion.div>
          </div>

          <motion.button
            className="slide-next"
            onClick={() => go(1)}
            initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 1.2 }}
            aria-label={`Next: ${next.title}`}
          >
            <img src={next.imageB} alt="" />
            <span className="slide-next-label">Up next<strong>{next.title}</strong></span>
            <span className="slide-next-plus"><Plus size={15} /></span>
          </motion.button>
        </motion.div>
      </AnimatePresence>

      <div className="slider-footer">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <div className="slider-progress">
          <motion.div
            key={index}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: SLIDE_SECONDS, ease: 'linear' }}
          />
        </div>
        <span>{String(SLIDES.length).padStart(2, '0')}</span>
      </div>

      <div className="slider-arrows">
        <button className="slider-arrow" aria-label="Previous slide" onClick={() => go(-1)}><ArrowLeft size={17} /></button>
        <button className="slider-arrow" aria-label="Next slide" onClick={() => go(1)}><ArrowRight size={17} /></button>
      </div>
    </section>
  );
}

// ── Departments ─────────────────────────────────────────────
function Departments() {
  return (
    <section className="section">
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">The departments</span>
          <h2>Six shops, <em className="accent-italic">one roof.</em></h2>
        </Reveal>
        <div className="depts-grid">
          {DEPARTMENTS.map((d, i) => (
            <Reveal key={d.id} delay={i * 0.06}>
              <div className="dept-card">
                <Link to={`/shop?dept=${d.id}`}>
                  <div className="dept-media"><img src={d.image} alt={d.label} loading="lazy" decoding="async" /></div>
                  <div className="dept-info">
                    <div>
                      <h3>{d.label}</h3>
                      <p>{d.blurb} · {byDept(d.id).length} styles</p>
                    </div>
                    <span className="dept-arrow"><ArrowRight size={16} /></span>
                  </div>
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Best sellers ────────────────────────────────────────────
function BestSellers({ onQuickView }) {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <Reveal className="section-head section-head--row">
          <div>
            <span className="eyebrow">Customer favourites</span>
            <h2>What {BRAND.city} keeps <em className="accent-italic">coming back for</em></h2>
          </div>
          <Link to="/shop" className="btn btn-outline btn-sm">See everything <ArrowRight size={14} /></Link>
        </Reveal>
        <div className="product-grid">
          {BEST_SELLERS.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} onQuickView={onQuickView} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── About ───────────────────────────────────────────────────
function About() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container about">
        <Reveal className="about-media">
          <img src={EDITORIAL.racks} alt="Inside the shop" loading="lazy" />
        </Reveal>
        <Reveal delay={0.1}>
          <span className="eyebrow">The house of Yvonne</span>
          <h2>Picked by hand.<br /><em className="accent-italic">Priced with sense.</em></h2>
          <p>
            Every piece in this shop is chosen the way you would choose it yourself:
            turned over, checked twice, and priced honestly. If our own family
            would not wear it, it does not make the shelf.
          </p>
          <ul className="about-list">
            <li>New stock lands every week</li>
            <li>Sizes for the whole family, baby to XXXL</li>
            <li>WhatsApp us a photo and we will reserve your size</li>
          </ul>
          <Link to="/contact" className="btn btn-primary">Visit the shop</Link>
        </Reveal>
      </div>
    </section>
  );
}

// ── Promise strip ───────────────────────────────────────────
const PROMISES = [
  { icon: Truck, title: 'Nationwide delivery', text: 'Accra same day, everywhere else in 24 to 48 hours.' },
  { icon: Smartphone, title: 'Pay your way', text: 'MTN MoMo, Telecel Cash, AT Money or any bank card.' },
  { icon: BadgeCheck, title: 'Genuine goods', text: 'Hand picked stock, checked before it ships.' },
  { icon: RefreshCw, title: 'Easy exchange', text: 'Wrong size? Swap it within 7 days, no stories.' },
];

function Promise() {
  return (
    <section className="promise">
      <div className="container promise-grid">
        {PROMISES.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.07} className="promise-item">
            <s.icon size={22} strokeWidth={1.5} />
            <h3>{s.title}</h3>
            <p>{s.text}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  const [quickView, setQuickView] = useState(null);
  return (
    <>
      <Slider />
      <Departments />
      <BestSellers onQuickView={setQuickView} />
      <About />
      <Promise />
      {quickView && <QuickView product={quickView} onClose={() => setQuickView(null)} />}
    </>
  );
}
