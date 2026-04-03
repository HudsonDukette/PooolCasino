import { Server, Socket } from "socket.io";
import { db, pool, usersTable, matchesTable, matchPlayersTable, matchRoundsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { playWarRound } from "./games/war";
import { playHighLowRound, type HighLowGuess } from "./games/highlow";
import * as CoinFlip from "./games/coinflip";
import * as RPS from "./games/rps";
import * as DiceBattle from "./games/dicebattle";
import * as NumGuess from "./games/numguess";
import * as TugOfWar from "./games/tugofwar";
import * as LastMan from "./games/lastman";
import * as CardRace from "./games/cardrace";
import * as QuickMath from "./games/quickmath";
import * as Memory from "./games/memory";
import * as BJPvP from "./games/bjpvp";
import * as Poker from "./games/poker";
import * as SpeedClick from "./games/speedclick";
import * as Reaction from "./games/reaction";
import * as SplitOrSteal from "./games/splitorsteal";
import * as RiskDice from "./games/riskdice";
import * as DuelFlip from "./games/duelflip";
import * as RiskAuction from "./games/riskauction";
import * as QuickDraw from "./games/quickdraw";
import * as BalanceBattle from "./games/balancebattle";
import { trackGameProgress } from "../lib/progress";
import { logger } from "../lib/logger";

const ALL_GAME_TYPES = [
  "war", "highlow", "coinflip", "rps", "dicebattle",
  "bjpvp", "poker", "memory", "speedclick", "numguess",
  "reaction", "tugofwar", "quickmath", "cardrace", "lastman",
  "splitorsteal", "riskdice", "duelflip", "riskauction", "quickdraw", "balancebattle",
];

const GAME_TOTAL_ROUNDS: Record<string, number> = {
  war: 3, highlow: 3, coinflip: 3, rps: 3, dicebattle: 3,
  bjpvp: 1, poker: 1, memory: 8, speedclick: 1, numguess: 3,
  reaction: 3, tugofwar: 30, quickmath: 5, cardrace: 1, lastman: 5,
  splitorsteal: 1, riskdice: 3, duelflip: 5, riskauction: 1, quickdraw: 3, balancebattle: 1,
};

interface PlayerRef { userId: number; username: string; socketId: string; }

interface QueueEntry {
  userId: number; username: string; socketId: string; gameType: string; queuedAt: number;
}

interface PendingMatch {
  matchId: number; gameType: string;
  player1: PlayerRef; player2: PlayerRef;
  bets: Record<number, number>; accepted: Set<number>;
  acceptTimeout: NodeJS.Timeout;
}

interface ActiveMatch {
  matchId: number; gameType: string;
  players: [PlayerRef, PlayerRef];
  finalBet: number; currentRound: number; totalRounds: number;
  scores: Record<number, number>; roundInProgress: boolean;
  gameState: any;
  timers: ReturnType<typeof setTimeout>[];
}

const queue: Map<string, QueueEntry> = new Map();
const pendingMatches: Map<number, PendingMatch> = new Map();
const activeMatches: Map<number, ActiveMatch> = new Map();
const userToMatch: Map<number, number> = new Map();

function broadcastLobbyStats(io: Server) {
  const stats: Record<string, { queued: number; playing: number }> = {};
  for (const gt of ALL_GAME_TYPES) {
    stats[gt] = {
      queued: [...queue.values()].filter(e => e.gameType === gt).length,
      playing: [...activeMatches.values()].filter(m => m.gameType === gt).length * 2,
    };
  }
  io.emit("lobby:stats", stats);
}

export function getLobbyStats() {
  const stats: Record<string, { queued: number; playing: number }> = {};
  for (const gt of ALL_GAME_TYPES) {
    stats[gt] = {
      queued: [...queue.values()].filter(e => e.gameType === gt).length,
      playing: [...activeMatches.values()].filter(m => m.gameType === gt).length * 2,
    };
  }
  return stats;
}

export function setupMatchmaking(io: Server) {
  io.on("connection", (socket: Socket) => {
    const userId = (socket.handshake.auth as any).userId as number | undefined;
    if (!userId) { socket.disconnect(); return; }
    socket.data.userId = userId;

    socket.on("queue:join", async ({ gameType }: { gameType: string }) => {
      if (!ALL_GAME_TYPES.includes(gameType)) return;
      if (userToMatch.has(userId)) { socket.emit("error", { message: "Already in a match" }); return; }

      const [user] = await db.select({ username: usersTable.username })
        .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!user) return;

      const existing = queue.get(`${userId}`);
      if (existing) { socket.emit("queue:status", { queued: true, gameType: existing.gameType }); return; }

      queue.set(`${userId}`, { userId, username: user.username, socketId: socket.id, gameType, queuedAt: Date.now() });
      socket.emit("queue:status", { queued: true, gameType });
      broadcastLobbyStats(io);
      tryMatchmake(io, gameType);
    });

    socket.on("queue:leave", () => {
      queue.delete(`${userId}`);
      socket.emit("queue:status", { queued: false });
      broadcastLobbyStats(io);
    });

    socket.on("match:bet", async ({ matchId, betAmount }: { matchId: number; betAmount: number }) => {
      const pending = pendingMatches.get(matchId);
      if (!pending) return;
      if (pending.player1.userId !== userId && pending.player2.userId !== userId) return;
      const bet = Math.max(0.01, parseFloat(betAmount.toString()) || 0);
      pending.bets[userId] = bet;
      socket.emit("match:bet_confirmed", { betAmount: bet });
      if (Object.keys(pending.bets).length === 2) {
        io.to(pending.player1.socketId).emit("match:both_bet");
        io.to(pending.player2.socketId).emit("match:both_bet");
      }
    });

    socket.on("match:accept", async ({ matchId }: { matchId: number }) => {
      const pending = pendingMatches.get(matchId);
      if (!pending) return;
      if (pending.player1.userId !== userId && pending.player2.userId !== userId) return;
      pending.accepted.add(userId);
      if (pending.accepted.size === 2) {
        clearTimeout(pending.acceptTimeout);
        await startMatch(io, pending);
      }
    });

    socket.on("match:action", async (data: { matchId: number; action: string; payload?: any }) => {
      const { matchId, action, payload } = data;
      const match = activeMatches.get(matchId);
      if (!match) return;
      if (!match.players.find(p => p.userId === userId)) return;
      const [p1, p2] = match.players;
      await dispatchAction(io, match, p1, p2, userId, action, payload);
    });

    socket.on("match:forfeit", async ({ matchId }: { matchId: number }) => {
      const match = activeMatches.get(matchId);
      if (!match) return;
      const opponent = match.players.find(p => p.userId !== userId);
      if (!opponent) return;
      await finalizeMatch(io, match, opponent.userId, "forfeit");
    });

    socket.on("disconnect", () => {
      queue.delete(`${userId}`);
      broadcastLobbyStats(io);
      const matchId = userToMatch.get(userId);
      if (matchId) {
        const match = activeMatches.get(matchId);
        if (match) {
          const opponent = match.players.find(p => p.userId !== userId);
          if (opponent) {
            const t = setTimeout(() => {
              const stillActive = activeMatches.get(matchId);
              if (stillActive) finalizeMatch(io, stillActive, opponent.userId, "disconnect");
            }, 30000);
            match.timers.push(t);
          }
        }
      }
    });
  });
}

