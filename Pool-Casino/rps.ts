export type RPSChoice = "rock" | "paper" | "scissors";

export interface RPSState {
  choices: Record<number, RPSChoice>;
}

export function initGameState(): RPSState {
  return { choices: {} };
}

function resolve(a: RPSChoice, b: RPSChoice): "a" | "b" | "tie" {
  if (a === b) return "tie";
  if ((a === "rock" && b === "scissors") || (a === "scissors" && b === "paper") || (a === "paper" && b === "rock")) return "a";
  return "b";
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: RPSState,
  userId: number,
  action: string,
  payload: any
): null | { roundDone: boolean; roundWinnerId: number | null; result: any; stateUpdate: Partial<RPSState> } {
  if (action !== "pick") return null;
  const choice = payload?.choice as RPSChoice;
  if (!["rock", "paper", "scissors"].includes(choice)) return null;
  if (state.choices[userId]) return null;

  const updated = { ...state.choices, [userId]: choice };

  if (!updated[p1Id] || !updated[p2Id]) {
    return { roundDone: false, roundWinnerId: null, result: null, stateUpdate: { choices: updated } };
  }

  const outcome = resolve(updated[p1Id], updated[p2Id]);
  let roundWinnerId: number | null = null;
  if (outcome === "a") roundWinnerId = p1Id;
  else if (outcome === "b") roundWinnerId = p2Id;

  const result = { p1Choice: updated[p1Id], p2Choice: updated[p2Id], roundWinnerId };
  return { roundDone: true, roundWinnerId, result, stateUpdate: { choices: {} } };
}
