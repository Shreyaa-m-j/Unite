// Used only when the AI is unavailable. Grounded, relatable "this or that" questions: no
// fantasy hypotheticals. Tagged by interest, so a fallback deck still fits the couple, and
// with "who" questions built from the two players' names.
import { isSimilar, similarToAny } from '../lib/similar.js';
import { ABOUT_US } from '../config.js';

const q = (text, a, b) => ({ q: text, a, b });

const GENERAL = [
  q('Reply to texts: instantly or whenever?', 'Instantly', 'Whenever'),
  q('Running late: fib a little or own up?', 'Fib a little', 'Own up'),
  q('Restaurant menu: safe order or gamble?', 'Safe order', 'Gamble'),
  q('Midnight leftovers: eat cold or reheat?', 'Eat cold', 'Reheat first'),
  q('Holiday packing: one small bag or overpack?', 'Travel light', 'Overpack'),
  q('Alarm rings: snooze or get up?', 'Snooze', 'Get up'),
  q('Birthday plan: surprise me or plan together?', 'Surprise me', 'Plan together'),
  q('Forgot a small detail: confess or bluff?', 'Confess', 'Bluff'),
  q('Phone at 2%: find charger or one more reel?', 'Find charger', 'One more reel'),
  q('Family function: mingle or hide with phone?', 'Mingle', 'Hide with phone'),
  q('Last dessert bite: split evenly or fight?', 'Split evenly', 'Fight for it'),
  q('Lost in a new city: ask a local or trust maps?', 'Ask a local', 'Trust maps'),
  q('Rain on date night: cancel or get drenched?', 'Cancel', 'Get drenched'),
  q('Bad movie halfway: walk out or stay?', 'Walk out', 'Stay till end'),
  q('Spicy food dare: accept or decline?', 'Accept', 'Decline'),
  q('Huge WhatsApp group backlog: scroll or mark read?', 'Scroll all', 'Mark read'),
  q('Free weekend: lazy at home or step out?', 'Lazy at home', 'Step out'),
  q('Gift hunting: buy early or last-minute panic?', 'Buy early', 'Last-minute'),
  q('Late-night hunger: order in or raid fridge?', 'Order in', 'Raid fridge'),
  q('Friday night: new restaurant or old favourite?', 'New place', 'Old favourite'),
  q('Busy day ends: long call or quick texts?', 'Long call', 'Quick texts'),
  q('Big decision: sleep on it or decide now?', 'Sleep on it', 'Decide now'),
  q('Awkward silence on a date: joke or just sit?', 'Crack a joke', 'Sit quietly'),
  q('Group photo: ten retakes or just one?', 'Ten retakes', 'Just one'),
  q('Plans cancelled last minute: relieved or sad?', 'Relieved', 'Sad'),
  q('Cab arrives early: rush out or take your time?', 'Rush out', 'Take time'),
  q('Neighbour aunty waves: stop and chat or smile and run?', 'Stop and chat', 'Smile and run'),
  q('Relatives ask when you are settling down: deflect or answer?', 'Deflect', 'Answer'),
  q('Power cut at night: candles or phone torch?', 'Candles', 'Phone torch'),
  q('Parents drop in unannounced: tidy fast or act natural?', 'Tidy fast', 'Act natural'),
];

