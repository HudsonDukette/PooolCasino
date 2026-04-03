import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, poolTable, betsTable, casinosTable, casinoGamesOwnedTable, casinoBetsTable, casinoTransactionsTable, casinoGameOddsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { calculateWinChance } from "../lib/gambling";

const router: IRouter = Router();

// ─── Blackjack in-memory state ───────────────────────────────────────────────
interface BJState {
  betAmount: number;
  playerCards: number[];
  dealerCards: number[];
  poolId: number;
  poolAmount: number;
  currentBalance: number;
  casinoId?: number;
  bjPayouts: { bj: number; win: number };
  bjOddsMult: number;
}
const bjGames = new Map<number, BJState>();

// ─── Helpers ─────────────────────────────────────────────────────────────────
function cardValue(card: number): number {
  if (card >= 11) return 10; // J Q K
  return card;
}

function handTotal(cards: number[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    const v = cardValue(c);
    if (v === 1) { aces++; total += 11; }
    else total += v;
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

function drawCard(): number {
  return Math.floor(Math.random() * 13) + 1; // 1(Ace)–13(King)
}

function cardLabel(card: number): string {
  if (card === 1) return "A";
  if (card === 11) return "J";
  if (card === 12) return "Q";
  if (card === 13) return "K";
  return String(card);
}

async function loadContext(userId: number) {
  const [[user], poolRows] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(poolTable).limit(1),
  ]);
  let pool = poolRows[0];
  if (!pool) [pool] = await db.insert(poolTable).values({}).returning();
  return { user: user!, pool };
}

function getBanError(user: { permanentlyBanned: boolean; bannedUntil: Date | null }): string | null {
  if (user.permanentlyBanned) return "Your account has been permanently banned from playing games.";
  if (user.bannedUntil && user.bannedUntil > new Date()) {
    const until = user.bannedUntil.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `You are banned from playing games until ${until}.`;
  }
  return null;
}

async function settleGame(
  userId: number,
  gameType: string,
  betAmount: number,
  multiplier: number,
  user: Awaited<ReturnType<typeof loadContext>>["user"],
  pool: Awaited<ReturnType<typeof loadContext>>["pool"],
  casinoId?: number,
  betAlreadyDeducted = false,
) {
  const won = multiplier > 1;
  const breakEven = Math.abs(multiplier - 1) < 0.001;

  let payout = 0;
  let newBalance = 0;
  let casinoInsolvent = false;

  await db.transaction(async (tx) => {
    // Re-read rows inside the transaction for atomic accounting
    const [freshUser] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");
    const currentBalance = parseFloat(freshUser.balance);

    if (casinoId !== undefined) {
      // ── Casino-aware settlement ──────────────────────────────────────────────
      const [casino] = await tx.select().from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
      if (!casino) throw new Error("Casino not found");
      const bankroll = parseFloat(casino.bankroll);
      const uncappedPayout = betAmount * multiplier;
      // Casino funds = current bankroll + the incoming bet (it received the bet before paying out)
      const totalCasinoFunds = bankroll + betAmount;
      const insolvent = won && uncappedPayout > totalCasinoFunds;
      // Cap payout at total casino funds so casino bankroll never goes negative
      payout = won ? Math.min(uncappedPayout, totalCasinoFunds) : uncappedPayout;
      // If bet was already deducted at session start, only credit payout back; otherwise do full net settlement
      newBalance = betAlreadyDeducted ? currentBalance + payout : currentBalance - betAmount + payout;
      const casinoProfit = betAmount - payout;
      const newBankroll = Math.max(0, bankroll + casinoProfit);

      const casinoUpdate: Record<string, unknown> = {
        bankroll: newBankroll.toFixed(2),
        totalBets: sql`${casinosTable.totalBets} + 1`,
        totalWagered: sql`${casinosTable.totalWagered} + ${betAmount}`,
        totalPaidOut: sql`${casinosTable.totalPaidOut} + ${payout}`,
        isPaused: newBankroll <= 0 || insolvent,
        updatedAt: new Date(),
      };
      if (insolvent) {
        casinoUpdate.insolvencyWinnerId = userId;
        casinoUpdate.insolvencyDebtAmount = (uncappedPayout - totalCasinoFunds).toFixed(2);
        casinoInsolvent = true;
      }

      await Promise.all([
        tx.update(casinosTable).set(casinoUpdate).where(eq(casinosTable.id, casinoId)),
        tx.insert(casinoBetsTable).values({
          casinoId,
          userId,
          gameType,
          betAmount: betAmount.toFixed(2),
          result: won ? "win" : "loss",
          payout: payout.toFixed(2),
          multiplier: multiplier.toFixed(4),
        }),
        tx.insert(casinoTransactionsTable).values({
          casinoId,
          type: won ? "bet_loss" : "bet_win",
          amount: Math.abs(casinoProfit).toFixed(2),
          description: `${gameType} — ${won ? "Player win" : "Player loss"}`,
        }),
      ]);
    } else {
      // ── Global pool settlement ───────────────────────────────────────────────
      const [freshPool] = await tx.select().from(poolTable).limit(1);
      if (!freshPool) throw new Error("Pool not found");
      const poolAmount = parseFloat(freshPool.totalAmount);
      const uncappedPayout = betAmount * multiplier;
      payout = won ? Math.min(uncappedPayout, poolAmount) : uncappedPayout;
      // If bet was already deducted at session start, balance only receives payout; pool already has the bet
      newBalance = betAlreadyDeducted ? currentBalance + payout : currentBalance - betAmount + payout;
      // If bet was already credited to pool at start, only subtract payout; otherwise full net
      const newPool = betAlreadyDeducted ? poolAmount - payout : poolAmount + betAmount - payout;

      const newBiggestWin = won && payout > parseFloat(freshPool.biggestWin) ? payout : parseFloat(freshPool.biggestWin);
      const newBiggestBet = betAmount > parseFloat(freshPool.biggestBet) ? betAmount : parseFloat(freshPool.biggestBet);

      await tx.update(poolTable).set({
        totalAmount: Math.max(0, newPool).toFixed(2),
        biggestWin: newBiggestWin.toFixed(2),
        biggestBet: newBiggestBet.toFixed(2),
      }).where(eq(poolTable.id, freshPool.id));
    }

    const profit = payout - betAmount;
    const newUserBiggestWin = won && payout > parseFloat(freshUser.biggestWin) ? payout : parseFloat(freshUser.biggestWin);
    const newUserBiggestBet = betAmount > parseFloat(freshUser.biggestBet) ? betAmount : parseFloat(freshUser.biggestBet);
    const gamesPlayed = parseInt(freshUser.gamesPlayed) + 1;
    const totalWins = parseInt(freshUser.totalWins) + (won ? 1 : 0);
    const totalLosses = parseInt(freshUser.totalLosses) + (!won && !breakEven ? 1 : 0);
    const currentStreak = won ? parseInt(freshUser.currentStreak) + 1 : 0;
    const winStreak = Math.max(parseInt(freshUser.winStreak), currentStreak);
    const totalProfit = parseFloat(freshUser.totalProfit) + profit;

    await Promise.all([
      tx.update(usersTable).set({
        balance: newBalance.toFixed(2),
        totalProfit: totalProfit.toFixed(2),
        biggestWin: newUserBiggestWin.toFixed(2),
        biggestBet: newUserBiggestBet.toFixed(2),
        gamesPlayed: gamesPlayed.toString(),
        winStreak: winStreak.toString(),
        currentStreak: currentStreak.toString(),
        totalWins: totalWins.toString(),
        totalLosses: totalLosses.toString(),
        lastBetAt: new Date(),
      }).where(eq(usersTable.id, userId)),
      tx.insert(betsTable).values({
        userId,
        gameType,
        betAmount: betAmount.toFixed(2),
        result: won ? "win" : "loss",
        payout: payout.toFixed(2),
        multiplier: multiplier.toFixed(4),
      }),
    ]);
  });

  return { won, breakEven, payout, multiplier, newBalance, profit: payout - betAmount, casinoInsolvent };
}

