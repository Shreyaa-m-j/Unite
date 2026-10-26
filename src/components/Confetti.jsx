import { useEffect, useMemo, useState } from 'react';

const COLORS = ['#ffb199', '#ff7eb3', '#f2c14e', '#b9a4ee', '#8fe3c2', '#fff4ef'];
const FALL_MS = 3800; // longest piece, including its delay

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// A single burst of paper confetti that plays once and then unmounts, so nothing loops
// behind the result. Skipped entirely when the viewer prefers reduced motion.
export default function Confetti({ count = 46 }) {
  const [done, setDone] = useState(reducedMotion);

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        left: (i / count) * 100 + (Math.random() * 6 - 3),
        delay: Math.random() * 0.45,
        duration: 2.1 + Math.random() * 1.2,
        drift: `${(Math.random() - 0.5) * 140}px`,
        rot: `${(Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 540)}deg`,
        color: COLORS[i % COLORS.length],
        w: 5 + Math.random() * 4,
        h: 8 + Math.random() * 7,
        round: i % 7 === 0,
      })),
    [count]
  );

  useEffect(() => {
    if (done) return;
    const t = setTimeout(() => setDone(true), FALL_MS);
    return () => clearTimeout(t);
  }, [done]);

  if (done) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className={p.round ? 'round' : ''}
          style={{
            left: `${p.left}%`,
            width: `${p.w}px`,
            height: `${p.round ? p.w : p.h}px`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--drift': p.drift,
            '--rot': p.rot,
          }}
        />
      ))}
    </div>
  );
}
