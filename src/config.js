export const GAME_CONFIG = {
  startGap: 10, // steps between the mascots
  matchMove: 2, // gap shrinks by this on a match (each mascot steps 1)
  mismatchMove: 2, // gap grows by this on a mismatch
  maxGap: 10, // gap can never exceed this
  durationSec: 60, // overall game timer
  questionsPerGame: 30,
  revealMs: 1200, // how long to show the result before the next question
};

export const INTERESTS = [
  'Movies', 'Bollywood', 'Cricket', 'Food', 'Travel', 'Music', 'Gaming',
  'Anime', 'Books', 'Fitness', 'Fashion', 'Pets', 'Memes', 'Late-night snacks', 'About us',
];
// 'About us' is special: instead of a topic, it turns its share of the deck into "Who is more likely to…"
// questions about the two of them (the options are their names).
export const ABOUT_US = 'About us';
