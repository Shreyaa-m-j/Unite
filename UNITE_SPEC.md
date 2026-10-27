# Unite — Build Spec

A real-time, two-player web game for couples who are apart. Both partners see AI-personalized "A or B" questions. When they pick the same option, their mascots step closer; when they differ, they drift apart. Unite before the timer runs out.

This is a portfolio project for a Product Manager application at a couples-experiences app. It has to be **live today**, so favor simple, reliable choices over clever ones.

---

## 1. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React + Vite (JavaScript) | Plain CSS or CSS modules; no heavy UI library |
| Real-time sync | Firebase Realtime Database | Rooms, players, answers, game state |
| AI | Gemini API (current Flash model; check Google AI Studio for the exact model name) | Called **only** from a serverless function, never from the browser |
| Serverless | Vercel function at `/api/questions` | Holds `GEMINI_API_KEY` |
| Hosting | Vercel | Free tier |
| Analytics | PostHog (JS snippet) | Optional but wanted |

Environment variables:
- Client (`.env`, prefixed `VITE_`): Firebase web config values, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`
- Server (Vercel env): `GEMINI_API_KEY`

Add a `.env.example` and make sure `.env` is in `.gitignore`.

---

## 2. User flow

1. **Landing:** title, one-line pitch ("Two hearts, 10 steps apart. Think alike to unite."), and two ways in:
   - a **Create a room** button
   - a **Join with a code** section: a room-code input plus a **Join room** button
2. **Set up (Player 1):** enter your name, pick a mascot, and pick 3–6 interests from chips (Movies, Bollywood, Cricket, Food, Travel, Music, Gaming, Anime, Books, Fitness, Fashion, Pets, Memes, Late-night snacks, **About us**). Then the room is created.
3. **Waiting room:** shows the **room code** in large, easy-to-read letters (with a copy button), the share link, buttons for **Share on WhatsApp** (`https://wa.me/?text=...`, including both the link and the code) and **Copy link**, plus "Waiting for your partner…" with a live indicator. It also has a **← Cancel room** button (top left) and a small hint under the waiting text: *"Partner already made a room? Cancel this one and join theirs."* (see 4c).
4. **Join (Player 2):** there are two ways to join, and both lead to the same join form (name, mascot, interests):
   - **By link:** opens `/room/{roomCode}`, and the room is validated as soon as the page loads.
   - **By code:** types the code on the landing page and taps **Join room**. The code is validated **only after tapping Join room** (no validation while typing). If it's valid, go to `/room/{roomCode}`. If it's invalid, stay on the landing page and show an error under the input (see 4a).
5. **Ready:** both players are shown. When both are in, Player 1 sees **Start**, which requests questions and starts the game. Before the game starts, Player 1 has **Cancel room** and Player 2 has **Leave** (see 4c).
6. **Game:** first a short **clock intro** (section 6a): a big stopwatch showing the full game time with "You have {durationSec} seconds to unite!", which then shrinks into the header timer. After that: the timer, the track with both mascots, the current question with big A/B buttons, a status line ("Waiting for Riya…"), and after both answer a ~1.2s reveal ("You both picked Chai! 💞 +2 closer" or "Different picks 😅 a step apart").
7. **End:**
   - **Won:** the mascots meet, with a celebration animation (hearts/confetti in CSS), questions answered, matches, and time taken.
   - **Lost:** "So close!", with the gap remaining and match rate.
   - Both end screens show three buttons:
     - **Play again:** asks for a rematch. The next round starts only when **both** players have tapped it (earlier rounds are kept; see section 4b).
     - **Share result**
     - **End room & go home:** ends the room for both players (see section 4b).

Player names come from input, so "you" vs "partner" labels are relative to each viewer.

---

## 3. Game rules (keep these in a config object)

```js
export const GAME_CONFIG = {
  startGap: 10,        // steps between the mascots
  matchMove: 2,        // gap shrinks by this on a match (each mascot steps 1)
  mismatchMove: 2,     // gap grows by this on a mismatch (each mascot steps back 1)
  maxGap: 10,          // gap can never exceed this
  durationSec: 60,     // overall game timer
  questionsPerGame: 30,
  revealMs: 1200,      // how long to show the result before the next question
  introMs: 2500,       // clock intro before the countdown starts; does NOT use up game time
  urgentAtSec: 10,     // last N seconds: red pulsing timer
};
```

