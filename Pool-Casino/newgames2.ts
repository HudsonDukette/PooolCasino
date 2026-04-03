import { Router, type IRouter, type Response } from "express";
import { db, usersTable, poolTable, betsTable, casinosTable, casinoGamesOwnedTable, casinoBetsTable, casinoTransactionsTable, casinoGameOddsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { trackGameProgress } from "../lib/progress";

const router: IRouter = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function auth(req: any, res: any): number | null {
  const id = req.session?.userId;
  if (!id) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return id;
}

function parseBet(req: any, res: any): number | null {
  const b = parseFloat(req.body?.betAmount);
  if (isNaN(b) || b < 0.01) { res.status(400).json({ error: "Minimum bet is $0.01" }); return null; }
  return b;
}

async function loadCtx(userId: number) {
  const [[user], poolRows] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(poolTable).limit(1),
  ]);
  let pool = poolRows[0];
  if (!pool) [pool] = await db.insert(poolTable).values({}).returning();
  return { user: user!, pool };
}

async function getCasinoOddsMultiplier(casinoId: number, gameType: string): Promise<number> {
  const [row] = await db.select().from(casinoGameOddsTable)
    .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, gameType))).limit(1);
  return row ? parseFloat(row.payoutMultiplier) : 1;
}

async function validateCasinoPlay(casinoId: number, gameType: string, betAmount: number, res: Response): Promise<boolean> {
  const [casino] = await db.select().from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
  if (!casino) { res.status(404).json({ error: "Casino not found" }); return false; }
  if (casino.isPaused) { res.status(400).json({ error: "Casino is paused" }); return false; }
  const [owned] = await db.select().from(casinoGamesOwnedTable)
    .where(and(eq(casinoGamesOwnedTable.casinoId, casinoId), eq(casinoGamesOwnedTable.gameType, gameType), eq(casinoGamesOwnedTable.isEnabled, true))).limit(1);
  if (!owned) { res.status(400).json({ error: "Game not enabled at this casino" }); return false; }
  if (betAmount < parseFloat(casino.minBet) || betAmount > parseFloat(casino.maxBet)) {
    res.status(400).json({ error: `Bet must be between $${casino.minBet} and $${casino.maxBet}` }); return false;
  }
  return true;
}

async function settle(
  userId: number, gameType: string, betAmount: number, rawMultiplier: number,
  user: any, pool: any, casinoId?: number
): Promise<{ won: boolean; payout: number; newBalance: number }> {
  let multiplier = rawMultiplier;
  if (casinoId !== undefined && rawMultiplier > 1) {
    const oddsMultiplier = await getCasinoOddsMultiplier(casinoId, gameType);
    multiplier = rawMultiplier * oddsMultiplier;
  }
  const won = multiplier > 1;
  const payout = parseFloat((betAmount * multiplier).toFixed(2));
  const net = payout - betAmount;

  const result = await db.transaction(async (tx) => {
    const [updatedUser] = await tx.update(usersTable)
      .set({ balance: sql`${usersTable.balance} + ${net.toFixed(2)}` })
      .where(eq(usersTable.id, userId)).returning({ balance: usersTable.balance });

    if (casinoId !== undefined) {
      const [casino] = await tx.select().from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
      const casinoProfit = won ? -net : betAmount;
      if (casino) {
        await Promise.all([
          tx.update(casinosTable).set({ bankroll: sql`${casinosTable.bankroll} + ${casinoProfit.toFixed(2)}`, totalBets: sql`${casinosTable.totalBets} + 1`, totalWagered: sql`${casinosTable.totalWagered} + ${betAmount.toFixed(2)}`, totalPaidOut: sql`${casinosTable.totalPaidOut} + ${payout.toFixed(2)}` }).where(eq(casinosTable.id, casinoId)),
          tx.insert(casinoBetsTable).values({ casinoId, userId, gameType, betAmount: betAmount.toFixed(2), result: won ? "win" : "loss", payout: payout.toFixed(2), multiplier: multiplier.toFixed(4) }),
          tx.insert(casinoTransactionsTable).values({ casinoId, type: won ? "bet_loss" : "bet_win", amount: Math.abs(casinoProfit).toFixed(2), description: `${gameType} — ${won ? "Player win" : "Player loss"}` }),
        ]);
      }
    } else {
      const [updatedPool] = await tx.update(poolTable)
        .set({ totalAmount: sql`${poolTable.totalAmount} + ${(-net).toFixed(2)}` })
        .where(eq(poolTable.id, pool.id)).returning();
      await tx.insert(betsTable).values({ userId, gameType, betAmount: betAmount.toFixed(2), result: won ? "win" : "loss", payout: payout.toFixed(2), multiplier: multiplier.toFixed(4) });
    }

    return { newBalance: parseFloat(updatedUser.balance) };
  });

  await trackGameProgress(userId, gameType, won);
  return { won, payout, newBalance: result.newBalance };
}

