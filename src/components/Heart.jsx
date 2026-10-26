// A custom glossy heart in a rich rose-to-crimson palette (instead of the system emoji,
// which looks different on every device). Inline SVG, so it scales and animates with CSS.
export default function Heart({ size = 44, className = '', label }) {
  return (
    <svg
      className={`heart-svg ${className}`}
      width={size}
      height={size * 0.92}
      viewBox="0 0 64 59"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id="heart-fill" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#ff6b8a" />
          <stop offset=".5" stopColor="#e82a5c" />
          <stop offset="1" stopColor="#a3103f" />
        </linearGradient>
        <radialGradient id="heart-shine" cx=".3" cy=".22" r=".55">
          <stop offset="0" stopColor="#ffd9e2" stopOpacity=".8" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* soft shadow under the heart */}
      <ellipse cx="32" cy="57" rx="11" ry="1.6" fill="#000" opacity=".18" />
      <path
        d="M32 55 C14 42 3 31 3 19.5 C3 10.5 9.8 4 18 4 C23.6 4 28.8 7 32 12 C35.2 7 40.4 4 46 4 C54.2 4 61 10.5 61 19.5 C61 31 50 42 32 55 Z"
        fill="url(#heart-fill)"
      />
      <path
        d="M32 55 C14 42 3 31 3 19.5 C3 10.5 9.8 4 18 4 C23.6 4 28.8 7 32 12 C35.2 7 40.4 4 46 4 C54.2 4 61 10.5 61 19.5 C61 31 50 42 32 55 Z"
        fill="url(#heart-shine)"
      />
      {/* glossy highlight on the left lobe */}
      <path d="M12 17 C12 12.5 15.6 9.6 19.6 9.8" stroke="#fff" strokeOpacity=".85" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="12.4" cy="22.6" r="1.6" fill="#fff" opacity=".7" />
    </svg>
  );
}
