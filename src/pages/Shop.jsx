import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { Search, Plus, Check } from 'lucide-react';
import { DEPARTMENTS, FEATURED, EDITORIAL } from '../data/products';
import { useStore } from '../context/StoreContext';
import { ProductCard, QuickView, Reveal } from '../components/ProductBits';
import { BRAND, fmtPrice } from '../config';

const EASE = [0.16, 1, 0.3, 1];

// ── Rounded hero with vertical marquees ─────────────────────
function ShopHero() {
  const words = [`${BRAND.short}`, 'collections', BRAND.city.toLowerCase(), 'est. in style'];
  const run = [...words, ...words];
  return (
    <section className="shop-hero">
      <div className="vmarquee vmarquee--left" aria-hidden="true">
        <div className="vmarquee-track">{run.map((w, i) => <span key={i}>{w}</span>)}</div>
      </div>
      <div className="vmarquee vmarquee--right" aria-hidden="true">
        <div className="vmarquee-track">{run.map((w, i) => <span key={i}>{w}</span>)}</div>
      </div>

      <motion.div
        className="shop-hero-media"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease: EASE }}
      >
        <motion.img
          src={EDITORIAL.store} alt="The shop floor"
          initial={{ scale: 1.12 }} animate={{ scale: 1 }}
          transition={{ duration: 8, ease: 'linear' }}
        />
        <span className="shop-hero-caption">The whole shop, in one place</span>
      </motion.div>
      <span className="shop-hero-tag">The collection</span>
      <span className="shop-hero-scroll">Scroll</span>
    </section>
  );
}

