import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GAME_CONFIG } from '../config.js';
import Mascot from '../components/Mascot.jsx';
import Heart from '../components/Heart.jsx';
import { validateRoom, findOpenRoom, cancelRoom, leaveRoom, endRoom, serverNow, REASON_MESSAGES } from '../lib/rooms.js';
import { track } from '../lib/analytics.js';
import { clearSlot } from '../lib/storage.js';
import { normalizeCode } from '../lib/roomCode.js';
import { firebaseReady } from '../firebase.js';

export default function Landing() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null); // { reason, message }
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(null); // a room this device is still seated in
  const [bannerBusy, setBannerBusy] = useState(false);
  const inputRef = useRef(null);
  const location = useLocation();
  // Arriving from "Back to home" / "End room": the primary button here sits exactly where that
  // button was, so a double-click or a late tap would land on "Create a room". Ignore taps briefly.
  const [guard, setGuard] = useState(Boolean(location.state?.guard));
  useEffect(() => {
    if (!guard) return;
    const t = setTimeout(() => setGuard(false), 900);
    return () => clearTimeout(t);
  }, [guard]);

  useEffect(() => {
    if (location.state?.focusJoin) inputRef.current?.focus(); // arrived here after cancelling my room
  }, [location.state]);

  useEffect(() => {
    if (!firebaseReady) return;
    let alive = true;
    findOpenRoom().then((r) => alive && setOpen(r));
    return () => {
      alive = false;
    };
  }, []);

  const cancelOpen = async () => {
    setBannerBusy(true);
    try {
      const { code, slot, room } = open;
      // events carry the room explicitly: this screen is outside any room
      const ctx = { roomId: code, player: slot, round: room.currentRound || 0 };
      track('resume_banner_clicked', { ...ctx, action: 'cancel' });
      if ((room.currentRound || 0) > 0) {
        if ((await endRoom(code, slot)) === 'ended') {
          const finished = Object.values(room.rounds || {}).filter((r) => r && ['won', 'lost'].includes(r.status)).length;
          track('room_ended', { ...ctx, rounds_played: finished, ended_from: 'other', partner_had_requested_rematch: false });
        }
      } else if (slot === 'p1') {
        await cancelRoom(code, { onCancelled: (info) => track('room_cancelled', { ...ctx, ...info, trigger: 'button' }) });
      } else if ((await leaveRoom(code)) === 'left') {
        const joinedAt = room.players?.p2?.joinedAt;
        track('partner_left_lobby', { ...ctx, seconds_in_lobby: typeof joinedAt === 'number' ? Math.round((serverNow() - joinedAt) / 1000) : null });
      }
      clearSlot(code);
      setOpen(null);
    } catch {
      /* leave the banner; the user can try again */
    }
    setBannerBusy(false);
  };

  const join = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await validateRoom(code); // validated only on submit, not while typing
    setBusy(false);
    if (res.ok) navigate(`/room/${res.code}`, { state: { via: 'code' } });
    else {
      // the player is trying to become Player 2; what they typed may not be a real room, so it can be null
      track('join_failed', { reason: res.reason, method: 'code', roomId: normalizeCode(code) || null, round: 0, player: 'p2' });
      setError({ reason: res.reason, message: REASON_MESSAGES[res.reason] });
    }
  };

  return (
    <main className={`screen center ${guard ? 'guard' : ''}`}>
      <div className="hero-mascots" aria-hidden="true">
        <Mascot id="g2" size={140} />
        <Heart className="hero-heart" size={34} />
        <Mascot id="b2" size={140} />
      </div>
      <h1 className="title">Unite</h1>
      <p className="pitch">Two hearts, {GAME_CONFIG.startGap} steps apart. Think alike to unite.</p>

      {!firebaseReady && (
        <p className="error">Firebase isn't configured: fill in .env (see .env.example) and restart.</p>
      )}

      {open && (
        <div className="card stack banner-card" role="status">
          <p>You have a room open: <b className="code-inline">{open.code}</b></p>
          <Link
            to={`/room/${open.code}`}
            className="btn primary"
            onClick={() => track('resume_banner_clicked', { roomId: open.code, player: open.slot, round: open.room.currentRound || 0, action: 'resume' })}
          >
            Resume
          </Link>
          <button className="btn" onClick={cancelOpen} disabled={bannerBusy}>
            {bannerBusy && <span className="spinner" />}Cancel it
          </button>
        </div>
      )}

      <div className="card stack">
        <Link to="/create" className="btn primary">Create a room</Link>
      </div>

      <form className="card stack" onSubmit={join} noValidate>
        <label className="field" htmlFor="room-code">Join with a code</label>
        <input
          id="room-code"
          ref={inputRef}
          className="code-input"
          value={code}
          maxLength={6}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="K7MQ4X"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'code-error' : undefined}
          onChange={(e) => {
            setCode(normalizeCode(e.target.value));
            setError(null);
          }}
        />
        {error && (
          <p id="code-error" className="error" role="alert">
            {error.message}
            {error.reason === 'full' && <> <Link to="/create">Create your own room</Link></>}
            {(error.reason === 'ended' || error.reason === 'cancelled') && <> <Link to="/create" className="btn primary">Create a room</Link></>}
          </p>
        )}
        <button className="btn" type="submit" disabled={busy}>
          {busy && <span className="spinner" />}Join room
        </button>
      </form>

    </main>
  );
}
