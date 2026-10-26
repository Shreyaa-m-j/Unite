import { ref, get, set, update, runTransaction, serverTimestamp } from 'firebase/database';
import { db } from '../firebase.js';
import { GAME_CONFIG } from '../config.js';
import { generateCode, normalizeCode, isValidCodeFormat } from './roomCode.js';
import { getSlot, saveSlot, clearSlot, listSlots } from './storage.js';
import { fetchQuestions } from './questions.js';
import { track } from './analytics.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const roomRef = (id) => ref(db, `rooms/${id}`);

// Server-clock offset, kept fresh by useRoom, so writes can stamp server-aligned times.
let serverOffset = 0;
export const setServerOffset = (ms) => {
  serverOffset = ms || 0;
};
export const serverNow = () => Date.now() + serverOffset;

function withTimeout(promise, ms = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Closes a round: status, endedAt and the full result record.
function endedRound(round, outcome, serverNow) {
  const result = round.result || {};
  const answered = result.answered || 0;
  const matches = result.matches || 0;
  return {
    ...round,
    status: outcome,
    endedAt: serverNow,
    result: {
      ...result,
      outcome,
      matches,
      answered,
      matchRate: answered ? Math.round((matches / answered) * 100) : 0,
      durationMs: serverNow - round.startedAt,
      gapRemaining: round.gap,
    },
  };
}

export const REASON_MESSAGES = {
  empty: 'Enter the room code your partner shared.',
  bad_format: 'Room codes are 6 letters/numbers, like K7MQ4X.',
  not_found: "We couldn't find that room. Double-check the code with your partner.",
  full: 'This room is already full.',
  expired: 'This room has expired. Ask your partner to create a new one.',
  ended: 'This room has ended. Start a new one to play again.',
  cancelled: 'This room was cancelled. Ask your partner for their code, or create a new room.',
  network: "Couldn't connect. Check your internet and try again.",
};

// Shared by the landing page (code) and /room/:code (link).
// Returns { ok, reason, code, slot }; slot is set when this device already holds a seat.
export async function validateRoom(input) {
  const code = normalizeCode(input);
  if (!code) return { ok: false, reason: 'empty' };
  if (!isValidCodeFormat(code)) return { ok: false, reason: 'bad_format' };
  if (!db) return { ok: false, reason: 'network' };

  let room;
  try {
    room = (await withTimeout(get(roomRef(code)))).val();
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (!room) return { ok: false, reason: 'not_found' };
  if (room.status === 'ended') {
    clearSlot(code);
    return { ok: false, reason: room.endReason === 'cancelled' ? 'cancelled' : 'ended' };
  }

  const slot = getSlot(code);
  if (slot && room.players?.[slot]) return { ok: true, code, slot };
  if (room.players?.p1 && room.players?.p2) return { ok: false, reason: 'full' };
  if (typeof room.createdAt === 'number' && Date.now() - room.createdAt > DAY_MS) {
    return { ok: false, reason: 'expired' };
  }
  return { ok: true, code, slot: null };
}

export async function createRoom(player) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const exists = (await withTimeout(get(roomRef(code)))).exists();
    if (exists) continue; // collision: regenerate
    await withTimeout(
      set(roomRef(code), {
        game: 'unite',
        createdAt: serverTimestamp(),
        status: 'lobby', // lobby | in_round | ended
        currentRound: 0, // 0 until the first game starts; rounds/{n} holds all per-game data
        players: { p1: { ...player, joinedAt: serverTimestamp(), online: true } },
      })
    );
    saveSlot(code, 'p1');
    return code;
  }
  throw new Error('Could not allocate a room code');
}

// Throws Error('full') or Error('ended') if the seat is gone or the room was closed first.
export async function joinRoom(code, player) {
  let reason = null;
  const res = await withTimeout(
    runTransaction(roomRef(code), (room) => {
      reason = null;
      if (room === null) return room;
      if (room.status === 'ended') {
        reason = 'ended';
        return;
      }
      if (room.players?.p2) {
        reason = 'full';
        return;
      }
      return { ...room, players: { ...room.players, p2: { ...player, joinedAt: Date.now(), online: true } } };
    })
  );
  if (!res.committed) throw new Error(reason || 'full');
  saveSlot(code, 'p2');
  return 'p2';
}

