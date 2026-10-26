// Vercel serverless function: POST /api/questions
// The only place GEMINI_API_KEY is used. Any failure returns a fallback deck, so the game never gets stuck.
import { GAME_CONFIG, ABOUT_US } from '../src/config.js';
import { pickFallback } from '../src/data/fallbackQuestions.js';
import { isSimilar, similarToAny } from '../src/lib/similar.js';

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
const TIMEOUT_MS = 25000; // whole-request budget, shared across attempts
const ATTEMPT_MS = 14000; // one stuck call must not eat the whole budget
const MAX_ATTEMPTS = 3;
const MIN_ATTEMPT_MS = 4500; // don't start another call without room to finish it
const BACKOFF_MS = 500;
const OVERASK = 2; // ask for a couple extra so the filters below have slack
const GOOD_ENOUGH = 20; // a deck this size never runs dry inside one round, so don't pad it
const MIN_AI = 8; // below this the AI batch is not worth keeping
const MAX_WORDS = 12; // the prompt asks for 10; allow a little slack before dropping one
const LATIN = /^[\x20-\x7E -ɏ‐-‟…]+$/; // Latin, digits and common punctuation only
// Google returns these when it is overloaded or rate-limiting; they usually clear on a retry.
const TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The prompt forbids these, but small models slip, so they are also enforced in code.
// Exes, religion and politics, explicit content, and first person ("my", "me"): both players read
// the same text, so "which outfit of mine" makes no sense.
const BLOCKED = new RegExp(
  [
    '\\bex\\b', "\\bex's\\b", '\\bexes\\b', '\\bex-\\w+', 'ex(?:-)?(?:girl|boy)friend', 'former (?:lover|flame)',
    'prayer', 'namaz', 'azaan', 'puja', 'pooja', 'aarti', 'bhajan', 'mosque', 'church', 'gurdwara', 'religio', 'god\\b', 'bible', 'quran',
    'politic', 'election', 'minister', '\\bvote\\b', 'modi', 'bjp', 'congress', 'trump', 'hindu', 'muslim', 'christian', 'sikh', 'caste',
    '\\bsex', 'nude', 'naked', 'porn', 'stripper', 'condom',
    "\\b(?:my|mine|me|myself|i'm|i've|i'll)\\b",
  ].join('|'),
  'i'
);

const clean = (v, max) => String(v ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, max);

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ---------------------------------------------------------------------------------------------
// The plan. Instead of asking the model for "a mix" and hoping, the server decides, per question,
// what TYPE it is and what TOPIC it is about, and the model just fills in the numbered slots.
// That is what keeps the deck on the couple's interests, varied, and different every round.
// ---------------------------------------------------------------------------------------------

// Everyday desi-life settings. A random handful is dealt out each call, so two rounds never
// get the same themes even with identical players.
const LIFE_TOPICS = [
  'train and flight journeys', 'family WhatsApp groups', 'wedding season', 'monsoon and rain plans',
  'power cuts and Wi-Fi trouble', 'food delivery apps', 'flat-hunting and roommates', 'working from home',
  'visiting relatives', 'cab and auto rides', 'festival shopping', 'road trips', 'college nostalgia',
  'in-laws and parents visiting', 'streaming queue arguments', 'grocery and quick-commerce apps',
  'birthdays and gifting', 'cooking at home', 'long-distance habits', 'weekend plans', 'morning routines',
  'late-night habits', 'neighbours and society life', 'phone habits', 'savings and splurges', 'festivals and fireworks',
  'tea-time rituals', 'photo taking and social media', 'sleep habits', 'office gossip', 'shopping malls',
  'planning surprises', 'texting style', 'old-school vs modern tastes', 'small superstitions', 'holiday planning',
];

// type -> share of the deck, and what the model is told it means
const TYPES = {
  FUNNY: {
    share: 0.33,
    brief:
      'a small, believable social mini-disaster with a real comic dilemma: someone caught out, running late, family watching, a white lie that might unravel, an awkward reveal. It should be something that could genuinely happen this week, and there must be a funny tension between the two ways out of it. Punchy and a little teasing.',
  },
  WHO: {
    share: 0.17,
    brief:
      'a "Who is more likely to…?" question about the two players as people or as a couple. The two options must be exactly the two players\' names. Specific, funny or revealing habits, never mean.',
  },
  RELATABLE: {
    share: 0.2,
    brief: 'an everyday habit that quietly reveals personality, where each option is something a real person would do.',
  },
  DEBATABLE: {
    share: 0.17,
    brief: 'a genuine taste split where both sides have real fans, so you must know your partner to call it.',
  },
  SWEET: {
    share: 0.13,
    brief: 'warm and specific, a little romantic, never cheesy.',
  },
};

