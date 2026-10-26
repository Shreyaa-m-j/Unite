// Six original full-body characters (3 women, 3 men) drawn as inline SVG in a cute 3D-cartoon style:
// a large expressive head over a compact torso and legs, layered shaded hair and glossy eyes.
// No names: players type their own name and pick a look. `id` is what gets stored in the room data.
export const MASCOTS = [
  { id: 'g1', label: 'Woman, long wavy hair, pink blouse', group: 'girl' },
  { id: 'g2', label: 'Woman, high ponytail, blue bodycon dress', group: 'girl' },
  { id: 'g3', label: 'Woman, neat bob, green dress', group: 'girl' },
  { id: 'b1', label: 'Man, side-parted hair, blue shirt', group: 'boy' },
  { id: 'b2', label: 'Man, textured fringe, burgundy sweater', group: 'boy' },
  { id: 'b3', label: 'Man, glasses, amber bomber jacket', group: 'boy' },
];

const INK = '#2b1d2e';
// The head is drawn in its own coordinates and scaled up about the collar, so the body stays compact.
// The head fills y 3–58 of the 160-tall canvas, so the figure is about two and a half heads tall.
const HS = 'translate(-20 0.6) scale(1.4)';

const Defs = () => (
  <defs>
    <linearGradient id="u-h" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#fff" stopOpacity=".26" />
      <stop offset=".5" stopColor="#fff" stopOpacity="0" />
      <stop offset="1" stopColor="#000" stopOpacity=".26" />
    </linearGradient>
    <linearGradient id="u-v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fff" stopOpacity=".22" />
      <stop offset=".45" stopColor="#fff" stopOpacity="0" />
      <stop offset="1" stopColor="#000" stopOpacity=".28" />
    </linearGradient>
    <radialGradient id="u-blush">
      <stop offset="0" stopColor="#ff6f86" stopOpacity=".55" />
      <stop offset="1" stopColor="#ff6f86" stopOpacity="0" />
    </radialGradient>
    <radialGradient id="u-sclera" cx=".5" cy=".6" r=".7">
      <stop offset="0" stopColor="#fff" />
      <stop offset="1" stopColor="#dfe2ea" />
    </radialGradient>
    <radialGradient id="u-ring" cx=".5" cy=".5" r=".5">
      <stop offset=".55" stopColor="#000" stopOpacity="0" />
      <stop offset="1" stopColor="#000" stopOpacity=".34" />
    </radialGradient>
  </defs>
);

const Mirror = ({ children }) => <g transform="translate(100 0) scale(-1 1)">{children}</g>;
// path + horizontal/vertical light-and-shadow overlay
const Shaded = ({ d, fill, dir = 'h', op = 1 }) => (
  <>
    <path d={d} fill={fill} />
    <path d={d} fill={`url(#u-${dir})`} opacity={op} />
  </>
);
// A tapered limb segment from p1 (width w1) to p2 (width w2) with round ends, a highlight and a shadow edge.
function Seg({ p1, w1, p2, w2, fill, hi = 0.22, sh = 0.18 }) {
  const [x1, y1] = p1;
  const [x2, y2] = p2;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  let nx = -(y2 - y1) / len;
  let ny = (x2 - x1) / len;
  if (nx > 0) { nx = -nx; ny = -ny; } // normal points to the lit (left) side
  const poly = (k, off) => {
    const f = (x, y, w, o) => `${x + nx * (w * k / 2 + o)},${y + ny * (w * k / 2 + o)}`;
    const g = (x, y, w, o) => `${x - nx * (w * k / 2 - o)},${y - ny * (w * k / 2 - o)}`;
    return `${f(x1, y1, w1, off)} ${f(x2, y2, w2, off)} ${g(x2, y2, w2, off)} ${g(x1, y1, w1, off)}`;
  };
  return (
    <g>
      <polygon points={poly(1, 0)} fill={fill} />
      <circle cx={x1} cy={y1} r={w1 / 2} fill={fill} />
      <circle cx={x2} cy={y2} r={w2 / 2} fill={fill} />
      <polygon points={poly(0.3, -w1 * 0.18)} fill="#fff" fillOpacity={hi} />
      <polygon points={poly(0.32, (w1 + w2) * 0.2)} fill="#000" fillOpacity={sh} />
    </g>
  );
}

function skinGradient(id, [light, base, dark]) {
  return (
    <radialGradient id={`${id}-skin`} cx=".4" cy=".3" r=".85">
      <stop offset="0" stopColor={light} />
      <stop offset=".55" stopColor={base} />
      <stop offset="1" stopColor={dark} />
    </radialGradient>
  );
}