function tryMatchmake(io: Server, gameType: string) {
  const waiting = [...queue.values()].filter(e => e.gameType === gameType);
  if (waiting.length < 2) return;
  const [p1, p2] = waiting;
  queue.delete(`${p1.userId}`);
  queue.delete(`${p2.userId}`);
  broadcastLobbyStats(io);
  createPendingMatch(io, gameType, p1, p2);
}

async function createPendingMatch(io: Server, gameType: string, p1: QueueEntry, p2: QueueEntry) {
  const [match] = await db.insert(matchesTable).values({ gameType, status: "pending" }).returning();
  const pending: PendingMatch = {
    matchId: match.id, gameType,
    player1: { userId: p1.userId, username: p1.username, socketId: p1.socketId },
    player2: { userId: p2.userId, username: p2.username, socketId: p2.socketId },
    bets: {}, accepted: new Set(),
    acceptTimeout: setTimeout(async () => {
      const p = pendingMatches.get(match.id);
      if (p) await startMatch(io, p);
    }, 10000),
  };
  pendingMatches.set(match.id, pending);
  const base = { matchId: match.id, gameType, timeoutSeconds: 10 };
  io.to(p1.socketId).emit("match:found", { ...base, opponent: { userId: p2.userId, username: p2.username } });
  io.to(p2.socketId).emit("match:found", { ...base, opponent: { userId: p1.userId, username: p1.username } });
}