// ── Blind Draw ───────────────────────────────────────────────────────────────
const BLIND_CARDS = [
  { label: "3×", multiplier: 3, type: "win" },
  { label: "2×", multiplier: 2, type: "win" },
  { label: "1.5×", multiplier: 1.5, type: "win" },
  { label: "1.2×", multiplier: 1.2, type: "win" },
  { label: "0×", multiplier: 0, type: "lose" },
  { label: "0×", multiplier: 0, type: "lose" },
  { label: "0×", multiplier: 0, type: "lose" },
  { label: "0.5×", multiplier: 0.5, type: "partial" },
];

router.post("/blinddraw", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const pick = parseInt(req.body?.pick);
  if (isNaN(pick) || pick < 1 || pick > 8) return res.status(400).json({ error: "Pick must be 1-8" });
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "blinddraw", betAmount, res as Response); if (!ok) return; }
  const { user, pool } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });

  const shuffled = [...BLIND_CARDS].sort(() => Math.random() - 0.5);
  const revealed = shuffled[pick - 1];
  const allCards = shuffled.map((c, i) => i === pick - 1 ? { ...c, picked: true } : { label: "?", multiplier: c.multiplier, type: c.type, picked: false });

  const result = await settle(userId, "blinddraw", betAmount, revealed.multiplier, user, pool, casinoId);
  return res.json({ pick, card: revealed, allCards, ...result });
});

// ── Hidden Path ───────────────────────────────────────────────────────────────
router.post("/hiddenpath", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const choices = req.body?.choices as string[];
  if (!Array.isArray(choices) || choices.length !== 5 || !choices.every(c => ["left", "right"].includes(c))) {
    return res.status(400).json({ error: "Provide 5 choices of 'left' or 'right'" });
  }
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "hiddenpath", betAmount, res as Response); if (!ok) return; }
  const { user, pool } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });

  const correct = Array.from({ length: 5 }, () => Math.random() < 0.5 ? "left" : "right");
  const steps = choices.map((choice, i) => ({ choice, correct: correct[i], hit: choice === correct[i] }));
  const hits = steps.filter(s => s.hit).length;
  const MULT_BY_HITS = [0, 0, 0.5, 1.5, 2.5, 5];
  const multiplier = MULT_BY_HITS[hits];
  const failedAt = steps.findIndex(s => !s.hit);

  const result = await settle(userId, "hiddenpath", betAmount, multiplier, user, pool, casinoId);
  return res.json({ steps, hits, failedAt, multiplier, ...result });
});

