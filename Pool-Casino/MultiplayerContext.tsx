import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useGetMe } from "@workspace/api-client-react";

export type GameType =
  | "war" | "highlow" | "coinflip" | "rps" | "dicebattle"
  | "bjpvp" | "poker" | "memory" | "speedclick" | "numguess"
  | "reaction" | "tugofwar" | "quickmath" | "cardrace" | "lastman"
  | "splitorsteal" | "riskdice" | "duelflip" | "riskauction" | "quickdraw" | "balancebattle";

export interface MatchFoundEvent {
  matchId: number;
  gameType: GameType;
  opponent: { userId: number; username: string };
  timeoutSeconds: number;
}

export interface MatchStartEvent {
  matchId: number;
  gameType: GameType;
  finalBet: number;
  totalRounds: number;
  scores: Record<number, number>;
  opponent: { userId: number; username: string };
}

export interface RoundResultEvent {
  round: number;
  total: number;
  result: any;
  scores: Record<number, number>;
}

export interface MatchEndEvent {
  matchId: number;
  winnerId: number | null;
  youWon: boolean;
  reason: string;
  scores: Record<number, number>;
  finalBet: number;
}

export interface LobbyStats {
  [gameType: string]: { queued: number; playing: number };
}

interface MultiplayerContextValue {
  socket: Socket | null;
  connected: boolean;
  queued: boolean;
  queueGameType: GameType | null;
  matchFound: MatchFoundEvent | null;
  currentMatch: MatchStartEvent | null;
  lastRound: RoundResultEvent | null;
  matchEnd: MatchEndEvent | null;
  hlFirstRoll: number | null;
  pvpEvent: { event: string; data: any } | null;
  lobbyStats: LobbyStats;
  joinQueue: (gameType: GameType) => void;
  leaveQueue: () => void;
  acceptMatch: (matchId: number) => void;
  placeBet: (matchId: number, betAmount: number) => void;
  sendAction: (matchId: number, action: string, payload?: any) => void;
  forfeitMatch: (matchId: number) => void;
  clearMatchEnd: () => void;
  clearMatchFound: () => void;
  clearPvpEvent: () => void;
}

const MultiplayerContext = createContext<MultiplayerContextValue | null>(null);

const GAME_SPECIFIC_EVENTS = [
  "speedclick:start",
  "reaction:waiting",
  "reaction:go",
  "quickmath:question",
  "bjpvp:dealt",
  "bjpvp:update",
  "memory:start",
  "cardrace:start",
  "cardrace:update",
  "highlow:waiting_guess",
  "quickdraw:waiting",
  "quickdraw:decoy",
  "quickdraw:draw",
];

export function MultiplayerProvider({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetMe({ query: { retry: false } });
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [queued, setQueued] = useState(false);
  const [queueGameType, setQueueGameType] = useState<GameType | null>(null);
  const [matchFound, setMatchFound] = useState<MatchFoundEvent | null>(null);
  const [currentMatch, setCurrentMatch] = useState<MatchStartEvent | null>(null);
  const [lastRound, setLastRound] = useState<RoundResultEvent | null>(null);
  const [matchEnd, setMatchEnd] = useState<MatchEndEvent | null>(null);
  const [hlFirstRoll, setHlFirstRoll] = useState<number | null>(null);
  const [pvpEvent, setPvpEvent] = useState<{ event: string; data: any } | null>(null);
  const [lobbyStats, setLobbyStats] = useState<LobbyStats>({});

  const userId = user?.id;

  useEffect(() => {
    if (!userId || user?.isGuest) return;

    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      auth: { userId },
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => {
      setConnected(false);
      setQueued(false);
      setQueueGameType(null);
    });

    socket.on("queue:status", ({ queued: q, gameType }: { queued: boolean; gameType?: GameType }) => {
      setQueued(q);
      setQueueGameType(q && gameType ? gameType : null);
    });

    socket.on("match:found", (data: MatchFoundEvent) => {
      setMatchFound(data);
      setQueued(false);
      setQueueGameType(null);
    });

    socket.on("match:start", (data: MatchStartEvent) => {
      setMatchFound(null);
      setCurrentMatch(data);
      setLastRound(null);
      setMatchEnd(null);
      setHlFirstRoll(null);
      setPvpEvent(null);
    });

    socket.on("match:round", (data: RoundResultEvent) => {
      setLastRound(data);
      setCurrentMatch(prev => prev ? { ...prev, scores: data.scores } : prev);
      setHlFirstRoll(null);
    });

    socket.on("match:end", (data: MatchEndEvent) => {
      setMatchEnd(data);
      setCurrentMatch(null);
    });

    socket.on("highlow:first_roll", ({ roll }: { roll: number }) => {
      setHlFirstRoll(roll);
    });

    socket.on("lobby:stats", (stats: LobbyStats) => {
      setLobbyStats(stats);
    });

    for (const evName of GAME_SPECIFIC_EVENTS) {
      socket.on(evName, (data: any) => {
        setPvpEvent({ event: evName, data });
      });
    }

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setQueued(false);
    };
  }, [userId, user?.isGuest]);

  const joinQueue = useCallback((gameType: GameType) => {
    socketRef.current?.emit("queue:join", { gameType });
  }, []);

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit("queue:leave");
  }, []);

  const acceptMatch = useCallback((matchId: number) => {
    socketRef.current?.emit("match:accept", { matchId });
  }, []);

  const placeBet = useCallback((matchId: number, betAmount: number) => {
    socketRef.current?.emit("match:bet", { matchId, betAmount });
  }, []);

  const sendAction = useCallback((matchId: number, action: string, payload?: any) => {
    socketRef.current?.emit("match:action", { matchId, action, payload });
  }, []);

  const forfeitMatch = useCallback((matchId: number) => {
    socketRef.current?.emit("match:forfeit", { matchId });
  }, []);

  const clearMatchEnd = useCallback(() => setMatchEnd(null), []);
  const clearMatchFound = useCallback(() => setMatchFound(null), []);
  const clearPvpEvent = useCallback(() => setPvpEvent(null), []);

  return (
    <MultiplayerContext.Provider value={{
      socket: socketRef.current,
      connected, queued, queueGameType,
      matchFound, currentMatch, lastRound, matchEnd,
      hlFirstRoll, pvpEvent, lobbyStats,
      joinQueue, leaveQueue, acceptMatch, placeBet,
      sendAction, forfeitMatch, clearMatchEnd, clearMatchFound, clearPvpEvent,
    }}>
      {children}
    </MultiplayerContext.Provider>
  );
}

export function useMultiplayer() {
  const ctx = useContext(MultiplayerContext);
  if (!ctx) throw new Error("useMultiplayer must be used within MultiplayerProvider");
  return ctx;
}