// ---- Everything below changes state through a transaction on the room node. ----

// Adds rounds/{n+1} (status "loading") and moves currentRound to it. Earlier rounds are untouched.
function withNewRound(room) {
  const n = (room.currentRound || 0) + 1;
  return {
    ...room,
    status: 'in_round',
    currentRound: n,
    rounds: { ...room.rounds, [n]: { status: 'loading', currentIndex: 0, gap: GAME_CONFIG.startGap } },
  };
}

// Runs fn(round) on rooms/{code}/rounds/{roundNo} inside a room transaction.
// fn returns the new round, or undefined to abort. Never touches an ended room.
function updateRound(code, roundNo, fn) {
  return runTransaction(roomRef(code), (room) => {
    if (room === null) return room;
    if (room.status === 'ended') return;
    const round = room.rounds?.[roundNo];
    if (!round) return;
    const next = fn(round);
    if (next === undefined) return;
    return { ...room, rounds: { ...room.rounds, [roundNo]: next } };
  });
}

// After a round is created: ask for questions, then (if the room is still open) start the clock.
async function writeQuestions(code, room) {
  const { players, currentRound: n, rounds } = room;
  const avoid = Object.entries(rounds || {})
    .filter(([k]) => Number(k) !== n)
    .flatMap(([, r]) => (r?.questions || []).map((x) => x.q));
  const { questions, source } = await fetchQuestions(players, avoid);
  // If the room was ended (or the round abandoned) meanwhile, the guard aborts and the questions are discarded.
  await updateRound(code, n, (round) => {
    if (round.status !== 'loading') return;
    return {
      ...round,
      status: 'playing',
      questions,
      questionSource: source,
      currentIndex: 0,
      gap: GAME_CONFIG.startGap,
      startedAt: serverNow(),
      result: { matches: 0, answered: 0, durationMs: 0 },
    };
  });
}

// Player 1's Start button: only when the room is open and no round exists yet.
export async function startFirstRound(code) {
  let created = false;
  const res = await runTransaction(roomRef(code), (room) => {
    created = false;
    if (room === null) return room;
    if (room.status === 'ended' || !(room.players?.p1 && room.players?.p2)) return;
    if ((room.currentRound || 0) > 0) return;
    created = true;
    return withNewRound(room);
  });
  if (!res.committed || !created) return false;
  await writeQuestions(code, res.snapshot.val());
  return true;
}

// Play again = a rematch request. The next round starts only once both players have asked.
// Returns { ok, outcome }: outcome 'waiting' | 'started', or when !ok a reason 'ended' | 'stale'.
export async function requestRematch(code, roundNo, slot) {
  let outcome = null;
  const res = await runTransaction(roomRef(code), (room) => {
    outcome = null;
    if (room === null) return room;
    if (room.status === 'ended') {
      outcome = 'ended';
      return;
    }
    const round = room.rounds?.[roundNo];
    if ((room.currentRound || 0) !== roundNo || !round || !['won', 'lost'].includes(round.status)) {
      outcome = 'stale';
      return;
    }
    const rematch = { ...round.rematch, [slot]: true };
    // when each player asked, so Player 1 can report how long the first one waited
    const rematchAt = { ...round.rematchAt, [slot]: serverNow() };
    const next = { ...room, rounds: { ...room.rounds, [roundNo]: { ...round, rematch, rematchAt } } };
    if (rematch.p1 && rematch.p2) {
      outcome = 'started';
      return withNewRound(next);
    }
    outcome = 'waiting';
    return next;
  });
  if (!res.committed) return { ok: false, reason: outcome };
  if (outcome === 'started') await writeQuestions(code, res.snapshot.val());
  return { ok: true, outcome };
}

