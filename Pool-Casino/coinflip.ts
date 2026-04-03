export type CoinSide = "heads" | "tails";

export interface CoinFlipState {
  choices: Record<number, CoinSide>;
}

export function initGameState(): CoinFlipState {
  return { choices: {} };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: CoinFlipState,
  userId: number,
  action: string,
  payload: any
): null | { roundDone: boolean; roundWinnerId: number | null; result: any; stateUpdate: Partial<CoinFlipState> } {
  if (action !== "pick") return null;
  const choice = payload?.choice as CoinSide;
  if (!["heads", "tails"].includes(choice)) return null;
  if (state.choices[userId]) return null;

  const updated = { ...state.choices, [userId]: choice };

  if (!updated[p1Id] || !updated[p2Id]) {
    return { roundDone: false, roundWinnerId: null, result: null, stateUpdate: { choices: updated } };
  }

  const flip: CoinSide = Math.random() < 0.5 ? "heads" : "tails";
  const p1Correct = updated[p1Id] === flip;
  const p2Correct = updated[p2Id] === flip;

  let roundWinnerId: number | null = null;
  if (p1Correct && !p2Correct) roundWinnerId = p1Id;
  else if (p2Correct && !p1Correct) roundWinnerId = p2Id;

  const result = { flip, p1Choice: updated[p1Id], p2Choice: updated[p2Id], p1Correct, p2Correct, roundWinnerId };
  return { roundDone: true, roundWinnerId, result, stateUpdate: { choices: {} } };
}