- Win: gap reaches 0 before the timer ends.
- Lose: the timer ends with gap > 0, or the questions run out.
- No per-question timer; the overall clock creates urgency.
- A player can't change their answer once submitted.
- Show the partner's choice only after both have answered.

What these numbers mean: a match and a mismatch now cancel each other out, so net progress per question is 4 × (agreement rate) − 2 steps. In 60 seconds, at roughly 4–5 seconds per question including the reveal, a couple gets through about 12–15 questions:
- 60% agreement → ~0.4 steps per question → about 25 questions needed → usually **lose**
- 70% agreement → ~0.8 steps per question → about 13 questions needed → **close call**
- 80% agreement → ~1.2 steps per question → about 9 questions needed → **win**

So this is a hard mode: couples need to agree on roughly 7 or more out of 10 questions *and* answer quickly. Since the gap starts at `maxGap`, mismatches before the first match have no effect. Keep all values in this config so they're easy to tune after watching real games.

---

## 4. Data model (Firebase Realtime DB)

```
rooms/{roomId}
  createdAt: serverTimestamp
  status: "lobby" | "in_round" | "ended"  // room-level
  endedBy: "p1" | "p2"          // set when the room is ended
  endReason: "ended" | "cancelled"  // "cancelled" = closed from the waiting/ready screen before any game
  endedAt: serverTimestamp
  currentRound: number          // 0 until the first game starts; then 1, 2, 3…
  players/                      // shared across all rounds
    p1: { name, mascot, interests: [], joinedAt, online: bool }
    p2: { name, mascot, interests: [], joinedAt, online: bool }
  rounds/
    {n}/                        // one entry per game; never overwritten
      status: "loading" | "playing" | "won" | "lost" | "abandoned"
      rematch: { p1: bool, p2: bool }   // who has tapped Play again on this round's result screen
      questions: [ { q, a, b } ]
      questionSource: "ai" | "fallback"
      currentIndex: number
      gap: number
      startedAt: number             // server time when the countdown begins = server time at creation + introMs (a future time)
      endedAt: serverTimestamp
      answers/
        {index}: { p1: "A"|"B", p2: "A"|"B", resolved: bool }
      result: { outcome, matches, answered, matchRate, durationMs, gapRemaining }
```

**Every round is kept.** All game reads and writes go to `rooms/{roomId}/rounds/{currentRound}/…`. Earlier rounds are never modified or deleted, so the data shows how many couples replayed and whether their match rate changed across rounds.

### 4b. Starting a round, Play again, and ending a room

**Core rule: every change to room or round state goes through a transaction on the room node** (`rooms/{roomId}`). That's what makes simultaneous taps safe: Firebase applies one transaction first and re-runs the other against the updated data.

**Starting the first round.** Player 1 taps **Start** in the ready screen. `startNextRound()` runs in a transaction. It only proceeds if the room isn't `ended` and there is no current round yet. It increments `currentRound`, sets room `status: "in_round"`, and creates `rounds/{n}` with `status: "loading"` and `gap: GAME_CONFIG.startGap`.

**Play again = a rematch request; both must agree.** One player tapping Play again must not pull the other into a new game while they're still reading their result.
- Tapping **Play again** runs a transaction that:
  1. aborts if the room is `ended` (the client then shows the "room ended" pop-up below);
  2. aborts if the current round isn't `won` or `lost`;
  3. sets `rounds/{n}/rematch/{mySlot} = true`;
  4. **if both** `rematch.p1` and `rematch.p2` are now true, starts the next round in the same transaction (increment `currentRound`, create `rounds/{n+1}` as above).
- While waiting, the button changes to **"Waiting for {partner}…"** (disabled), with a small **Cancel** link that sets my rematch flag back to false.
- The partner's screen shows a nudge: **"{name} wants a rematch! 🔁"**, with Play again highlighted.
- If the partner is offline (presence), show "{partner} is offline" next to the waiting state.
- After a new round is created, the player whose transaction created it requests questions from `/api/questions` and writes them in. Before writing, check the room isn't `ended`; if it is, discard the questions. Then set `status: "playing"` and `startedAt`.
- Both clients listen to `currentRound` and switch to the new round automatically.
- Players and interests carry over. The AI request includes earlier rounds' questions in `avoid`.