export async function cancelRematch(code, roundNo, slot) {
  const res = await runTransaction(roomRef(code), (room) => {
    if (room === null) return room;
    if (room.status === 'ended' || (room.currentRound || 0) !== roundNo) return;
    const round = room.rounds?.[roundNo];
    if (!round || !['won', 'lost'].includes(round.status)) return;
    const { [slot]: _withdrawn, ...rematchAt } = round.rematchAt || {}; // eslint-disable-line no-unused-vars
    return {
      ...room,
      rounds: { ...room.rounds, [roundNo]: { ...round, rematch: { ...round.rematch, [slot]: false }, rematchAt } },
    };
  });
  return res.committed;
}

// Game-level analytics events must be sent once per round, even if Player 1 refreshes, opens a second tab or
// reconnects. Player 1 "claims" an event with a transaction on the round; only the claim that finds it unclaimed
// returns true, and only that one reports it. kind: 'started' | 'finished' | 'rematchStarted'.
export async function claimEvent(code, roundNo, kind) {
  let first = false;
  const res = await updateRound(code, roundNo, (round) => {
    first = false;
    if (round.reported?.[kind]) return;
    first = true;
    return { ...round, reported: { ...round.reported, [kind]: true } };
  });
  return Boolean(first && res.committed);
}

// Ends the room for both players. Nothing is deleted; every round stays in the database.
// Returns 'ended' (we did it) or 'already' (the partner got there first).
export async function endRoom(code, slot) {
  let outcome = null;
  await runTransaction(roomRef(code), (room) => {
    outcome = null;
    if (room === null) return room;
    if (room.status === 'ended') {
      outcome = 'already';
      return;
    }
    const next = { ...room, status: 'ended', endReason: 'ended', endedBy: slot, endedAt: serverNow() };
    const cur = room.currentRound || 0;
    const round = room.rounds?.[cur];
    if (round && ['loading', 'playing'].includes(round.status)) {
      next.rounds = { ...room.rounds, [cur]: { ...round, status: 'abandoned' } };
    }
    outcome = 'ended';
    return next;
  });
  return outcome;
}

// Writes the answer; whichever transaction sees both answers resolves the question (once).
export function submitAnswer(code, roundNo, slot, choice, index, serverNowMs) {
  return updateRound(code, roundNo, (round) => {
    if (round.status !== 'playing' || (round.currentIndex || 0) !== index) return;
    const current = round.answers?.[index] || {};
    if (current[slot]) return; // final once submitted
    const entry = { ...current, [slot]: choice };
    const next = { ...round, answers: { ...round.answers, [index]: entry } };

    if (entry.p1 && entry.p2 && !entry.resolved) {
      const matched = entry.p1 === entry.p2;
      const { matchMove, mismatchMove, maxGap } = GAME_CONFIG;
      entry.resolved = true;
      entry.matched = matched;
      next.gap = matched ? Math.max(0, round.gap - matchMove) : Math.min(maxGap, round.gap + mismatchMove);
      const result = round.result || { matches: 0, answered: 0 };
      next.result = {
        ...result,
        matches: (result.matches || 0) + (matched ? 1 : 0),
        answered: (result.answered || 0) + 1,
      };
      if (next.gap === 0) return endedRound(next, 'won', serverNowMs);
    }
    return next;
  });
}

// Moves to the next question after the reveal. Safe for both clients to call.
export function advanceQuestion(code, roundNo, index, serverNowMs) {
  return updateRound(code, roundNo, (round) => {
    if (round.status !== 'playing' || (round.currentIndex || 0) !== index) return;
    if (!round.answers?.[index]?.resolved) return;
    if (index + 1 >= round.questions.length) return endedRound(round, 'lost', serverNowMs);
    return { ...round, currentIndex: index + 1 };
  });
}

