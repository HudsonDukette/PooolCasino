export interface RiskDiceState {
  picks: Record<number, number>;
}

export function initGameState(): RiskDiceState {
  return { picks: {} };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: RiskDiceState,
  userId: number,
  action: string,
  payload: any
): null | { roundDone: boolean; roundWinnerId: number | null; result: any; stateUpdate: Partial<RiskDiceState> } {
  if (action !== "pick") return null;
  const pick = payload?.number as number;
  if (!Number.isInteger(pick) || pick < 1 || pick > 6) return null;
  if (state.picks[userId] !== undefined) return null;

  const updated = { ...state.picks, [userId]: pick };

  if (updated[p1Id] === undefined || updated[p2Id] === undefined) {
    return { roundDone: false, roundWinnerId: null, result: null, stateUpdate: { picks: updated } };
  }

  const roll = Math.floor(Math.random() * 6) + 1;
  const p1Pick = updated[p1Id];
  const p2Pick = updated[p2Id];
  const p1Diff = Math.abs(p1Pick - roll);
  const p2Diff = Math.abs(p2Pick - roll);

  let roundWinnerId: number | null = null;
  if (p1Diff < p2Diff) roundWinnerId = p1Id;
  else if (p2Diff < p1Diff) roundWinnerId = p2Id;
  else roundWinnerId = Math.random() < 0.5 ? p1Id : p2Id;

  const result = { roll, p1Pick, p2Pick, p1Diff, p2Diff, roundWinnerId };
  return { roundDone: true, roundWinnerId, result, stateUpdate: { picks: {} } };
}
