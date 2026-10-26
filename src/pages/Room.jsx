import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { firebaseReady } from '../firebase.js';
import { normalizeCode } from '../lib/roomCode.js';
import {
  validateRoom, joinRoom, startFirstRound, endRoom, cancelRoom, leaveRoom, cancelMyEmptyRooms, claimEvent, serverNow, REASON_MESSAGES,
} from '../lib/rooms.js';
import { track, setContext, clearContext, setPlayerName } from '../lib/analytics.js';
import { clearSlot } from '../lib/storage.js';
import { useRoom } from '../hooks/useRoom.js';
import PlayerForm from '../components/PlayerForm.jsx';
import Lobby from '../components/Lobby.jsx';
import OnlineGame from '../components/OnlineGame.jsx';
import EndedPopup from '../components/EndedPopup.jsx';

// Rounds that actually finished (won or lost); an abandoned or still-running round does not count.
const finishedRounds = (room) =>
  Object.values(room?.rounds || {}).filter((r) => r && ['won', 'lost'].includes(r.status)).length;

function Message({ text, children }) {
  return (
    <main className="screen center">
      <div className="card stack">
        <p>{text}</p>
        {children}
        <Link to="/" className="btn">Back to home</Link>
      </div>
    </main>
  );
}

export default function Room() {
  const { roomId } = useParams();
  const location = useLocation();
  const [check, setCheck] = useState({ state: 'checking' });
  // arrived by typing the code on the home page (state set there) or by opening the shared link
  const via = location.state?.via === 'code' ? 'code' : 'link';

  // Same validation as joining by code.
  useEffect(() => {
    if (!firebaseReady) return;
    let alive = true;
    setCheck({ state: 'checking' });
    validateRoom(roomId).then((r) => {
      if (!alive) return;
      if (!r.ok && via === 'link') track('join_failed', { reason: r.reason, method: 'link', roomId: normalizeCode(roomId), round: 0, player: 'p2' });
      setCheck(r.ok ? { state: 'ok', code: r.code, slot: r.slot } : { state: 'fail', reason: r.reason });
    });
    return () => {
      alive = false;
    };
  }, [roomId]);

  if (!firebaseReady) return <Message text="Firebase isn't configured yet. Fill in .env and restart." />;
  if (check.state === 'checking') return <Message text="Checking room…" />;
  if (check.state === 'fail') {
    return (
      <Message text={REASON_MESSAGES[check.reason]}>
        {check.reason === 'full' && <Link to="/create" className="btn primary">Create your own room</Link>}
        {(check.reason === 'ended' || check.reason === 'cancelled') && <Link to="/create" className="btn primary">Create a room</Link>}
      </Message>
    );
  }
  return <RoomInner code={check.code || normalizeCode(roomId)} initialSlot={check.slot} via={via} />;
}

