import { GAME_CONFIG } from '../config.js';
import Mascot from './Mascot.jsx';

const { maxGap } = GAME_CONFIG;
const PAD = 9; // % kept clear at each end so the outermost characters aren't clipped
const STEPS = Array.from({ length: maxGap + 1 }, (_, i) => i);
const MEET = maxGap / 2;

// The one place a step index becomes a screen position: markers and characters both use it,
// so moving one step on the board is exactly one marker on screen.
const stepPos = (i) => PAD + ((100 - 2 * PAD) * i) / maxGap;

export default function Track({ gap, left, right, lastMove, moveId }) {
  // The pair always stands symmetrically about the middle marker, `gap` markers apart.
  const steps = Math.max(0, Math.min(maxGap, gap));
  const leftStep = (maxGap - steps) / 2;
  const rightStep = (maxGap + steps) / 2;
  const lx = stepPos(leftStep);
  const rx = stepPos(rightStep);
  const anim = lastMove === 'closer' ? 'bounce' : lastMove === 'apart' ? 'wobble' : '';
  const together = steps === 0;
  // On the final step both share the middle marker, so nudge them apart to stand shoulder to shoulder.
  const hug = together ? 24 : 0;

  return (
    <div className={`track-wrap ${together ? 'united' : ''}`}>
      <div className="track" aria-hidden="true">
        <div className="lane" />
        {/* the stretch still to be closed */}
        <div className="lane-remaining" style={{ left: `${lx}%`, width: `${rx - lx}%` }} />
        {STEPS.map((i) => {
          const state = i === MEET ? 'meet' : i > leftStep && i < rightStep ? 'open' : 'cleared';
          return <span key={i} className={`step ${state}`} style={{ left: `${stepPos(i)}%` }} />;
        })}
        <div className="mascot-slot" style={{ left: `${lx}%`, marginLeft: `${-hug}px` }}>
          <div key={`l${moveId}`} className={`mascot-inner ${anim}`}>
            <Mascot id={left.mascot} size={84} label={left.name} />
          </div>
        </div>
        <div className="mascot-slot" style={{ left: `${rx}%`, marginLeft: `${hug}px` }}>
          <div key={`r${moveId}`} className={`mascot-inner ${anim}`}>
            <Mascot id={right.mascot} size={84} label={right.name} />
          </div>
        </div>
        {together && <div className="track-heart">💞</div>}
        {moveId > 0 && lastMove && (
          <div key={`b${moveId}`} className={`burst ${lastMove}`}>
            {lastMove === 'closer' ? `💞 +${GAME_CONFIG.matchMove}` : `💨 −${GAME_CONFIG.mismatchMove}`}
          </div>
        )}
      </div>
      <p className="gap-text" aria-live="polite">
        {together ? (
          <span className="gap-united">United! 💞</span>
        ) : (
          <>
            <b className="gap-count">{steps}</b> {steps === 1 ? 'step' : 'steps'} apart
          </>
        )}
      </p>
    </div>
  );
}
