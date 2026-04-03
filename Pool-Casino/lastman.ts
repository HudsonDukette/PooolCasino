export interface LastManState {
  decisions: Record<number, "stay" | "fold" | null>;
  failChances: number[];
}

const FAIL_CHANCES = [0.2, 0.35, 0.5, 0.65, 0.8];

export function initGameState(): LastManState {
  return { decisions: {}, failChances: FAIL_CHANCES };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: LastManState,
  userId: number,
  action: string,
  _payload: any,
  currentRound: number
): null | {
  roundDone: boolean;
  roundWinnerId: number | null;
  result: any;
  stateUpdate: Partial<LastManState>;
  gameDone?: boolean;
  gameWinnerId?: number | null;
} {
  if (!["stay", "fold"].includes(action)) return null;
  if (state.decisions[userId] !== null && state.decisions[userId] !== undefined) return null;

  const updated = { ...state.decisions, [userId]: action as "stay" | "fold" };

  if (updated[p1Id] === undefined || updated[p1Id] === null || updated[p2Id] === undefined || updated[p2Id] === null) {
    return { roundDone: false, roundWinnerId: null, result: null, stateUpdate: { decisions: updated } };
  }

  const p1Folded = updated[p1Id] === "fold";
  const p2Folded = updated[p2Id] === "fold";

  if (p1Folded || p2Folded) {
    const gameWinnerId = p1Folded && p2Folded ? null : p1Folded ? p2Id : p1Id;
    const result = { p1Decision: updated[p1Id], p2Decision: updated[p2Id], failRoll: null, gameWinnerId };
    return { roundDone: true, roundWinnerId: gameWinnerId, result, stateUpdate: { decisions: {} }, gameDone: true, gameWinnerId };
  }

  const riskChance = FAIL_CHANCES[Math.min(currentRound - 1, FAIL_CHANCES.length - 1)] ?? 0.8;
  const p1Roll = Math.random();
  const p2Roll = Math.random();
  const p1Failed = p1Roll < riskChance;
  const p2Failed = p2Roll < riskChance;

  let gameWinnerId: number | null = null;
  let gameDone = false;

  if (p1Failed || p2Failed) {
    gameDone = true;
    if (p1Failed && p2Failed) gameWinnerId = null;
    else if (p1Failed) gameWinnerId = p2Id;
    else gameWinnerId = p1Id;
  }

  const result = {
    p1Decision: updated[p1Id],
    p2Decision: updated[p2Id],
    riskChance,
    p1Roll: Math.round(p1Roll * 100) / 100,
    p2Roll: Math.round(p2Roll * 100) / 100,
    p1Failed,
    p2Failed,
    gameWinnerId: gameDone ? gameWinnerId : null,
  };

  return {
    roundDone: true,
    roundWinnerId: gameDone ? gameWinnerId : null,
    result,
    stateUpdate: { decisions: {} },
    gameDone,
    gameWinnerId: gameDone ? gameWinnerId : null,
  };
}
