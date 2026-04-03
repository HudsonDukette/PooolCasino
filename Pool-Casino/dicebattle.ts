export interface DiceBattleState {
  triggered: boolean;
}

export function initGameState(): DiceBattleState {
  return { triggered: false };
}

function rollDice(n: number): number[] {
  return Array.from({ length: n }, () => Math.floor(Math.random() * 6) + 1);
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: DiceBattleState,
  userId: number,
  action: string,
  _payload: any
): null | { roundDone: boolean; roundWinnerId: number | null; result: any; stateUpdate: Partial<DiceBattleState> } {
  if (action !== "roll") return null;
  if (state.triggered) return null;

  const p1Dice = rollDice(2);
  const p2Dice = rollDice(2);
  const p1Total = p1Dice.reduce((a, b) => a + b, 0);
  const p2Total = p2Dice.reduce((a, b) => a + b, 0);

  let roundWinnerId: number | null = null;
  if (p1Total > p2Total) roundWinnerId = p1Id;
  else if (p2Total > p1Total) roundWinnerId = p2Id;

  const result = { p1Dice, p2Dice, p1Total, p2Total, roundWinnerId };
  return { roundDone: true, roundWinnerId, result, stateUpdate: { triggered: false } };
}
