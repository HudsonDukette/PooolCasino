export interface MemoryState {
  grid: string[];
  matched: boolean[];
  flipped: number[];
  turn: number;
  scores: Record<number, number>;
  pairsFound: number;
}

const TOTAL_PAIRS = 8;

export function initGameState(p1Id: number, p2Id: number): MemoryState {
  const values = [...Array(TOTAL_PAIRS).keys()].map(i => String(i + 1));
  const pairs = [...values, ...values];
  const shuffled = pairs.sort(() => Math.random() - 0.5);
  return {
    grid: shuffled,
    matched: Array(16).fill(false),
    flipped: [],
    turn: p1Id,
    scores: { [p1Id]: 0, [p2Id]: 0 },
    pairsFound: 0,
  };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: MemoryState,
  userId: number,
  action: string,
  payload: any
): null | {
  roundDone: boolean;
  roundWinnerId: number | null;
  result: any;
  stateUpdate: Partial<MemoryState>;
  gameDone?: boolean;
  gameWinnerId?: number | null;
} {
  if (action !== "flip") return null;
  if (state.turn !== userId) return null;
  const index = parseInt(payload?.index);
  if (isNaN(index) || index < 0 || index >= 16) return null;
  if (state.matched[index]) return null;
  if (state.flipped.includes(index)) return null;
  if (state.flipped.length >= 2) return null;

  const newFlipped = [...state.flipped, index];

  if (newFlipped.length < 2) {
    return {
      roundDone: false,
      roundWinnerId: null,
      result: { flipped: newFlipped, turn: userId, matched: state.matched, scores: state.scores, phase: "first_flip" },
      stateUpdate: { flipped: newFlipped },
    };
  }

  const [i1, i2] = newFlipped;
  const matched = state.grid[i1] === state.grid[i2];
  const newMatched = [...state.matched];
  const newScores = { ...state.scores };
  let nextTurn = userId === p1Id ? p2Id : p1Id;
  let newPairsFound = state.pairsFound;

  if (matched) {
    newMatched[i1] = true;
    newMatched[i2] = true;
    newScores[userId] = (newScores[userId] ?? 0) + 1;
    nextTurn = userId;
    newPairsFound++;
  }

  const gameDone = newPairsFound >= TOTAL_PAIRS;
  let gameWinnerId: number | null = null;
  if (gameDone) {
    if (newScores[p1Id] > newScores[p2Id]) gameWinnerId = p1Id;
    else if (newScores[p2Id] > newScores[p1Id]) gameWinnerId = p2Id;
  }

  const result = {
    flipped: newFlipped,
    matched: newMatched,
    isMatch: matched,
    scores: newScores,
    turn: gameDone ? null : nextTurn,
    pairsFound: newPairsFound,
    gameDone,
    gameWinnerId: gameDone ? gameWinnerId : undefined,
  };

  return {
    roundDone: matched || !matched,
    roundWinnerId: matched ? userId : null,
    result,
    stateUpdate: {
      matched: newMatched,
      flipped: [],
      turn: nextTurn,
      scores: newScores,
      pairsFound: newPairsFound,
    },
    gameDone,
    gameWinnerId: gameDone ? gameWinnerId : undefined,
  };
}
