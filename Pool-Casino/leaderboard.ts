import { Router, type IRouter } from "express";
import { db, usersTable, betsTable } from "@workspace/db";
import { desc, eq, and, sql } from "drizzle-orm";
import {
  GetRichestPlayersResponse,
  GetBiggestWinnersResponse,
  GetBiggestBettorsResponse,
  GetRecentBigWinsResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const selectLeaderboardUser = {
  username: usersTable.username,
  avatarUrl: usersTable.avatarUrl,
  suspendedUntil: usersTable.suspendedUntil,
  bannedUntil: usersTable.bannedUntil,
  permanentlyBanned: usersTable.permanentlyBanned,
};

function mapLeaderboardUser(u: any, rank: number, value: number, label: string) {
  const now = new Date();
  return {
    rank,
    username: u.username,
    value,
    label,
    avatarUrl: u.avatarUrl ?? null,
    isSuspended: !!(u.suspendedUntil && u.suspendedUntil > now),
    isBanned: !!(u.permanentlyBanned || (u.bannedUntil && u.bannedUntil > now)),
    permanentlyBanned: !!u.permanentlyBanned,
  };
}

router.get("/leaderboard/richest", async (_req, res): Promise<void> => {
  const users = await db
    .select({ ...selectLeaderboardUser, balance: usersTable.balance })
    .from(usersTable)
    .where(eq(usersTable.isGuest, false))
    .orderBy(desc(usersTable.balance))
    .limit(20);

  res.json({
    entries: users.map((u, i) => mapLeaderboardUser(u, i + 1, parseFloat(u.balance), `$${parseFloat(u.balance).toFixed(2)}`)),
  });
});

router.get("/leaderboard/biggest-winners", async (_req, res): Promise<void> => {
  const users = await db
    .select({ ...selectLeaderboardUser, biggestWin: usersTable.biggestWin })
    .from(usersTable)
    .where(eq(usersTable.isGuest, false))
    .orderBy(desc(usersTable.biggestWin))
    .limit(20);

  res.json({
    entries: users.map((u, i) => mapLeaderboardUser(u, i + 1, parseFloat(u.biggestWin), `$${parseFloat(u.biggestWin).toFixed(2)}`)),
  });
});

router.get("/leaderboard/biggest-bettors", async (_req, res): Promise<void> => {
  const users = await db
    .select({ ...selectLeaderboardUser, biggestBet: usersTable.biggestBet })
    .from(usersTable)
    .where(eq(usersTable.isGuest, false))
    .orderBy(desc(usersTable.biggestBet))
    .limit(20);

  res.json({
    entries: users.map((u, i) => mapLeaderboardUser(u, i + 1, parseFloat(u.biggestBet), `$${parseFloat(u.biggestBet).toFixed(2)}`)),
  });
});

router.get("/leaderboard/recent-big-wins", async (_req, res): Promise<void> => {
  const wins = await db
    .select({
      username: usersTable.username,
      payout: betsTable.payout,
      betAmount: betsTable.betAmount,
      gameType: betsTable.gameType,
      multiplier: betsTable.multiplier,
      timestamp: betsTable.timestamp,
    })
    .from(betsTable)
    .innerJoin(usersTable, eq(betsTable.userId, usersTable.id))
    .where(and(eq(betsTable.result, "win"), eq(usersTable.isGuest, false)))
    .orderBy(desc(betsTable.payout))
    .limit(15);

  res.json(
    GetRecentBigWinsResponse.parse({
      wins: wins.map((w) => ({
        username: w.username,
        payout: parseFloat(w.payout),
        betAmount: parseFloat(w.betAmount),
        gameType: w.gameType,
        multiplier: w.multiplier ? parseFloat(w.multiplier) : null,
        timestamp: w.timestamp.toISOString(),
      })),
    }),
  );
});

router.get("/leaderboard/top-games", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      gameType: betsTable.gameType,
      totalWagered: sql<string>`COALESCE(SUM(${betsTable.betAmount}), 0)`,
      totalBets: sql<string>`COUNT(*)`,
      houseProfit: sql<string>`COALESCE(SUM(${betsTable.betAmount}) - SUM(${betsTable.payout}), 0)`,
    })
    .from(betsTable)
    .groupBy(betsTable.gameType)
    .orderBy(desc(sql`SUM(${betsTable.betAmount})`))
    .limit(20);

  res.json({
    games: rows.map((r, i) => ({
      rank: i + 1,
      gameType: r.gameType,
      totalWagered: parseFloat(r.totalWagered),
      totalBets: parseInt(String(r.totalBets)),
      houseProfit: parseFloat(r.houseProfit),
    })),
  });
});

export default router;