function initGameState(gameType: string, p1Id: number, p2Id: number): any {
  switch (gameType) {
    case "coinflip": return CoinFlip.initGameState();
    case "rps": return RPS.initGameState();
    case "dicebattle": return DiceBattle.initGameState();
    case "numguess": return NumGuess.initGameState();
    case "tugofwar": return TugOfWar.initGameState(p1Id, p2Id);
    case "lastman": return LastMan.initGameState();
    case "cardrace": return CardRace.initGameState(p1Id, p2Id);
    case "quickmath": return QuickMath.initGameState();
    case "memory": return Memory.initGameState(p1Id, p2Id);
    case "bjpvp": return BJPvP.initGameState(p1Id, p2Id);
    case "poker": return Poker.initGameState(p1Id, p2Id);
    case "speedclick": return SpeedClick.initGameState();
    case "reaction": return Reaction.initGameState();
    case "highlow": return { hlFirstRoll: null as number | null, hlGuesses: {} as Record<number, string> };
    case "splitorsteal": return SplitOrSteal.initGameState();
    case "riskdice": return RiskDice.initGameState();
    case "duelflip": return DuelFlip.initGameState();
    case "riskauction": return RiskAuction.initGameState();
    case "quickdraw": return QuickDraw.initGameState();
    case "balancebattle": return BalanceBattle.initGameState();
    default: return {};
  }
}

async function startMatch(io: Server, pending: PendingMatch) {
  pendingMatches.delete(pending.matchId);
  const p1Bet = pending.bets[pending.player1.userId] ?? 100;
  const p2Bet = pending.bets[pending.player2.userId] ?? 100;
  const [p1User] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, pending.player1.userId)).limit(1);
  const [p2User] = await db.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, pending.player2.userId)).limit(1);
  const p1Balance = parseFloat(p1User?.balance ?? "0");
  const p2Balance = parseFloat(p2User?.balance ?? "0");
  const avgBet = (p1Bet + p2Bet) / 2;
  const clampedBet = Math.max(0.01, Math.min(avgBet, p1Balance, p2Balance));

  await Promise.all([
    db.insert(matchPlayersTable).values({ matchId: pending.matchId, userId: pending.player1.userId, betAmount: clampedBet.toFixed(2), accepted: true }),
    db.insert(matchPlayersTable).values({ matchId: pending.matchId, userId: pending.player2.userId, betAmount: clampedBet.toFixed(2), accepted: true }),
    db.update(matchesTable).set({ status: "active", startedAt: new Date(), finalBet: clampedBet.toFixed(2) }).where(eq(matchesTable.id, pending.matchId)),
  ]);

  const totalRounds = GAME_TOTAL_ROUNDS[pending.gameType] ?? 3;
  const gameState = initGameState(pending.gameType, pending.player1.userId, pending.player2.userId);

  const active: ActiveMatch = {
    matchId: pending.matchId, gameType: pending.gameType,
    players: [pending.player1, pending.player2],
    finalBet: clampedBet, currentRound: 0, totalRounds,
    scores: { [pending.player1.userId]: 0, [pending.player2.userId]: 0 },
    roundInProgress: false, gameState, timers: [],
  };
  activeMatches.set(pending.matchId, active);
  userToMatch.set(pending.player1.userId, pending.matchId);
  userToMatch.set(pending.player2.userId, pending.matchId);
  broadcastLobbyStats(io);

  const startPayload = {
    matchId: pending.matchId, gameType: pending.gameType, finalBet: clampedBet,
    totalRounds, scores: active.scores,
  };
  io.to(pending.player1.socketId).emit("match:start", { ...startPayload, opponent: { userId: pending.player2.userId, username: pending.player2.username } });
  io.to(pending.player2.socketId).emit("match:start", { ...startPayload, opponent: { userId: pending.player1.userId, username: pending.player1.username } });

  await onMatchStart(io, active);
}