// ─── Casino validation helper ─────────────────────────────────────────────────
async function validateCasinoPlay(
  casinoId: number,
  gameType: string,
  betAmount: number,
  res: Response,
): Promise<boolean> {
  const [casino] = await db.select().from(casinosTable).where(eq(casinosTable.id, casinoId)).limit(1);
  if (!casino) { res.status(404).json({ error: "Casino not found" }); return false; }
  if (casino.isPaused) { res.status(400).json({ error: "This casino is currently paused" }); return false; }

  const [gameOwned] = await db.select().from(casinoGamesOwnedTable)
    .where(and(eq(casinoGamesOwnedTable.casinoId, casinoId), eq(casinoGamesOwnedTable.gameType, gameType), eq(casinoGamesOwnedTable.isEnabled, true)))
    .limit(1);
  if (!gameOwned) { res.status(400).json({ error: `${gameType} is not offered at this casino` }); return false; }

  const minBet = parseFloat(casino.minBet);
  const maxBet = parseFloat(casino.maxBet);
  if (betAmount < minBet) { res.status(400).json({ error: `Minimum bet at this casino is ${minBet}` }); return false; }
  if (betAmount > maxBet) { res.status(400).json({ error: `Maximum bet at this casino is ${maxBet}` }); return false; }

  const bankroll = parseFloat(casino.bankroll);
  if (bankroll <= 0) { res.status(400).json({ error: "Casino bankroll is empty — the owner needs to deposit chips first" }); return false; }

  return true;
}

function authCheck(req: Request, res: Response): number | null {
  const userId = (req as Request & { session: { userId?: number } }).session?.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return null; }
  return userId;
}

function parseBet(req: Request, res: Response): number | null {
  const bet = parseFloat((req.body as { betAmount?: string })?.betAmount ?? "");
  if (isNaN(bet) || bet < 0.01) { res.status(400).json({ error: "Invalid bet amount (min $0.01)" }); return null; }
  return bet;
}

// ─── Ban enforcement middleware ───────────────────────────────────────────────
router.use("/games", async (req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "POST") return next();
  const userId = req.session?.userId;
  if (!userId) return next();
  const [u] = await db.select({ bannedUntil: usersTable.bannedUntil, permanentlyBanned: usersTable.permanentlyBanned })
    .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (u) {
    const err = getBanError(u);
    if (err) { res.status(403).json({ error: "banned", message: err }); return; }
  }
  next();
});

// ─── 1. Dice Roll ────────────────────────────────────────────────────────────
router.post("/games/dice", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { betType, prediction, casinoId: rawCasinoId } = req.body;
  const casinoId = rawCasinoId ? parseInt(rawCasinoId) : undefined;
  if (!["exact", "high", "low"].includes(betType)) {
    res.status(400).json({ error: "betType must be 'exact', 'high', or 'low'" }); return;
  }
  if (betType === "exact" && (prediction < 1 || prediction > 6)) {
    res.status(400).json({ error: "prediction must be 1–6 for exact bets" }); return;
  }

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  let dicePayouts = { exact: 5, high: 1.9, low: 1.9 };
  let diceOddsMult = 1;

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "dice", betAmount, res);
    if (!ok) return;
    const [oddsRow] = await db.select().from(casinoGameOddsTable)
      .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, "dice"))).limit(1);
    if (oddsRow) {
      diceOddsMult = parseFloat(oddsRow.payoutMultiplier);
      if (oddsRow.payTableConfig) {
        try { dicePayouts = { ...dicePayouts, ...JSON.parse(oddsRow.payTableConfig) }; } catch { /* ignore */ }
      }
    }
  }

  const winChance = casinoId !== undefined
    ? 0.5
    : calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;

  let rolled: number;
  if (betType === "exact") {
    if (doWin) {
      rolled = prediction;
    } else {
      const others = [1,2,3,4,5,6].filter((n: number) => n !== prediction);
      rolled = others[Math.floor(Math.random() * others.length)];
    }
  } else {
    const highNums = [4,5,6], lowNums = [1,2,3];
    const target = betType === "high" ? highNums : lowNums;
    const opposite = betType === "high" ? lowNums : highNums;
    if (doWin) {
      rolled = target[Math.floor(Math.random() * target.length)];
    } else {
      rolled = opposite[Math.floor(Math.random() * opposite.length)];
    }
  }

  const won = betType === "exact"
    ? rolled === prediction
    : betType === "high" ? rolled >= 4 : rolled <= 3;

  const rawMult = won ? (betType === "exact" ? dicePayouts.exact : betType === "high" ? dicePayouts.high : dicePayouts.low) : 0;
  const multiplier = rawMult * diceOddsMult;
  const result = await settleGame(userId, "dice", betAmount, multiplier, user, pool, casinoId);
  res.json({ ...result, rolled, betType, prediction, dicePayouts });
});