const BANK = {
  Movies: [
    q('Movie night: rewatch a favourite or try something new?', 'Rewatch favourite', 'Try something new'),
    q('Theatre seat: back row or middle row?', 'Back row', 'Middle row'),
    q('Credits roll: leave instantly or stay for scenes?', 'Leave instantly', 'Stay for scenes'),
    q('Spoiler slips out: forgive instantly or sulk?', 'Forgive instantly', 'Sulk a bit'),
  ],
  Bollywood: [
    q('Item song plays: dance along or film it?', 'Dance along', 'Film it'),
    q('Dialogue game: quote dialogues or sing songs?', 'Quote dialogues', 'Sing songs'),
    q('Bollywood night: 90s romance or modern thriller?', '90s romance', 'Modern thriller'),
    q('Sangeet night: perform a number or stay seated?', 'Perform a number', 'Stay seated'),
  ],
  Cricket: [
    q('Last over nerves: pace the room or sit frozen?', 'Pace the room', 'Sit frozen'),
    q('Team loses: blame the captain or the pitch?', 'The captain', 'The pitch'),
    q('Match day: stadium roar or couch comfort?', 'Stadium roar', 'Couch comfort'),
    q('Match chat: stats nerd or pure vibes?', 'Stats nerd', 'Pure vibes'),
  ],
  Food: [
    q('Menu dilemma: order the usual or something new?', 'The usual', 'Something new'),
    q('Street food: extra spicy or tangy mild?', 'Extra spicy', 'Tangy mild'),
    q('Shared plate: split everything or guard yours?', 'Split everything', 'Guard mine'),
    q('Cooking together: follow recipe or improvise?', 'Follow recipe', 'Improvise'),
  ],
  Travel: [
    q('Trip planning: fixed itinerary or wander freely?', 'Fixed itinerary', 'Wander freely'),
    q('Holiday pace: packed days or lazy mornings?', 'Packed days', 'Lazy mornings'),
    q('Souvenirs: buy plenty or just photographs?', 'Buy plenty', 'Just photos'),
    q('Long journey: road trip or overnight train?', 'Road trip', 'Overnight train'),
  ],
  Music: [
    q('Playlist control: you pick or take turns?', 'I pick', 'Take turns'),
    q('Concert night: front row or room to breathe?', 'Front row', 'Room to breathe'),
    q('Car ride songs: sing loud or hum quietly?', 'Sing loud', 'Hum quietly'),
    q('Earphones: share one each or separate pairs?', 'Share earbuds', 'Own pair'),
  ],
  Gaming: [
    q('Co-op game: play together or race solo?', 'Play together', 'Race solo'),
    q('Losing streak: rage quit or one more match?', 'Rage quit', 'One more match'),
    q('Boss fight stuck: ask for help or grind alone?', 'Ask for help', 'Grind alone'),
    q('Gaming snack: chips in hand or clean controllers?', 'Chips in hand', 'Clean controllers'),
  ],
  Anime: [
    q('New anime: binge all night or one episode daily?', 'Binge all night', 'One daily'),
    q('Anime night: subtitles or dubbed?', 'Subtitles', 'Dubbed'),
    q('Favourite arc: emotional or epic fights?', 'Emotional', 'Epic fights'),
    q('Finale spoiled: furious or shrug it off?', 'Furious', 'Shrug it off'),
  ],
  Books: [
    q('Reading nook: paperback pages or e-reader?', 'Paperback', 'E-reader'),
    q('Book club: finish the novel or skim the summary?', 'Finish novel', 'Skim summary'),
    q('Bookmarks: dog-ear pages or use a bookmark?', 'Dog-ear it', 'Proper bookmark'),
    q('Story craving: thriller twist or slow romance?', 'Thriller twist', 'Slow romance'),
  ],
  Fitness: [
    q('Gym time: sunrise session or late evening?', 'Sunrise session', 'Late evening'),
    q('Workout partner: push each other or go solo?', 'Push each other', 'Go solo'),
    q('Rest day: stay active or full couch?', 'Stay active', 'Full couch'),
    q('Post-gym treat: biryani or protein shake?', 'Biryani', 'Protein shake'),
  ],
  Fashion: [
    q('Getting ready: outfit planned or last-minute chaos?', 'Planned outfit', 'Last-minute chaos'),
    q('Shopping trip: browse for hours or buy fast?', 'Browse for hours', 'Buy fast'),
    q('Wedding outfit: classic traditional or trendy fusion?', 'Classic traditional', 'Trendy fusion'),
    q('Date night shoes: sneakers or something dressy?', 'Sneakers', 'Dressy shoes'),
  ],
  Pets: [
    q('Pet naps: allowed on the bed or floor only?', 'On the bed', 'Floor only'),
    q('Pet walk duty: morning rounds or evening stroll?', 'Morning rounds', 'Evening stroll'),
    q('Pet photos: post daily or keep private?', 'Post daily', 'Keep private'),
    q('Adopting: rescue a stray or choose a breed?', 'Rescue a stray', 'Choose a breed'),
  ],
  Memes: [
    q('Meme drop: send instantly or save for later?', 'Send instantly', 'Save for later'),
    q('Funny meme: laugh out loud or silent smirk?', 'Laugh out loud', 'Silent smirk'),
    q('Meme battle: counter-meme or reply with text?', 'Counter-meme', 'Reply with text'),
    q('Funny chat screenshot: share it or keep private?', 'Share it', 'Keep private'),
  ],
  'Late-night snacks': [
    q('Midnight hunger: instant noodles or cold pizza?', 'Instant noodles', 'Cold pizza'),
    q('Snack run: delivery app or walk to the shop?', 'Delivery app', 'Walk to shop'),
    q('Late snack rule: share one or order separately?', 'Share one', 'Order separately'),
    q('Fridge raid: leftover biryani or something sweet?', 'Leftover biryani', 'Something sweet'),
  ],
};

