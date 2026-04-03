import { Server } from "socket.io";

export interface QuickDrawState {
  phase: "waiting" | "decoy" | "ready" | "resolved";
  reacted: Record<number, number | "early">;
}

export function initGameState(): QuickDrawState {
  return { phase: "waiting", reacted: {} };
}

export function startRound(
  io: Server,
  p1: { userId: number; socketId: string },
  p2: { userId: number; socketId: string },
  state: QuickDrawState,
  onRoundDone: (result: any, winnerId: number | null) => void
): ReturnType<typeof setTimeout> {
  state.phase = "waiting";
  state.reacted = {};

  for (const p of [p1, p2]) io.to(p.socketId).emit("quickdraw:waiting");

  const decoyDelay = 1000 + Math.random() * 1500;
  const realDelay = decoyDelay + 800 + Math.random() * 2000;

  const decoyTimer = setTimeout(() => {
    if (state.phase !== "waiting") return;
    state.phase = "decoy";
    for (const p of [p1, p2]) io.to(p.socketId).emit("quickdraw:decoy");

    setTimeout(() => {
      if (state.phase !== "decoy") return;
      state.phase = "ready";
      for (const p of [p1, p2]) io.to(p.socketId).emit("quickdraw:draw");

      setTimeout(() => {
        if (state.phase !== "resolved") {
          state.phase = "resolved";
          resolve(p1, p2, state, onRoundDone);
        }
      }, 3000);
    }, realDelay - decoyDelay);
  }, decoyDelay);

  return decoyTimer;
}

function resolve(
  p1: { userId: number },
  p2: { userId: number },
  state: QuickDrawState,
  onRoundDone: (result: any, winnerId: number | null) => void
) {
  const p1React = state.reacted[p1.userId];
  const p2React = state.reacted[p2.userId];
  const p1Time = typeof p1React === "number" ? p1React : null;
  const p2Time = typeof p2React === "number" ? p2React : null;

  let winnerId: number | null = null;
  if (p1React === "early" && p2React !== "early") winnerId = p2.userId;
  else if (p2React === "early" && p1React !== "early") winnerId = p1.userId;
  else if (p1Time !== null && p2Time === null) winnerId = p1.userId;
  else if (p2Time !== null && p1Time === null) winnerId = p2.userId;
  else if (p1Time !== null && p2Time !== null) winnerId = p1Time <= p2Time ? p1.userId : p2.userId;

  onRoundDone({ p1Reaction: p1React, p2Reaction: p2React, winnerId }, winnerId);
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: QuickDrawState,
  userId: number,
  action: string,
  _payload: any
): "early" | "draw" | null {
  if (action !== "draw") return null;
  if (state.reacted[userId] !== undefined) return null;

  if (state.phase === "waiting" || state.phase === "decoy") {
    state.reacted[userId] = "early";
    return "early";
  }

  if (state.phase === "ready") {
    state.reacted[userId] = Date.now();
    return "draw";
  }

  return null;
}