// ─── 2. Coin Flip ────────────────────────────────────────────────────────────
router.post("/games/coinflip", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { choice, casinoId: rawCasinoId } = req.body;
  const casinoId = rawCasinoId ? parseInt(rawCasinoId) : undefined;
  if (!["heads", "tails"].includes(choice)) {
    res.status(400).json({ error: "choice must be 'heads' or 'tails'" }); return;
  }

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  let coinWinMult = 1.95;
  let coinOddsMult = 1;

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "coinflip", betAmount, res);
    if (!ok) return;
    const [oddsRow] = await db.select().from(casinoGameOddsTable)
      .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, "coinflip"))).limit(1);
    if (oddsRow) {
      coinOddsMult = parseFloat(oddsRow.payoutMultiplier);
      if (oddsRow.payTableConfig) {
        try {
          const custom = JSON.parse(oddsRow.payTableConfig) as { win?: number };
          if (custom.win !== undefined) coinWinMult = custom.win;
        } catch { /* ignore */ }
      }
    }
  }

  const winChance = casinoId !== undefined ? 0.5 : calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;
  const result_side = doWin ? choice : (choice === "heads" ? "tails" : "heads");
  const won = result_side === choice;
  const multiplier = won ? coinWinMult * coinOddsMult : 0;
  const result = await settleGame(userId, "coinflip", betAmount, multiplier, user, pool, casinoId);
  res.json({ ...result, choice, result: result_side, coinWinMult });
});

// ─── 3. Crash ────────────────────────────────────────────────────────────────
router.post("/games/crash", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { cashOutAt: rawCashOutAt, casinoId: rawCasinoId } = req.body;
  const cashOutAt = parseFloat(rawCashOutAt);
  const casinoId = rawCasinoId ? parseInt(rawCasinoId) : undefined;
  if (isNaN(cashOutAt) || cashOutAt < 1.1 || cashOutAt > 100) {
    res.status(400).json({ error: "cashOutAt must be between 1.1 and 100" }); return;
  }

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "crash", betAmount, res);
    if (!ok) return;
  }

  const winChance = casinoId !== undefined ? 0.5 : calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;

  let crashAt: number;
  if (doWin) {
    const extra = 0.5 + Math.random() * 3;
    crashAt = parseFloat((cashOutAt + extra).toFixed(2));
  } else {
    const safeRange = cashOutAt - 1.0;
    crashAt = parseFloat((1.0 + Math.random() * safeRange * 0.95).toFixed(2));
  }

  const won = crashAt >= cashOutAt;
  const multiplier = won ? cashOutAt : 0;
  const result = await settleGame(userId, "crash", betAmount, multiplier, user, pool, casinoId);
  res.json({ ...result, crashAt, cashOutAt });
});

// ─── 4. Slots ────────────────────────────────────────────────────────────────
const SLOT_SYMBOLS = ["cherry", "lemon", "orange", "bell", "diamond", "seven"] as const;
type SlotSymbol = typeof SLOT_SYMBOLS[number];

const SLOT_PAYOUTS: Record<SlotSymbol, number> = {
  seven: 20, diamond: 10, bell: 5, orange: 3, cherry: 2, lemon: 2,
};

function pickSlots(doWin: boolean): [SlotSymbol, SlotSymbol, SlotSymbol] {
  if (doWin) {
    // Pick a matching symbol (3-of-a-kind)
    const sym = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    return [sym, sym, sym];
  }
  // Pick non-matching
  const pick = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
  let reels: [SlotSymbol, SlotSymbol, SlotSymbol];
  do {
    reels = [pick(), pick(), pick()];
  } while (reels[0] === reels[1] && reels[1] === reels[2]);
  return reels;
}

router.post("/games/slots", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { casinoId: rawCasinoId } = req.body;
  const casinoId = rawCasinoId ? parseInt(rawCasinoId) : undefined;

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  let slotPayouts: Record<SlotSymbol, number> = { ...SLOT_PAYOUTS };
  let casinoOddsMultiplier = 1;

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "slots", betAmount, res);
    if (!ok) return;
    const [oddsRow] = await db.select().from(casinoGameOddsTable)
      .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, "slots"))).limit(1);
    if (oddsRow) {
      casinoOddsMultiplier = parseFloat(oddsRow.payoutMultiplier);
      if (oddsRow.payTableConfig) {
        try {
          const custom = JSON.parse(oddsRow.payTableConfig) as Partial<Record<SlotSymbol, number>>;
          slotPayouts = { ...SLOT_PAYOUTS, ...custom };
        } catch { /* ignore parse error */ }
      }
    }
  }

  const winChance = casinoId !== undefined ? 0.5 : calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;
  const reels = pickSlots(doWin);
  const allMatch = reels[0] === reels[1] && reels[1] === reels[2];
  const rawMultiplier = allMatch ? slotPayouts[reels[0]] : 0;
  const multiplier = rawMultiplier * casinoOddsMultiplier;
  const result = await settleGame(userId, "slots", betAmount, multiplier, user, pool, casinoId);
  res.json({ ...result, reels, slotPayouts });
});

// ─── 5. Wheel Spin ────────────────────────────────────────────────────────────
const WHEEL_SEGMENTS = [
  { label: "0.2x", multiplier: 0.2, weight: 25 },
  { label: "0.5x", multiplier: 0.5, weight: 20 },
  { label: "1x",   multiplier: 1,   weight: 20 },
  { label: "1.5x", multiplier: 1.5, weight: 15 },
  { label: "2x",   multiplier: 2,   weight: 10 },
  { label: "3x",   multiplier: 3,   weight: 6  },
  { label: "5x",   multiplier: 5,   weight: 3  },
  { label: "10x",  multiplier: 10,  weight: 1  },
];
const WIN_SEGMENTS   = WHEEL_SEGMENTS.filter(s => s.multiplier > 1);
const LOSE_SEGMENTS  = WHEEL_SEGMENTS.filter(s => s.multiplier <= 1);

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = Math.random() * total;
  for (const item of items) { r -= item.weight; if (r <= 0) return item; }
  return items[items.length - 1];
}