// shown on each numbered line, so the instruction sits right next to the slot it applies to
const SLOT_HINT = {
  FUNNY: 'an awkward real-life situation with two ways out',
  WHO: 'options are exactly the two names',
  RELATABLE: 'a revealing everyday habit',
  DEBATABLE: 'a real taste split',
  SWEET: 'romantic and specific',
};

function buildPlan(p1, p2, n) {
  // type counts, rounded so they always add up to n
  const names = Object.keys(TYPES);
  const counts = Object.fromEntries(names.map((t) => [t, Math.round(n * TYPES[t].share)]));
  let diff = n - Object.values(counts).reduce((a, b) => a + b, 0);
  for (let i = 0; diff !== 0; i = (i + 1) % names.length) {
    counts[names[i]] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
  }
  const types = shuffle(names.flatMap((t) => Array(counts[t]).fill(t)));

  // interests both picked first, then each player's own, so shared taste gets the most airtime
  const both = p1.interests.filter((i) => p2.interests.includes(i));
  const solo = [
    ...p1.interests.filter((i) => !p2.interests.includes(i)),
    ...p2.interests.filter((i) => !p1.interests.includes(i)),
  ];
  let interests = [...both, ...solo];
  // "About us" gets double airtime when chosen: it is the couple-specific category
  if (interests.includes(ABOUT_US)) interests = [...interests, ABOUT_US];
  const interestSlots = interests.length ? Math.round(n * 0.65) : 0;
  const topics = [];
  for (let i = 0; i < interestSlots; i++) topics.push({ kind: 'interest', text: interests[i % interests.length] });
  const life = shuffle(LIFE_TOPICS);
  for (let i = topics.length; i < n; i++) topics.push({ kind: 'life', text: life[i % life.length] });

  // "About us" slots are always "Who is more likely to…" questions; the type is forced, whatever was dealt
  const slots = shuffle(topics).map((topic, i) => ({
    n: i + 1,
    type: topic.kind === 'interest' && topic.text === ABOUT_US ? 'WHO' : types[i],
    topic,
  }));
  return { slots, interests, both };
}

function buildPrompt(p1, p2, avoid, plan) {
  const { both } = plan;
  // numbered 1..k inside this batch; the caller maps answers back to the full deck by position
  const slots = plan.slots.map((s, i) => ({ ...s, n: i + 1 }));
  const present = new Set(slots.map((s) => s.type));
  const recent = avoid.slice(-60);
  const avoidBlock = recent.length
    ? `\nALREADY ASKED in earlier rounds. Do not repeat, rephrase, or write a close cousin of any of these:\n${recent.map((q) => `- ${q}`).join('\n')}\n`
    : '';
  const lines = slots
    .map((s) => {
      const what =
        s.topic.text === ABOUT_US
          ? 'the two of them as a couple (habits, quirks, small moments). Start the question with exactly "Who is more likely to"'
          : s.topic.kind === 'interest'
            ? `their interest "${s.topic.text}"`
            : `the setting "${s.topic.text}"`;
      return `${s.n}. ${s.type} (${SLOT_HINT[s.type]}) about ${what}`;
    })
    .join('\n');

  return `You write questions for "Unite", a game for a romantic couple in India who are apart.
Both partners see the same "this or that" question at the same moment and answer privately.
They only score when they pick the SAME option, so every question tests how well they know each other.

Player 1 is ${p1.name}. They like: ${p1.interests.join(', ') || 'a bit of everything'}.
Player 2 is ${p2.name}. They like: ${p2.interests.join(', ') || 'a bit of everything'}.
${both.length ? `They both like: ${both.join(', ')}.\n` : ''}
Write exactly ${slots.length} questions, one per numbered line below, IN THIS ORDER. Each line fixes the
question's type and what it must be about.

${lines}

TYPES
${Object.entries(TYPES)
  .filter(([name]) => present.has(name))
  .map(([name, t]) => `- ${name}: ${t.brief}`)
  .join('\n')}

HOW TO WRITE THEM
- When a line names an interest, make the question clearly about it and be specific: name a real film,
  player, dish, game, series, genre, place or habit from that world instead of the bare word. A reader
  should instantly see which interest it came from.
- When a line names a setting, ground it in everyday Indian life.
- A good question is easy to guess if you truly know your partner and a coin-flip if you don't.
  Both options must be realistic and about equally tempting. Never a joke answer, never an obvious winner.
- Specific beats generic. Avoid stock pairs like tea or coffee, dogs or cats, beach or mountains.
- Funny means recognisable and slightly embarrassing, not random. No made-up fantasy: no superpowers,
  aliens, time travel, zombies, or being an animal. No slapstick or gross-out imagery (licking things,
  crying dramatically, "dying inside"). Both options must be things a real person would genuinely do,
  and the comedy should come from how recognisable and awkward the moment is.
- Every question must be different in setting, wording and shape. Do not open two questions the same way,
  except the "Who is more likely to…" ones, which must all differ in what they are about.
- Be original. Do not reuse well-known viral prompts.

FORMAT
- "q" is the question: at most 10 words. "a" and "b" are the options: at most 4 words each.
  LENGTH IS A HARD LIMIT. Count the words in "q"; more than 10 is rejected. Short and punchy keeps the
  game fast: aim for 6 to 9 words.
- Every question must be a complete dilemma a person can answer, never a topic or a noun phrase.
  Three shapes are fine, so vary them:
    "<situation>: <one choice> or <the other>?"   (the question names both choices)
    "<situation>:"                                 (a scenario; the two reactions live only in "a" and "b")
    a short direct question ("Who ...?", "Which ...?")
- The two options are two different concrete picks or actions. Never Yes/No, Always/Sometimes,
  Love it/Hate it, or "do it / don't do it" in disguise.
- English only. Transliterate Indian words (biryani, tapri, chaat); never use Devanagari or any other script.

NEVER
- Jokes about body, looks, weight, gender, caste, religion, region, or a family member's worth.
- Anything explicit, political, religious (prayer, temples, gods), or about money trouble, serious
  fights, or exes. Not even mentioned in passing.
- First person ("I", "me", "my", "mine"). Both players read the same text, so write "you" or "our".
${avoidBlock}
Return a JSON object {"questions":[{"q":"...","a":"...","b":"..."}]} with exactly ${slots.length} entries.`;
}