// ── Manifesto ───────────────────────────────────────────────
function Manifesto() {
  const sentence = 'One shop for her, for him, for the little ones, and for every day in between.';
  const words = sentence.split(' ');
  const chipAfter = 6; // insert an image chip mid-sentence
  return (
    <section className="section">
      <div className="container manifesto">
        <p>
          {words.map((w, i) => (
            <span key={i} style={{ display: 'inline' }}>
              <motion.span
                className="w"
                initial={{ opacity: 0.12, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-18% 0px -18% 0px' }}
                transition={{ duration: 0.5, delay: i * 0.035, ease: EASE }}
              >
                {w}
              </motion.span>
              {i === chipAfter && (
                <motion.span
                  className="chip"
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: chipAfter * 0.035 }}
                >
                  <img src="/products/w1.jpg" alt="" />
                </motion.span>
              )}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}

// ── Featured showcase ───────────────────────────────────────
function Showcase() {
  const { dispatch } = useStore();
  const [index, setIndex] = useState(0);
  const [added, setAdded] = useState(false);
  const p = FEATURED[index];

  const add = () => {
    dispatch({ type: 'cart/add', id: p.id, size: p.sizes?.[0] ?? 'One size' });
    setAdded(true);
    setTimeout(() => setAdded(false), 1100);
  };

  return (
    <section className="section showcase" style={{ paddingTop: 0 }}>
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">The edit, {FEATURED.length} pieces</span>
          <h2>Featured this <em className="accent-italic">week</em></h2>
        </Reveal>

        <div className="showcase-grid">
          <div className="showcase-copy">
            <AnimatePresence mode="wait">
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 22 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <span className="eyebrow">{DEPARTMENTS.find((d) => d.id === p.dept)?.label} · N°{String(index + 1).padStart(2, '0')}</span>
                <h3 className="showcase-name">{p.name}</h3>
                <span className="showcase-price price">{fmtPrice(p.price)}</span>
                <div className="showcase-rule">{p.tagline}</div>
                <p className="showcase-story">{p.story}</p>
                <button className={`btn ${added ? 'btn-added' : 'btn-primary'}`} onClick={add}>
                  {added ? (<><Check size={15} /> Added to cart</>) : (<>Add to cart <Plus size={15} /></>)}
                </button>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="showcase-stage">
            <span className="showcase-counter">{String(index + 1).padStart(2, '0')} / {String(FEATURED.length).padStart(2, '0')}</span>
            <div className="showcase-mask">
              <AnimatePresence mode="popLayout">
                <motion.img
                  key={p.id}
                  src={p.image} alt={p.name}
                  initial={{ opacity: 0, scale: 1.08, y: 18 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.98, y: -14 }}
                  transition={{ duration: 0.65, ease: EASE }}
                />
              </AnimatePresence>
            </div>
          </div>

          <div className="showcase-side">
            <div className="showcase-thumbs">
              {FEATURED.map((f, i) => (
                <button
                  key={f.id}
                  className={`showcase-thumb ${i === index ? 'on' : ''}`}
                  onClick={() => setIndex(i)}
                  aria-label={`Show ${f.name}`}
                >
                  <img src={f.image} alt="" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="showcase-ruler" aria-hidden="true">
          {[...Array(41)].map((_, i) => (
            <i key={i} className={Math.round((index / (FEATURED.length - 1)) * 40) === i ? 'on' : ''} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Kinetic typography ──────────────────────────────────────
function Kinetic() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const x1 = useTransform(scrollYProgress, [0, 1], ['4%', '-14%']);
  const x2 = useTransform(scrollYProgress, [0, 1], ['-14%', '4%']);

  return (
    <section className="kinetic" ref={ref} aria-hidden="true">
      <motion.div className="kinetic-line" style={{ x: x1 }}>
        Genuine goods
        <span className="chip"><img src="/products/p2.jpg" alt="" /></span>
        honest prices <em>every day</em>
      </motion.div>
      <motion.div className="kinetic-line" style={{ x: x2 }}>
        <em>From Accra</em> with love
        <span className="chip"><img src="/products/p8.jpg" alt="" /></span>
        to your door
      </motion.div>
    </section>
  );
}

// ── Full collection ─────────────────────────────────────────
const SORTS = [
  { id: 'featured', label: 'Featured' },
  { id: 'low', label: 'Price, low to high' },
  { id: 'high', label: 'Price, high to low' },
];

function Collection({ onQuickView }) {
  const [params, setParams] = useSearchParams();
  const dept = params.get('dept') || 'all';
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('featured');
  const { allProducts } = useStore();
  const gridRef = useRef(null);

  useEffect(() => {
    if (params.get('dept')) {
      gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [params]);

  const shown = useMemo(() => {
    let list = dept === 'all' ? allProducts : allProducts.filter((p) => p.dept === dept);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => [p.name, p.tagline, p.dept].join(' ').toLowerCase().includes(q));
    }
    if (sort === 'low') list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'high') list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [allProducts, dept, query, sort]);

  const setDept = (id) => setParams(id === 'all' ? {} : { dept: id }, { preventScrollReset: true });

  return (
    <section className="section" ref={gridRef} style={{ paddingTop: 0 }}>
      <div className="container">
        <Reveal className="section-head">
          <span className="eyebrow">The collection · {allProducts.length} pieces</span>
          <h2>Browse <em className="accent-italic">everything</em></h2>
        </Reveal>

        <div className="shop-toolbar">
          <div className="shop-chips">
            <button className={`chip ${dept === 'all' ? 'on' : ''}`} onClick={() => setDept('all')}>All</button>
            {DEPARTMENTS.map((d) => (
              <button key={d.id} className={`chip ${dept === d.id ? 'on' : ''}`} onClick={() => setDept(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
          <div className="shop-tools">
            <div className="shop-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the shop"
                aria-label="Search products"
              />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products">
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="shop-empty">
            <p>Nothing matches "{query}" in this department yet.</p>
            <button className="btn btn-outline" onClick={() => { setQuery(''); setDept('all'); }}>Clear the search</button>
          </div>
        ) : (
          <div className="product-grid">
            {shown.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} onQuickView={onQuickView} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Brand story ─────────────────────────────────────────────
function Story() {
  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="container">
        <Reveal>
          <div className="story">
            <div className="story-media"><img src={EDITORIAL.rail} alt="Stock on the rails" loading="lazy" /></div>
            <div className="story-copy">
              <span className="eyebrow">Our story</span>
              <h2>A market woman's eye.<br />A department store's range.</h2>
              <p>
                {BRAND.name} started with one rail and a simple rule: buy what you
                would proudly wear, sell it at a price you would happily pay.
                Today the shop dresses whole families, from christening shoes to
                the watch he wears to ask for her hand.
              </p>
              <Link to="/contact" className="btn">Find the shop</Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Shop() {
  const [quickView, setQuickView] = useState(null);
  return (
    <>
      <ShopHero />
      <Manifesto />
      <Showcase />
      <Kinetic />
      <Collection onQuickView={setQuickView} />
      <Story />
      {quickView && <QuickView product={quickView} onClose={() => setQuickView(null)} />}
    </>
  );
}