async function onMatchStart(io: Server, match: ActiveMatch) {
  const [p1, p2] = match.players;
  switch (match.gameType) {
    case "poker": {
      const result = match.gameState.result;
      match.currentRound = 1;
      if (result.winnerId) match.scores[result.winnerId]++;
      await db.insert(matchRoundsTable).values({ matchId: match.matchId, roundNumber: 1, gameData: result as any, winnerId: result.winnerId });
      const rp = { round: 1, total: 1, result, scores: match.scores };
      for (const p of match.players) io.to(p.socketId).emit("match:round", rp);
      await finalizeMatch(io, match, result.winnerId, "normal");
      break;
    }
    case "speedclick": {
      const t = SpeedClick.startTimer(io, match.matchId, p1, p2, match.gameState, async (result, winnerId) => {
        match.currentRound = 1;
        if (winnerId) match.scores[winnerId]++;
        await db.insert(matchRoundsTable).values({ matchId: match.matchId, roundNumber: 1, gameData: result as any, winnerId });
        for (const p of match.players) io.to(p.socketId).emit("match:round", { round: 1, total: 1, result, scores: match.scores });
        await finalizeMatch(io, match, winnerId, "normal");
      });
      match.timers.push(t);
      break;
    }
    case "reaction": {
      startReactionRound(io, match);
      break;
    }
    case "quickdraw": {
      startQuickDrawRound(io, match);
      break;
    }
    case "quickmath": {
      const q = QuickMath.getInitialQuestion(match.gameState);
      for (const p of match.players) io.to(p.socketId).emit("quickmath:question", { question: q.display, round: 1, total: match.totalRounds });
      break;
    }
    case "bjpvp": {
      const { p1Hand, p2Hand, p1Total, p2Total } = BJPvP.getInitialState(match.gameState, p1.userId, p2.userId);
      io.to(p1.socketId).emit("bjpvp:dealt", { myHand: p1Hand, myTotal: p1Total, opponentTotal: p2Total });
      io.to(p2.socketId).emit("bjpvp:dealt", { myHand: p2Hand, myTotal: p2Total, opponentTotal: p1Total });
      break;
    }
    case "memory": {
      const grid = match.gameState.grid as string[];
      for (const p of match.players) io.to(p.socketId).emit("memory:start", { gridSize: grid.length, turn: match.gameState.turn });
      break;
    }
    case "cardrace": {
      for (const p of match.players) io.to(p.socketId).emit("cardrace:start", { totals: match.gameState.totals });
      break;
    }
    default: break;
  }
}

