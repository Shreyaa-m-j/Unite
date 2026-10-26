// PostHog analytics. Everything here is a no-op when VITE_POSTHOG_KEY is not set, so the app
// runs fine without it. posthog-js is loaded lazily (after first paint), so it never delays
// the game, and events fired before it finishes loading are queued, not lost.
//
// Who reports what:
//   Game-level events (game_started, game_won, game_lost, rematch_started) are reported by Player 1 only,
//   once per round (see claimEvent in rooms.js). room_ended is reported by whoever ran the ending transaction.
//   Player-level events (question_answered, rematch_requested, ...) are reported by the player who acted.
//
// Privacy: only ids, counts and timings are sent. Never question or answer text. Player names are sent
// only as a PostHog person property, and only in development (see setPlayerName).

const env = import.meta.env;
const KEY = env.VITE_POSTHOG_KEY;
const HOST = env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';

export const analyticsEnabled = Boolean(KEY);

// "development" while running on your machine or local network, "production" once deployed.
// VITE_APP_ENV overrides it (for example "staging" on a Vercel preview).
export const isLocalHost = (h) =>
  h === 'localhost' ||
  h === '0.0.0.0' ||
  h === '[::1]' ||
  h.endsWith('.local') ||
  h.endsWith('.localhost') ||
  // whole private IPv4 addresses only: a hostname that merely starts with "10." or "localhost" is not local
  /^(127(\.\d{1,3}){3}|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/.test(h);
export const appEnv = () => {
  if (env.VITE_APP_ENV) return env.VITE_APP_ENV;
  if (env.DEV) return 'development';
  return typeof window !== 'undefined' && isLocalHost(window.location.hostname) ? 'development' : 'production';
};

// Player names reach PostHog only as the person property `name`, so the Persons list is readable while
// testing. On by default in development; set VITE_POSTHOG_PERSON_NAMES=true to also send them in production.
const personNamesOn = () => appEnv() === 'development' || env.VITE_POSTHOG_PERSON_NAMES === 'true';

let client = null; // the loaded posthog instance
let loading = false;
const queue = [];
let groupedRoom = null;
let pendingName = null;
let sentName = null;

// Every event carries these three fields. Outside a room they are null, so the keys are always present.
const BASE = { roomId: null, round: null, player: null };
let context = {};
export const setContext = (next) => {
  // undefined would overwrite the null defaults and then vanish from the payload, so drop it
  context = Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined));
};
export const clearContext = () => {
  context = {};
};

// Both players of a room are different anonymous browsers, so a normal funnel can never link
// "room created" (one player) to "partner joined" (the other). Tagging every event with its room as a
// PostHog *group* lets funnels aggregate by room instead of by person.
function send(event, payload, options) {
  if (payload.roomId && payload.roomId !== groupedRoom && typeof client.group === 'function') {
    client.group('room', payload.roomId);
    groupedRoom = payload.roomId;
  }
  client.capture(event, payload, options);
}

function applyName() {
  if (client && pendingName && pendingName !== sentName && typeof client.setPersonProperties === 'function') {
    client.setPersonProperties({ name: pendingName });
    sentName = pendingName;
  }
}

export function initAnalytics() {
  if (!KEY || client || loading) return;
  loading = true;
  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(KEY, {
        api_host: HOST,
        autocapture: false, // we send explicit events only, so the funnel stays clean
        capture_pageview: false, // PostHog's own pageview events cannot carry roomId/round/player
        disable_session_recording: true,
        person_profiles: 'identified_only', // anonymous players do not create billable person profiles
        respect_dnt: true,
      });
      posthog.register({ env: appEnv() }); // a super property: attached to every event from now on
      client = posthog;
      applyName();
      queue.splice(0).forEach(([event, props, options]) => send(event, props, options));
    })
    .catch(() => {
      loading = false; // ad blockers and offline: carry on without analytics
    });
}

// track('game_won', { duration_ms: 41000 }). roomId, round and player are filled in from the room the player
// is in; pass them explicitly to override. `at` (a Date) stamps the event with when the action happened.
export function track(event, props = {}, at) {
  if (!KEY) return;
  try {
    const payload = { ...BASE, ...context, ...props };
    const options = at ? { timestamp: at } : undefined;
    if (client) send(event, payload, options);
    else {
      queue.push([event, payload, options]);
      initAnalytics();
    }
  } catch {
    /* analytics must never break the game */
  }
}

// Sets the PostHog person property `name`, so the Persons list shows who is who while testing.
export function setPlayerName(name) {
  if (!KEY || !name || !personNamesOn()) return;
  pendingName = String(name).slice(0, 40);
  applyName(); // if PostHog has not loaded yet, applyName runs again once it has
}