**End room & go home.**
- Tapping it opens a confirm dialog: **"End this room for both of you?"**, with buttons **End room** and **Stay**.
- On confirm, a transaction runs:
  - If the room is **already `ended`**, change nothing (the partner got there first).
  - Otherwise set `status: "ended"`, `endedBy: mySlot`, `endedAt`. If the current round is `loading` or `playing`, set that round's status to `abandoned`.
- Then the ending player clears `unite_{roomId}` from `localStorage` and goes to the home screen, with no pop-up for them.
- **The room's data is not deleted.** Ending only changes the status, so every round stays available for analysis.

**What the other player sees.** Every client listens to the room's `status`. When it becomes `ended` and `endedBy` isn't me:
- Close any open dialog (including my own End-room confirm).
- Show a pop-up: **"{partner} ended the room 👋"** / "Thanks for playing together!", with buttons **Back to home** (primary) and **Start a new room**.
- If the pop-up is ignored, go home automatically after 8 seconds (show a small countdown).
- Clear `unite_{roomId}` from `localStorage`.

**How each situation resolves**

| Situation | What happens |
|---|---|
| A ends the room while B is on the result screen | B gets the "{A} ended the room" pop-up and goes home |
| A ends the room, B taps Play again (any order) | If End lands first, B's Play again transaction aborts because the room is ended, and B sees the pop-up. If B's tap lands first, B just has a rematch request pending (no round starts, since A never agreed); then End lands and B sees the pop-up. B never gets stuck waiting |
| Both tap End room at the same time | The first transaction ends the room. The second sees it's already ended and changes nothing. Both go home; **neither** sees the "partner ended" pop-up, because each chose to leave |
| Both tap Play again at the same time | Both transactions set their own rematch flag. Whichever runs second sees both flags true and creates the next round. Exactly one new round is created, and both switch to it |
| B refreshes or reopens the link after the room ended | Validation finds the room `ended` and shows "This room has ended. Start a new one to play again." with a **Create a room** button |
| A closes the tab without ending the room | The room stays open; B sees "{A} is offline" and can still tap End room |

- `roomId` is the **room code**: 6 characters, uppercase letters and digits, without look-alike characters (no `0/O`, `1/I/L`). Example: `K7MQ4X`. Check for a collision when creating, and regenerate if the code already exists.
- Store which slot (`p1`/`p2`) the device holds in `localStorage` under `unite_{roomId}`, so a refresh puts the player back in place. Wrap it in try/catch.
- A third person opening the link sees "This room is full" plus a button to create their own room.
- Presence: use Firebase `.info/connected` and `onDisconnect()` to set `online: false`. If the partner goes offline mid-game, show a small "Partner disconnected…" banner; don't end the game.

### 4c. Leaving before the game starts (waiting and ready screens)

Typical case: both partners create a room at the same time, and one needs to back out and join the other's code.

**Player 1 cancels the room**
- **← Cancel room** opens a confirm dialog: *"Cancel this room? Your partner won't be able to join it."*, with **Cancel room** and **Keep waiting**. (If no partner has joined yet, skipping the dialog is also fine; keep it short.)
- On confirm, a transaction on the room:
  - aborts if the room is already `ended` (just go home);
  - otherwise sets `status: "ended"`, `endReason: "cancelled"`, `endedBy: "p1"`, `endedAt`.
- Clear `unite_{roomId}` from `localStorage` and go to the home screen, with the **Join with a code** input focused, since joining the partner's room is the most likely next step.
- If Player 2 had already joined, they get the same partner pop-up as in 4b, worded as *"{name} cancelled the room"*.
- **Race with a joining partner:** the join and the cancel are both transactions on the room node. If the join lands first, the cancel still goes through and the new partner sees the pop-up. If the cancel lands first, the join fails with "This room has ended." Nobody gets stuck.

**Player 2 leaves before the game starts**
- **Leave** opens a confirm dialog: *"Leave this room?"*.
- A transaction removes `players/p2`, which frees the slot. The room stays open, so Player 1 can keep waiting, and the same partner (or anyone with the code) can join again.
- Player 2 clears `unite_{roomId}` and goes home.
- Player 1 sees a small toast, *"{name} left the room"*, and goes back to "Waiting for your partner…".
- This transaction aborts if a round has already started; from then on, the in-game End room (4b) applies.