router.post("/games/wheel", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { casinoId: rawCasinoId } = req.body;
  const casinoId = rawCasinoId ? parseInt(rawCasinoId) : undefined;

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  let wheelSegments = [...WHEEL_SEGMENTS];
  let casinoOddsMultiplier = 1;

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "wheel", betAmount, res);
    if (!ok) return;
    const [oddsRow] = await db.select().from(casinoGameOddsTable)
      .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, "wheel"))).limit(1);
    if (oddsRow) {
      casinoOddsMultiplier = parseFloat(oddsRow.payoutMultiplier);
      if (oddsRow.payTableConfig) {
        try {
          const custom = JSON.parse(oddsRow.payTableConfig) as Record<string, number>;
          wheelSegments = wheelSegments.map((seg, i) => {
            const customMult = custom[`seg${i}`];
            return customMult !== undefined ? { ...seg, multiplier: customMult } : seg;
          });
        } catch { /* ignore parse error */ }
      }
    }
  }

  const customWinSegs = wheelSegments.filter(s => s.multiplier > 1);
  const customLoseSegs = wheelSegments.filter(s => s.multiplier <= 1);
  const winChance = casinoId !== undefined ? 0.5 : calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;
  const pickFrom = doWin ? (customWinSegs.length > 0 ? customWinSegs : wheelSegments) : (customLoseSegs.length > 0 ? customLoseSegs : wheelSegments);
  const segment = weightedPick(pickFrom);
  const segmentIndex = wheelSegments.indexOf(segment);
  const result = await settleGame(userId, "wheel", betAmount, segment.multiplier * casinoOddsMultiplier, user, pool, casinoId);
  res.json({ ...result, segment: segment.label, segmentIndex, wheelPayouts: wheelSegments.map(s => s.multiplier) });
});

// ─── 6. Number Guess ────────────────────────────────────────────────────────
router.post("/games/guess", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { guess: rawGuess, casinoId: rawCasinoId } = req.body;
  const guessed = parseInt(rawGuess);
  const casinoId = rawCasinoId ? parseInt(rawCasinoId) : undefined;
  if (isNaN(guessed) || guessed < 1 || guessed > 100) {
    res.status(400).json({ error: "Guess must be 1–100" }); return;
  }

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  let guessPayouts = { exact: 50, near1: 10, near5: 3, near10: 2, near20: 1.5 };
  let guessOddsMult = 1;

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "guess", betAmount, res);
    if (!ok) return;
    const [oddsRow] = await db.select().from(casinoGameOddsTable)
      .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, "guess"))).limit(1);
    if (oddsRow) {
      guessOddsMult = parseFloat(oddsRow.payoutMultiplier);
      if (oddsRow.payTableConfig) {
        try { guessPayouts = { ...guessPayouts, ...JSON.parse(oddsRow.payTableConfig) }; } catch { /* ignore */ }
      }
    }
  }

  const winChance = casinoId !== undefined ? 0.5 : calculateWinChance(betAmount, parseFloat(pool.totalAmount));
  const doWin = Math.random() < winChance;

  let actual: number;
  if (doWin) {
    const dist = [0, 1, 2, 5, 10];
    const off = dist[Math.floor(Math.random() * dist.length)];
    const sign = Math.random() > 0.5 ? 1 : -1;
    actual = Math.max(1, Math.min(100, guessed + sign * off));
  } else {
    let candidate: number;
    do { candidate = Math.floor(Math.random() * 100) + 1; }
    while (Math.abs(candidate - guessed) <= 20);
    actual = candidate;
  }

  const distance = Math.abs(actual - guessed);
  let baseMult = 0;
  if (distance === 0)        baseMult = guessPayouts.exact;
  else if (distance <= 1)    baseMult = guessPayouts.near1;
  else if (distance <= 5)    baseMult = guessPayouts.near5;
  else if (distance <= 10)   baseMult = guessPayouts.near10;
  else if (distance <= 20)   baseMult = guessPayouts.near20;
  const multiplier = baseMult * guessOddsMult;

  const result = await settleGame(userId, "guess", betAmount, multiplier, user, pool, casinoId);
  res.json({ ...result, guessed, actual, distance, guessPayouts });
});

// ─── 7. Mines — Stateful (start / reveal / cashout) ──────────────────────────
interface MinesGameState {
  betAmount: number;
  minesCount: number;
  minePositions: Set<number>;
  revealedSafe: number[];
  poolId: number;
  poolAmountAtStart: number;
  casinoId?: number;
}
const minesGames = new Map<number, MinesGameState>();

function minesMultiplier(minesCount: number, safeReveals: number): number {
  let m = 1;
  for (let i = 0; i < safeReveals; i++) {
    m *= ((25 - i) / (25 - minesCount - i)) * 0.97;
  }
  return parseFloat(m.toFixed(4));
}