function startQuickDrawRound(io: Server, match: ActiveMatch) {
  const [p1, p2] = match.players;
  match.gameState = QuickDraw.initGameState();
  const t = QuickDraw.startRound(io, p1, p2, match.gameState, async (result, winnerId) => {
    match.currentRound++;
    if (winnerId) match.scores[winnerId]++;
    match.gameState.phase = "resolved";
    await db.insert(matchRoundsTable).values({ matchId: match.matchId, roundNumber: match.currentRound, gameData: result as any, winnerId });
    const rp = { round: match.currentRound, total: match.totalRounds, result, scores: match.scores };
    for (const p of match.players) io.to(p.socketId).emit("match:round", rp);
    if (match.currentRound >= match.totalRounds) {
      await finalizeMatch(io, match, getScoreWinner(match), "normal");
    } else {
      setTimeout(() => startQuickDrawRound(io, match), 2000);
    }
  });
  match.timers.push(t);
}

function startReactionRound(io: Server, match: ActiveMatch) {
  const [p1, p2] = match.players;
  const t = Reaction.startRound(io, p1, p2, match.gameState, async (result, winnerId) => {
    match.currentRound++;
    if (winnerId) match.scores[winnerId]++;
    match.gameState.phase = "resolved";

    await db.insert(matchRoundsTable).values({ matchId: match.matchId, roundNumber: match.currentRound, gameData: result as any, winnerId });
    const rp = { round: match.currentRound, total: match.totalRounds, result, scores: match.scores };
    for (const p of match.players) io.to(p.socketId).emit("match:round", rp);

    if (match.currentRound >= match.totalRounds) {
      const overallWinnerId = getScoreWinner(match);
      await finalizeMatch(io, match, overallWinnerId, "normal");
    } else {
      match.gameState = Reaction.initGameState();
      setTimeout(() => startReactionRound(io, match), 2000);
    }
  });
  match.timers.push(t);
}

async function dispatchAction(
  io: Server, match: ActiveMatch, p1: PlayerRef, p2: PlayerRef,
  userId: number, action: string, payload: any
) {
  const gt = match.gameType;

  if (gt === "war" && action === "draw") {
    await handleWarRound(io, match);
    return;
  }

  if (gt === "highlow") {
    await handleHighLowAction(io, match, userId, action, payload);
    return;
  }

  if (gt === "speedclick" && action === "click") {
    SpeedClick.handleAction(p1.userId, p2.userId, match.gameState, userId, action, payload);
    return;
  }

  if (gt === "reaction") {
    Reaction.handleAction(p1.userId, p2.userId, match.gameState, userId, action, payload);
    return;
  }

  if (gt === "quickdraw") {
    QuickDraw.handleAction(p1.userId, p2.userId, match.gameState, userId, action, payload);
    return;
  }

  if (gt === "tugofwar") {
    await handleTugOfWarAction(io, match, userId, action, payload);
    return;
  }

  if (gt === "memory") {
    await handleMemoryAction(io, match, userId, action, payload);
    return;
  }

  if (gt === "bjpvp") {
    await handleBJPvPAction(io, match, userId, action, payload);
    return;
  }

  if (gt === "cardrace") {
    await handleCardRaceAction(io, match, userId, action, payload);
    return;
  }

  if (gt === "lastman") {
    await handleLastManAction(io, match, userId, action, payload);
    return;
  }

  await handleGenericRoundAction(io, match, userId, action, payload);
}