// Forces the response shape. Without this, the model often returns a bare array and the whole batch used to be thrown away.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { q: { type: 'STRING' }, a: { type: 'STRING' }, b: { type: 'STRING' } },
        required: ['q', 'a', 'b'],
        propertyOrdering: ['q', 'a', 'b'],
      },
    },
  },
  required: ['questions'],
};

// Accept every shape the model might send: {"questions":[…]}, a bare array, or code-fenced JSON.
function extractQuestions(text) {
  const json = JSON.parse(String(text).trim().replace(/^```(?:json)?\s*|\s*```$/g, ''));
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.questions)) return json.questions;
  return Object.values(json ?? {}).find(Array.isArray) ?? [];
}

// Keep only well-formed questions that are distinct from earlier rounds and from each other.
function validate(raw, avoid, slots = [], names = []) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const [idx, item] of raw.entries()) {
    const slot = slots[idx];
    let q = clean(item?.q ?? item?.question, 120);
    let a = clean(item?.a ?? item?.option_a, 40);
    let b = clean(item?.b ?? item?.option_b, 40);
    if (!q || !a || !b || a.toLowerCase() === b.toLowerCase()) continue;
    if (!/[?:]$/.test(q)) q = `${q.replace(/[.!…]+$/, '')}?`; // every question ends in ? or :
    if (slot?.type === 'WHO') {
      // a "who" question's options are always the two players, whatever the model wrote
      if (!/^who(se)?\b/i.test(q) || names.length < 2) continue;
      [a, b] = names;
    }
    if (q.split(/\s+/).length > MAX_WORDS) continue; // long questions kill the pace
    if (![q, a, b].every((t) => LATIN.test(t))) continue; // models occasionally emit stray CJK/Devanagari
    if (BLOCKED.test(`${q} ${a} ${b}`)) continue;
    const candidate = { q, a, b };
    if (similarToAny(candidate, avoid)) continue; // asked in an earlier round, even if reworded
    if (out.some((o) => isSimilar(o, candidate))) continue; // near-duplicate inside this batch
    out.push({ ...candidate, slot: slot?.n ?? 999 });
  }
  return out;
}

// Lowest thinking setting for this model family: Gemini 2.5 takes a token budget (0 = off),
// Gemini 3+ takes a level.
function thinkingConfig(model) {
  if (/gemini-2\.5/.test(model)) return { thinkingBudget: model.includes('pro') ? 128 : 0 };
  // GEMINI_THINKING (minimal | low | medium | high) trades latency for better instruction-following
  return { thinkingLevel: process.env.GEMINI_THINKING || (model.includes('pro') ? 'low' : 'minimal') };
}

