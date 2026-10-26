// Catches rephrased repeats ("Airport: three hours early or sprint to gate?" vs
// "Airport arrival: three hours early or last minute sprint?"), which exact-match dedupe misses.

const STOP = new Set([
  'this', 'that', 'with', 'your', 'their', 'what', 'when', 'where', 'which', 'would', 'could', 'should',
  'have', 'from', 'into', 'about', 'after', 'before', 'than', 'then', 'them', 'they', 'over', 'just',
  'more', 'most', 'much', 'only', 'also', 'ever', 'even', 'both', 'each', 'does', 'doing', 'while',
]);

export function tokens(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !STOP.has(w))
  );
}

const overlap = (a, b) => {
  let n = 0;
  for (const w of a) if (b.has(w)) n++;
  return n;
};

// True when two questions are really the same question (shared content words, counting both options).
export function isSimilar(a, b) {
  const ta = tokens(`${a.q} ${a.a ?? ''} ${a.b ?? ''}`);
  const tb = tokens(`${b.q} ${b.a ?? ''} ${b.b ?? ''}`);
  const shared = overlap(ta, tb);
  const smaller = Math.min(ta.size, tb.size);
  return smaller > 0 && shared >= 3 && shared / smaller >= 0.6;
}

// Same test against a list of plain question strings (what `avoid` carries across rounds).
export function similarToAny(item, texts) {
  const ti = tokens(`${item.q} ${item.a ?? ''} ${item.b ?? ''}`);
  const norm = item.q.toLowerCase();
  return texts.some((t) => {
    if (t.toLowerCase() === norm) return true;
    const tt = tokens(t);
    const shared = overlap(ti, tt);
    return shared >= 3 && shared / Math.min(ti.size, tt.size) >= 0.6;
  });
}