// Start a new mines game — deducts bet immediately
router.post("/games/mines/start", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { minesCount: rawMines, casinoId: rawCasinoId } = req.body;
  const minesCount = parseInt(rawMines);
  const casinoId = rawCasinoId ? parseInt(rawCasinoId) : undefined;

  if (isNaN(minesCount) || minesCount < 1 || minesCount > 24) {
    res.status(400).json({ error: "minesCount must be 1–24" }); return;
  }

  if (minesGames.has(userId)) {
    res.status(400).json({ error: "You already have an active mines game. Cash out or let it resolve first." }); return;
  }

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  const currentBalance = parseFloat(user.balance);
  if (currentBalance < betAmount) { res.status(400).json({ error: "Insufficient balance" }); return; }

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "mines", betAmount, res);
    if (!ok) return;
  }

  const allTiles = Array.from({ length: 25 }, (_, i) => i);
  const shuffled = [...allTiles].sort(() => Math.random() - 0.5);
  const minePositions = new Set(shuffled.slice(0, minesCount));

  const newBalance = await db.transaction(async (tx) => {
    const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");
    const balance = parseFloat(freshUser.balance);
    if (balance < betAmount) throw new Error("Insufficient balance");
    const updatedBalance = balance - betAmount;
    await tx.update(usersTable).set({ balance: updatedBalance.toFixed(2) }).where(eq(usersTable.id, userId));
    if (casinoId === undefined) {
      await tx.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} + ${betAmount}` }).where(eq(poolTable.id, pool.id));
    }
    return updatedBalance;
  });

  minesGames.set(userId, {
    betAmount,
    minesCount,
    minePositions,
    revealedSafe: [],
    poolId: pool.id,
    poolAmountAtStart: parseFloat(pool.totalAmount) + betAmount,
    casinoId,
  });

  res.json({ started: true, minesCount, totalTiles: 25, newBalance });
});

// Check current game state (used on page load to recover mid-game)
router.get("/games/mines/status", (req, res): void => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = minesGames.get(userId);
  if (!game) { res.json({ active: false }); return; }
  const multiplier = minesMultiplier(game.minesCount, game.revealedSafe.length);
  const potentialPayout = parseFloat((game.betAmount * multiplier).toFixed(2));
  res.json({
    active: true,
    betAmount: game.betAmount,
    minesCount: game.minesCount,
    revealedSafe: game.revealedSafe,
    currentMultiplier: multiplier,
    potentialPayout,
  });
});

// Abandon a stuck game — forfeits the bet (no refund, already deducted on start)
router.post("/games/mines/abandon", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = minesGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active mines game to abandon." }); return; }

  minesGames.delete(userId);
  const { user, pool } = await loadContext(userId);
  await settleGame(userId, "mines", game.betAmount, 0, user!, pool, game.casinoId, true);
  res.json({ abandoned: true, lostAmount: game.betAmount, minePositions: [...game.minePositions] });
});

// Reveal a tile
router.post("/games/mines/reveal", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const tileIndex = parseInt(req.body?.tileIndex);
  if (isNaN(tileIndex) || tileIndex < 0 || tileIndex > 24) {
    res.status(400).json({ error: "tileIndex must be 0–24" }); return;
  }

  const game = minesGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active mines game. Start a new game first." }); return; }
  if (game.revealedSafe.includes(tileIndex)) {
    res.status(400).json({ error: "Tile already revealed" }); return;
  }

  const hitMine = game.minePositions.has(tileIndex);

  if (hitMine) {
    minesGames.delete(userId);
    const { user, pool } = await loadContext(userId);
    const result = await settleGame(userId, "mines", game.betAmount, 0, user!, pool, game.casinoId, true);
    res.json({ hitMine: true, minePositions: [...game.minePositions], newBalance: result.newBalance });
    return;
  }

  game.revealedSafe.push(tileIndex);
  const currentMultiplier = minesMultiplier(game.minesCount, game.revealedSafe.length);
  const [revealUserRow] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const [revealPoolRow] = await db.select().from(poolTable).limit(1);
  const potentialPayout = Math.min(game.betAmount * currentMultiplier, parseFloat(revealPoolRow.totalAmount));
  res.json({
    hitMine: false,
    tileIndex,
    revealedSafe: game.revealedSafe,
    currentMultiplier,
    potentialPayout,
    currentBalance: parseFloat(revealUserRow.balance),
    safeLeft: 25 - game.minesCount - game.revealedSafe.length,
  });
});

// Cash out current winnings
router.post("/games/mines/cashout", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;

  const game = minesGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active mines game." }); return; }
  if (game.revealedSafe.length === 0) {
    res.status(400).json({ error: "Reveal at least one tile before cashing out." }); return;
  }

  minesGames.delete(userId);

  const [[user], [pool]] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1),
    db.select().from(poolTable).limit(1),
  ]);
  const currentBalance = parseFloat(user.balance);
  const multiplier = minesMultiplier(game.minesCount, game.revealedSafe.length);
  const uncappedPayout = game.betAmount * multiplier;
  const won = uncappedPayout > game.betAmount;

  let payout: number;
  let newBalance: number;

  if (game.casinoId !== undefined) {
    const [casino] = await db.select().from(casinosTable).where(eq(casinosTable.id, game.casinoId)).limit(1);
    const bankroll = parseFloat(casino?.bankroll ?? "0");
    // Bet was already deducted from player at game start but not yet added to bankroll
    const totalCasinoFunds = bankroll + game.betAmount;
    const insolvent = won && uncappedPayout > totalCasinoFunds;
    payout = won ? Math.min(uncappedPayout, totalCasinoFunds) : uncappedPayout;
    newBalance = currentBalance + payout;
    const casinoProfit = game.betAmount - payout;
    const newBankroll = Math.max(0, bankroll + casinoProfit);

    const casinoUpdate: Record<string, unknown> = {
      bankroll: newBankroll.toFixed(2),
      totalBets: sql`${casinosTable.totalBets} + 1`,
      totalWagered: sql`${casinosTable.totalWagered} + ${game.betAmount}`,
      totalPaidOut: sql`${casinosTable.totalPaidOut} + ${payout}`,
      isPaused: newBankroll <= 0 || insolvent,
      updatedAt: new Date(),
    };
    if (insolvent) {
      casinoUpdate.insolvencyWinnerId = userId;
      casinoUpdate.insolvencyDebtAmount = (uncappedPayout - totalCasinoFunds).toFixed(2);
    }

    await Promise.all([
      db.update(casinosTable).set(casinoUpdate).where(eq(casinosTable.id, game.casinoId)),
      db.insert(casinoBetsTable).values({
        casinoId: game.casinoId, userId, gameType: "mines",
        betAmount: game.betAmount.toFixed(2), result: won ? "win" : "loss",
        payout: payout.toFixed(2), multiplier: multiplier.toFixed(4),
      }),
      db.insert(casinoTransactionsTable).values({
        casinoId: game.casinoId, type: won ? "bet_loss" : "bet_win",
        amount: Math.abs(casinoProfit).toFixed(2),
        description: `mines — ${won ? "Player win" : "Player loss"}`,
      }),
    ]);
  } else {
    const poolAmount = parseFloat(pool.totalAmount);
    payout = Math.min(uncappedPayout, poolAmount);
    newBalance = currentBalance + payout;
    const newPool = Math.max(0, poolAmount - payout);
    const newBiggestWin = won && payout > parseFloat(pool.biggestWin) ? payout : parseFloat(pool.biggestWin);
    const newBiggestBet = game.betAmount > parseFloat(pool.biggestBet) ? game.betAmount : parseFloat(pool.biggestBet);

    await db.update(poolTable).set({
      totalAmount: newPool.toFixed(2),
      biggestWin: newBiggestWin.toFixed(2),
      biggestBet: newBiggestBet.toFixed(2),
    }).where(eq(poolTable.id, pool.id));
  }

  const profit = payout - game.betAmount;
  const gamesPlayed = parseInt(user.gamesPlayed) + 1;
  const totalWins = parseInt(user.totalWins) + (won ? 1 : 0);
  const totalLosses = parseInt(user.totalLosses) + (!won ? 1 : 0);
  const currentStreak = won ? parseInt(user.currentStreak) + 1 : 0;
  const winStreak = Math.max(parseInt(user.winStreak), currentStreak);
  const totalProfit = parseFloat(user.totalProfit) + profit;

  await Promise.all([
    db.update(usersTable).set({
      balance: newBalance.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      biggestWin: (won && payout > parseFloat(user.biggestWin) ? payout : parseFloat(user.biggestWin)).toFixed(2),
      biggestBet: (game.betAmount > parseFloat(user.biggestBet) ? game.betAmount : parseFloat(user.biggestBet)).toFixed(2),
      gamesPlayed: gamesPlayed.toString(),
      winStreak: winStreak.toString(),
      currentStreak: currentStreak.toString(),
      totalWins: totalWins.toString(),
      totalLosses: totalLosses.toString(),
      lastBetAt: new Date(),
    }).where(eq(usersTable.id, userId)),
    db.insert(betsTable).values({
      userId,
      gameType: "mines",
      betAmount: game.betAmount.toFixed(2),
      result: won ? "win" : "loss",
      payout: payout.toFixed(2),
      multiplier: multiplier.toFixed(4),
    }),
  ]);

  res.json({
    payout,
    multiplier,
    newBalance,
    minePositions: [...game.minePositions],
    revealedSafe: game.revealedSafe,
    won,
  });
});

// ─── 8. Blackjack — Deal ─────────────────────────────────────────────────────
router.post("/games/blackjack/deal", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;

  const { casinoId: rawCasinoId } = req.body;
  const casinoId = rawCasinoId ? parseInt(rawCasinoId) : undefined;

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (Math.round(parseFloat(user.balance) * 100) < Math.round(betAmount * 100)) { res.status(400).json({ error: "Insufficient balance" }); return; }

  let bjPayouts = { bj: 2.5, win: 2.0 };
  let bjOddsMult = 1;

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "blackjack", betAmount, res);
    if (!ok) return;
    const [oddsRow] = await db.select().from(casinoGameOddsTable)
      .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, "blackjack"))).limit(1);
    if (oddsRow) {
      bjOddsMult = parseFloat(oddsRow.payoutMultiplier);
      if (oddsRow.payTableConfig) {
        try { bjPayouts = { ...bjPayouts, ...JSON.parse(oddsRow.payTableConfig) }; } catch { /* ignore */ }
      }
    }
  }

  bjGames.delete(userId);

  const playerCards = [drawCard(), drawCard()];
  const dealerCards = [drawCard(), drawCard()];
  const playerTotal = handTotal(playerCards);
  const dealerTotal = handTotal(dealerCards);

  bjGames.set(userId, {
    betAmount,
    playerCards,
    dealerCards,
    poolId: pool.id,
    poolAmount: parseFloat(pool.totalAmount),
    currentBalance: parseFloat(user.balance),
    casinoId,
    bjPayouts,
    bjOddsMult,
  });

  const playerBJ = playerCards.length === 2 && playerTotal === 21;
  const dealerBJ = dealerCards.length === 2 && dealerTotal === 21;

  if (playerBJ || dealerBJ) {
    bjGames.delete(userId);
    let multiplier = 1;
    if (playerBJ && !dealerBJ) multiplier = bjPayouts.bj * bjOddsMult;
    else if (dealerBJ && !playerBJ) multiplier = 0;
    const result = await settleGame(userId, "blackjack", betAmount, multiplier, user, pool, casinoId);
    res.json({
      ...result,
      playerCards: playerCards.map(cardLabel),
      dealerCards: dealerCards.map(cardLabel),
      playerTotal,
      dealerTotal,
      done: true,
      outcome: playerBJ && !dealerBJ ? "blackjack" : dealerBJ && !playerBJ ? "dealer_blackjack" : "push",
    }); return;
  }

  res.json({
    playerCards: playerCards.map(cardLabel),
    dealerUpcard: cardLabel(dealerCards[0]),
    playerTotal,
    done: false,
  });
});

// ─── 8. Blackjack — Action ────────────────────────────────────────────────────
router.post("/games/blackjack/action", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const { action } = req.body;
  if (!["hit", "stand"].includes(action)) {
    res.status(400).json({ error: "action must be 'hit' or 'stand'" }); return;
  }

  const game = bjGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active Blackjack game. Deal first." }); return; }

  if (action === "hit") {
    game.playerCards.push(drawCard());
    const playerTotal = handTotal(game.playerCards);

    if (playerTotal > 21) {
      bjGames.delete(userId);
      const { user, pool } = await loadContext(userId);
      const result = await settleGame(userId, "blackjack", game.betAmount, 0, user!, pool, game.casinoId);
      res.json({
        ...result,
        playerCards: game.playerCards.map(cardLabel),
        dealerCards: [cardLabel(game.dealerCards[0]), "?"],
        playerTotal,
        dealerTotal: null,
        done: true,
        outcome: "bust",
      }); return;
    }

    res.json({
      playerCards: game.playerCards.map(cardLabel),
      playerTotal,
      done: false,
    }); return;
  }

  // Stand — dealer plays
  const dealerCards = [...game.dealerCards];
  while (handTotal(dealerCards) < 17) dealerCards.push(drawCard());

  const playerTotal = handTotal(game.playerCards);
  const dealerTotal = handTotal(dealerCards);

  const { bjPayouts: gBjPayouts, bjOddsMult: gBjMult } = game;
  let outcome: string;
  let multiplier: number;
  if (dealerTotal > 21) { outcome = "dealer_bust"; multiplier = gBjPayouts.win * gBjMult; }
  else if (playerTotal > dealerTotal) { outcome = "win"; multiplier = gBjPayouts.win * gBjMult; }
  else if (playerTotal < dealerTotal) { outcome = "lose"; multiplier = 0; }
  else { outcome = "push"; multiplier = 1; }

  bjGames.delete(userId);
  const { user, pool } = await loadContext(userId);
  const result = await settleGame(userId, "blackjack", game.betAmount, multiplier, user!, pool, game.casinoId);
  res.json({
    ...result,
    playerCards: game.playerCards.map(cardLabel),
    dealerCards: dealerCards.map(cardLabel),
    playerTotal,
    dealerTotal,
    done: true,
    outcome,
  });
});

// ─── Pyramid Climb (Session-Based) ───────────────────────────────────────────
const PYRAMID_PAYOUTS = [0, 1.9, 3.8, 7.5, 15, 30, 60, 120, 240, 480, 960];

interface PyramidGameState {
  betAmount: number;
  outcomes: boolean[];
  currentLevel: number;
  poolId: number;
  casinoId?: number;
  pyramidPayouts: number[];
  pyramidOddsMult: number;
}
const pyramidGames = new Map<number, PyramidGameState>();

router.post("/games/pyramid/start", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  if (pyramidGames.has(userId)) { res.status(400).json({ error: "You already have an active pyramid game. Cash out or finish first." }); return; }

  const { casinoId: rawCasinoId } = req.body;
  const casinoId = rawCasinoId ? parseInt(rawCasinoId) : undefined;

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (user.permanentlyBanned || (user.bannedUntil && user.bannedUntil > new Date())) { res.status(403).json({ error: "You are banned from playing games." }); return; }
  const currentBalance = parseFloat(user.balance);
  if (currentBalance < betAmount) { res.status(400).json({ error: "Insufficient balance" }); return; }

  let pyramidPayouts = [...PYRAMID_PAYOUTS];
  let pyramidOddsMult = 1;

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "pyramid", betAmount, res);
    if (!ok) return;
    const [oddsRow] = await db.select().from(casinoGameOddsTable)
      .where(and(eq(casinoGameOddsTable.casinoId, casinoId), eq(casinoGameOddsTable.gameType, "pyramid"))).limit(1);
    if (oddsRow) {
      pyramidOddsMult = parseFloat(oddsRow.payoutMultiplier);
      if (oddsRow.payTableConfig) {
        try {
          const custom = JSON.parse(oddsRow.payTableConfig) as Record<string, number>;
          pyramidPayouts = pyramidPayouts.map((v, i) => {
            if (i === 0) return 0;
            const k = `l${i}`;
            return custom[k] !== undefined ? custom[k] : v;
          });
        } catch { /* ignore */ }
      }
    }
  }

  const outcomes = Array.from({ length: 10 }, () => Math.random() >= 0.5);

  const newBalance = await db.transaction(async (tx) => {
    const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");
    const balance = parseFloat(freshUser.balance);
    if (balance < betAmount) throw new Error("Insufficient balance");
    const updatedBalance = balance - betAmount;
    await tx.update(usersTable).set({ balance: updatedBalance.toFixed(2) }).where(eq(usersTable.id, userId));
    if (casinoId === undefined) {
      await tx.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} + ${betAmount}` }).where(eq(poolTable.id, pool.id));
    }
    return updatedBalance;
  });

  pyramidGames.set(userId, { betAmount, outcomes, currentLevel: 0, poolId: pool.id, casinoId, pyramidPayouts, pyramidOddsMult });
  res.json({ started: true, newBalance, totalLevels: 10, pyramidPayouts });
});