// Small rounded hand with a thumb; short so it stays cute at the end of a short arm.
function Hand({ id, x, y, rot = 0, flip = false, s = 1 }) {
  const skin = `url(#${id}-skin)`;
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -s : s} ${s})`}>
      <path d="M-3 -1.8 C-4 1.2 -3.8 4.8 -2.2 6.4 C-.6 7.8 2.2 7.4 3 5.4 C3.7 3 3.5 .2 2.9 -1.8 Z" fill={skin} />
      <path d="M-3.3 .2 C-5.2 1.2 -5 4 -3.4 4.8 C-3.1 3.2 -3.1 1.6 -2.9 .4 Z" fill={skin} />
      <path d="M-.8 3 L-.9 6.6 M1.1 2.8 L1 6.4" stroke="#000" strokeOpacity=".18" strokeWidth=".5" strokeLinecap="round" />
    </g>
  );
}

// Face centred at x=50, eyes at y≈26.5. Ears, neck, face, eyes, brows, nose, blush, lips.
function Head({ id, iris, brow, lip = '#d4687a', boy = false }) {
  const skin = `url(#${id}-skin)`;
  const face = boy
    ? 'M36.3 24 C36.3 1.4 63.7 1.4 63.7 24 C63.7 32.8 61.4 37.9 57.4 40.1 C54 41.9 46 41.9 42.6 40.1 C38.6 37.9 36.3 32.8 36.3 24 Z'
    : 'M36.5 24 C36.5 1.4 63.5 1.4 63.5 24 C63.5 33.6 58.6 40.6 50 41.2 C41.4 40.6 36.5 33.6 36.5 24 Z';
  // Almond eye: sclera, big iris clipped by the lids, pupil, catchlights, upper lid line and a lash flick.
  const k = boy ? 0.92 : 1;
  const eye = (cx, dir) => {
    const shape = `M${cx - 4.5 * k} 26.5 C${cx - 3.6 * k} ${26.5 - 5.5 * k} ${cx + 3.6 * k} ${26.5 - 5.5 * k} ${cx + 4.5 * k} 26.5 C${cx + 3.6 * k} ${26.5 + 4.1 * k} ${cx - 3.6 * k} ${26.5 + 4.1 * k} ${cx - 4.5 * k} 26.5 Z`;
    const clip = `eye-${id}-${dir > 0 ? 'r' : 'l'}`;
    return (
      <g key={cx}>
        <clipPath id={clip}><path d={shape} /></clipPath>
        <path d={shape} fill="url(#u-sclera)" />
        <g clipPath={`url(#${clip})`}>
          <ellipse cx={cx} cy="26.6" rx={3.7 * k} ry={4.1 * k} fill={iris} />
          <ellipse cx={cx} cy="26.6" rx={3.7 * k} ry={4.1 * k} fill="url(#u-ring)" />
          <path d={`M${cx - 3.1 * k} 27.6 Q${cx} ${26.6 + 4.6 * k} ${cx + 3.1 * k} 27.6`} stroke="#fff" strokeOpacity=".3" strokeWidth="1" fill="none" />
          <ellipse cx={cx} cy="26.6" rx={1.6 * k} ry={2 * k} fill={INK} />
          <path d={`M${cx - 5.2} 20.6 L${cx + 5.2} 20.6 L${cx + 5.2} ${26.5 - 2.3 * k} Q${cx} ${26.5 - 3.7 * k} ${cx - 5.2} ${26.5 - 2.3 * k} Z`} fill="#000" opacity=".25" />
        </g>
        <circle cx={cx + 1.4 * k} cy={26.6 - 1.8 * k} r={1.2 * k} fill="#fff" />
        <circle cx={cx - 1.2 * k} cy={26.6 + 1.6 * k} r={0.58 * k} fill="#fff" opacity=".85" />
        <path d={`M${cx - 4.5 * k} 26.5 C${cx - 3.6 * k} ${26.5 - 5.5 * k} ${cx + 3.6 * k} ${26.5 - 5.5 * k} ${cx + 4.5 * k} 26.5`} stroke={INK} strokeWidth={boy ? 1.15 : 1.3} fill="none" strokeLinecap="round" />
        {!boy && <path d={`M${cx + dir * 4.4} 26.1 L${cx + dir * 5.7} 24.6`} stroke={INK} strokeWidth="1" strokeLinecap="round" />}
      </g>
    );
  };
  return (
    <g>
      <ellipse cx="36.4" cy="27.2" rx="2.4" ry="3.5" fill={skin} />
      <ellipse cx="63.6" cy="27.2" rx="2.4" ry="3.5" fill={skin} />
      <path d={face} fill={skin} />
      <path d={face} fill="url(#u-h)" opacity=".55" />
      <ellipse cx="41" cy="32" rx="4.3" ry="2.7" fill="url(#u-blush)" opacity={boy ? 0.8 : 1} />
      <ellipse cx="59" cy="32" rx="4.3" ry="2.7" fill="url(#u-blush)" opacity={boy ? 0.8 : 1} />
      {eye(43.3, -1)}
      {eye(56.7, 1)}
      {boy ? (
        <path d="M38.6 20.4 Q43.3 17.6 47.8 19.8 M52.2 19.8 Q56.7 17.6 61.4 20.4" stroke={brow} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      ) : (
        <path d="M39.2 20 Q43.2 16.9 47.8 18.8 M52.2 18.8 Q56.8 16.9 60.8 20" stroke={brow} strokeWidth=".95" fill="none" strokeLinecap="round" opacity=".92" />
      )}
      <path d="M48.9 31 Q50 32.6 51.5 31.2" stroke="#000" strokeOpacity=".3" strokeWidth=".9" fill="none" strokeLinecap="round" />
      <ellipse cx="50" cy="30" rx=".9" ry=".7" fill="#fff" opacity=".4" />
      {boy ? (
        <>
          <path d="M46.4 35.2 Q50 38.6 53.6 35.2" stroke={lip} strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <path d="M47.6 37.4 Q50 38.4 52.4 37.4" stroke="#000" strokeOpacity=".12" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M45.8 34.8 Q48.2 33.6 50 34.4 Q51.8 33.6 54.2 34.8 Q50 37.6 45.8 34.8 Z" fill={lip} />
          <path d="M46.4 35.1 Q50 36.7 53.6 35.1 Q50 39 46.4 35.1 Z" fill={lip} opacity=".85" />
          <path d="M46.6 35.2 Q50 36.3 53.4 35.2" stroke="#000" strokeOpacity=".25" strokeWidth=".5" fill="none" />
          <ellipse cx="50" cy="37.1" rx="1.4" ry=".5" fill="#fff" opacity=".45" />
        </>
      )}
    </g>
  );
}

// Chunky sneaker for the left foot (mirror for the right). Toe points outward.
function Sneaker({ color, sole = '#f4f1ec', lace = '#fff' }) {
  const body = 'M38.8 134 L49.2 134 C49.8 138.6 49.6 143.4 47.2 144.8 L33.4 144.8 C29.4 144.8 28.4 141.2 31.6 139.6 C35.2 138.2 38.2 136.8 38.8 134 Z';
  const bottom = 'M29.4 143.8 L49.2 143.8 L49 147.6 L30.6 147.6 C28.8 147.6 28 145.2 29.4 143.8 Z';
  return (
    <g>
      <path d={body} fill={color} />
      <path d={body} fill="url(#u-v)" />
      <path d={bottom} fill={sole} />
      <path d={bottom} fill="url(#u-v)" opacity=".5" />
      <path d="M31.4 141 C33.6 139.2 36.4 139 38.2 140" stroke="#000" strokeOpacity=".14" strokeWidth=".8" fill="none" />
      <path d="M40.2 136 L44.6 137.2 M39.8 138.4 L44.2 139.6 M39.2 140.6 L43.6 141.6" stroke={lace} strokeWidth=".9" strokeLinecap="round" />
      <path d="M31.8 142.2 Q34.2 140.6 37 141" stroke="#fff" strokeOpacity=".5" strokeWidth="1" fill="none" strokeLinecap="round" />
    </g>
  );
}

// Ankle boot for the left foot (mirror for the right).
function Boot({ color, heel = '#2a1a12' }) {
  const body = 'M38.6 122 L48.6 122 L49.2 139 C49.6 142.4 48.4 144.8 46 145 L32.8 145 C29.2 145 28.6 141.6 31.6 140 C35.2 138.6 38 137.6 38.6 134.6 Z';
  return (
    <g>
      <path d={body} fill={color} />
      <path d={body} fill="url(#u-h)" />
      <path d={body} fill="url(#u-v)" opacity=".55" />
      <path d="M29.6 144.4 L49.2 144.4 L49 147.6 L30.8 147.6 C29 147.6 28.4 145.6 29.6 144.4 Z" fill={heel} />
      <path d="M38.6 122 L48.6 122" stroke="#000" strokeOpacity=".25" strokeWidth="1.1" />
      <path d="M39.6 127 L47.4 127 M39.6 131.4 L47.6 131.4" stroke="#000" strokeOpacity=".13" strokeWidth=".7" />
      <path d="M32.4 142.2 Q34.6 140.6 37.2 141" stroke="#fff" strokeOpacity=".38" strokeWidth="1" fill="none" strokeLinecap="round" />
    </g>
  );
}

