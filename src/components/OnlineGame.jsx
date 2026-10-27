import { useEffect, useRef, useState } from 'react';
import { GAME_CONFIG } from '../config.js';
import { stepsText } from '../lib/format.js';
import { submitAnswer, advanceQuestion, expireIfTimeUp, requestRematch, cancelRematch, claimEvent } from '../lib/rooms.js';
import { track } from '../lib/analytics.js';
import Track from './Track.jsx';
import EndScreen from './EndScreen.jsx';
import Reveal from './Reveal.jsx';
import Dialog from './Dialog.jsx';
import Stopwatch from './Stopwatch.jsx';
import ClockIntro from './ClockIntro.jsx';

// `round` is rooms/{code}/rounds/{roundNo}. Mounted with key={roundNo} so local state resets on Play again.
export default function OnlineGame({ room, round, roundNo, slot, code, offsetMs, onEndRoom }) {
  const partnerSlot = slot === 'p1' ? 'p2' : 'p1';
  const me = room.players[slot];
  const partner = room.players[partnerSlot];

  const cur = round.currentIndex || 0;
  const q = round.questions?.[cur];
  const ans = round.answers?.[cur] || {};
  const resolved = Boolean(ans.resolved);
  const playing = round.status === 'playing';

  const [doneIdx, setDoneIdx] = useState(-1); // reveal finished for this question index
  const revealing = resolved && doneIdx !== cur;
  const [, setTick] = useState(0);
  const [rematchBusy, setRematchBusy] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [endBusy, setEndBusy] = useState(false);
  const [endError, setEndError] = useState('');
  const submitting = useRef(false);

  // The clock intro. startedAt is in the future by introMs (set when the questions were written), so the intro
  // never uses up game time and both phones start the countdown at the same moment.
  const startedAt = typeof round.startedAt === 'number' ? round.startedAt : 0;
  const introLeftAtMount = useRef(startedAt - (Date.now() + offsetMs)).current;
  const [introOver, setIntroOver] = useState(introLeftAtMount <= 0);
  const [gameVisible, setGameVisible] = useState(introLeftAtMount <= 0); // the game fades in as the clock flies
  const timerRef = useRef(null); // the header stopwatch: where the big clock lands

  const shownAt = useRef(Date.now()); // when this question appeared for this player
  const answeredAt = useRef(null);
  const reported = useRef(new Set()); // question indexes already reported

  const serverNow = () => Date.now() + offsetMs;
  const fullMs = GAME_CONFIG.durationSec * 1000;
  const remainingMs = startedAt ? Math.max(0, Math.min(fullMs, startedAt + fullMs - serverNow())) : fullMs;

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setTick((n) => n + 1);
      // safety net: if the intro's own timer was delayed (a throttled background tab), start the game anyway
      if (startedAt && Date.now() + offsetMs >= startedAt) {
        setIntroOver(true);
        setGameVisible(true);
      }
    }, 250);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  useEffect(() => {
    if (!revealing) return;
    const t = setTimeout(() => setDoneIdx(cur), GAME_CONFIG.revealMs);
    return () => clearTimeout(t);
  }, [revealing, cur]);

  // Either client may move things along; the transactions guard against doubles.
  useEffect(() => {
    if (playing && introOver && remainingMs === 0 && startedAt) {
      expireIfTimeUp(code, roundNo, serverNow());
    }
  });
  useEffect(() => {
    if (playing && resolved && !revealing) advanceQuestion(code, roundNo, cur, serverNow());
  }, [playing, resolved, revealing, cur, code, roundNo]);

  useEffect(() => {
    submitting.current = false;
    // the first question only appears once the intro is over (startedAt, in this phone's clock)
    shownAt.current = Math.max(Date.now(), cur === 0 && startedAt ? startedAt - offsetMs : 0);
    answeredAt.current = null;
  }, [cur]);

  // One event per player per question, once it has been resolved (so `matched` is known). Only the page load in
  // which the player actually tapped reports it (answeredAt is set by the tap), so a refresh on a question they
  // already answered cannot report it a second time.
  useEffect(() => {
    if (!resolved || !ans[slot] || !answeredAt.current || reported.current.has(cur)) return;
    reported.current.add(cur);
    track('question_answered', {
      round: roundNo,
      index: cur,
      matched: Boolean(ans.matched),
      time_to_answer_ms: answeredAt.current - shownAt.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, cur]);

  // Game-level events are reported by Player 1 only, and claimed with a transaction so each is sent exactly
  // once per round, even across refreshes, second tabs or a reconnect. Player 2's client never sends them.
  useEffect(() => {
    if (slot !== 'p1' || round.status !== 'playing') return;
    const at = new Date();
    claimEvent(code, roundNo, 'started').then((first) => {
      if (first) track('game_started', { round: roundNo, question_source: round.questionSource }, at);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.status === 'playing']);

  useEffect(() => {
    if (slot !== 'p1' || (round.status !== 'won' && round.status !== 'lost')) return;
    const at = new Date();
    const r = round.result || {};
    const answered = r.answered || 0;
    const base = {
      round: roundNo,
      questions_answered: answered,
      match_rate: r.matchRate ?? (answered ? Math.round(((r.matches || 0) / answered) * 100) : 0),
    };
    const won = round.status === 'won';
    claimEvent(code, roundNo, 'finished').then((first) => {
      if (!first) return;
      if (won) track('game_won', { ...base, duration_ms: r.durationMs }, at);
      else track('game_lost', { ...base, gap_remaining: round.gap }, at);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.status]);

  const answer = (choice) => {
    if (submitting.current || ans[slot] || !playing || !introOver) return;
    submitting.current = true;
    answeredAt.current = Date.now();
    submitAnswer(code, roundNo, slot, choice, cur, serverNow());
  };

  const myRematch = Boolean(round.rematch?.[slot]);
  const partnerWants = Boolean(round.rematch?.[partnerSlot]);
  const rematch = async (want) => {
    if (rematchBusy) return;
    setRematchBusy(true);
    try {
      if (want) {
        // Timestamped at the tap: when this is the second tap, the new round appears before the request
        // resolves. `round` is the round being replayed, not the new one.
        const tappedAt = new Date();
        const r = await requestRematch(code, roundNo, slot);
        if (r.ok) track('rematch_requested', { round: roundNo, partner_already_requested: partnerWants }, tappedAt);
      } else if (await cancelRematch(code, roundNo, slot)) {
        track('rematch_cancelled', { round: roundNo });
      }
    } finally {
      setRematchBusy(false);
    }
  };

  const lastMove = resolved ? (ans.matched ? 'closer' : 'apart') : null;
  const trackEl = (
    <Track gap={round.gap} left={me} right={partner} lastMove={lastMove} moveId={resolved ? cur + 1 : 0} />
  );

  // End screen only after the final reveal has played out.
  if ((round.status === 'won' || round.status === 'lost') && !revealing) {
    const won = round.status === 'won';
    const result = round.result || {};
    return (
      <>
      <EndScreen
        won={won}
        onEndRoom={() => {
          setEndError('');
          setConfirmEnd(true);
        }}
        names={`${me.name} & ${partner.name}`}
        headline={`${me.name} & ${partner.name} united! 🎉`}
        track={trackEl}
        onShared={(method) => track('result_shared', { round: roundNo, outcome: won ? 'won' : 'lost', method })}
        gap={round.gap}
        answered={result.answered || 0}
        matches={result.matches || 0}
        tookSec={Math.round((result.durationMs || 0) / 1000)}
      >
        {partnerWants && !myRematch && <p className="nudge">{partner.name} wants a rematch! 🔁</p>}
        {myRematch ? (
          <>
            <button className="btn primary" disabled>
              <span className="spinner" />Waiting for {partner.name}…
            </button>
            {partner.online === false && <p className="hint">{partner.name} is offline</p>}
            <button className="link-btn" disabled={rematchBusy} onClick={() => rematch(false)}>Cancel</button>
          </>
        ) : (
          <button
            className={`btn primary ${partnerWants ? 'pulse-btn' : ''}`}
            disabled={rematchBusy}
            onClick={() => rematch(true)}
          >
            Play again
          </button>
        )}
      </EndScreen>
        {confirmEnd && (
          <Dialog
            title="End this room for both of you?"
            actions={
              <>
                <button
                  className="btn primary"
                  disabled={endBusy}
                  onClick={async () => {
                    setEndBusy(true);
                    try {
                      await onEndRoom();
                    } catch {
                      setEndError("Couldn't connect. Check your internet and try again.");
                      setEndBusy(false);
                    }
                  }}
                >
                  {endBusy && <span className="spinner" />}End room
                </button>
                <button className="btn" disabled={endBusy} onClick={() => setConfirmEnd(false)}>Stay</button>
              </>
            }
          >
            <p className="hint">{partner.name} will be taken home too.</p>
            {endError && <p className="error" role="alert">{endError}</p>}
          </Dialog>
        )}
      </>
    );
  }
  if (!q) return null;

  const secs = introOver ? Math.ceil(remainingMs / 1000) : GAME_CONFIG.durationSec;
  const urgent = introOver && playing && secs > 0 && secs <= GAME_CONFIG.urgentAtSec;
  const optionText = (c) => (c === 'A' ? q.a : q.b);

  const status = ans[slot] ? `Waiting for ${partner.name}…` : 'Pick one!';

  return (
    <>
    {!introOver && (
      <ClockIntro
        msLeft={introLeftAtMount}
        targetRef={timerRef}
        onFly={() => setGameVisible(true)}
        onDone={() => {
          setIntroOver(true);
          setGameVisible(true);
        }}
      />
    )}
    <main className={`screen game-main ${gameVisible ? 'game-in' : 'game-hold'}`}>
      {partner.online === false && (
        <div className="banner" role="status">Partner disconnected… waiting for them to come back</div>
      )}
      <header className="hud">
        {/* hidden until the big intro clock has landed on it, then it takes over at the same spot */}
        <Stopwatch innerRef={timerRef} value={secs} size={54} urgent={urgent} className={introOver ? '' : 'mini-wait'} label={`${secs} seconds left`} />
        <span className="hud-count">Q{cur + 1}</span>
      </header>
      {trackEl}
      <div className="card question">
        <h2>{q.q}</h2>
        {revealing ? (
          <Reveal
            matched={ans.matched}
            picks={[
              { name: me.name, mascot: me.mascot, option: optionText(ans[slot]) },
              { name: partner.name, mascot: partner.mascot, option: optionText(ans[partnerSlot]) },
            ]}
          >
            {ans.matched
              ? `You both picked ${optionText(ans[slot])}! 💞 +${GAME_CONFIG.matchMove} closer`
              : `Different picks 😅 ${stepsText(GAME_CONFIG.mismatchMove)} apart`}
          </Reveal>
        ) : (
          <p className="hint" role="status">{status}</p>
        )}
      </div>
      <div className="ab">
        {['A', 'B'].map((c) => (
          <button
            key={c}
            className={`btn ab-btn ${ans[slot] === c ? 'chosen' : ''}`}
            disabled={Boolean(ans[slot]) || !playing || !introOver}
            onClick={() => answer(c)}
          >
            <small>{ans[slot] === c ? 'Locked in ✓' : c}</small>
            <span>{optionText(c)}</span>
          </button>
        ))}
      </div>
    </main>
    </>
  );
}
