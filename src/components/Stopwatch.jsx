// An original stopwatch: crown, side button, a glowing peach-to-pink ring, a dark face with tick marks and
// the number in the middle. The big intro clock and the small header timer are the same drawing at two
// sizes, so when the big one shrinks into the header it reads as one object.
const TICKS = Array.from({ length: 12 }, (_, i) => {
  const a = (i * Math.PI) / 6;
  const long = i % 3 === 0;
  const r1 = long ? 29 : 31.5;
  return {
    x1: 50 + r1 * Math.sin(a), y1: 64 - r1 * Math.cos(a),
    x2: 50 + 35 * Math.sin(a), y2: 64 - 35 * Math.cos(a),
    long,
  };
});

export default function Stopwatch({ value, size = 56, urgent = false, className = '', innerRef, label }) {
  const w = size;
  const h = size * 1.12;
  return (
    <div
      ref={innerRef}
      className={`stopwatch ${urgent ? 'urgent' : ''} ${className}`}
      style={{ width: w, height: h }}
      role="timer"
      aria-label={label || `${value} seconds`}
    >
      <svg viewBox="0 0 100 112" width={w} height={h} aria-hidden="true">
        <defs>
          <linearGradient id="sw-ring" x1="0.1" y1="0" x2="0.9" y2="1">
            <stop offset="0" stopColor="#ffb199" />
            <stop offset=".55" stopColor="#ff7eb3" />
            <stop offset="1" stopColor="#e8458f" />
          </linearGradient>
          <radialGradient id="sw-face" cx=".4" cy=".32" r=".85">
            <stop offset="0" stopColor="#4a2a78" />
            <stop offset="1" stopColor="#1f1040" />
          </radialGradient>
        </defs>
        <rect x="41" y="1" width="18" height="9" rx="3" fill="#ffd2c2" />
        <rect x="46" y="9" width="8" height="10" fill="#ffb199" />
        <rect x="77" y="14" width="10" height="7" rx="2" fill="#ffb199" transform="rotate(42 82 17.5)" />
        <circle cx="50" cy="64" r="44" fill="url(#sw-ring)" />
        <circle className="sw-urgent" cx="50" cy="64" r="44" fill="#ff2d55" opacity="0" />
        <path d="M17 50 A38 38 0 0 1 40 28" stroke="#fff" strokeOpacity=".55" strokeWidth="3" strokeLinecap="round" fill="none" />
        <circle cx="50" cy="64" r="37.5" fill="url(#sw-face)" />
        {TICKS.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#fff4ef" strokeOpacity={t.long ? 0.8 : 0.4} strokeWidth={t.long ? 2 : 1.4} strokeLinecap="round" />
        ))}
      </svg>
      <span className="sw-num" style={{ fontSize: size * (String(value).length > 2 ? 0.27 : 0.34) }}>{value}</span>
    </div>
  );
}