// Time is up. Guarded so a win can never be overwritten.
export function expireIfTimeUp(code, roundNo, serverNowMs) {
  return updateRound(code, roundNo, (round) => {
    if (round.status !== 'playing' || round.gap === 0) return;
    return endedRound(round, 'lost', serverNowMs);
  });
}

// ---- Leaving before the game starts (waiting / ready screens) ----

// Player 1 closes the room. Returns 'cancelled' | 'already' (ended) | 'started' (use endRoom instead)
// | 'has_partner' (only with onlyIfEmpty). The room is kept, not deleted.
export async function cancelRoom(code, { onlyIfEmpty = false, onCancelled } = {}) {
  let outcome = null;
  let info = null;
  await runTransaction(roomRef(code), (room) => {
    outcome = null;
    info = null;
    if (room === null) return room;
    if (room.status === 'ended') {
      outcome = 'already';
      return;
    }
    if ((room.currentRound || 0) > 0) {
      outcome = 'started';
      return;
    }
    if (onlyIfEmpty && room.players?.p2) {
      outcome = 'has_partner';
      return;
    }
    outcome = 'cancelled';
    info = {
      seconds_waiting: typeof room.createdAt === 'number' ? Math.round((serverNow() - room.createdAt) / 1000) : null,
      partner_had_joined: Boolean(room.players?.p2),
    };
    return { ...room, status: 'ended', endReason: 'cancelled', endedBy: 'p1', endedAt: serverNow() };
  });
  if (outcome === 'cancelled' && info) onCancelled?.(info);
  return outcome;
}

// Player 2 gives up the seat; the room stays open for Player 1.
// Returns 'left' | 'ended' | 'started' | 'not_in'.
export async function leaveRoom(code) {
  let outcome = null;
  await runTransaction(roomRef(code), (room) => {
    outcome = null;
    if (room === null) return room;
    if (room.status === 'ended') {
      outcome = 'ended';
      return;
    }
    if ((room.currentRound || 0) > 0) {
      outcome = 'started';
      return;
    }
    if (!room.players?.p2) {
      outcome = 'not_in';
      return;
    }
    const { p2, ...rest } = room.players; // eslint-disable-line no-unused-vars
    outcome = 'left';
    return { ...room, players: rest };
  });
  return outcome;
}

// Auto-cancel my empty rooms (Player 1, no partner yet) when I join someone else's. Returns the codes closed.
export async function cancelMyEmptyRooms(exceptCode) {
  const closed = [];
  for (const { code, slot } of listSlots()) {
    if (code === exceptCode || slot !== 'p1') continue;
    try {
      const outcome = await cancelRoom(code, {
        onlyIfEmpty: true,
        onCancelled: (info) =>
          track('room_cancelled', { roomId: code, player: 'p1', round: 0, ...info, trigger: 'auto_on_join_other' }),
      });
      if (outcome === 'cancelled') {
        clearSlot(code);
        closed.push(code);
      }
    } catch {
      /* network hiccup: leave it; the resume banner will still offer it */
    }
  }
  return closed;
}

// The first still-open room this device holds a seat in (for the home-screen resume banner).
// Stale entries (gone, ended, or seat removed) are cleaned out of localStorage.
export async function findOpenRoom() {
  let best = null;
  for (const { code, slot } of listSlots()) {
    try {
      const room = (await withTimeout(get(roomRef(code)))).val();
      if (!room || room.status === 'ended' || !room.players?.[slot]) {
        clearSlot(code);
        continue;
      }
      if (!best || (room.createdAt || 0) > (best.room.createdAt || 0)) best = { code, slot, room };
    } catch {
      /* offline: show nothing */
    }
  }
  return best;
}

// Presence writes go through a transaction that refuses to re-create a seat that was given up.
export function setPresence(code, slot, online) {
  return runTransaction(roomRef(code), (room) => {
    if (room === null) return room;
    if (room.status === 'ended' || !room.players?.[slot] || room.players[slot].online === online) return;
    return { ...room, players: { ...room.players, [slot]: { ...room.players[slot], online } } };
  });
}