async function handleGenericRoundAction(io: Server, match: ActiveMatch, userId: number, action: string, payload: any) {
  if (match.roundInProgress) return;
  const [p1, p2] = match.players;
  const p1Id = p1.userId;
  const p2Id = p2.userId;

  let result: ReturnType<typeof CoinFlip.handleAction>;

  switch (match.gameType) {
    case "coinflip": result = CoinFlip.handleAction(p1Id, p2Id, match.gameState, userId, action, payload); break;
    case "rps": result = RPS.handleAction(p1Id, p2Id, match.gameState, userId, action, payload); break;
    case "dicebattle": result = DiceBattle.handleAction(p1Id, p2Id, match.gameState, userId, action, payload); break;
    case "numguess": result = NumGuess.handleAction(p1Id, p2Id, match.gameState, userId, action, payload); break;
    case "quickmath": result = QuickMath.handleAction(p1Id, p2Id, match.gameState, userId, action, payload); break;
    case "splitorsteal": result = SplitOrSteal.handleAction(p1Id, p2Id, match.gameState, userId, action, payload); break;
    case "riskdice": result = RiskDice.handleAction(p1Id, p2Id, match.gameState, userId, action, payload); break;
    case "duelflip": result = DuelFlip.handleAction(p1Id, p2Id, match.gameState, userId, action, payload); break;
    case "riskauction": result = RiskAuction.handleAction(p1Id, p2Id, match.gameState, userId, action, payload); break;
    case "balancebattle": result = BalanceBattle.handleAction(p1Id, p2Id, match.gameState, userId, action, payload); break;
    default: return;
  }

  if (!result) return;

  Object.assign(match.gameState, result.stateUpdate);

  if (!result.roundDone) return;

  match.roundInProgress = true;
  match.currentRound++;
  if (result.roundWinnerId) match.scores[result.roundWinnerId]++;

  await db.insert(matchRoundsTable).values({
    matchId: match.matchId, roundNumber: match.currentRound,
    gameData: result.result as any, winnerId: result.roundWinnerId,
  });

  const rp = { round: match.currentRound, total: match.totalRounds, result: result.result, scores: match.scores };
  for (const p of match.players) io.to(p.socketId).emit("match:round", rp);

  if (match.gameType === "quickmath" && match.currentRound < match.totalRounds) {
    const q = QuickMath.getInitialQuestion(match.gameState);
    for (const p of match.players) io.to(p.socketId).emit("quickmath:question", { question: q.display, round: match.currentRound + 1, total: match.totalRounds });
  }

  match.roundInProgress = false;

  if (match.currentRound >= match.totalRounds) {
    await finalizeMatch(io, match, getScoreWinner(match), "normal");
  }
}

async function handleWarRound(io: Server, match: ActiveMatch) {
  if (match.roundInProgress) return;
  match.roundInProgress = true;
  match.currentRound++;
  const [p1, p2] = match.players;
  const result = playWarRound(p1.userId, p2.userId);
  if (result.winnerId) match.scores[result.winnerId]++;
  await db.insert(matchRoundsTable).values({ matchId: match.matchId, roundNumber: match.currentRound, gameData: result as any, winnerId: result.winnerId });
  const rp = { round: match.currentRound, total: match.totalRounds, result, scores: match.scores };
  for (const p of match.players) io.to(p.socketId).emit("match:round", rp);
  match.roundInProgress = false;
  if (match.currentRound >= match.totalRounds) {
    await finalizeMatch(io, match, getScoreWinner(match), "normal");
  }
}

async function handleHighLowAction(io: Server, match: ActiveMatch, userId: number, action: string, payload: any) {
  const gs = match.gameState;
  if (action === "reveal") {
    if (match.roundInProgress) return;
    match.roundInProgress = true;
    gs.hlFirstRoll = Math.floor(Math.random() * 6) + 1;
    gs.hlGuesses = {};
    for (const p of match.players) io.to(p.socketId).emit("highlow:first_roll", { roll: gs.hlFirstRoll, round: match.currentRound + 1 });
    return;
  }
  if (action === "guess") {
    const guess = payload?.guess as HighLowGuess;
    if (!["higher", "lower"].includes(guess)) return;
    gs.hlGuesses[userId] = guess;
    if (Object.keys(gs.hlGuesses).length < 2) {
      const sock = match.players.find(p => p.userId === userId);
      if (sock) io.to(sock.socketId).emit("highlow:waiting_guess");
      return;
    }
    match.currentRound++;
    const [p1, p2] = match.players;
    const secondRoll = Math.floor(Math.random() * 6) + 1;
    let actual: "higher" | "lower" | "same";
    if (secondRoll > gs.hlFirstRoll) actual = "higher";
    else if (secondRoll < gs.hlFirstRoll) actual = "lower";
    else actual = "same";
    const p1Correct = actual !== "same" && gs.hlGuesses[p1.userId] === actual;
    const p2Correct = actual !== "same" && gs.hlGuesses[p2.userId] === actual;
    let winnerId: number | null = null;
    if (p1Correct && !p2Correct) { winnerId = p1.userId; match.scores[p1.userId]++; }
    else if (p2Correct && !p1Correct) { winnerId = p2.userId; match.scores[p2.userId]++; }
    const result = { firstRoll: gs.hlFirstRoll, secondRoll, p1Guess: gs.hlGuesses[p1.userId], p2Guess: gs.hlGuesses[p2.userId], actual, winnerId };
    await db.insert(matchRoundsTable).values({ matchId: match.matchId, roundNumber: match.currentRound, gameData: result as any, winnerId });
    const rp = { round: match.currentRound, total: match.totalRounds, result, scores: match.scores };
    for (const p of match.players) io.to(p.socketId).emit("match:round", rp);
    gs.hlFirstRoll = null;
    gs.hlGuesses = {};
    match.roundInProgress = false;
    if (match.currentRound >= match.totalRounds) {
      await finalizeMatch(io, match, getScoreWinner(match), "normal");
    }
  }
}