router.get("/games/pyramid/status", (req, res): void => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = pyramidGames.get(userId);
  if (!game) { res.json({ active: false }); return; }
  const PP = game.pyramidPayouts ?? PYRAMID_PAYOUTS;
  const cashOutMultiplier = game.currentLevel > 0 ? PP[game.currentLevel] : 0;
  res.json({
    active: true,
    betAmount: game.betAmount,
    currentLevel: game.currentLevel,
    canCashOut: game.currentLevel > 0,
    cashOutMultiplier,
    potentialPayout: parseFloat((game.betAmount * cashOutMultiplier).toFixed(2)),
    pyramidPayouts: PP,
  });
});

router.post("/games/pyramid/advance", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = pyramidGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active pyramid game. Start a new game first." }); return; }
  if (game.currentLevel >= 10) { res.status(400).json({ error: "Already at maximum level." }); return; }
  const nextLevel = game.currentLevel + 1;
  const passed = game.outcomes[nextLevel - 1];
  game.currentLevel = nextLevel;

  if (!passed) {
    pyramidGames.delete(userId);
    const { user, pool } = await loadContext(userId);
    const result = await settleGame(userId, "pyramid", game.betAmount, 0, user!, pool, game.casinoId, true);
    res.json({ passed: false, failedAtLevel: nextLevel, newBalance: result.newBalance }); return;
  }

  const PP2 = game.pyramidPayouts ?? PYRAMID_PAYOUTS;
  const oddsMult = game.pyramidOddsMult ?? 1;
  if (nextLevel === 10) {
    pyramidGames.delete(userId);
    const { user, pool } = await loadContext(userId);
    const multiplier = PP2[10] * oddsMult;
    const result = await settleGame(userId, "pyramid", game.betAmount, multiplier, user!, pool, game.casinoId, true);
    res.json({ passed: true, level: nextLevel, reachedTop: true, payout: result.payout, newBalance: result.newBalance, multiplier }); return;
  }

  const cashOutMultiplier = PP2[nextLevel] * oddsMult;
  res.json({ passed: true, level: nextLevel, reachedTop: false, cashOutMultiplier, potentialPayout: parseFloat((game.betAmount * cashOutMultiplier).toFixed(2)) });
});

