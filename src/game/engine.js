import { GAME_CONFIG } from '../config.js';

// Pure game rules. Milestone 3 will mirror this logic inside a Firebase transaction.
export function initialState(questions) {
  return {
    status: 'playing', // playing | won | lost
    questions,
    index: 0,
    gap: GAME_CONFIG.startGap,
    answers: {}, // { p1: "A", p2: "B" } for the current question
    reveal: null, // { matched, option } while the result is showing
    matches: 0,
    answered: 0,
    lastMove: null, // closer | apart
    moveId: 0,
    startedAt: Date.now(),
    endedAt: null,
  };
}

export function reducer(state, action) {
  if (state.status !== 'playing') return state;
  switch (action.type) {
    case 'answer': {
      if (state.reveal || state.answers[action.slot]) return state; // answers are final
      const answers = { ...state.answers, [action.slot]: action.choice };
      if (!(answers.p1 && answers.p2)) return { ...state, answers };
      const matched = answers.p1 === answers.p2;
      const { matchMove, mismatchMove, maxGap } = GAME_CONFIG;
      const gap = matched
        ? Math.max(0, state.gap - matchMove)
        : Math.min(maxGap, state.gap + mismatchMove);
      const q = state.questions[state.index];
      return {
        ...state,
        answers,
        gap,
        matches: state.matches + (matched ? 1 : 0),
        answered: state.answered + 1,
        lastMove: matched ? 'closer' : 'apart',
        moveId: state.moveId + 1,
        reveal: { matched, option: matched ? (answers.p1 === 'A' ? q.a : q.b) : null },
      };
    }
    case 'next': {
      if (!state.reveal) return state;
      if (state.gap === 0) return { ...state, status: 'won', endedAt: Date.now(), reveal: null };
      if (state.index + 1 >= state.questions.length) {
        return { ...state, status: 'lost', endedAt: Date.now(), reveal: null };
      }
      return { ...state, index: state.index + 1, answers: {}, reveal: null };
    }
    case 'timeout':
      // A win already on the board (gap 0, mid-reveal) can't be overwritten.
      return { ...state, status: state.gap === 0 ? 'won' : 'lost', endedAt: Date.now(), reveal: null };
    default:
      return state;
  }
}
