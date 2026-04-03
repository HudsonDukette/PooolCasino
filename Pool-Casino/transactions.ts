import { Router, type IRouter } from "express";
import { db, betsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { GetTransactionsQueryParams, GetTransactionsResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/transactions", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const params = GetTransactionsQueryParams.safeParse(req.query);
  const limit = params.success && params.data.limit ? params.data.limit : 20;
  const offset = params.success && params.data.offset ? params.data.offset : 0;
  const game = params.success ? params.data.game : undefined;

  let query = db
    .select()
    .from(betsTable)
    .where(eq(betsTable.userId, userId))
    .orderBy(desc(betsTable.timestamp))
    .limit(limit)
    .offset(offset);

  const bets = await query;

  const filtered = game ? bets.filter((b) => b.gameType === game) : bets;

  res.json(
    GetTransactionsResponse.parse({
      transactions: filtered.map((b) => ({
        id: b.id,
        gameType: b.gameType,
        betAmount: parseFloat(b.betAmount),
        result: b.result,
        payout: parseFloat(b.payout),
        multiplier: b.multiplier ? parseFloat(b.multiplier) : null,
        timestamp: b.timestamp.toISOString(),
      })),
      total: filtered.length,
    }),
  );
});

export default router;
