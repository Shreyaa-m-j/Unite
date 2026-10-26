import { pickFallback } from '../data/fallbackQuestions.js';

const CLIENT_TIMEOUT_MS = 30000; // just above the server's 25s Gemini budget

// Asks /api/questions; if that is unreachable or returns junk, uses the built-in set
// so the game never gets stuck. `avoid` = question texts from earlier rounds.
export async function fetchQuestions(players, avoid = []) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);
  try {
    const pick = (p) => ({ name: p.name, interests: p.interests || [] });
    const res = await fetch('/api/questions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ p1: pick(players.p1), p2: pick(players.p2), avoid }),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    const ok = Array.isArray(data.questions) && data.questions.length >= 15 && data.questions.every((x) => x.q && x.a && x.b);
    if (!ok) throw new Error('bad payload');
    return { questions: data.questions, source: data.source === 'ai' ? 'ai' : 'fallback' };
  } catch {
    return { questions: pickFallback({ p1: players.p1, p2: players.p2, avoid, count: 40 }), source: 'fallback' };
  } finally {
    clearTimeout(timer);
  }
}