// "Who is more likely to…" questions; the two options are the players' own names.
const WHO = [
  'Who falls asleep first during movies?',
  'Who takes longer to get ready?',
  'Who forgets plans more often?',
  'Who apologises first after a silly fight?',
  'Who hogs the blanket at night?',
  'Who is the better planner?',
  'Who texts back slower?',
  'Who gets dramatic when ill?',
  'Who gets lost more easily?',
  'Who spends more on snacks?',
  'Who controls the playlist on drives?',
  'Who would cry first at a movie?',
  'Who is the messier one?',
  'Who panics more when plans change?',
  'Who is more likely to plan a surprise?',
  'Who is more likely to burn the dinner?',
  'Who is more likely to book tickets at the last minute?',
  'Who is more likely to text first after a fight?',
  'Who is more likely to sing in the shower?',
  'Who is more likely to overpack for a short trip?',
  'Who is more likely to start a pillow fight?',
  'Who is more likely to remember tiny details?',
  'Who is more likely to take a hundred photos?',
  'Who is more likely to be late to a date?',
  'Who is more likely to pick the movie?',
  'Who is more likely to talk to strangers on a train?',
  'Who is more likely to cry happy tears?',
  'Who is more likely to adopt a stray?',
];

// Flat list for callers that just want "the general deck" (kept for compatibility).
export const FALLBACK_QUESTIONS = [...GENERAL, ...Object.values(BANK).flat()];

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Builds a deck that fits the couple: some "who" questions with their names, interest-tagged
// questions spread across everything they picked, and general ones to fill. Skips anything
// already asked in earlier rounds (`avoid`, plain question strings), exactly or by similarity.
export function pickFallback({ p1, p2, avoid = [], count = 30 }) {
  const names = [p1?.name || 'Player 1', p2?.name || 'Player 2'];
  const picked = [];
  const take = (item) => {
    if (picked.length >= count) return;
    if (similarToAny(item, avoid)) return;
    if (picked.some((p) => isSimilar(p, item))) return;
    picked.push(item);
  };

  // "About us" turns the deck into mostly "who is more likely" questions about the two of them
  const aboutUs = (p1?.interests || []).includes(ABOUT_US) || (p2?.interests || []).includes(ABOUT_US);
  shuffle(WHO).slice(0, aboutUs ? 14 : 6).forEach((text) => take({ q: text, a: names[0], b: names[1] }));

  // interests both players picked come first, then the rest; round-robin so each gets airtime
  const a = p1?.interests || [];
  const b = p2?.interests || [];
  const order = [...a.filter((i) => b.includes(i)), ...a.filter((i) => !b.includes(i)), ...b.filter((i) => !a.includes(i))];
  const pools = order.filter((i) => BANK[i]).map((i) => shuffle(BANK[i]));
  for (let round = 0; round < 4 && picked.length < 20; round++) {
    pools.forEach((pool) => pool[round] && take(pool[round]));
  }

  shuffle(GENERAL).forEach(take);
  // still short (tiny pools, long avoid list): relax to anything unused
  shuffle(FALLBACK_QUESTIONS).forEach((item) => {
    if (picked.length < count && !picked.includes(item)) picked.push(item);
  });
  return shuffle(picked).slice(0, count);
}