async function handleTugOfWarAction(io: Server, match: ActiveMatch, userId: number, action: string, payload: any) {
  const [p1, p2] = match.players;
  const result = TugOfWar.handleAction(p1.userId, p2.userId, match.gameState, userId, action, payload);
  if (!result) return;
  Object.assign(match.gameState, result.stateUpdate);
  if (!result.roundDone) return;
  match.currentRound++;
  if (result.roundWinnerId) match.scores[result.roundWinnerId]++;
  await db.insert(matchRoundsTable).values({ matchId: match.matchId, roundNumber: match.currentRound, gameData: result.result as any, winnerId: result.roundWinnerId });
  const rp = { round: match.currentRound, total: match.totalRounds, result: result.result, scores: match.scores };
  for (const p of match.players) io.to(p.socketId).emit("match:round", rp);
  if (result.gameDone) {
    await finalizeMatch(io, match, result.roundWinnerId ?? null, "normal");
  }
}

async function handleMemoryAction(io: Server, match: ActiveMatch, userId: number, action: string, payload: any) {
  const [p1, p2] = match.players;
  const result = Memory.handleAction(p1.userId, p2.userId, match.gameState, userId, action, payload);
  if (!result) return;
  Object.assign(match.gameState, result.stateUpdate);
  const rp = { round: match.currentRound, total: match.totalRounds, result: result.result, scores: match.scores };
  for (const p of match.players) io.to(p.socketId).emit("match:round", rp);
  if (result.gameDone) {
    match.currentRound = match.totalRounds;
    await finalizeMatch(io, match, result.gameWinnerId ?? null, "normal");
  }
}

async function handleBJPvPAction(io: Server, match: ActiveMatch, userId: number, action: string, payload: any) {
  const [p1, p2] = match.players;
  const result = BJPvP.handleAction(p1.userId, p2.userId, match.gameState, userId, action, payload);
  if (!result) return;
  Object.assign(match.gameState, result.stateUpdate);

  for (const p of match.players) {
    io.to(p.socketId).emit("bjpvp:update", {
      ...result.result,
      myHand: match.gameState.hands[p.userId],
      myTotal: result.result.totals[p.userId],
      opponentTotal: result.result.totals[match.players.find(pp => pp.userId !== p.userId)!.userId],
    });
  }

  if (result.gameDone) {
    match.currentRound = 1;
    if (result.gameWinnerId) match.scores[result.gameWinnerId]++;
    await db.insert(matchRoundsTable).values({ matchId: match.matchId, roundNumber: 1, gameData: result.result as any, winnerId: result.gameWinnerId ?? null });
    const rp = { round: 1, total: 1, result: result.result, scores: match.scores };
    for (const p of match.players) io.to(p.socketId).emit("match:round", rp);
    await finalizeMatch(io, match, result.gameWinnerId ?? null, "normal");
  }
}