// ── Jackpot Hunt ─────────────────────────────────────────────────────────────
router.post("/jackpothunt", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const picks = req.body?.picks as number[];
  if (!Array.isArray(picks) || picks.length !== 3 || !picks.every(p => Number.isInteger(p) && p >= 1 && p <= 12)) {
    return res.status(400).json({ error: "Pick exactly 3 unique boxes (1-12)" });
  }
  if (new Set(picks).size !== 3) return res.status(400).json({ error: "Picks must be unique" });
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "jackpothunt", betAmount, res as Response); if (!ok) return; }
  const { user, pool } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });

  const BOX_VALUES = [10, 3, 2, 2, 1.5, 1.5, 1.2, 1.2, 0, 0, 0, 0];
  const shuffled = [...BOX_VALUES].sort(() => Math.random() - 0.5);
  const boxes = shuffled.map((v, i) => ({ box: i + 1, multiplier: v, picked: picks.includes(i + 1) }));
  const pickedValues = picks.map(p => shuffled[p - 1]);
  const avgMultiplier = pickedValues.reduce((a, b) => a + b, 0) / 3;

  const result = await settle(userId, "jackpothunt", betAmount, avgMultiplier, user, pool, casinoId);
  return res.json({ boxes, picks, pickedValues, avgMultiplier, ...result });
});

// ── Target Hit ───────────────────────────────────────────────────────────────
const targetSessions = new Map<number, { betAmount: number; casinoId?: number; targetMs: number; startedAt: number }>();

router.post("/targethit/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "targethit", betAmount, res as Response); if (!ok) return; }
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} - ${betAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
  const targetMs = Math.floor(1000 + Math.random() * 4000);
  const startedAt = Date.now();
  targetSessions.set(userId, { betAmount, casinoId, targetMs, startedAt });
  return res.json({ started: true, durationMs: 5000 });
});

router.post("/targethit/click", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = targetSessions.get(userId);
  if (!session) return res.status(400).json({ error: "No active target session" });
  targetSessions.delete(userId);
  const { betAmount, casinoId, targetMs, startedAt } = session;
  const elapsed = Date.now() - startedAt;
  const diff = Math.abs(elapsed - targetMs);
  const accuracy = Math.max(0, 1 - diff / 2000);
  const multiplier = accuracy < 0.1 ? 0 : 0.5 + accuracy * 3.5;
  const { user, pool } = await loadCtx(userId);
  const { won, payout, newBalance } = await settle(userId, "targethit", betAmount, multiplier, { ...user, balance: (parseFloat(user.balance) + betAmount).toString() }, pool, casinoId);
  return res.json({ elapsed, targetMs, diff, accuracy: Math.round(accuracy * 100), multiplier: parseFloat(multiplier.toFixed(2)), won, payout, newBalance });
});

// ── Countdown Gamble ─────────────────────────────────────────────────────────
const countdownSessions = new Map<number, { betAmount: number; casinoId?: number; startedAt: number }>();

router.post("/countdown/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "countdown", betAmount, res as Response); if (!ok) return; }
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} - ${betAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
  countdownSessions.set(userId, { betAmount, casinoId, startedAt: Date.now() });
  return res.json({ started: true, durationMs: 10000 });
});

router.post("/countdown/cashout", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = countdownSessions.get(userId);
  if (!session) return res.status(400).json({ error: "No active countdown session" });
  countdownSessions.delete(userId);
  const { betAmount, casinoId, startedAt } = session;
  const elapsed = Math.min(10000, Date.now() - startedAt);
  const remaining = Math.max(0, 10000 - elapsed);
  const secondsLeft = remaining / 1000;
  const multiplier = 0.5 + (secondsLeft / 10) * 2.5;
  const { user, pool } = await loadCtx(userId);
  const { won, payout, newBalance } = await settle(userId, "countdown", betAmount, multiplier, { ...user, balance: (parseFloat(user.balance) + betAmount).toString() }, pool, casinoId);
  return res.json({ secondsLeft: parseFloat(secondsLeft.toFixed(1)), multiplier: parseFloat(multiplier.toFixed(2)), won, payout, newBalance });
});

