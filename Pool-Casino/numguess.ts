export interface NumGuessState {
  target: number;
  guesses: Record<number, number>;
}

export function initGameState(): NumGuessState {
  return { target: Math.floor(Math.random() * 100) + 1, guesses: {} };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: NumGuessState,
  userId: number,
  action: string,
  payload: any
): null | { roundDone: boolean; roundWinnerId: number | null; result: any; stateUpdate: Partial<NumGuessState> } {
  if (action !== "guess") return null;
  const guess = parseInt(payload?.guess);
  if (isNaN(guess) || guess < 1 || guess > 100) return null;
  if (state.guesses[userId] !== undefined) return null;

  const updated = { ...state.guesses, [userId]: guess };

  if (updated[p1Id] === undefined || updated[p2Id] === undefined) {
    return { roundDone: false, roundWinnerId: null, result: null, stateUpdate: { guesses: updated } };
  }

  const { target } = state;
  const p1Dist = Math.abs(updated[p1Id] - target);
  const p2Dist = Math.abs(updated[p2Id] - target);

  let roundWinnerId: number | null = null;
  if (p1Dist < p2Dist) roundWinnerId = p1Id;
  else if (p2Dist < p1Dist) roundWinnerId = p2Id;

  const result = { target, p1Guess: updated[p1Id], p2Guess: updated[p2Id], p1Dist, p2Dist, roundWinnerId };
  return {
    roundDone: true,
    roundWinnerId,
    result,
    stateUpdate: { target: Math.floor(Math.random() * 100) + 1, guesses: {} },
  };
}
