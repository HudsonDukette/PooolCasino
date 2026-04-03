import { pool, db, badgesTable, userBadgesTable, usersTable, monthlyChallengesTable, userMonthlyProgressTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";

interface GameResult {
  userId: number;
  gameType: string;
  betAmount: number;
  won: boolean;
  lostAmount?: number;
  currentWinStreak?: number;
}

export function trackGameProgress(result: GameResult): void {
  Promise.all([
    checkAndAwardBadges(result.userId),
    updateMonthlyChallenges(result),
  ]).catch(err => logger.error({ err }, "Error tracking game progress"));
}

async function checkAndAwardBadges(userId: number): Promise<void> {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (!user) return;

  const allBadges = await db.select().from(badgesTable);
  const earnedRows = await db.select({ badgeId: userBadgesTable.badgeId })
    .from(userBadgesTable).where(eq(userBadgesTable.userId, userId));
  const earnedIds = new Set(earnedRows.map(r => r.badgeId));

  const gamesPlayed = parseInt(user.gamesPlayed ?? "0");
  const winStreak = parseInt(user.winStreak ?? "0");
  const biggestBet = parseFloat(user.biggestBet ?? "0");

  const pvpRes = await pool.query<{ c: string }>(
    `SELECT COUNT(*) as c FROM match_players mp
     JOIN matches m ON m.id = mp.match_id
     WHERE mp.user_id = $1 AND m.winner_id = $1 AND m.status = 'completed'`,
    [userId]
  );
  const pvpWins = parseInt(pvpRes.rows[0]?.c ?? "0");

  for (const badge of allBadges) {
    if (earnedIds.has(badge.id)) continue;

    let earned = false;
    switch (badge.requirementType) {
      case "games_played":   earned = gamesPlayed >= badge.requirementValue; break;
      case "win_streak":     earned = winStreak >= badge.requirementValue;   break;
      case "biggest_bet":    earned = biggestBet >= badge.requirementValue;  break;
      case "pvp_wins":       earned = pvpWins >= badge.requirementValue;     break;
      case "game_first": {
        if (badge.requirementGame) {
          const r = await pool.query<{ c: string }>(
            `SELECT COUNT(*) as c FROM bets WHERE user_id = $1 AND game_type = $2`,
            [userId, badge.requirementGame]
          );
          earned = parseInt(r.rows[0]?.c ?? "0") >= 1;
        }
        break;
      }
    }

    if (earned) {
      await db.insert(userBadgesTable).values({
        userId,
        badgeId: badge.id,
        claimed: false,
        progress: badge.requirementValue,
      }).onConflictDoNothing();
    }
  }
}

async function updateMonthlyChallenges(result: GameResult): Promise<void> {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const challenges = await db.select().from(monthlyChallengesTable)
    .where(eq(monthlyChallengesTable.month, month));

  if (challenges.length === 0) return;

  for (const challenge of challenges) {
    let delta: number | null = null;
    let setTo: number | null = null;

    switch (challenge.requirementType) {
      case "pvp_wins":
        continue;

      case "total_losses_amount":
        if (!result.won && result.lostAmount) delta = Math.floor(result.lostAmount);
        break;

      case "win_streak":
        if (result.currentWinStreak !== undefined) setTo = result.currentWinStreak;
        break;

      case "unique_games": {
        const r = await pool.query<{ c: string }>(
          `SELECT COUNT(DISTINCT game_type) as c FROM bets WHERE user_id = $1
           AND "timestamp" >= date_trunc('month', NOW())`,
          [result.userId]
        );
        setTo = parseInt(r.rows[0]?.c ?? "0");
        break;
      }

      case "big_bets":
        if (result.betAmount >= 10000) delta = 1;
        break;

      case "game_played":
        delta = 1;
        break;
    }

    if (delta === null && setTo === null) continue;

    await pool.query(
      `INSERT INTO user_monthly_progress (user_id, challenge_id, progress)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, challenge_id) DO UPDATE
       SET progress = CASE
         WHEN $4::boolean THEN GREATEST(user_monthly_progress.progress, $3)
         ELSE user_monthly_progress.progress + $3
       END
       WHERE NOT user_monthly_progress.claimed`,
      [
        result.userId,
        challenge.id,
        delta !== null ? delta : (setTo ?? 0),
        setTo !== null,
      ]
    );
  }
}