router.post("/games/pyramid/cashout", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = pyramidGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active pyramid game." }); return; }
  if (game.currentLevel === 0) { res.status(400).json({ error: "Advance at least one level before cashing out." }); return; }
  pyramidGames.delete(userId);
  const { user, pool } = await loadContext(userId);
  const PP3 = game.pyramidPayouts ?? PYRAMID_PAYOUTS;
  const multiplier = PP3[game.currentLevel] * (game.pyramidOddsMult ?? 1);
  const result = await settleGame(userId, "pyramid", game.betAmount, multiplier, user!, pool, game.casinoId, true);
  res.json({ payout: result.payout, multiplier, won: result.won, newBalance: result.newBalance, level: game.currentLevel });
});

// ─── IceBreak (Session-Based, like Mines) ────────────────────────────────────
const ICE_TOTAL = 16;
const ICE_DANGER = 4;
const ICE_SAFE = ICE_TOTAL - ICE_DANGER;

function iceMultiplier(safeReveals: number): number {
  let m = 1;
  for (let i = 0; i < safeReveals; i++) {
    m *= ((ICE_TOTAL - i) / (ICE_SAFE - i)) * 0.97;
  }
  return parseFloat(m.toFixed(4));
}

interface IceGameState {
  betAmount: number;
  dangerPositions: Set<number>;
  revealedSafe: number[];
  poolId: number;
  casinoId?: number;
}
const iceGames = new Map<number, IceGameState>();

