import { useEffect, useRef, useState } from 'react';
import { GAME_CONFIG } from '../config.js';
import Stopwatch from './Stopwatch.jsx';

const HOLD_MS = 1500; // how long the big clock sits in the middle before it flies to the header

const prefersReducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

// The clock intro. Shows the full game time (from GAME_CONFIG.durationSec, never hard-coded), then the clock
// shrinks and moves into the exact spot of the header timer (measured, then animated with a CSS transform),
// so it reads as one continuous object. The whole thing is timed backwards from `msLeft`, the time until
// startedAt, so it ends exactly when the countdown begins, on both phones, even if one joined the intro late.
//
//   targetRef: the header timer element to land on     onFly: the game should start fading in
//   onDone: startedAt has arrived (remove me, the real timer takes over)
export default function ClockIntro({ msLeft, targetRef, onFly, onDone }) {
  const { durationSec, introMs } = GAME_CONFIG;
  const reduced = useRef(prefersReducedMotion()).current;
  const clockRef = useRef(null);
  const [phase, setPhase] = useState('hold'); // hold | fly | fade
  const [flyStyle, setFlyStyle] = useState(null);
  const left0 = useRef(msLeft).current; // time until startedAt when this mounted

  useEffect(() => {
    const hold = Math.min(HOLD_MS, introMs * 0.6);
    const elapsed = Math.max(0, introMs - left0);
    const flyAt = Math.max(0, hold - elapsed);

    const t1 = setTimeout(() => {
      onFly?.();
      if (reduced) {
        setPhase('fade'); // reduced motion: no shrink, a simple crossfade
        return;
      }
      const clock = clockRef.current;
      const target = targetRef.current;
      if (!clock || !target) {
        setPhase('fade');
        return;
      }
      const c = clock.getBoundingClientRect();
      const t = target.getBoundingClientRect();
      const scale = t.width / c.width;
      const dx = t.left + t.width / 2 - (c.left + c.width / 2);
      const dy = t.top + t.height / 2 - (c.top + c.height / 2);
      const flyMs = Math.max(200, left0 - flyAt); // lands exactly when the countdown starts
      setFlyStyle({
        transform: `translate(${dx}px, ${dy}px) translate(-50%, -50%) scale(${scale})`,
        transition: `transform ${flyMs}ms cubic-bezier(0.55, 0, 0.2, 1)`,
      });
      setPhase('fly');
    }, flyAt);
    const t2 = setTimeout(() => onDone?.(), Math.max(0, left0));
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`intro ${phase}`} data-phase={phase}>
      <div className="intro-bg" />
      <div ref={clockRef} className="intro-clock" style={flyStyle || undefined}>
        <Stopwatch value={durationSec} size={190} label={`${durationSec} seconds`} />
      </div>
      <p className="intro-text" role="status">You have {durationSec} seconds to unite!</p>
    </div>
  );
}
