import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { BRAND } from '../config';
import { SLIDES } from '../data/products';

// ── Opening veil ────────────────────────────────────────────
// The brand name rises letter by letter on a cream veil, then the
// veil sweeps up into the first slide. Nothing moves until the
// display font and the first slide's imagery are actually ready,
// so the sequence never stutters.

const EASE = [0.16, 1, 0.3, 1];

function preload(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = img.onerror = resolve;
    img.src = src;
  });
}

export default function Intro({ onComplete }) {
  const [ready, setReady] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onComplete();
  };

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }
    let alive = true;
    const assets = [preload(SLIDES[0].imageA), preload(SLIDES[0].imageB)];
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const failsafe = new Promise((r) => setTimeout(r, 2500));
    Promise.race([Promise.all([fonts, ...assets]), failsafe]).then(() => {
      if (alive) setReady(true);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(finish, 3400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const word = BRAND.name.toUpperCase();

  return (
    <motion.div
      className="intro"
      onClick={finish}
      exit={{ y: '-100%' }}
      transition={{ duration: 1, ease: [0.76, 0, 0.24, 1] }}
    >
      {ready && (
        <div className="intro-center">
          <motion.div
            className="intro-mark"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: EASE }}
          >
            {BRAND.monogram}
          </motion.div>

          <div className="intro-word" aria-label={BRAND.name}>
            {word.split('').map((ch, i) => (
              <span className="l" key={i}>
                <motion.span
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.85, delay: 0.25 + i * 0.04, ease: EASE }}
                >
                  {ch === ' ' ? ' ' : ch}
                </motion.span>
              </span>
            ))}
          </div>

          <motion.div
            className="intro-rule"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 1.35, ease: EASE }}
          />
          <motion.p
            className="intro-sub"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.55 }}
          >
            {BRAND.city} · Women · Men · Kids
          </motion.p>
        </div>
      )}

      <button className="intro-skip" onClick={finish}>Skip intro</button>
    </motion.div>
  );
}
