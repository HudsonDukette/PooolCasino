export interface TugOfWarState {
  bar: number;
  taps: number;
}

export function initGameState(p1Id: number, _p2Id: number): TugOfWarState {
  return { bar: 50, taps: 0 };
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: TugOfWarState,
  userId: number,
  action: string,
  _payload: any
): null | { roundDone: boolean; roundWinnerId: number | null; result: any; stateUpdate: Partial<TugOfWarState>; gameDone?: boolean } {
  if (action !== "tap") return null;

  const step = 5;
  const newBar = userId === p1Id ? state.bar - step : state.bar + step;
  const clampedBar = Math.max(0, Math.min(100, newBar));
  const newTaps = state.taps + 1;
  const maxTaps = 30;

  const gameDone = clampedBar <= 0 || clampedBar >= 100 || newTaps >= maxTaps;
  let gameWinnerId: number | null = null;
  if (gameDone) {
    if (clampedBar <= 0) gameWinnerId = p1Id;
    else if (clampedBar >= 100) gameWinnerId = p2Id;
    else if (clampedBar < 50) gameWinnerId = p1Id;
    else if (clampedBar > 50) gameWinnerId = p2Id;
  }

  const result = { bar: clampedBar, taps: newTaps, tapperId: userId, gameDone, gameWinnerId };
  return {
    roundDone: gameDone,
    roundWinnerId: gameDone ? gameWinnerId : null,
    result,
    stateUpdate: { bar: clampedBar, taps: newTaps },
    gameDone,
  };
}