// ── Card Stack ───────────────────────────────────────────────────────────────
function drawCard(): { label: string; value: number } {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const rank = ranks[Math.floor(Math.random() * ranks.length)];
  const suit = suits[Math.floor(Math.random() * suits.length)];
  const numRank = ["J","Q","K"].includes(rank) ? 10 : rank === "A" ? 11 : parseInt(rank);
  return { label: `${rank}${suit}`, value: numRank };
}

const cardSessions = new Map<number, { betAmount: number; casinoId?: number; cards: { label: string; value: number }[]; total: number }>();

router.post("/cardstack/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "cardstack", betAmount, res as Response); if (!ok) return; }
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} - ${betAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
  const first = drawCard();
  cardSessions.set(userId, { betAmount, casinoId, cards: [first], total: first.value });
  return res.json({ card: first, total: first.value, bust: false });
});

router.post("/cardstack/draw", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = cardSessions.get(userId);
  if (!session) return res.status(400).json({ error: "No active card session" });
  const card = drawCard();
  session.cards.push(card);
  session.total += card.value;
  if (session.total > 21) {
    cardSessions.delete(userId);
    const { user, pool } = await loadCtx(userId);
    const { payout, newBalance } = await settle(userId, "cardstack", session.betAmount, 0, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
    return res.json({ card, total: session.total, bust: true, won: false, payout, newBalance });
  }
  return res.json({ card, total: session.total, bust: false });
});

router.post("/cardstack/stand", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = cardSessions.get(userId);
  if (!session) return res.status(400).json({ error: "No active card session" });
  cardSessions.delete(userId);
  const { total, betAmount, casinoId } = session;
  const MULTS: Record<number, number> = { 21: 3, 20: 2.5, 19: 2, 18: 1.8, 17: 1.5, 16: 1.3, 15: 1.2 };
  const multiplier = MULTS[total] ?? (total >= 12 ? 1.1 : 0.8);
  const { user, pool } = await loadCtx(userId);
  const { won, payout, newBalance } = await settle(userId, "cardstack", betAmount, multiplier, { ...user, balance: (parseFloat(user.balance) + betAmount).toString() }, pool, casinoId);
  return res.json({ total, multiplier, won, payout, newBalance });
});

// ── Power Grid ───────────────────────────────────────────────────────────────
const powerGridSessions = new Map<number, {
  betAmount: number; casinoId?: number;
  grid: { multiplier: number; type: string }[];
  revealed: number[]; accumulated: number; phase: string;
}>();

function buildPowerGrid() {
  const cells = [
    ...Array(4).fill(null).map(() => ({ multiplier: 0, type: "shock" })),
    { multiplier: 3, type: "bonus" }, { multiplier: 2.5, type: "bonus" },
    { multiplier: 2, type: "bonus" }, { multiplier: 1.8, type: "boost" },
    { multiplier: 1.5, type: "boost" }, { multiplier: 1.3, type: "boost" },
    { multiplier: 1.2, type: "boost" }, { multiplier: 1.1, type: "boost" },
    { multiplier: 0.8, type: "weak" }, { multiplier: 0.7, type: "weak" },
    { multiplier: 0.5, type: "weak" }, { multiplier: 0.3, type: "weak" },
  ];
  return cells.sort(() => Math.random() - 0.5);
}

router.post("/powergrid/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "powergrid", betAmount, res as Response); if (!ok) return; }
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} - ${betAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
  const grid = buildPowerGrid();
  powerGridSessions.set(userId, { betAmount, casinoId, grid, revealed: [], accumulated: 1, phase: "playing" });
  return res.json({ gridSize: 16, started: true });
});