function RoomInner({ code, initialSlot, via }) {
  const [slot, setSlot] = useState(initialSlot);
  const { room, offsetMs } = useRoom(code, slot);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const navigate = useNavigate();
  // Set the moment this player confirms End/Cancel/Leave, so they never see the partner pop-up for their own action.
  const leaving = useRef(false);
  const toastTimer = useRef(null);
  const prevP2 = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 4000);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Player 1: tell them when the partner leaves the lobby (the room is back to "waiting").
  const p2Name = room?.players?.p2?.name || null;
  useEffect(() => {
    const prev = prevP2.current;
    prevP2.current = p2Name;
    if (slot === 'p1' && prev && !p2Name && room?.status === 'lobby') showToast(`${prev} left the room`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p2Name]);

  // Every event fired from here on carries the room, which seat this is, and the current round.
  const currentRound = room?.currentRound || 0;
  useEffect(() => {
    setContext({ roomId: code, player: slot || undefined, round: currentRound });
  }, [code, slot, currentRound]);
  useEffect(() => clearContext, []);

  // The PostHog person is named after the player (development only), so the Persons list is readable.
  const myName = room?.players?.[slot]?.name;
  useEffect(() => {
    if (myName) setPlayerName(myName);
  }, [myName]);

  // A rematch started a new round. Game-level, so Player 1 reports it once (claimed on the new round).
  // seconds_waited: from the first rematch tap on the previous round until now.
  useEffect(() => {
    if (slot !== 'p1' || currentRound < 2) return;
    const asked = Object.values(room?.rounds?.[currentRound - 1]?.rematchAt || {}).filter((n) => typeof n === 'number');
    if (!room?.rounds?.[currentRound] || !asked.length) return;
    const at = new Date();
    const waited = Math.round((serverNow() - Math.min(...asked)) / 100) / 10;
    claimEvent(code, currentRound, 'rematchStarted').then((first) => {
      if (first) track('rematch_started', { round: currentRound, new_round: currentRound, seconds_waited: waited < 600 ? waited : null }, at);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRound, slot]);

  // Runs a "leave" transaction, then clears the seat and goes home. Errors bubble to the confirm dialog.
  const leaveVia = (action, navState, after) => async () => {
    leaving.current = true;
    let outcome;
    try {
      outcome = await action();
    } catch (e) {
      leaving.current = false;
      throw e;
    }
    if (outcome === 'started') {
      // The game began just before this tap; stay put (the screen switches to the round).
      leaving.current = false;
      return;
    }
    after?.(outcome);
    clearSlot(code);
    navigate('/', { state: { ...navState, guard: true } });
  };
  const handleEndRoom = leaveVia(
    () => endRoom(code, slot),
    undefined,
    (outcome) => {
      if (outcome !== 'ended') return; // 'already': the partner ended it first, so it is theirs to report
      const partnerSlot = slot === 'p1' ? 'p2' : 'p1';
      track('room_ended', {
        rounds_played: finishedRounds(room),
        ended_from: 'result',
        partner_had_requested_rematch: Boolean(room?.rounds?.[room.currentRound]?.rematch?.[partnerSlot]),
      });
    }
  );
  const handleCancelRoom = leaveVia(
    () => cancelRoom(code, {
      onCancelled: (info) => track('room_cancelled', { ...info, trigger: 'button' }),
    }),
    { focusJoin: true }
  );
  const handleLeave = leaveVia(
    () => leaveRoom(code),
    undefined,
    (outcome) => {
      if (outcome !== 'left') return;
      const joinedAt = room?.players?.p2?.joinedAt;
      track('partner_left_lobby', { seconds_in_lobby: typeof joinedAt === 'number' ? Math.round((serverNow() - joinedAt) / 1000) : null });
    }
  );

  const withToast = (el) => (
    <>
      {el}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );

  if (room === undefined) return <Message text="Loading room…" />;
  if (room === null) return <Message text={REASON_MESSAGES.not_found} />;

  if (room.status === 'ended') {
    const partnerSlot = slot === 'p1' ? 'p2' : 'p1';
    const cancelled = room.endReason === 'cancelled';
    if (slot && room.endedBy !== slot && !leaving.current) {
      return (
        <EndedPopup
          code={code}
          cancelled={cancelled}
          roundsPlayed={finishedRounds(room)}
          partnerName={room.players?.[partnerSlot]?.name || 'Your partner'}
        />
      );
    }
    if (!slot) {
      return (
        <Message text={cancelled ? REASON_MESSAGES.cancelled : REASON_MESSAGES.ended}>
          <Link to="/create" className="btn primary">Create a room</Link>
        </Message>
      );
    }
    return <Message text="Leaving…" />;
  }

  if (slot && !room.players?.[slot]) {
    // Our seat is gone (we just left, or left from another tab).
    return <Message text={leaving.current ? 'Leaving…' : "You're no longer in this room."} />;
  }

  if (!slot) {
    const takenMascot = room.players?.p1?.mascot;
    return withToast(
      <PlayerForm
        title={`Join ${room.players?.p1?.name || 'your partner'}'s room`}
        submitLabel="Join room"
        busy={busy}
        error={error}
        defaultMascot={takenMascot === 'b1' ? 'b2' : 'b1'}
        onSubmit={async (player) => {
          setBusy(true);
          setError('');
          try {
            setSlot(await joinRoom(code, player));
            setPlayerName(player.name);
            track('partner_joined', {
              roomId: code,
              player: 'p2',
              round: 0,
              method: via,
              seconds_since_room_created: typeof room.createdAt === 'number' ? Math.round((serverNow() - room.createdAt) / 1000) : null,
            });
            // Joining someone else's room: close my own empty room, if I have one.
            cancelMyEmptyRooms(code).then((closed) => {
              if (closed.length) showToast(`Closed your empty room ${closed[0]}.`);
            });
          } catch (e) {
            const reason = e.message === 'full' ? 'full' : e.message === 'ended' ? 'ended' : 'network';
            track('join_failed', { reason, method: via, roomId: code, round: 0, player: 'p2' });
            setError(REASON_MESSAGES[reason]);
            setBusy(false);
          }
        }}
      />
    );
  }

  const roundNo = room.currentRound || 0;
  const round = roundNo ? room.rounds?.[roundNo] : null;

  if (round?.status === 'loading') {
    return (
      <main className="screen center">
        <span className="spinner big" />
        <h2>Cooking up questions just for you two…</h2>
      </main>
    );
  }
  if (!round) {
    return withToast(
      <Lobby
        room={room}
        slot={slot}
        code={code}
        starting={busy}
        onCancelRoom={handleCancelRoom}
        onLeave={handleLeave}
        onStart={async () => {
          setBusy(true);
          try {
            await startFirstRound(code);
          } finally {
            setBusy(false);
          }
        }}
      />
    );
  }
  return withToast(
    <OnlineGame key={roundNo} room={room} round={round} roundNo={roundNo} slot={slot} code={code} offsetMs={offsetMs} onEndRoom={handleEndRoom} />
  );
}