// Neck, in body coordinates: drawn before the torso so collars sit over it, and under the head.
const Neck = ({ id }) => (
  <g>
    <path d="M44.4 50 L44.2 62 Q50 66.6 55.8 62 L55.6 50 Z" fill={`url(#${id}-skin)`} />
    <path d="M44.4 50 L44.2 62 Q50 66.6 55.8 62 L55.6 50 Z" fill="url(#u-h)" />
    <path d="M44.2 55 Q50 65 55.8 55 L55.8 49 L44.2 49 Z" fill="#000" opacity=".17" />
  </g>
);

const Shadow = () => <ellipse cx="50" cy="149.6" rx="21" ry="2.8" fill="#000" opacity=".22" />;

const CHARACTERS = {
  // Long chestnut waves with a side part, blush blouse tucked into skinny jeans, white sneakers, hand on hip
  g1: () => {
    const hair = '#7b4a2e';
    const hairMid = '#935a38';
    const hairLight = '#b6784a';
    const skinBase = '#f8cfb4';
    const jean = '#2f4470';
    const blouse = '#ff6f95';
    const blouseDark = '#e04f78';
    // wavy mass behind the body: S-curves down both sides ending in soft curls
    const back =
      'M50 2.4 C39.4 2.2 31.8 7.6 30.2 17.4 C29.2 23.8 29.6 28.6 28.4 35 C26.4 43.6 30.2 48 27 56.6 C24.4 64 28.8 67.2 26 74.6 C25 79 28.2 82.6 32 80.6 C34.6 79.2 34.2 74.6 36.8 73.6 L63.2 73.6 C65.8 74.6 65.4 79.2 68 80.6 C71.8 82.6 75 79 74 74.6 C71.2 67.2 75.6 64 73 56.6 C69.8 48 73.6 43.6 71.6 35 C70.4 28.6 70.8 23.8 69.8 17.4 C68.2 7.6 60.6 2.2 50 2.4 Z';
    const cap = 'M36.2 25.4 C34.4 9 42.6 2.4 50.2 2.4 C58.6 2.4 66 9 63.8 25.4 C62.6 17.8 59 12 52.6 10.4 C48.6 9.4 44.6 10.6 42 13.2 C38.8 16.4 37 20.6 36.2 25.4 Z';
    const lockL = 'M36.2 25 C32.2 33 32.6 41 30.8 48 C29.2 54 31.6 59 30.6 65 C30.2 69 33.8 69 34.4 65 C35.6 58 33.8 53 35.2 47 C36.6 41 36.6 33 38.6 28 Z';
    const lockR = 'M63.8 25 C67.8 33 67.4 41 69.2 48 C70.8 54 68.4 59 69.4 65 C69.8 69 66.2 69 65.6 65 C64.4 58 66.2 53 64.8 47 C63.4 41 63.4 33 61.4 28 Z';
    return (
      <>
        {skinGradient('g1', ['#ffeadb', skinBase, '#e3a98a'])}
        <g transform={HS}>
          <path d={back} fill={hair} />
          <path d={back} fill="url(#u-v)" />
          <path d="M30.6 36 C28.6 46 32.2 50 29.6 58 M69.4 36 C71.4 46 67.8 50 70.4 58 M33.6 28 C31.6 40 34.6 46 32.6 56 M66.4 28 C68.4 40 65.4 46 67.4 56" stroke={hairMid} strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".85" />
        </g>
        <Shadow />
        {/* skinny jeans */}
        <Shaded d="M37.6 90 C36.4 102 37.4 118 38.8 136 L47.4 136 C47.8 120 48.8 104 49.4 92 Z" fill={jean} dir="h" />
        <Mirror><Shaded d="M37.6 90 C36.4 102 37.4 118 38.8 136 L47.4 136 C47.8 120 48.8 104 49.4 92 Z" fill={jean} dir="h" /></Mirror>
        <path d="M42.6 100 C42.2 112 42.8 124 43.4 134 M57.4 100 C57.8 112 57.2 124 56.6 134" stroke="#000" strokeOpacity=".13" strokeWidth=".7" fill="none" />
        <Sneaker color="#fbfbfd" />
        <Mirror><Sneaker color="#fbfbfd" /></Mirror>
        <Neck id="g1" />
        {/* torso and arms, dropped to sit below the chin */}
        <g transform="translate(0 6)">
          {/* left arm hangs, sleeve rolled above the elbow */}
          <Seg p1={[37, 61]} w1={8.6} p2={[33.4, 74]} w2={7.4} fill={blouse} />
          <Seg p1={[33.4, 74]} w1={5.8} p2={[34.4, 88]} w2={4.6} fill="url(#g1-skin)" hi={0.3} sh={0.1} />
          <Seg p1={[30.4, 74.4]} w1={2.6} p2={[36.6, 74.6]} w2={2.6} fill={blouseDark} hi={0.1} sh={0.1} />
          <Hand id="g1" x={34.6} y={87.6} rot={3} s={1.15} />
          {/* torso: shoulders, waist, hips */}
          <Shaded d="M33.6 62 C33.6 57.2 40.2 55.2 50 55.2 C59.8 55.2 66.4 57.2 66.4 62 C67 69 64.2 74.4 62.8 79.4 C62.2 84 63.6 88.4 64.4 92 L35.6 92 C36.4 88.4 37.8 84 37.2 79.4 C35.8 74.4 33 69 33.6 62 Z" fill={blouse} dir="h" />
          <path d="M36.4 90.8 L63.6 90.8 L63.4 93.4 L36.6 93.4 Z" fill="#1f2f52" />
          <path d="M37 92 L63 92" stroke="#d6a45a" strokeWidth=".8" />
          <path d="M46 55.6 L50 64.4 L54 55.6 Z" fill="url(#g1-skin)" />
          <path d="M44.4 55.2 L50 64.2 L42.2 61 L41.2 57.2 Z" fill="#ffb3c8" />
          <path d="M55.6 55.2 L50 64.2 L57.8 61 L58.8 57.2 Z" fill="#ffc6d6" />
          <path d="M50 64.4 L50 91" stroke={blouseDark} strokeWidth=".8" />
          {[68.4, 74.4, 80.4, 86.4].map((y) => <circle key={y} cx="50" cy={y} r=".95" fill="#fff3e0" />)}
          <path d="M42.4 69 C43.6 74 42.8 81 40.8 87 M57.6 69 C56.4 74 57.2 81 59.2 87" stroke="#000" strokeOpacity=".08" strokeWidth="1.4" fill="none" />
          <path d="M46.2 62.8 Q50 68.4 53.8 62.8" stroke="#f2c14e" strokeWidth=".7" fill="none" />
          <circle cx="50" cy="68" r=".95" fill="#f2c14e" />
          {/* right arm: hand on hip */}
          <Seg p1={[63, 61]} w1={8.6} p2={[70.8, 73]} w2={7.4} fill={blouse} />
          <Seg p1={[70.8, 73]} w1={5.8} p2={[64, 84]} w2={4.6} fill="url(#g1-skin)" hi={0.3} sh={0.1} />
          <Seg p1={[67.8, 70.4]} w1={2.6} p2={[73.8, 74.4]} w2={2.6} fill={blouseDark} hi={0.1} sh={0.1} />
          <Hand id="g1" x={62.6} y={85} rot={150} s={1.15} flip />
        </g>
        <g transform={HS}>
          <Head id="g1" iris="#7a4a2a" brow="#5e3720" lip="#d4687a" />
          <path d={cap} fill={hair} />
          <path d={cap} fill="url(#u-v)" />
          <path d="M45.4 3.8 C54.6 3.8 62.8 9.6 63.6 22.4 C59.4 14 53 9.6 46.4 11.4 Z" fill={hairMid} opacity=".9" />
          <path d={lockL} fill={hair} />
          <path d={lockR} fill={hair} />
          <path d={lockL} fill={hairMid} opacity=".45" transform="translate(-.8 0)" />
          <path d={lockR} fill={hairMid} opacity=".45" transform="translate(.8 0)" />
          <path d="M41.6 5.4 C46.4 3.6 53 3.8 58.2 7 M38.8 12.6 C43.4 7.8 50.4 6.6 57 9.6 M32.8 39 C31.8 47 32.8 55 33.8 62 M67.2 39 C68.2 47 67.2 55 66.2 62" stroke={hairLight} strokeWidth="1" strokeLinecap="round" fill="none" opacity=".85" />
          <circle cx="36.3" cy="31.6" r="1.3" fill="#f2c14e" />
          <circle cx="63.7" cy="31.6" r="1.3" fill="#f2c14e" />
        </g>
      </>
    );
  },
  // Sleek high ponytail, sapphire bodycon dress with cap sleeves, bare legs, black ankle boots
  g2: () => {
    const hair = '#17101a';
    const hairLight = '#5a4864';
    const skinBase = '#e4a97f';
    const dress = '#3f5bc0';
    const dressDark = '#2f468f';
    const pony = 'M57.4 5.6 C71.6 3.2 77.4 23.4 73.4 42.2 C72 50.6 67 54.6 66 48.2 C68.2 38 67.6 25.2 58.8 19 Z';
    const cap = 'M36.4 25.6 C34.6 9.2 43 2.6 50.2 2.6 C58.4 2.6 66.2 9.2 63.6 25.6 C62.4 17.6 58 11.2 50.6 10.6 C43.2 10.8 38 17.6 36.4 25.6 Z';
    const fringe = 'M36.9 24.4 C38 12.8 45.8 6.4 61.6 11.6 C52.4 11 43.6 15.4 36.9 24.4 Z';
    return (
      <>
        {skinGradient('g2', ['#f6d2b0', skinBase, '#c58a60'])}
        <g transform={HS}>
          <path d={pony} fill={hair} />
          <path d={pony} fill="url(#u-h)" />
          <path d="M63.4 10.6 C69.8 15 71.8 28 69.6 42.4" stroke={hairLight} strokeWidth="1" fill="none" opacity=".8" />
        </g>
        <Shadow />
        {/* bare legs + ankle boots */}
        <Seg p1={[43.8, 100]} w1={9.4} p2={[43.4, 128]} w2={6.2} fill="url(#g2-skin)" hi={0.3} sh={0.14} />
        <Seg p1={[56.2, 100]} w1={9.4} p2={[56.6, 128]} w2={6.2} fill="url(#g2-skin)" hi={0.3} sh={0.14} />
        <Boot color="#15151c" />
        <Mirror><Boot color="#15151c" /></Mirror>
        <Neck id="g2" />
        {/* torso and arms, dropped to sit below the chin */}
        <g transform="translate(0 6)">
          {/* arms: cap sleeve then bare forearm */}
          <Seg p1={[37, 61]} w1={8.6} p2={[34.4, 69]} w2={8} fill={dress} />
          <Seg p1={[34.4, 69]} w1={6} p2={[34.6, 88]} w2={4.6} fill="url(#g2-skin)" hi={0.3} sh={0.1} />
          <Hand id="g2" x={34.8} y={87.6} rot={3} s={1.15} />
          <Seg p1={[63, 61]} w1={8.6} p2={[65.6, 69]} w2={8} fill={dress} />
          <Seg p1={[65.6, 69]} w1={6} p2={[65.4, 88]} w2={4.6} fill="url(#g2-skin)" hi={0.3} sh={0.1} />
          <Hand id="g2" x={65.2} y={87.6} rot={-3} s={1.15} flip />
          {/* bodycon: fitted through the waist and hip, hem at mid-thigh */}
          <Shaded d="M33.8 62 C33.8 57 40.2 55.2 50 55.2 C59.8 55.2 66.2 57 66.2 62 C66.8 68 63.2 72.6 60.8 78.4 C60 83.6 62.4 88.8 63.8 93.8 C64.6 97.6 64.2 101.2 62.8 105 Q50 108.6 37.2 105 C35.8 101.2 35.4 97.6 36.2 93.8 C37.6 88.8 40 83.6 39.2 78.4 C36.8 72.6 33.2 68 33.8 62 Z" fill={dress} dir="h" />
          <path d="M46 55.4 L50 62.6 L54 55.4 Q50 54.4 46 55.4 Z" fill="url(#g2-skin)" />
          <path d="M45.8 55.6 Q50 61.6 54.2 55.6" stroke={dressDark} strokeWidth=".9" fill="none" />
          <path d="M39.4 77.4 Q50 81.6 60.6 77.4" stroke="#000" strokeOpacity=".16" strokeWidth="1.4" fill="none" />
        <path d="M41.6 84 Q50 88 58.4 84" stroke="#fff" strokeOpacity=".1" strokeWidth="2" fill="none" />
          <path d="M40.6 66 C42.2 73 41.4 82 40.4 91 M59.4 66 C57.8 73 58.6 82 59.6 91" stroke="#000" strokeOpacity=".09" strokeWidth="1.4" fill="none" />
          <path d="M37.2 105 Q50 108.6 62.8 105 L62.6 107.2 Q50 110.8 37.4 107.2 Z" fill={dressDark} />
          <path d="M46.8 58.6 Q50 62.4 53.2 58.8" stroke="#e8e2f4" strokeWidth=".7" fill="none" />
          <circle cx="50" cy="62.6" r=".9" fill="#e8e2f4" />
        </g>
        <g transform={HS}>
          <Head id="g2" iris="#3a2417" brow="#17101a" lip="#c0485e" />
          <path d={cap} fill={hair} />
          <path d={cap} fill="url(#u-v)" />
          <path d={fringe} fill={hair} />
          <path d="M41.6 5.6 C46.8 3.8 54 4.2 59.4 7.6 M39.4 11.6 C45.6 8.4 54 8.8 60.6 12.4" stroke={hairLight} strokeWidth="1" strokeLinecap="round" fill="none" opacity=".85" />
          <path d="M37 26.6 C36.4 20.2 37.6 15 40.4 11.8 C38.8 17 38.4 22.4 38.8 26.6 Z" fill={hair} />
          <circle cx="36.3" cy="31.8" r="1.3" fill="#f7f5f2" />
          <circle cx="63.7" cy="31.8" r="1.3" fill="#f7f5f2" />
          <ellipse cx="65.6" cy="10.2" rx="3" ry="1.7" fill="#c0485e" transform="rotate(-25 65.6 10.2)" />
        </g>
      </>
    );
  },
  // Neat side-swept bob, emerald wrap dress with a belt, small gold hoops, tan ankle boots
  g3: () => {
    const hair = '#2a1810';
    const hairLight = '#6a4a3a';
    const skinBase = '#bf8460';
    const green = '#1f8f6b';
    const greenDark = '#17785a';
    const bob = 'M32.6 23 C31.4 8.2 41 2.6 50 2.6 C59 2.6 68.6 8.2 67.4 23 C67.6 31.8 68.6 38.4 70 44 C70.8 49.6 66.4 51.6 62.2 51 L37.8 51 C33.6 51.6 29.2 49.6 30 44 C31.4 38.4 32.4 31.8 32.6 23 Z';
    const bangs = 'M36.4 25.6 C34.6 10 43.4 3.6 50.4 3.6 C58.4 3.6 66.2 9.4 63.6 25 C62.6 17.8 58 11.4 50.4 10.8 C45.8 11.2 41.6 13.6 39.2 16.4 C37.6 18.8 36.6 22.2 36.4 25.6 Z';
    const sweep = 'M37 18.2 C44.8 4.6 61 7 64.2 20.2 C57.4 12 45.6 11.8 37 18.2 Z';
    return (
      <>
        {skinGradient('g3', ['#d9a27c', skinBase, '#9c6444'])}
        <g transform={HS}><path d={bob} fill={hair} /><path d={bob} fill="url(#u-v)" /></g>
        <Shadow />
        {/* calves + boots */}
        <Seg p1={[43.6, 104]} w1={9} p2={[43.4, 128]} w2={6} fill="url(#g3-skin)" hi={0.3} sh={0.14} />
        <Seg p1={[56.4, 104]} w1={9} p2={[56.6, 128]} w2={6} fill="url(#g3-skin)" hi={0.3} sh={0.14} />
        <Boot color="#c98f5c" />
        <Mirror><Boot color="#c98f5c" /></Mirror>
        <Neck id="g3" />
        {/* torso and arms, dropped to sit below the chin */}
        <g transform="translate(0 6)">
          {/* arms: three-quarter sleeves */}
          <Seg p1={[37, 61]} w1={8.6} p2={[33.6, 73]} w2={7.4} fill={green} />
          <Seg p1={[33.6, 73]} w1={5.8} p2={[34.6, 88]} w2={4.6} fill="url(#g3-skin)" hi={0.3} sh={0.1} />
          <Seg p1={[30.6, 73.4]} w1={2.6} p2={[36.6, 73.6]} w2={2.6} fill={greenDark} hi={0.1} sh={0.1} />
          <Hand id="g3" x={34.8} y={87.6} rot={3} s={1.15} />
          <Seg p1={[63, 61]} w1={8.6} p2={[66.4, 73]} w2={7.4} fill={green} />
          <Seg p1={[66.4, 73]} w1={5.8} p2={[65.4, 88]} w2={4.6} fill="url(#g3-skin)" hi={0.3} sh={0.1} />
          <Seg p1={[63.4, 73.6]} w1={2.6} p2={[69.4, 73.4]} w2={2.6} fill={greenDark} hi={0.1} sh={0.1} />
          <Hand id="g3" x={65.2} y={87.6} rot={-3} s={1.15} flip />
          {/* wrap dress: fitted bodice, belt, flared skirt */}
          <Shaded d="M33.6 62 C33.6 57 40.2 55.2 50 55.2 C59.8 55.2 66.4 57 66.4 62 C67 69 64 74 62.8 78.4 L64.4 84 C67.4 94.6 70 103 71.4 108.6 Q50 114 28.6 108.6 C30 103 32.6 94.6 35.6 84 L37.2 78.4 C36 74 33 69 33.6 62 Z" fill={green} dir="h" />
          <path d="M46.2 55.4 L55.4 69.4 L58 62.4 L53.8 55.4 Q50 54.4 46.2 55.4 Z" fill="url(#g3-skin)" />
          <path d="M46 55.8 L55.8 70.4 M57.6 63 L55.8 70.4" stroke={greenDark} strokeWidth="1.1" fill="none" />
          <path d="M37.4 78 Q50 82.6 62.6 78 L63 82 Q50 86.8 37 82 Z" fill="#8a5a34" />
          <rect x="52.4" y="79" width="4.4" height="3.6" rx=".8" fill="#f2c14e" />
          <path d="M36.6 86 C35.6 94 34 102 32.2 107.6 M63.4 86 C64.4 94 66 102 67.8 107.6 M45.8 88 C45.2 96 44.4 102 43.6 108.6 M54.2 88 C54.8 96 55.6 102 56.4 108.6" stroke="#000" strokeOpacity=".13" strokeWidth="1" fill="none" />
          <path d="M28.8 108.6 Q50 114 71.2 108.6 L71.2 110.4 Q50 116 28.8 110.4 Z" fill={greenDark} />
          <path d="M46.6 58.6 Q50 63.4 53.4 58.8" stroke="#f2c14e" strokeWidth=".7" fill="none" />
        </g>
        <g transform={HS}>
          <Head id="g3" iris="#2a170d" brow="#2a1810" lip="#b8506a" />
          <path d={bangs} fill={hair} />
          <path d={bangs} fill="url(#u-v)" />
          <path d={sweep} fill={hair} />
          <path d="M41.6 6.4 C47.8 4 56 5.2 61.4 9.8 M38.4 15.8 C43.8 9.4 52 8.4 60.4 11.6 M32.8 31 C32.4 37 33 43 34.4 47.6 M67.2 31 C67.6 37 67 43 65.6 47.6" stroke={hairLight} strokeWidth="1" strokeLinecap="round" fill="none" opacity=".85" />
          <path d="M32.8 24 C31.8 34.4 32.8 42.6 35.2 47.2 C37.2 44.6 36.2 38.4 36.8 32 Z" fill={hair} />
          <path d="M67.2 24 C68.2 34.4 67.2 42.6 64.8 47.2 C62.8 44.6 63.8 38.4 63.2 32 Z" fill={hair} />
          <circle cx="36.3" cy="33.4" r="2" fill="none" stroke="#f2c14e" strokeWidth="1" />
          <circle cx="63.7" cy="33.4" r="2" fill="none" stroke="#f2c14e" strokeWidth="1" />
        </g>
      </>
    );
  },
  // Neat side part with a soft quiff, light-blue shirt with rolled sleeves, chinos, white sneakers
  b1: () => {
    const hair = '#2a1c16';
    const hairLight = '#6a4a38';
    const skinBase = '#f3c9a8';
    const shirt = '#3f8cff';
    const shirtDark = '#2468d6';
    const chino = '#c9a97a';
    // skull cap with a clean, slightly off-centre hairline
    const cap = 'M36.4 24 C34.6 8.4 42.6 2.2 50.4 2.2 C58.8 2.2 66 8.2 63.8 24 C63 18 60.4 13.8 56.4 12.4 C50.8 14.8 44.2 15.2 40.4 13.2 C38.4 15 37 19.2 36.4 24 Z';
    // volume swept from the part across to his left
    const quiff = 'M39.6 13.4 C40.8 4.2 54 0 62.4 6 C66 8.6 66.4 14.6 65 19.6 C63.2 12.2 56.4 8 48.6 9 C44.8 9.6 41.6 11.6 39.6 13.4 Z';
    return (
      <>
        {skinGradient('b1', ['#ffe9d8', skinBase, '#dba286'])}
        <Shadow />
        {/* chinos */}
        <Shaded d="M35.8 91 C35 104 36.2 120 38.2 136 L47.6 136 C48 120 48.8 104 49.4 93 Z" fill={chino} dir="h" />
        <Mirror><Shaded d="M35.8 91 C35 104 36.2 120 38.2 136 L47.6 136 C48 120 48.8 104 49.4 93 Z" fill={chino} dir="h" /></Mirror>
        <path d="M42.6 100 L43.2 134 M57.4 100 L56.8 134" stroke="#000" strokeOpacity=".1" strokeWidth=".8" />
        <path d="M36.6 134 L47.6 134 M52.4 134 L63.4 134" stroke="#fff" strokeOpacity=".14" strokeWidth="1" />
        <Sneaker color="#fbfbfd" sole="#d3d6e2" />
        <Mirror><Sneaker color="#fbfbfd" sole="#d3d6e2" /></Mirror>
        <Neck id="b1" />
        {/* torso and arms, dropped to sit below the chin */}
        <g transform="translate(0 6)">
          {/* left arm: sleeve rolled above the elbow */}
          <Seg p1={[34.4, 61]} w1={9.8} p2={[31.6, 73]} w2={8.8} fill={shirt} />
          <Seg p1={[31.6, 73]} w1={6.6} p2={[32.6, 88]} w2={5.4} fill="url(#b1-skin)" hi={0.3} sh={0.1} />
          <Seg p1={[27.4, 73.2]} w1={3} p2={[36, 73.6]} w2={3} fill={shirtDark} hi={0.1} sh={0.1} />
          <Hand id="b1" x={32.8} y={87.6} rot={3} s={1.2} />
          {/* torso */}
          <Shaded d="M31.6 62 C31.6 57 39.4 55.2 50 55.2 C60.6 55.2 68.4 57 68.4 62 C69 70 66.8 77 65.8 84 L65.4 93 L34.6 93 L34.2 84 C33.2 77 31 70 31.6 62 Z" fill={shirt} dir="h" />
          <path d="M34.6 90.6 L65.4 90.6 L65.4 93.6 L34.6 93.6 Z" fill="#6b4328" />
          <rect x="47.8" y="90.4" width="4.4" height="3.2" rx=".6" fill="#d6a45a" />
          <path d="M45.8 55.4 L50 64.6 L54.2 55.4 Z" fill="url(#b1-skin)" />
          <path d="M43.4 54.6 L50 66 L44.2 58.6 L41.4 56.2 Z" fill="#a9ccff" />
          <path d="M56.6 54.6 L50 66 L55.8 58.6 L58.6 56.2 Z" fill="#c0daff" />
          <path d="M50 66 L50 90.6" stroke={shirtDark} strokeWidth=".8" />
          {[70, 76.4, 82.8, 88.4].map((y) => <circle key={y} cx="50" cy={y} r=".9" fill="#e8f0fb" />)}
          <rect x="55" y="68.4" width="6.4" height="6.4" rx=".8" fill={shirtDark} opacity=".5" />
          <path d="M40.6 68 C41.6 76 40.8 84 38.6 90 M59.4 74 C60 80 59.4 85 60.4 90.4" stroke="#000" strokeOpacity=".08" strokeWidth="1.4" fill="none" />
          {/* right arm hangs, sleeve rolled above the elbow */}
          <Seg p1={[65.6, 61]} w1={9.8} p2={[68.4, 73]} w2={8.8} fill={shirt} />
          <Seg p1={[68.4, 73]} w1={6.6} p2={[67.4, 88]} w2={5.4} fill="url(#b1-skin)" hi={0.3} sh={0.1} />
          <Seg p1={[64, 73.6]} w1={3} p2={[72.6, 73.2]} w2={3} fill={shirtDark} hi={0.1} sh={0.1} />
          <Hand id="b1" x={67.2} y={87.6} rot={-3} s={1.2} flip />
        </g>
        <g transform={HS}>
          <Head id="b1" iris="#4a3020" brow="#2a1c16" lip="#c4606c" boy />
          <path d={cap} fill={hair} />
          <path d={cap} fill="url(#u-v)" />
          <path d={quiff} fill={hair} />
          <path d={quiff} fill="url(#u-v)" />
          <path d="M41 4.8 C40.4 8 40 10.6 39.8 13.4" stroke="#0e0a08" strokeOpacity=".45" strokeWidth="1.1" strokeLinecap="round" fill="none" />
          <path d="M44.4 3.4 C50.8 1.4 58 2.6 62.6 6.8 M42.8 8 C49.2 5.6 56.8 6.6 62 10.6 M57.6 13 C60.2 14.8 62.2 17.6 63.2 21" stroke={hairLight} strokeWidth="1" strokeLinecap="round" fill="none" opacity=".85" />
          <path d="M36.6 24.6 C36.4 20.8 36.9 17.6 38.3 15.2 C38.6 18.4 38.9 21.6 39.6 24.6 Z" fill={hair} />
          <path d="M63.4 24.6 C63.6 20.8 63.1 17.6 61.7 15.2 C61.4 18.4 61.1 21.6 60.4 24.6 Z" fill={hair} />
        </g>
      </>
    );
  },
  // Neat textured fringe, burgundy sweater over a white collar, dark jeans, brown boots, hands in pockets
  b2: () => {
    const hair = '#3d2a1e';
    const hairLight = '#7a5640';
    const skinBase = '#d9a070';
    const sweater = '#8a2f45';
    const sweaterDark = '#6f2236';
    // short crop whose fringe breaks into soft points across the forehead
    const cap = 'M36.4 23.6 C34.6 8 42.6 1.8 50.4 1.8 C58.6 1.8 66.2 8 63.8 23.6 C63.2 18.4 61.6 14.6 59.4 12.6 C57.8 14.8 56.2 15.8 54.4 15.9 C52.9 14.9 51.4 13.8 50 12.6 C48.8 14.1 47.2 15.2 45.2 15.9 C43.6 15.6 42.2 14.7 40.6 13.2 C38.6 14.8 37 18.4 36.4 23.6 Z';
    const top = 'M40.2 12.6 C42 4 55.6 0.4 62.6 6.8 C64.8 8.8 65.4 12.2 64.6 15.8 C61.2 9.4 54 6.8 47 8.6 C44.2 9.2 41.9 10.9 40.2 12.6 Z';
    return (
      <>
        {skinGradient('b2', ['#f2c59c', skinBase, '#b8805a'])}
        <Shadow />
        {/* dark slim jeans */}
        <Shaded d="M36.2 91 C35.4 104 36.8 118 38.8 130 L47.6 130 C48 118 48.8 104 49.4 93 Z" fill="#2d3550" dir="h" />
        <Mirror><Shaded d="M36.2 91 C35.4 104 36.8 118 38.8 130 L47.6 130 C48 118 48.8 104 49.4 93 Z" fill="#2d3550" dir="h" /></Mirror>
        <path d="M42.8 100 L43.4 128 M57.2 100 L56.6 128" stroke="#fff" strokeOpacity=".08" strokeWidth=".8" />
        <Boot color="#7a4a2a" />
        <Mirror><Boot color="#7a4a2a" /></Mirror>
        <Neck id="b2" />
        {/* torso and arms, dropped to sit below the chin */}
        <g transform="translate(0 6)">
          {/* sweater: torso then arms bent toward the pockets */}
          <Shaded d="M31.6 62 C31.6 57 39.4 55.2 50 55.2 C60.6 55.2 68.4 57 68.4 62 C69 70 66.8 77 65.8 84 L65.4 94 L34.6 94 L34.2 84 C33.2 77 31 70 31.6 62 Z" fill={sweater} dir="h" />
          <path d="M34.8 91.4 Q50 94.6 65.2 91.4 L65.2 94.6 Q50 97.8 34.8 94.6 Z" fill={sweaterDark} />
          <path d="M42.8 55.4 L50 65.6 L57.2 55.4 L54 54 L50 58.6 L46 54 Z" fill="#f4f1ec" />
          <path d="M44.4 55.2 Q50 63.6 55.6 55.2" stroke={sweaterDark} strokeWidth="2" fill="none" />
          <path d="M50 65.6 L50 71" stroke="#e0d8cc" strokeWidth=".6" />
          <path d="M40.6 67 C41.6 75 40.6 84 38.4 91 M59.4 67 C58.4 75 59.4 84 61.6 91" stroke="#000" strokeOpacity=".1" strokeWidth="1.4" fill="none" />
          <Seg p1={[34.4, 61]} w1={9.8} p2={[31.4, 75]} w2={8.8} fill={sweater} />
          <Seg p1={[31.4, 75]} w1={8.8} p2={[32.6, 87]} w2={7.6} fill={sweater} />
          <Seg p1={[32.4, 85.2]} w1={7.6} p2={[32.7, 88.2]} w2={7.6} fill={sweaterDark} hi={0.1} sh={0.1} />
          <Hand id="b2" x={32.8} y={88.8} rot={3} s={1.2} />
          <Seg p1={[65.6, 61]} w1={9.8} p2={[68.6, 75]} w2={8.8} fill={sweater} />
          <Seg p1={[68.6, 75]} w1={8.8} p2={[67.4, 87]} w2={7.6} fill={sweater} />
          <Seg p1={[67.6, 85.2]} w1={7.6} p2={[67.3, 88.2]} w2={7.6} fill={sweaterDark} hi={0.1} sh={0.1} />
          <Hand id="b2" x={67.2} y={88.8} rot={-3} s={1.2} flip />
        </g>
        <g transform={HS}>
          <Head id="b2" iris="#3b2616" brow="#3d2a1e" lip="#c46a6a" boy />
          <path d={cap} fill={hair} />
          <path d={cap} fill="url(#u-v)" />
          <path d={top} fill={hair} />
          <path d={top} fill="url(#u-v)" />
          <path d="M44.4 3.2 C51 1.2 58.2 2.6 62.6 6.8 M42.6 7.4 C49.4 5 57 6.2 62.2 10.4" stroke={hairLight} strokeWidth="1" strokeLinecap="round" fill="none" opacity=".85" />
          <path d="M36.6 24.6 C36.4 20.8 36.9 17.6 38.3 15.2 C38.6 18.4 38.9 21.6 39.6 24.6 Z" fill={hair} />
          <path d="M63.4 24.6 C63.6 20.8 63.1 17.6 61.7 15.2 C61.4 18.4 61.1 21.6 60.4 24.6 Z" fill={hair} />
        </g>
      </>
    );
  },
  // Neat taper with volume on top, glasses, amber bomber jacket over a white tee, charcoal jeans, white sneakers
  b3: () => {
    const hair = '#141014';
    const hairLight = '#4a4048';
    const skinBase = '#ad7650';
    const amber = '#d8912f';
    const amberDark = '#b4731f';
    const rib = '#2d3142';
    const cap = 'M36.5 23.4 C34.8 7.8 43 1.6 50.4 1.6 C58.6 1.6 66 7.8 63.5 23.4 C62.8 17.6 60.2 13.6 56.2 12.2 C50.8 14.2 44.8 14.4 41 12.8 C38.8 14.4 37.2 18.2 36.5 23.4 Z';
    const top = 'M40.2 12.8 C42.4 3.2 56.6 0 63.2 7.6 C65.6 10.4 65.4 15 64.6 18.8 C62 11.8 54.4 8.2 47 9.8 C44.2 10.4 41.8 11.6 40.2 12.8 Z';
    return (
      <>
        {skinGradient('b3', ['#cf9770', skinBase, '#8a573a'])}
        <Shadow />
        {/* charcoal jeans */}
        <Shaded d="M36 91 C35.2 104 36.4 120 38.4 136 L47.6 136 C48 120 48.8 104 49.4 93 Z" fill="#424757" dir="h" />
        <Mirror><Shaded d="M36 91 C35.2 104 36.4 120 38.4 136 L47.6 136 C48 120 48.8 104 49.4 93 Z" fill="#424757" dir="h" /></Mirror>
        <path d="M42.8 100 L43.4 134 M57.2 100 L56.6 134" stroke="#000" strokeOpacity=".14" strokeWidth=".8" />
        <Sneaker color="#fbfbfd" sole="#d3d6e2" />
        <Mirror><Sneaker color="#fbfbfd" sole="#d3d6e2" /></Mirror>
        <Neck id="b3" />
        {/* torso and arms, dropped to sit below the chin */}
        <g transform="translate(0 6)">
          {/* left bomber sleeve with a ribbed cuff */}
          <Seg p1={[34.2, 61]} w1={10.2} p2={[31.4, 74]} w2={9} fill={amber} />
          <Seg p1={[31.4, 74]} w1={9} p2={[32.6, 86]} w2={7.8} fill={amber} />
          <Seg p1={[32.4, 84]} w1={7.8} p2={[32.7, 87.4]} w2={7.8} fill={rib} hi={0.12} sh={0.12} />
          <Hand id="b3" x={32.8} y={88} rot={3} s={1.2} />
          {/* zipped bomber jacket over a white tee */}
          <Shaded d="M31.8 62 C31.8 57 39.6 55.2 50 55.2 C60.4 55.2 68.2 57 68.2 62 C68.8 70 66.6 77 65.6 84 L65.2 92 L34.8 92 L34.4 84 C33.4 77 31.2 70 31.8 62 Z" fill={amber} dir="h" />
          <path d="M43.2 56.6 C46 54.6 54 54.6 56.8 56.6 L55.6 61 C53.2 59.4 46.8 59.4 44.4 61 Z" fill="#f4f1ec" />
          <path d="M43.4 57.6 C46 55.8 54 55.8 56.6 57.6 L55.6 61 C53.2 59.4 46.8 59.4 44.4 61 Z" fill={rib} />
          <path d="M34.6 89.4 Q50 92.8 65.4 89.4 L65.4 93.6 Q50 97 34.6 93.6 Z" fill={rib} />
          <path d="M37.4 90.2 L37.2 94.4 M41.2 91.1 L41.1 95.3 M45 91.7 L45 95.9 M55 91.7 L55 95.9 M58.8 91.1 L58.9 95.3 M62.6 90.2 L62.8 94.4" stroke="#000" strokeOpacity=".2" strokeWidth=".6" />
          <path d="M50 60 L50 90" stroke={amberDark} strokeWidth="1.4" />
          <circle cx="50" cy="74" r="1.2" fill="#f7dfa8" />
          <path d="M38.8 77.4 L44.4 81 M61.2 77.4 L55.6 81" stroke={amberDark} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M38.4 66 C39.4 74 38.8 82 37.4 88.6 M61.6 66 C60.6 74 61.2 82 62.6 88.6" stroke="#000" strokeOpacity=".12" strokeWidth="1.3" fill="none" />
          {/* right bomber sleeve with a ribbed cuff */}
          <Seg p1={[65.8, 61]} w1={10.2} p2={[68.6, 74]} w2={9} fill={amber} />
          <Seg p1={[68.6, 74]} w1={9} p2={[67.4, 86]} w2={7.8} fill={amber} />
          <Seg p1={[67.6, 84]} w1={7.8} p2={[67.3, 87.4]} w2={7.8} fill={rib} hi={0.12} sh={0.12} />
          <Hand id="b3" x={67.2} y={88} rot={-3} s={1.2} flip />
        </g>
        <g transform={HS}>
          <Head id="b3" iris="#1f130b" brow="#141014" lip="#8a3a44" boy />
          <path d={cap} fill={hair} />
          <path d={cap} fill="url(#u-v)" />
          {/* tapered sides read as a lighter band under the volume on top */}
          <path d="M36.6 24 C36.3 19.8 36.9 16.4 38.6 13.8 L40.8 14.4 C39.2 17.4 38.6 21 38.4 24 Z" fill={hairLight} opacity=".5" />
          <path d="M63.4 24 C63.7 19.8 63.1 16.4 61.4 13.8 L59.2 14.4 C60.8 17.4 61.4 21 61.6 24 Z" fill={hairLight} opacity=".5" />
          <path d={top} fill={hair} />
          <path d={top} fill="url(#u-v)" />
          <path d="M44.4 3 C51 0.8 58.2 2.4 62.6 6.8 M42.8 7.4 C49.6 5 57 6.2 62.2 10.2" stroke={hairLight} strokeWidth="1" strokeLinecap="round" fill="none" opacity=".85" />
          <path d="M36.6 24.6 C36.4 20.8 36.9 17.6 38.3 15.2 C38.6 18.4 38.9 21.6 39.6 24.6 Z" fill={hair} />
          <path d="M63.4 24.6 C63.6 20.8 63.1 17.6 61.7 15.2 C61.4 18.4 61.1 21.6 60.4 24.6 Z" fill={hair} />
          <rect x="38.1" y="21.8" width="10.6" height="9.4" rx="4.3" fill="#fff" fillOpacity=".1" stroke="#3a2418" strokeWidth="1.2" />
          <rect x="51.3" y="21.8" width="10.6" height="9.4" rx="4.3" fill="#fff" fillOpacity=".1" stroke="#3a2418" strokeWidth="1.2" />
          <path d="M48.7 25.6 L51.3 25.6" stroke="#3a2418" strokeWidth="1.2" />
          <path d="M38.1 25.2 L36.2 24.8" stroke="#3a2418" strokeWidth="1.1" strokeLinecap="round" />
          <path d="M61.9 25.2 L63.8 24.8" stroke="#3a2418" strokeWidth="1.1" strokeLinecap="round" />
        </g>
      </>
    );
  },
};

// size = height in px (full body is 100:160). crop="head" shows head and shoulders, square.
export default function Mascot({ id = 'g1', size = 96, crop, label }) {
  const m = MASCOTS.find((x) => x.id === id) || MASCOTS[0];
  const head = crop === 'head';
  const draw = CHARACTERS[m.id] || CHARACTERS.g1;
  return (
    <svg
      className="mascot-svg"
      width={head ? size : (size * 100) / 160}
      height={size}
      viewBox={head ? '20 2 60 60' : '0 0 100 160'}
      role="img"
      aria-label={label || m.label}
    >
      <Defs />
      {draw()}
    </svg>
  );
}
