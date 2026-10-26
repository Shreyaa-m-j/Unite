import { useEffect, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import { GAME_CONFIG } from '../config.js';
import { stepsText } from '../lib/format.js';
import { pickFallback } from '../data/fallbackQuestions.js';
import { initialState, reducer } from '../game/engine.js';
import Mascot from '../components/Mascot.jsx';
import MascotPicker from '../components/MascotPicker.jsx';
import Track from '../components/Track.jsx';
import EndScreen from '../components/EndScreen.jsx';
import Reveal from '../components/Reveal.jsx';

function Setup({ onStart }) {
  const [players, setPlayers] = useState({
    p1: { name: 'Riya', mascot: 'g1' },
    p2: { name: 'Arjun', mascot: 'b1' },
  });
  const set = (slot, patch) => setPlayers((p) => ({ ...p, [slot]: { ...p[slot], ...patch } }));

  return (
    <main className="screen">
      <Link to="/" className="back">← Home</Link>
      <h2>Local test game</h2>
      <p className="hint">Both players share this screen. Pick for each of them.</p>
      {['p1', 'p2'].map((slot, i) => (
        <section className="card stack" key={slot}>
          <label className="field">
            Player {i + 1} name
            <input
              value={players[slot].name}
              maxLength={16}
              onChange={(e) => set(slot, { name: e.target.value })}
            />
          </label>
          <MascotPicker value={players[slot].mascot} onChange={(m) => set(slot, { mascot: m })} />
        </section>
      ))}
      <button
        className="btn primary"
        onClick={() =>
          onStart({
            p1: { ...players.p1, name: players.p1.name.trim() || 'Player 1' },
            p2: { ...players.p2, name: players.p2.name.trim() || 'Player 2' },
          })
        }
      >
        Start
      </button>
    </main>
  );
}

function Game({ players, onAgain, onExit }) {
  const [state, dispatch] = useReducer(reducer, null, () =>
    initialState(pickFallback({ p1: players.p1, p2: players.p2, count: GAME_CONFIG.questionsPerGame }))
  );
  const [now, setNow] = useState(Date.now());

  // Overall countdown.
  useEffect(() => {
    if (state.status !== 'playing') return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [state.status]);
  const remainingMs = Math.max(0, state.startedAt + GAME_CONFIG.durationSec * 1000 - now);
  useEffect(() => {
    if (state.status === 'playing' && remainingMs === 0) dispatch({ type: 'timeout' });
  }, [remainingMs, state.status]);

  // Reveal, then move on.
  useEffect(() => {
    if (!state.reveal) return;
    const t = setTimeout(() => dispatch({ type: 'next' }), GAME_CONFIG.revealMs);
    return () => clearTimeout(t);
  }, [state.reveal]);

  const { p1, p2 } = players;
  const secs = Math.ceil(remainingMs / 1000);
  const mmss = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  const track = <Track gap={state.gap} left={p1} right={p2} lastMove={state.lastMove} moveId={state.moveId} />;

  if (state.status !== 'playing') {
    const won = state.status === 'won';
    return (
      <EndScreen
        won={won}
        names={`${p1.name} & ${p2.name}`}
        headline={`${p1.name} & ${p2.name} united! 🎉`}
        track={track}
        gap={state.gap}
        answered={state.answered}
        matches={state.matches}
        tookSec={Math.round(((state.endedAt ?? Date.now()) - state.startedAt) / 1000)}
      >
        <button className="btn primary" onClick={onAgain}>Play again</button>
        <button className="btn" onClick={onExit}>Change players</button>
      </EndScreen>
    );
  }

  const q = state.questions[state.index];
  const waitingFor = ['p1', 'p2'].filter((s) => !state.answers[s]);

  return (
    <main className="screen">
      <header className="hud">
        <span className={`timer ${secs <= 15 ? 'low' : ''}`} aria-label="Time left">⏱ {mmss}</span>
        <span className="hud-count">Q{state.index + 1}</span>
      </header>
      {track}

      <div className="card question">
        <h2>{q.q}</h2>
        {state.reveal ? (
          <Reveal
            matched={state.reveal.matched}
            picks={['p1', 'p2'].map((sl) => ({
              name: players[sl].name,
              mascot: players[sl].mascot,
              option: state.answers[sl] === 'A' ? q.a : q.b,
            }))}
          >
            {state.reveal.matched
              ? `You both picked ${state.reveal.option}! 💞 +${GAME_CONFIG.matchMove} closer`
              : `Different picks 😅 ${stepsText(GAME_CONFIG.mismatchMove)} apart`}
          </Reveal>
        ) : (
          <p className="hint" role="status">
            {waitingFor.length === 2
              ? 'Both of you, choose!'
              : `Waiting for ${players[waitingFor[0]].name}…`}
          </p>
        )}
      </div>

      {['p1', 'p2'].map((slot) => {
        const picked = state.answers[slot];
        return (
          <section className="card player-row" key={slot}>
            <div className="player-name">
              <Mascot id={players[slot].mascot} crop="head" size={34} />
              {players[slot].name}
              {picked && <span className="locked">Locked in ✓</span>}
            </div>
            <div className="ab">
              {['A', 'B'].map((c) => (
                <button
                  key={c}
                  className={`btn ab-btn ${state.reveal && picked === c ? 'chosen' : ''}`}
                  disabled={!!picked || !!state.reveal}
                  onClick={() => dispatch({ type: 'answer', slot, choice: c })}
                >
                  <small>{c}</small>
                  {/* Choices stay hidden until both have answered. */}
                  <span>{c === 'A' ? q.a : q.b}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}

export default function LocalGame() {
  const [players, setPlayers] = useState(null);
  const [round, setRound] = useState(0);

  if (!players) return <Setup onStart={setPlayers} />;
  return (
    <Game
      key={round}
      players={players}
      onAgain={() => setRound((r) => r + 1)}
      onExit={() => setPlayers(null)}
    />
  );
}