async function askGemini(prompt, budgetMs) {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), budgetMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          temperature: 1,
          thinkingConfig: thinkingConfig(MODEL),
        },
      }),
    });
    if (!res.ok) {
      const err = new Error(`Gemini ${res.status}`);
      err.status = res.status;
      err.transient = TRANSIENT_STATUS.has(res.status);
      err.retryAfterMs = Number(res.headers.get('retry-after')) * 1000 || 0;
      throw err;
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
    return extractQuestions(text);
  } finally {
    clearTimeout(timer);
    console.log(`questions: Gemini (${MODEL}) call took ${Date.now() - started}ms`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'POST only' });
  }

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const player = (p) => ({
    name: clean(p?.name, 16) || 'Player',
    interests: [...new Set((Array.isArray(p?.interests) ? p.interests : []).slice(0, 8).map((i) => clean(i, 30)).filter(Boolean))],
  });
  const p1 = player(body.p1);
  const p2 = player(body.p2);
  const avoid = (Array.isArray(body.avoid) ? body.avoid : []).slice(0, 120).map((q) => clean(q, 120)).filter(Boolean);
  const want = GAME_CONFIG.questionsPerGame;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(200).json({ questions: pickFallback({ p1, p2, avoid, count: want + 10 }), source: 'fallback' });
  }

  const deadline = Date.now() + TIMEOUT_MS;
  const plan = buildPlan(p1, p2, want + OVERASK);

  // Two focused calls in parallel instead of one call juggling five question types: the funny
  // questions get the model's full attention, and each call is about half the size, so it is faster.
  const FUNNY_SIDE = new Set(['FUNNY', 'SWEET']);
  const groups = [
    plan.slots.filter((s) => FUNNY_SIDE.has(s.type)),
    plan.slots.filter((s) => !FUNNY_SIDE.has(s.type)),
  ].filter((g) => g.length);

  // One batch: retries on a blip (503/429/5xx, dropped connection) or a thin result, inside the shared budget.
  async function runBatch(slots) {
    let best = [];
    let reason = 'no attempt made';
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const left = deadline - Date.now();
      if (left < MIN_ATTEMPT_MS) break;
      let wait = BACKOFF_MS * attempt;
      try {
        const raw = await askGemini(buildPrompt(p1, p2, avoid, { slots, both: plan.both }), Math.min(left, ATTEMPT_MS));
        const batch = validate(raw, avoid, slots, [p1.name, p2.name]);
        if (batch.length > best.length) best = batch;
        // retrying costs seconds of loading, so only do it when the batch is badly thin;
        // a slightly short deck is topped up from the fallback bank instead
        if (best.length >= Math.ceil(slots.length * 0.5)) break;
        reason = `only ${batch.length}/${slots.length} valid`;
      } catch (err) {
        reason = err.message;
        // 400/401/403/404 are our mistake, not a blip; stop retrying
        if (err.status !== undefined && !err.transient) break;
        if (err.retryAfterMs) wait = err.retryAfterMs;
      }
      const room = deadline - Date.now() - MIN_ATTEMPT_MS;
      if (attempt === MAX_ATTEMPTS || room <= 0) break;
      wait = Math.min(wait, room);
      console.warn(`questions: batch attempt ${attempt} failed (${reason}), retrying in ${wait}ms`);
      await sleep(wait);
    }
    return { questions: best, reason };
  }

  const results = await Promise.all(groups.map(runBatch));
  const reason = results.map((r) => r.reason).join(' | ');

  // merge, drop near-duplicates across the two batches, and restore the planned order so the funny
  // ones are spread through the game instead of bunched together
  const questions = [];
  for (const item of results.flatMap((r) => r.questions).sort((x, y) => x.slot - y.slot)) {
    if (!questions.some((q) => isSimilar(q, item))) questions.push({ q: item.q, a: item.a, b: item.b });
  }

  if (questions.length >= GOOD_ENOUGH) {
    console.log(`questions: ok, ${questions.length} AI questions`);
    return res.status(200).json({ questions: questions.slice(0, want), source: 'ai' });
  }
  // Short on AI questions: top up with ones that fit this couple, never a generic deck.
  if (questions.length >= MIN_AI) {
    const extra = pickFallback({ p1, p2, avoid: [...avoid, ...questions.map((q) => q.q)], count: want - questions.length });
    console.warn(`questions: ${questions.length} AI + ${extra.length} fallback (${reason})`);
    return res.status(200).json({ questions: shuffle([...questions, ...extra]).slice(0, want), source: 'ai' });
  }
  console.error('questions: falling back:', reason);
  return res.status(200).json({ questions: pickFallback({ p1, p2, avoid, count: want + 10 }), source: 'fallback' });
}
