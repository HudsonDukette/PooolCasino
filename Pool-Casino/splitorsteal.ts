export interface SplitStealState {
  choices: Record<number, "split" | "steal">;
}

export function initGameState(): SplitStealState {
  return { choices: {} };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: SplitStealState,
  userId: number,
  action: string,
  payload: any
): null | { roundDone: boolean; roundWinnerId: number | null; result: any; stateUpdate: Partial<SplitStealState> } {
  if (action !== "pick") return null;
  const choice = payload?.choice as "split" | "steal";
  if (!["split", "steal"].includes(choice)) return null;
  if (state.choices[userId]) return null;

  const updated = { ...state.choices, [userId]: choice };

  if (!updated[p1Id] || !updated[p2Id]) {
    return { roundDone: false, roundWinnerId: null, result: null, stateUpdate: { choices: updated } };
  }

  const p1Choice = updated[p1Id];
  const p2Choice = updated[p2Id];

  let roundWinnerId: number | null = null;
  if (p1Choice === "steal" && p2Choice === "split") roundWinnerId = p1Id;
  else if (p2Choice === "steal" && p1Choice === "split") roundWinnerId = p2Id;

  const result = { p1Choice, p2Choice, roundWinnerId };
  return { roundDone: true, roundWinnerId, result, stateUpdate: { choices: {} } };
}