**Leaving without tapping anything (browser Back, closing the tab)**
- The room is **not** cancelled automatically; a refresh or mistap shouldn't kill it.
- On the home screen, if `localStorage` holds a slot for a room that's still open, show a banner: *"You have a room open: K7MQ4X"*, with **Resume** and **Cancel it**.

**Joining someone else's room while my own room is open**
- If I join another room (by code or link) while I'm Player 1 of a room with **no partner yet**, automatically cancel my old room (same transaction as above) and show a toast: *"Closed your empty room K7MQ4X."*
- If my old room already has a partner, don't touch it; just show the resume banner later.

**Validation:** a cancelled room shows *"This room was cancelled. Ask your partner for their code, or create a new room."* (see 4a).

**Data:** cancelled rooms are kept, not deleted, so you can measure how often people create duplicate rooms.

### 4a. Joining by room code: validation

The input should be friendly:
- Accept lowercase and convert to uppercase; trim spaces and remove any dashes or spaces inside the code.
- Max length 6, `autocapitalize="characters"`, `autocomplete="off"`, letter-spaced font. Pressing Enter submits.
- Show the **Join room** button as enabled even when the field is empty; validation happens on click.

When **Join room** is tapped, check in this order and show the first error that applies (inline, under the input, in a soft red style):