router.post("/powergrid/pick", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = powerGridSessions.get(userId);
  if (!session || session.phase !== "playing") return res.status(400).json({ error: "No active grid session" });
  const cell = parseInt(req.body?.cell);
  if (isNaN(cell) || cell < 0 || cell > 15) return res.status(400).json({ error: "Invalid cell (0-15)" });
  if (session.revealed.includes(cell)) return res.status(400).json({ error: "Cell already revealed" });
  session.revealed.push(cell);
  const revealed = session.grid[cell];
  if (revealed.type === "shock") {
    session.phase = "bust";
    powerGridSessions.delete(userId);
    const { user, pool } = await loadCtx(userId);
    const { payout, newBalance } = await settle(userId, "powergrid", session.betAmount, 0, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
    return res.json({ cell, revealed, bust: true, accumulated: session.accumulated, won: false, payout, newBalance });
  }
  session.accumulated *= revealed.multiplier;
  return res.json({ cell, revealed, bust: false, accumulated: parseFloat(session.accumulated.toFixed(3)) });
});

router.post("/powergrid/cashout", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = powerGridSessions.get(userId);
  if (!session) return res.status(400).json({ error: "No active grid session" });
  powerGridSessions.delete(userId);
  const { user, pool } = await loadCtx(userId);
  const { won, payout, newBalance } = await settle(userId, "powergrid", session.betAmount, session.accumulated, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
  return res.json({ accumulated: session.accumulated, won, payout, newBalance });
});

// ── Elimination Wheel ─────────────────────────────────────────────────────────
const WHEEL_SEGMENTS = 8;
const elimWheelSessions = new Map<number, {
  betAmount: number; casinoId?: number;
  segments: number[]; round: number; phase: string;
}>();

router.post("/elimwheel/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "elimwheel", betAmount, res as Response); if (!ok) return; }
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} - ${betAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
  const segments = Array.from({ length: WHEEL_SEGMENTS }, (_, i) => i + 1);
  elimWheelSessions.set(userId, { betAmount, casinoId, segments: [...segments], round: 0, phase: "spinning" });
  return res.json({ segments, totalSegments: WHEEL_SEGMENTS });
});

router.post("/elimwheel/spin", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = elimWheelSessions.get(userId);
  if (!session || session.phase !== "spinning") return res.status(400).json({ error: "No active wheel session" });
  session.round++;
  const landedIndex = Math.floor(Math.random() * session.segments.length);
  const landedSegment = session.segments[landedIndex];
  session.segments.splice(landedIndex, 1);
  const remaining = session.segments.length;
  if (remaining === 0) {
    session.phase = "done";
    elimWheelSessions.delete(userId);
    const { user, pool } = await loadCtx(userId);
    const { won, payout, newBalance } = await settle(userId, "elimwheel", session.betAmount, 5, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
    return res.json({ landed: landedSegment, remaining: [], round: session.round, won: true, payout, newBalance, finished: true });
  }
  return res.json({ landed: landedSegment, remaining: session.segments, round: session.round, finished: false });
});

router.post("/elimwheel/cashout", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = elimWheelSessions.get(userId);
  if (!session) return res.status(400).json({ error: "No active wheel session" });
  elimWheelSessions.delete(userId);
  const spunRounds = session.round;
  const MULT = [0, 0.3, 0.6, 1.0, 1.5, 2.5, 4, 5];
  const multiplier = MULT[Math.min(spunRounds, MULT.length - 1)];
  const { user, pool } = await loadCtx(userId);
  const { won, payout, newBalance } = await settle(userId, "elimwheel", session.betAmount, multiplier, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
  return res.json({ spunRounds, multiplier, won, payout, newBalance });
});

// ── Combo Builder ─────────────────────────────────────────────────────────────
const comboSessions = new Map<number, {
  betAmount: number; casinoId?: number;
  combo: number; roundMult: number; phase: string;
}>();

router.post("/combobuilder/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "combobuilder", betAmount, res as Response); if (!ok) return; }
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} - ${betAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
  comboSessions.set(userId, { betAmount, casinoId, combo: 0, roundMult: 1, phase: "playing" });
  return res.json({ started: true, combo: 0, potentialMult: 1 });
});

