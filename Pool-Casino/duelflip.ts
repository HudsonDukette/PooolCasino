export type DuelChoice = "call" | "fold";

export interface DuelFlipState {
  choices: Record<number, DuelChoice>;
}

export function initGameState(): DuelFlipState {
  return { choices: {} };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: DuelFlipState,
  userId: number,
  action: string,
  payload: any
): null | { roundDone: boolean; roundWinnerId: number | null; result: any; stateUpdate: Partial<DuelFlipState> } {
  if (action !== "pick") return null;
  const choice = payload?.choice as DuelChoice;
  if (!["call", "fold"].includes(choice)) return null;
  if (state.choices[userId] !== undefined) return null;

  const updated = { ...state.choices, [userId]: choice };

  if (updated[p1Id] === undefined || updated[p2Id] === undefined) {
    return { roundDone: false, roundWinnerId: null, result: null, stateUpdate: { choices: updated } };
  }

  const p1Choice = updated[p1Id];
  const p2Choice = updated[p2Id];

  let roundWinnerId: number | null = null;

  if (p1Choice === "fold" && p2Choice === "fold") {
    roundWinnerId = null;
  } else if (p1Choice === "fold") {
    roundWinnerId = p2Id;
  } else if (p2Choice === "fold") {
    roundWinnerId = p1Id;
  } else {
    roundWinnerId = Math.random() < 0.5 ? p1Id : p2Id;
  }

  const flip = Math.random() < 0.5 ? "heads" : "tails";
  const result = { p1Choice, p2Choice, flip, roundWinnerId };
  return { roundDone: true, roundWinnerId, result, stateUpdate: { choices: {} } };
}