async function handleCardRaceAction(io: Server, match: ActiveMatch, userId: number, action: string, payload: any) {
  const [p1, p2] = match.players;
  const result = CardRace.handleAction(p1.userId, p2.userId, match.gameState, userId, action, payload);
  if (!result) return;
  Object.assign(match.gameState, result.stateUpdate);

  for (const p of match.players) io.to(p.socketId).emit("cardrace:update", result.result);

  if (result.gameDone) {
    match.currentRound = 1;
    if (result.gameWinnerId) match.scores[result.gameWinnerId]++;
    await db.insert(matchRoundsTable).values({ matchId: match.matchId, roundNumber: 1, gameData: result.result as any, winnerId: result.gameWinnerId ?? null });
    const rp = { round: 1, total: 1, result: result.result, scores: match.scores };
    for (const p of match.players) io.to(p.socketId).emit("match:round", rp);
    await finalizeMatch(io, match, result.gameWinnerId ?? null, "normal");
  }
}

async function handleLastManAction(io: Server, match: ActiveMatch, userId: number, action: string, payload: any) {
  const [p1, p2] = match.players;
  const result = LastMan.handleAction(p1.userId, p2.userId, match.gameState, userId, action, payload, match.currentRound + 1);
  if (!result) return;
  Object.assign(match.gameState, result.stateUpdate);
  if (!result.roundDone) return;
  match.currentRound++;
  if (result.roundWinnerId) match.scores[result.roundWinnerId]++;
  await db.insert(matchRoundsTable).values({ matchId: match.matchId, roundNumber: match.currentRound, gameData: result.result as any, winnerId: result.roundWinnerId ?? null });
  const rp = { round: match.currentRound, total: match.totalRounds, result: result.result, scores: match.scores };
  for (const p of match.players) io.to(p.socketId).emit("match:round", rp);
  if (result.gameDone || match.currentRound >= match.totalRounds) {
    const winner = result.gameDone ? (result.gameWinnerId ?? null) : getScoreWinner(match);
    await finalizeMatch(io, match, winner, "normal");
  }
}

function getScoreWinner(match: ActiveMatch): number | null {
  const [p1, p2] = match.players;
  const s1 = match.scores[p1.userId] ?? 0;
  const s2 = match.scores[p2.userId] ?? 0;
  if (s1 > s2) return p1.userId;
  if (s2 > s1) return p2.userId;
  return null;
}

async function finalizeMatch(io: Server, match: ActiveMatch, winnerId: number | null, reason: string) {
  if (!activeMatches.has(match.matchId)) return;
  activeMatches.delete(match.matchId);
  for (const p of match.players) userToMatch.delete(p.userId);
  for (const t of match.timers) clearTimeout(t);
  broadcastLobbyStats(io);

  await db.update(matchesTable).set({ status: "completed", winnerId: winnerId ?? undefined, completedAt: new Date() })
    .where(eq(matchesTable.id, match.matchId));

  if (winnerId && match.finalBet > 0) {
    const loserId = match.players.find(p => p.userId !== winnerId)!.userId;
    await pool.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [match.finalBet, winnerId]);
    await pool.query(`UPDATE users SET balance = GREATEST(0, balance - $1) WHERE id = $2`, [match.finalBet, loserId]);
  }

  const payload = { matchId: match.matchId, winnerId, reason, scores: match.scores, finalBet: match.finalBet };
  for (const p of match.players) {
    const youWon = p.userId === winnerId;
    io.to(p.socketId).emit("match:end", { ...payload, youWon });
    trackGameProgress({ userId: p.userId, gameType: match.gameType, betAmount: match.finalBet, won: youWon, lostAmount: youWon ? 0 : match.finalBet });
  }
  logger.info({ matchId: match.matchId, winnerId, reason }, "Match finalized");
}