router.post("/combobuilder/pick", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = comboSessions.get(userId);
  if (!session || session.phase !== "playing") return res.status(400).json({ error: "No active combo session" });
  const pick = parseInt(req.body?.pick);
  if (![1, 2, 3].includes(pick)) return res.status(400).json({ error: "Pick 1, 2, or 3" });
  const bustIndex = Math.floor(Math.random() * 3) + 1;
  const hit = pick !== bustIndex;
  if (!hit) {
    session.phase = "bust";
    comboSessions.delete(userId);
    const { user, pool } = await loadCtx(userId);
    const { payout, newBalance } = await settle(userId, "combobuilder", session.betAmount, 0, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
    return res.json({ pick, bustIndex, hit: false, combo: session.combo, bust: true, won: false, payout, newBalance });
  }
  session.combo++;
  session.roundMult = 1 + session.combo * 0.5;
  return res.json({ pick, bustIndex, hit: true, combo: session.combo, roundMult: session.roundMult, bust: false });
});

router.post("/combobuilder/cashout", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = comboSessions.get(userId);
  if (!session) return res.status(400).json({ error: "No active combo session" });
  comboSessions.delete(userId);
  const { user, pool } = await loadCtx(userId);
  const { won, payout, newBalance } = await settle(userId, "combobuilder", session.betAmount, session.roundMult, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
  return res.json({ combo: session.combo, multiplier: session.roundMult, won, payout, newBalance });
});

// ── Chain Reaction ────────────────────────────────────────────────────────────
const chainSessions = new Map<number, {
  betAmount: number; casinoId?: number;
  chainLength: number; currentMult: number; phase: string;
}>();

router.post("/chainreaction/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "chainreaction", betAmount, res as Response); if (!ok) return; }
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} - ${betAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
  chainSessions.set(userId, { betAmount, casinoId, chainLength: 0, currentMult: 1, phase: "playing" });
  return res.json({ started: true, chainLength: 0, currentMult: 1 });
});

router.post("/chainreaction/react", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = chainSessions.get(userId);
  if (!session || session.phase !== "playing") return res.status(400).json({ error: "No active chain session" });
  const winChance = Math.max(0.3, 0.7 - session.chainLength * 0.05);
  const won = Math.random() < winChance;
  if (!won) {
    session.phase = "bust";
    chainSessions.delete(userId);
    const { user, pool } = await loadCtx(userId);
    const { payout, newBalance } = await settle(userId, "chainreaction", session.betAmount, 0, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
    return res.json({ won: false, chainLength: session.chainLength, bust: true, payout, newBalance });
  }
  session.chainLength++;
  session.currentMult = parseFloat((1 + session.chainLength * 0.6).toFixed(2));
  return res.json({ won: true, chainLength: session.chainLength, currentMult: session.currentMult, bust: false, nextWinChance: Math.max(0.3, 0.7 - session.chainLength * 0.05) });
});

router.post("/chainreaction/cashout", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = chainSessions.get(userId);
  if (!session) return res.status(400).json({ error: "No active chain session" });
  chainSessions.delete(userId);
  const { user, pool } = await loadCtx(userId);
  const { won, payout, newBalance } = await settle(userId, "chainreaction", session.betAmount, session.currentMult, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
  return res.json({ chainLength: session.chainLength, multiplier: session.currentMult, won, payout, newBalance });
});

// ── Reverse Crash ─────────────────────────────────────────────────────────────
const reverseCrashSessions = new Map<number, {
  betAmount: number; casinoId?: number;
  crashMultiplier: number; startedAt: number; crashed: boolean;
}>();

router.post("/reversecrash/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "reversecrash", betAmount, res as Response); if (!ok) return; }
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} - ${betAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
  const crashMultiplier = 1 + Math.random() * 1.5;
  reverseCrashSessions.set(userId, { betAmount, casinoId, crashMultiplier, startedAt: Date.now(), crashed: false });
  return res.json({ started: true, startMultiplier: 10 });
});

