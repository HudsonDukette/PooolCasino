import { Server } from "socket.io";

export interface SpeedClickState {
  clicks: Record<number, number>;
  lastClickWindow: Record<number, number[]>;
  active: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export function initGameState(): SpeedClickState {
  return { clicks: {}, lastClickWindow: {}, active: false, timer: null };
}

const MAX_CLICKS_PER_SECOND = 15;
const GAME_DURATION_MS = 5000;

export function startTimer(
  io: Server,
  matchId: number,
  p1: { userId: number; socketId: string },
  p2: { userId: number; socketId: string },
  state: SpeedClickState,
  onDone: (result: any, winnerId: number | null) => void
): ReturnType<typeof setTimeout> {
  state.clicks[p1.userId] = 0;
  state.clicks[p2.userId] = 0;
  state.lastClickWindow[p1.userId] = [];
  state.lastClickWindow[p2.userId] = [];
  state.active = true;

  io.to(p1.socketId).emit("speedclick:start", { durationMs: GAME_DURATION_MS });
  io.to(p2.socketId).emit("speedclick:start", { durationMs: GAME_DURATION_MS });

  return setTimeout(() => {
    state.active = false;
    const p1Clicks = state.clicks[p1.userId] ?? 0;
    const p2Clicks = state.clicks[p2.userId] ?? 0;
    let winnerId: number | null = null;
    if (p1Clicks > p2Clicks) winnerId = p1.userId;
    else if (p2Clicks > p1Clicks) winnerId = p2.userId;
    onDone({ p1Clicks, p2Clicks, winnerId }, winnerId);
  }, GAME_DURATION_MS);
}

export function handleAction(
  _p1Id: number,
  _p2Id: number,
  state: SpeedClickState,
  userId: number,
  action: string,
  _payload: any
): null {
  if (action !== "click" || !state.active) return null;

  const now = Date.now();
  const window = (state.lastClickWindow[userId] ?? []).filter(t => now - t < 1000);
  if (window.length >= MAX_CLICKS_PER_SECOND) return null;

  window.push(now);
  state.lastClickWindow[userId] = window;
  state.clicks[userId] = (state.clicks[userId] ?? 0) + 1;

  return null;
}