| Check | Error message |
|---|---|
| Empty | "Enter the room code your partner shared." |
| Wrong length or characters | "Room codes are 6 letters/numbers, like K7MQ4X." |
| Room doesn't exist in Firebase | "We couldn't find that room. Double-check the code with your partner." |
| Room already has 2 players (and this device isn't one of them) | "This room is already full." plus a **Create your own room** link |
| Room is older than 24 hours | "This room has expired. Ask your partner to create a new one." |
| Room status is `ended` with `endReason: "cancelled"` | "This room was cancelled. Ask your partner for their code, or create a new room." plus a **Create a room** button |
| Room status is `ended` (any other reason) | "This room has ended. Start a new one to play again." plus a **Create a room** button |

- While checking, show a spinner on the button and disable it to prevent double taps.
- If the network fails: "Couldn't connect. Check your internet and try again."
- Clear the error as soon as the user edits the input.
- If this device already holds a slot in that room (from `localStorage`), go straight back to the room instead of showing an error.
- Opening `/room/{code}` directly uses the same checks. On failure, show the error on a simple screen with a **Back to home** button.
- Put the validation in one shared function, `validateRoom(code)`, returning `{ ok, reason }`, so the link and code paths behave the same way.

### Resolving an answer (important)
When a player submits, write their answer inside a **transaction on the current round** (`rooms/{roomId}/rounds/{currentRound}`). In the same transaction, if both answers for `currentIndex` exist and the question isn't resolved yet, update `gap`, check for a win, and advance `currentIndex` (after the reveal; see below). Only the transaction resolves, so a question can't be resolved twice.

Simple reveal approach: the transaction marks `answers/{index}/resolved = true` and sets `gap`. Each client shows the reveal for `revealMs` and then shows the next question. Player 1's client writes `currentIndex + 1` after the reveal, guarded so it only advances from the expected index **in the expected round**.

When a round ends (won or lost), write `result` and `endedAt` into that round. Nothing at the room level other than `currentRound` changes between rounds.

### Timer
The client that creates the round sets `startedAt = serverNow() + GAME_CONFIG.introMs` (server time via `.info/serverTimeOffset`), so the intro never uses up game time. Both clients show the intro until `startedAt`, then count down from `durationSec` using the same offset, so the countdown is identical on both. Before `startedAt` the remaining time is held at the full duration, answers are rejected (buttons disabled and `answer()` guarded), and the timeout check does not run. Player 1's client sets the round's `status: "lost"` when time runs out, and the transaction guards it so a win can't be overwritten.

### Security rules (demo level)
Allow read/write on `rooms/{roomId}` for anyone who knows the ID, and validate basic shapes: answers at `rooms/$roomId/rounds/$round/answers/$index` must be "A" or "B". Note in the README that this is demo-level security. **Whenever `database.rules.json` changes, re-publish it in the Firebase console** (Realtime Database → Rules).

---

## 5. AI question generation

`POST /api/questions` with body `{ p1: { name, interests }, p2: { name, interests }, avoid: [ "question text", … ] }`. `avoid` holds the questions from earlier rounds in this room, so Play again gets fresh ones. Returns `{ questions: [{ q, a, b }], source: "ai" | "fallback" }`.

**The implementation in `api/questions.js` is the source of truth; this section describes it.** The prompt is not a fixed string. It is built per request from a plan, which is what keeps decks on-topic, varied, and different every round.

### How a deck is built

1. **The server deals a plan.** For N slots (30 + 2 spare) it decides, per slot, a **type** and a **topic**:
   - Types and shares: FUNNY 33%, RELATABLE 20%, WHO 17%, DEBATABLE 17%, SWEET 13%. WHO means "who is more likely to…", and its options are the two players' names.
   - **"About us"** is a special interest. Its slots (it gets double airtime) are always WHO questions of the form "Who is more likely to…?" about the two of them as a couple, with the two names as the options, and the fallback deck uses mostly "who" questions when it is picked.
   - Topics: about 65% of slots are one of the couple's own interests (shared interests first, round-robin so each gets airtime). The rest are random everyday-Indian-life settings dealt from a pool of ~36 (train journeys, WhatsApp family groups, wedding season, power cuts, and so on), different on every call.
2. **Two focused calls run in parallel**: one for FUNNY + SWEET slots, one for the rest. Each is about half the size, so it is faster, and the funny questions get the model's full attention.
3. **Each call's prompt lists its numbered slots** ("7. FUNNY (an awkward real-life situation with two ways out) about their interest "Cricket""), and the model fills them in order. The prompt contains **no example questions**: literal examples were being copied back almost verbatim.
4. The response shape is **forced with a JSON schema** (`responseSchema`), and the parser also accepts a bare array or code-fenced JSON. Without this the model often replied with a bare array, every batch counted as zero valid questions, and the game silently served the generic fallback.

### What the prompt asks for

- A good question is easy to guess if you truly know your partner and a coin-flip if you don't. Both options realistic and about equally tempting.
- Grounded, never silly: no superpowers, aliens, time travel, zombies, animals, slapstick or gross-out imagery. Funny means recognisable and slightly embarrassing.
- Interest slots name something specific from that world (a film, player, dish, game, series) rather than the bare word.
- `q` max 10 words, `a`/`b` max 4 words. Shapes: `"<situation>: <choice A> or <choice B>?"`, a scenario ending in `:` with the two reactions only in `a`/`b`, or a short direct question. Never Yes/No or Always/Sometimes options.
- English only (Indian words transliterated), no first person ("I/me/my": both players read the same text), and nothing about body, looks, caste, religion, region, exes, money trouble or explicit content.
- Questions already asked this room are listed ("do not repeat, rephrase, or write a close cousin").

### What the server enforces after the model replies

The prompt is a request; the code is the guarantee. Every question is checked, and dropped if it fails:
- over 12 words, non-Latin script, or hitting the blocklist (exes, religion, politics, explicit, first person);
- **similar** to anything in `avoid` or to another question in the batch. `src/lib/similar.js` compares content words (options included), so a reworded repeat is caught and not just an exact match;
- a WHO slot that is not a "Who…?" question. WHO options are overwritten with the two player names.

Survivors are merged, de-duplicated across the two calls, and put back in plan order so funny questions are spread through the game.

### Failure handling (the game must never get stuck)

- Each call retries on a blip (HTTP 408/429/5xx, dropped connection, thin result) with backoff, inside one 25s budget (14s per attempt). 400/401/403/404 are not retried.
- 20 or more valid AI questions: used as is. 8 to 19: topped up from the fallback bank. Fewer than 8, or no key: the fallback deck.
- The **fallback** (`src/data/fallbackQuestions.js`) is not a generic list: 86 grounded questions tagged by interest, plus "who" questions built from the players' names. A fallback deck is picked to match the couple's interests, skips anything already asked, and has no fantasy hypotheticals. The browser uses the same picker if `/api/questions` is unreachable.
- Set `GEMINI_MODEL` to change model and `GEMINI_THINKING` (`minimal`/`low`/`medium`/`high`) to trade latency for instruction-following. `minimal` is the default; `medium` roughly doubled the wait for no visible gain.
- While generating, show a loading screen with playful text ("Cooking up questions just for you two…").

---

## 6. Screens & design

- **Mobile-first, works on laptop.** Design for a phone screen of 360–430px. On larger screens, center the app in a column with max-width ~480px over a full-bleed background.
- **Mood:** bedtime/night. Deep indigo-to-plum gradient background, a warm accent (peach/pink), soft glowing elements, rounded cards. Original styling only; don't copy any existing app's brand.
- **Mascots:** 4–6 original, simple characters drawn as inline SVG (e.g. a round blob with face and color variants, a little star, a moon, a cloud, a bunny). Not emoji-only, and not existing characters.
- **Track:** a horizontal path with 10 step markers. Mascots move with a CSS transition, and do a little bounce when moving toward each other and a wobble when moving apart. Show "6 steps apart" text for clarity.
- **Buttons:** large A/B buttons (at least 56px tall) that are easy to tap with a thumb. Disable them after answering, with a "Locked in ✓" state.
- **Accessibility:** good contrast, visible focus states, `prefers-reduced-motion` support (turn off bounces and confetti).
- No horizontal scrolling at 360px width.
- Page title "Unite: think alike, come closer", favicon, and Open Graph tags (title, description) so the WhatsApp link preview looks good.

### 6a. Clock intro

**Clock intro** (`ClockIntro.jsx`, `Stopwatch.jsx`)
- Shown on both phones from the moment the round is playable until `startedAt`. A night-sky overlay with a large stopwatch (190px) showing `GAME_CONFIG.durationSec` (never hard-coded) and the text "You have {durationSec} seconds to unite!".
- After about 1.5s (`min(1500, introMs × 0.6)`) the clock shrinks and flies into the **measured** position and size of the header timer (`getBoundingClientRect`, animated with a CSS transform that lands exactly when the countdown starts), the overlay fades out and the game fades in behind it. The header timer is hidden until the clock lands.
- The entry animation uses the `scale` property, not `transform`, so it does not fight the fly transform.
- `prefers-reduced-motion`: no shrink or flight; the clock shows for the same time, then crossfades into the game.
- The header timer is the same stopwatch drawing at 54px. In the last `urgentAtSec` seconds it turns red and pulses gently (pulse off under reduced motion).

**No sound.** The game has no audio, no tick and no mute button. The red pulsing timer is the only urgency cue. The one-screen `/local` game has no intro.

---

## 7. Analytics (PostHog)

Track these events (include `roomId`, `round`, and `player` where relevant):

| Event | Properties |
|---|---|
| `room_created` | interests_count |
| `invite_shared` | method: whatsapp / copy |
| `partner_joined` | seconds_since_room_created, method: link / code |
| `join_failed` | reason: empty / bad_format / not_found / full / expired / network |
| `game_started` | question_source: ai / fallback |
| `question_answered` | index, matched (bool), time_to_answer_ms |
| `game_won` | duration_ms, questions_answered, match_rate |
| `game_lost` | gap_remaining, questions_answered, match_rate |
| `rematch_requested` | round, partner_already_requested (bool) |
| `rematch_cancelled` | round |
| `rematch_started` | new_round, seconds_waited |
| `room_ended` | rounds_played, ended_from: result / other, partner_had_requested_rematch (bool) |
| `room_cancelled` | seconds_waiting, partner_had_joined (bool), trigger: button / auto_on_join_other |
| `partner_left_lobby` | seconds_in_lobby |
| `resume_banner_clicked` | action: resume / cancel |
| `room_ended_by_partner_seen` | rounds_played, action: home / new_room / auto |
| `result_shared` | outcome |

Add a helper `track(event, props)` that does nothing if PostHog isn't configured, so the app works without it.

**How it is built (`src/lib/analytics.js`):**
- With no `VITE_POSTHOG_KEY` the whole module is a no-op, and `posthog-js` is not even in the production bundle. With a key, it loads lazily after first paint as its own chunk, and events fired before it finishes loading are queued, not lost.
- **Every event carries `roomId`, `round` and `player`** (`p1`/`p2`). Inside a room they are filled in automatically; for events fired outside one (a failed join typed on the home screen) they are passed explicitly, with `player: "p2"` (the would-be joiner), `round: 0`, and `roomId` as typed, or `null` if nothing was typed. The keys are never missing. Pageview events are turned off, because PostHog's own pageview event cannot carry these fields.
- **Who reports what.**
  - *Game-level* events (`game_started`, `game_won`, `game_lost`, `rematch_started`) are sent **once per round, by Player 1 only**. Player 1 first "claims" the event with a transaction on the round (`rounds/{n}/reported/{started|finished|rematchStarted}`), and only the claim that finds it unclaimed sends it, so a refresh, a second tab or a reconnect cannot repeat it. Player 2's client never sends them.
  - `room_ended` is sent by whoever ran the ending transaction (never by the player who finds it already ended).
  - *Player-level* events (`question_answered`, `rematch_requested`, `rematch_cancelled`, `invite_shared`, `result_shared`, `join_failed`, `partner_joined`, `partner_left_lobby`, `room_created`, `room_cancelled`, `resume_banner_clicked`, `room_ended_by_partner_seen`) are sent by the player who did the thing. `question_answered` is sent only by the page load in which the player actually tapped, so refreshing after answering cannot repeat it.
- **Environment.** Every event has a super property `env`: `development` when the app runs on `localhost`, a private network address or a `.local` name, and `production` when deployed. Set `VITE_APP_ENV` to override it (for example `staging`). Filter `env = production` in PostHog to leave your own testing out.
- **Person name.** The PostHog person property `name` is set to the player's name so the Persons list is readable while testing. Because names are personal data, this happens **in development only**; set `VITE_POSTHOG_PERSON_NAMES=true` to also send them in production. Names are never attached to events, only to the person.
- **Privacy.** Apart from that opt-in person name, only ids, counts and timings are sent: never question or answer text, interests, or names in events. Autocapture and session recording are off, anonymous players do not create person profiles until a name or group is attached, and Do Not Track is respected.

**Where each event comes from, and the properties added beyond the table:**
- `room_created`: after the room is written. `interests_count` only.
- `invite_shared`: `method` is `whatsapp`, `telegram`, `x`, `sms`, `email`, `copy`, `native` (the system share sheet) or `copy_code`.
- `partner_joined`: sent by the joiner. `method` is `code` (typed on the home screen) or `link` (opened the shared link).
- `join_failed`: `reason` is `empty`, `bad_format`, `not_found`, `full`, `expired`, `network`, or `ended`/`cancelled`; `method` is `code` or `link`.
- `question_answered`: one per player per question, sent once the question resolves (so `matched` is known). `time_to_answer_ms` runs from when the question appeared on that player's screen.
- `game_started`: `question_source` (`ai`/`fallback`), read from the round.
- `game_won` / `game_lost`: `duration_ms`, `questions_answered`, `match_rate` (and `gap_remaining` on a loss).
- `result_shared`: `outcome` (`won`/`lost`) and `method`, as for `invite_shared`.
- `rematch_started`: sent once, by Player 1. `seconds_waited` runs from the first player's rematch tap to the new round (both taps are timestamped in `rounds/{n}/rematchAt`).
- `room_ended`: `ended_from` is `result` (End room on the result screen) or `other` (ended from the home-screen resume banner).
- `room_ended_by_partner_seen`: also carries `cancelled` (true when the partner cancelled before the game).
- `room_cancelled`: `trigger` is `button` (Cancel room, or the resume banner) or `auto_on_join_other`.
- `partner_left_lobby`: sent by the player who left.
- `resume_banner_clicked`: `action` is `resume` or `cancel`.

The funnel to report: room created → invite shared → partner joined → game started → game finished → play again.

**Building it in PostHog.** The two players of a room are different anonymous browsers, so a funnel that counts *people* can never connect "room created" (one player) to "partner joined" (the other). Every event is therefore tagged with its room as a PostHog **group** (`room`). Create the group type under Project settings → Group analytics, then in the funnel set *Aggregating by* to **room**. Suggested steps:
1. `room_created`
2. `invite_shared`
3. `partner_joined`
4. `game_started`
5. `game_won` **or** `game_lost` (add both to the same step)
6. `rematch_started`

If group analytics is not available on your plan, build the same view in Trends with each event as a series, using the math "Unique values of property `roomId`". Question-level detail (`match_rate`, `time_to_answer_ms`, win rate by round) needs no grouping.

---

## 8. Build order (milestones)

Get each milestone working before starting the next.

1. **Scaffold:** Vite + React, routing (`/` and `/room/:roomId`), theme and layout, mascot SVGs, `GAME_CONFIG`.
2. **Local game:** the full game loop with fallback questions and both players simulated on one screen, so the rules, track animation, and end screens can be tested without Firebase.
3. **Rooms + real-time:** Firebase create/join (by link **and** by room code with full validation, section 4a), presence, waiting room, share link, transactions for answers, and the synced timer. Test with two browser windows (one normal, one incognito).
4. **AI questions:** the `/api/questions` Vercel function, the Gemini call, validation, and fallback. Test locally with `vercel dev`.
5. **Polish:** reveal animations, win/lose screens, Play again, share result, OG tags, reduced motion.
6. **Analytics:** PostHog `track` helper and events.
7. **Local testing (before any deploy):** run everything locally and work through the testing checklist in section 9. Also test on real phones on the same Wi-Fi: run `vercel dev --listen 0.0.0.0:3000` (or `npm run dev -- --host` for frontend-only checks) and open the laptop's local IP address on the phones. Fix issues before moving on.
8. **Deploy (only when the developer says testing is done):** push to GitHub, import into Vercel, set environment variables, then repeat a quick test on two real phones using the live URL. **Do not deploy as part of earlier milestones.**

---

## 9. Checklists

### Testing (locally, before deploy)
- [ ] Two people on different phones can create, join, and finish a game
- [ ] Joining **by link** works
- [ ] Joining **by typing the code** works, including lowercase and with spaces (`k7m q4x`)
- [ ] Each invalid-code case shows the right error: empty, wrong format, not found, full, expired
- [ ] Errors appear only after tapping Join room, and clear when the input is edited
- [ ] Refreshing mid-game puts the player back in their slot
- [ ] Play again creates a new `rounds/{n}` entry; earlier rounds stay unchanged in the Firebase Data tab
- [ ] One player tapping Play again shows "Waiting for {partner}…"; the partner sees the rematch nudge; no round starts until both tap
- [ ] Cancel on a pending rematch works
- [ ] Both players tapping Play again at the same time creates only one new round
- [ ] A ends the room while B is on the result screen → B sees the pop-up and goes home (by button and by the 8s auto-redirect)
- [ ] A ends the room right after B taps Play again → B sees the pop-up, isn't stuck waiting
- [ ] Both tap End room together → both go home, no pop-up, room `ended` once in Firebase
- [ ] Rejoining an ended room by link or code shows the "room has ended" message
- [ ] Ending a room keeps all its rounds in Firebase (nothing deleted)
- [ ] Player 1 can cancel from the waiting room, lands on home with the code input focused, and can join the partner's room
- [ ] Joining a cancelled room shows the "room was cancelled" message
- [ ] Player 2 can leave the ready screen; Player 1 sees the toast and is back to waiting; Player 2 can rejoin
- [ ] Cancel and join at the same moment → nobody gets stuck (joiner sees the pop-up or the error)
- [ ] Browser Back from the waiting room → home shows the resume banner; Resume and Cancel it both work
- [ ] Both create rooms, then A joins B's code → A's empty room is auto-cancelled with a toast
- [ ] Round 2 questions are different from round 1
- [ ] AI questions reflect chosen interests and include clearly funny ones (~30%)
- [ ] The fallback works when the API key is missing, and also includes funny questions
- [ ] The intro number equals `durationSec` (set it to 90 and check both the clock and the text change)
- [ ] The big clock lands exactly on the header timer on a phone and a laptop
- [ ] Both phones start the countdown together, and the intro does not use up game time (the header shows the full duration when the intro ends)
- [ ] Answers cannot be tapped during the intro
- [ ] The timer turns red and pulses in the last 10 seconds
- [ ] With reduced motion on, the clock crossfades with no flight
- [ ] Looks good at 360px and on a laptop
- [ ] PostHog events show up in the dashboard

### Deploy (later)
- [ ] No API key visible in the browser bundle
- [ ] Environment variables set in Vercel
- [ ] Live URL tested on two real phones (Android and iPhone if possible)
- [ ] WhatsApp link preview shows the title and description
- [ ] README: what it is, the hypothesis, how to run it locally, environment variables, deploy steps

---

## 10. Later: "Guess the ___"

Keep room, player, and interests code generic (e.g. `room.game = "unite"`) so a second game can reuse the lobby. The AI picks a person/movie/show/item/character from the players' interests and generates the answer, accepted aliases, and 5 clues from vague to obvious in **one** call per round. The first correct guess wins the round, resolved with a transaction.