router.post("/reversecrash/cashout", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = reverseCrashSessions.get(userId);
  if (!session) return res.status(400).json({ error: "No active crash session" });
  reverseCrashSessions.delete(userId);
  const elapsed = (Date.now() - session.startedAt) / 1000;
  const current = Math.max(1, 10 - elapsed * 2);
  const alreadyCrashed = current <= session.crashMultiplier;
  const effectiveMult = alreadyCrashed ? 0 : current;
  const { user, pool } = await loadCtx(userId);
  const { won, payout, newBalance } = await settle(userId, "reversecrash", session.betAmount, effectiveMult, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
  return res.json({ elapsed: parseFloat(elapsed.toFixed(1)), current: parseFloat(current.toFixed(2)), crashedAt: parseFloat(session.crashMultiplier.toFixed(2)), alreadyCrashed, won, payout, newBalance });
});

// ── Safe Steps ────────────────────────────────────────────────────────────────
const safeStepsSessions = new Map<number, {
  betAmount: number; casinoId?: number;
  step: number; accumulated: number; phase: string;
}>();
const SAFE_STEPS_MULTS = [0, 1.2, 1.5, 1.9, 2.5, 3.2, 4.0, 5.0, 6.5, 8.5, 12];
const SAFE_STEPS_FAIL = [0, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6];

router.post("/safesteps/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "safesteps", betAmount, res as Response); if (!ok) return; }
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} - ${betAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
  safeStepsSessions.set(userId, { betAmount, casinoId, step: 0, accumulated: 1, phase: "playing" });
  return res.json({ step: 0, accumulated: 1, nextFailChance: SAFE_STEPS_FAIL[1], nextMult: SAFE_STEPS_MULTS[1] });
});

router.post("/safesteps/step", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = safeStepsSessions.get(userId);
  if (!session || session.phase !== "playing") return res.status(400).json({ error: "No active steps session" });
  const nextStep = session.step + 1;
  if (nextStep > 10) return res.status(400).json({ error: "Already at max steps" });
  const failChance = SAFE_STEPS_FAIL[nextStep];
  const failed = Math.random() < failChance;
  session.step = nextStep;
  if (failed) {
    session.phase = "bust";
    safeStepsSessions.delete(userId);
    const { user, pool } = await loadCtx(userId);
    const { payout, newBalance } = await settle(userId, "safesteps", session.betAmount, 0, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
    return res.json({ step: nextStep, failed: true, payout: 0, newBalance, won: false });
  }
  session.accumulated = SAFE_STEPS_MULTS[nextStep];
  return res.json({ step: nextStep, failed: false, accumulated: session.accumulated, nextFailChance: nextStep < 10 ? SAFE_STEPS_FAIL[nextStep + 1] : null, nextMult: nextStep < 10 ? SAFE_STEPS_MULTS[nextStep + 1] : null });
});

router.post("/safesteps/cashout", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = safeStepsSessions.get(userId);
  if (!session) return res.status(400).json({ error: "No active steps session" });
  safeStepsSessions.delete(userId);
  const { user, pool } = await loadCtx(userId);
  const { won, payout, newBalance } = await settle(userId, "safesteps", session.betAmount, session.accumulated, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
  return res.json({ step: session.step, multiplier: session.accumulated, won, payout, newBalance });
});

// ── Prediction Chain ──────────────────────────────────────────────────────────
const predChainSessions = new Map<number, {
  betAmount: number; casinoId?: number;
  correct: number; total: number; currentMult: number; phase: string;
}>();

router.post("/predchain/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const rounds = Math.min(5, Math.max(3, parseInt(req.body?.rounds ?? "5") || 5));
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "predchain", betAmount, res as Response); if (!ok) return; }
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} - ${betAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
  predChainSessions.set(userId, { betAmount, casinoId, correct: 0, total: rounds, currentMult: 1, phase: "playing" });
  return res.json({ started: true, totalRounds: rounds });
});