router.post("/games/icebreak/start", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const betAmount = parseBet(req, res); if (!betAmount) return;
  if (iceGames.has(userId)) { res.status(400).json({ error: "You already have an active ice break game." }); return; }

  const { casinoId: rawCasinoId } = req.body;
  const casinoId = rawCasinoId ? parseInt(rawCasinoId) : undefined;

  const { user, pool } = await loadContext(userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }
  if (user.permanentlyBanned || (user.bannedUntil && user.bannedUntil > new Date())) { res.status(403).json({ error: "You are banned from playing games." }); return; }
  const currentBalance = parseFloat(user.balance);
  if (currentBalance < betAmount) { res.status(400).json({ error: "Insufficient balance" }); return; }

  if (casinoId !== undefined) {
    const ok = await validateCasinoPlay(casinoId, "icebreak", betAmount, res);
    if (!ok) return;
  }

  const shuffled = Array.from({ length: ICE_TOTAL }, (_, i) => i).sort(() => Math.random() - 0.5);
  const dangerPositions = new Set(shuffled.slice(0, ICE_DANGER));

  const newBalance = await db.transaction(async (tx) => {
    const [freshUser] = await tx.select({ balance: usersTable.balance }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!freshUser) throw new Error("User not found");
    const balance = parseFloat(freshUser.balance);
    if (balance < betAmount) throw new Error("Insufficient balance");
    const updatedBalance = balance - betAmount;
    await tx.update(usersTable).set({ balance: updatedBalance.toFixed(2) }).where(eq(usersTable.id, userId));
    if (casinoId === undefined) {
      await tx.update(poolTable).set({ totalAmount: sql`${poolTable.totalAmount} + ${betAmount}` }).where(eq(poolTable.id, pool.id));
    }
    return updatedBalance;
  });

  iceGames.set(userId, { betAmount, dangerPositions, revealedSafe: [], poolId: pool.id, casinoId });
  res.json({ started: true, totalTiles: ICE_TOTAL, dangerCount: ICE_DANGER, newBalance });
});

router.get("/games/icebreak/status", (req, res): void => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = iceGames.get(userId);
  if (!game) { res.json({ active: false }); return; }
  const multiplier = iceMultiplier(game.revealedSafe.length);
  res.json({ active: true, betAmount: game.betAmount, revealedSafe: game.revealedSafe, currentMultiplier: multiplier, potentialPayout: parseFloat((game.betAmount * multiplier).toFixed(2)) });
});

router.post("/games/icebreak/reveal", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const tileIndex = parseInt(req.body?.tileIndex);
  if (isNaN(tileIndex) || tileIndex < 0 || tileIndex >= ICE_TOTAL) { res.status(400).json({ error: `tileIndex must be 0–${ICE_TOTAL - 1}` }); return; }
  const game = iceGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active ice break game. Start a new game first." }); return; }
  if (game.revealedSafe.includes(tileIndex)) { res.status(400).json({ error: "Tile already revealed" }); return; }
  const hitDanger = game.dangerPositions.has(tileIndex);
  if (hitDanger) {
    iceGames.delete(userId);
    const { user, pool } = await loadContext(userId);
    const result = await settleGame(userId, "icebreak", game.betAmount, 0, user!, pool, game.casinoId, true);
    res.json({ hitDanger: true, dangerPositions: [...game.dangerPositions], newBalance: result.newBalance }); return;
  }
  game.revealedSafe.push(tileIndex);
  const currentMultiplier = iceMultiplier(game.revealedSafe.length);
  const [poolRow] = await db.select().from(poolTable).limit(1);
  const potentialPayout = Math.min(game.betAmount * currentMultiplier, parseFloat(poolRow.totalAmount));
  res.json({ hitDanger: false, tileIndex, revealedSafe: game.revealedSafe, currentMultiplier, potentialPayout, safeLeft: ICE_SAFE - game.revealedSafe.length });
});

router.post("/games/icebreak/cashout", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = iceGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active ice break game." }); return; }
  if (game.revealedSafe.length === 0) { res.status(400).json({ error: "Reveal at least one safe tile before cashing out." }); return; }
  iceGames.delete(userId);
  const { user, pool } = await loadContext(userId);
  const multiplier = iceMultiplier(game.revealedSafe.length);
  const result = await settleGame(userId, "icebreak", game.betAmount, multiplier, user!, pool, game.casinoId, true);
  res.json({ payout: result.payout, multiplier, won: result.won, newBalance: result.newBalance, revealedCount: game.revealedSafe.length, dangerPositions: [...game.dangerPositions] });
});

router.post("/games/icebreak/abandon", async (req, res): Promise<void> => {
  const userId = authCheck(req, res); if (!userId) return;
  const game = iceGames.get(userId);
  if (!game) { res.status(400).json({ error: "No active ice break game to abandon." }); return; }
  iceGames.delete(userId);
  const { user, pool } = await loadContext(userId);
  await settleGame(userId, "icebreak", game.betAmount, 0, user!, pool, game.casinoId, true);
  res.json({ abandoned: true, lostAmount: game.betAmount, dangerPositions: [...game.dangerPositions] });
});

export default router;
