export type RiskLevel = 1 | 2 | 3 | 4 | 5;

export interface BalanceBattleState {
  picks: Record<number, RiskLevel>;
}

export function initGameState(): BalanceBattleState {
  return { picks: {} };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: BalanceBattleState,
  userId: number,
  action: string,
  payload: any
): null | { roundDone: boolean; roundWinnerId: number | null; result: any; stateUpdate: Partial<BalanceBattleState> } {
  if (action !== "pick") return null;
  const level = payload?.level as RiskLevel;
  if (![1, 2, 3, 4, 5].includes(level)) return null;
  if (state.picks[userId] !== undefined) return null;

  const updated = { ...state.picks, [userId]: level };

  if (updated[p1Id] === undefined || updated[p2Id] === undefined) {
    return { roundDone: false, roundWinnerId: null, result: null, stateUpdate: { picks: updated } };
  }

  const p1Level = updated[p1Id];
  const p2Level = updated[p2Id];

  const target = Math.ceil(Math.random() * 5) as RiskLevel;

  const p1Diff = Math.abs(p1Level - target);
  const p2Diff = Math.abs(p2Level - target);

  let roundWinnerId: number | null = null;
  if (p1Diff < p2Diff) roundWinnerId = p1Id;
  else if (p2Diff < p1Diff) roundWinnerId = p2Id;
  else roundWinnerId = Math.random() < 0.5 ? p1Id : p2Id;

  const riskLabels: Record<RiskLevel, string> = { 1: "Safe", 2: "Low", 3: "Medium", 4: "High", 5: "Max" };
  const result = {
    p1Level, p2Level,
    p1Label: riskLabels[p1Level], p2Label: riskLabels[p2Level],
    target, targetLabel: riskLabels[target],
    p1Diff, p2Diff, roundWinnerId,
  };
  return { roundDone: true, roundWinnerId, result, stateUpdate: { picks: {} } };
}