router.post("/predchain/predict", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = predChainSessions.get(userId);
  if (!session || session.phase !== "playing") return res.status(400).json({ error: "No active prediction session" });
  const prediction = req.body?.prediction;
  if (!["heads", "tails"].includes(prediction)) return res.status(400).json({ error: "Predict 'heads' or 'tails'" });
  const outcome = Math.random() < 0.5 ? "heads" : "tails";
  const isCorrect = prediction === outcome;
  if (!isCorrect) {
    session.phase = "bust";
    predChainSessions.delete(userId);
    const { user, pool } = await loadCtx(userId);
    const { payout, newBalance } = await settle(userId, "predchain", session.betAmount, 0, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
    return res.json({ prediction, outcome, correct: false, correct_count: session.correct, bust: true, won: false, payout, newBalance });
  }
  session.correct++;
  session.currentMult = parseFloat(Math.pow(1.85, session.correct).toFixed(2));
  const finished = session.correct >= session.total;
  if (finished) {
    predChainSessions.delete(userId);
    const { user, pool } = await loadCtx(userId);
    const { won, payout, newBalance } = await settle(userId, "predchain", session.betAmount, session.currentMult, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
    return res.json({ prediction, outcome, correct: true, correct_count: session.correct, bust: false, finished: true, multiplier: session.currentMult, won, payout, newBalance });
  }
  return res.json({ prediction, outcome, correct: true, correct_count: session.correct, currentMult: session.currentMult, bust: false, finished: false, remaining: session.total - session.correct });
});

// ── Timed Safe ────────────────────────────────────────────────────────────────
const timedSafeSessions = new Map<number, {
  betAmount: number; casinoId?: number;
  crackAt: number; startedAt: number; phase: string;
}>();

router.post("/timedsafe/start", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  const casinoId = req.body?.casinoId ? parseInt(req.body.casinoId) : undefined;
  if (casinoId !== undefined) { const ok = await validateCasinoPlay(casinoId, "timedsafe", betAmount, res as Response); if (!ok) return; }
  const { user } = await loadCtx(userId);
  if (parseFloat(user.balance) < betAmount) return res.status(400).json({ error: "Insufficient balance" });
  await db.update(usersTable).set({ balance: sql`${usersTable.balance} - ${betAmount.toFixed(2)}` }).where(eq(usersTable.id, userId));
  const crackAt = 5000 + Math.random() * 25000;
  timedSafeSessions.set(userId, { betAmount, casinoId, crackAt, startedAt: Date.now(), phase: "waiting" });
  return res.json({ started: true, maxWaitMs: 30000 });
});

router.post("/timedsafe/open", async (req, res) => {
  const userId = auth(req, res); if (!userId) return;
  const session = timedSafeSessions.get(userId);
  if (!session) return res.status(400).json({ error: "No active safe session" });
  timedSafeSessions.delete(userId);
  const elapsed = Date.now() - session.startedAt;
  const cracked = elapsed >= session.crackAt;
  const ratio = elapsed / 30000;
  let multiplier: number;
  if (!cracked) {
    multiplier = 0.5 + ratio * 1.0;
  } else {
    const overRatio = Math.min(1, (elapsed - session.crackAt) / 10000);
    multiplier = 1.5 + overRatio * 3.5;
  }
  const { user, pool } = await loadCtx(userId);
  const { won, payout, newBalance } = await settle(userId, "timedsafe", session.betAmount, multiplier, { ...user, balance: (parseFloat(user.balance) + session.betAmount).toString() }, pool, session.casinoId);
  return res.json({ elapsed, crackAt: Math.round(session.crackAt), cracked, multiplier: parseFloat(multiplier.toFixed(2)), won, payout, newBalance });
});

export default router;
