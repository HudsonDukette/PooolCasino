import { Server } from "socket.io";

export interface ReactionState {
  phase: "waiting" | "ready" | "resolved";
  reacted: Record<number, number | "early">;
  goTimer: ReturnType<typeof setTimeout> | null;
}

export function initGameState(): ReactionState {
  return { phase: "waiting", reacted: {}, goTimer: null };
}

export function startRound(
  io: Server,
  p1: { userId: number; socketId: string },
  p2: { userId: number; socketId: string },
  state: ReactionState,
  onRoundDone: (result: any, winnerId: number | null) => void
): ReturnType<typeof setTimeout> {
  state.phase = "waiting";
  state.reacted = {};

  io.to(p1.socketId).emit("reaction:waiting");
  io.to(p2.socketId).emit("reaction:waiting");

  const delay = 2000 + Math.random() * 3000;

  return setTimeout(() => {
    state.phase = "ready";
    const goTime = Date.now();
    io.to(p1.socketId).emit("reaction:go");
    io.to(p2.socketId).emit("reaction:go");

    setTimeout(() => {
      if (state.phase !== "resolved") {
        state.phase = "resolved";
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
    }, 3000);
  }, delay);
}

export function handleAction(
  p1Id: number,
  p2Id: number,
  state: ReactionState,
  userId: number,
  action: string,
  _payload: any
): "early" | "reaction" | null {
  if (action !== "react") return null;
  if (state.reacted[userId] !== undefined) return null;

  if (state.phase === "waiting") {
    state.reacted[userId] = "early";
    return "early";
  }

  if (state.phase === "ready") {
    state.reacted[userId] = Date.now();
    return "reaction";
  }

  return null;
}
