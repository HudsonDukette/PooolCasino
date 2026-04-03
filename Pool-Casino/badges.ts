import { Router, type IRouter } from "express";
import { db, pool, badgesTable, userBadgesTable, monthlyChallengesTable, userMonthlyProgressTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getLobbyStats } from "../multiplayer/matchmaking";

const router: IRouter = Router();

router.get("/badges", async (req, res): Promise<void> => {
  const userId = req.session.userId;

  const allBadges = await db.select().from(badgesTable);

  if (!userId) {
    res.json({ badges: allBadges, userBadges: [] });
    return;
  }

  const userBadges = await db.select().from(userBadgesTable).where(eq(userBadgesTable.userId, userId));

  res.json({
    badges: allBadges,
    userBadges: userBadges.map(ub => ({
      badgeId: ub.badgeId,
      earnedAt: ub.earnedAt,
      claimed: ub.claimed,
      progress: ub.progress,
    })),
  });
});

router.get("/badges/monthly", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const challenges = await db.select().from(monthlyChallengesTable)
    .where(eq(monthlyChallengesTable.month, month));

  if (!userId) {
    res.json({ challenges, progress: [] });
    return;
  }

  const progress = await db.select().from(userMonthlyProgressTable)
    .where(eq(userMonthlyProgressTable.userId, userId));

  res.json({ challenges, progress });
});

router.post("/badges/claim/:badgeId", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const badgeId = parseInt(req.params.badgeId);
  const [ub] = await db.select().from(userBadgesTable)
    .where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badgeId, badgeId))).limit(1);

  if (!ub) { res.status(404).json({ error: "Badge not earned" }); return; }
  if (ub.claimed) { res.status(400).json({ error: "Already claimed" }); return; }

  await db.update(userBadgesTable).set({ claimed: true })
    .where(and(eq(userBadgesTable.userId, userId), eq(userBadgesTable.badgeId, badgeId)));

  res.json({ ok: true });
});

router.post("/badges/monthly/claim/:challengeId", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const challengeId = parseInt(req.params.challengeId);
  const [prog] = await db.select().from(userMonthlyProgressTable)
    .where(and(
      eq(userMonthlyProgressTable.userId, userId),
      eq(userMonthlyProgressTable.challengeId, challengeId),
    )).limit(1);

  if (!prog) { res.status(404).json({ error: "Not found" }); return; }
  if (prog.claimed) { res.status(400).json({ error: "Already claimed" }); return; }

  const [challenge] = await db.select().from(monthlyChallengesTable)
    .where(eq(monthlyChallengesTable.id, challengeId)).limit(1);
  if (!challenge) { res.status(404).json({ error: "Challenge not found" }); return; }

  if (prog.progress < challenge.requirementValue) {
    res.status(400).json({ error: "Challenge not completed yet" }); return;
  }

  await db.update(userMonthlyProgressTable).set({ claimed: true, claimedAt: new Date() })
    .where(and(
      eq(userMonthlyProgressTable.userId, userId),
      eq(userMonthlyProgressTable.challengeId, challengeId),
    ));

  const reward = 5000;
  await pool.query(`UPDATE users SET balance = balance + $1 WHERE id = $2`, [reward, userId]);

  res.json({ ok: true, reward });
});

router.get("/matches/history", async (req, res): Promise<void> => {
  const userId = req.session.userId;
  if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }

  const rows = await pool.query(
    `SELECT m.id, m.game_type, m.status, m.winner_id, m.final_bet, m.created_at, m.completed_at,
            mp.score,
            u.username as opponent_username, u.id as opponent_id
     FROM matches m
     JOIN match_players mp ON mp.match_id = m.id AND mp.user_id = $1
     JOIN match_players mp2 ON mp2.match_id = m.id AND mp2.user_id != $1
     JOIN users u ON u.id = mp2.user_id
     WHERE m.status = 'completed'
     ORDER BY m.completed_at DESC
     LIMIT 20`,
    [userId]
  );

  res.json({ matches: rows.rows });
});

router.get("/lobby/stats", (_req, res): void => {
  res.json(getLobbyStats());
});

export default router;
