import { db, badgesTable, monthlyChallengesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const BADGES = [
  { name: "First Blood", description: "Play your first game ever", icon: "🩸", badgeType: "permanent", requirementType: "games_played", requirementValue: 1, requirementGame: null },
  { name: "High Roller", description: "Place a single bet over $1,000,000", icon: "💎", badgeType: "permanent", requirementType: "biggest_bet", requirementValue: 1000000, requirementGame: null },
  { name: "Whale", description: "Place a single bet over $100,000,000", icon: "🐋", badgeType: "permanent", requirementType: "biggest_bet", requirementValue: 100000000, requirementGame: null },
  { name: "Hot Streak", description: "Win 5 games in a row", icon: "🔥", badgeType: "permanent", requirementType: "win_streak", requirementValue: 5, requirementGame: null },
  { name: "On Fire", description: "Win 10 games in a row", icon: "🌋", badgeType: "permanent", requirementType: "win_streak", requirementValue: 10, requirementGame: null },
  { name: "Centurion", description: "Play 100 games total", icon: "⚔️", badgeType: "permanent", requirementType: "games_played", requirementValue: 100, requirementGame: null },
  { name: "Veteran", description: "Play 500 games total", icon: "🎖️", badgeType: "permanent", requirementType: "games_played", requirementValue: 500, requirementGame: null },
  { name: "PvP Initiate", description: "Win your first multiplayer match", icon: "🤺", badgeType: "permanent", requirementType: "pvp_wins", requirementValue: 1, requirementGame: null },
  { name: "PvP Champion", description: "Win 10 multiplayer matches", icon: "🏆", badgeType: "permanent", requirementType: "pvp_wins", requirementValue: 10, requirementGame: null },
  { name: "Roulette Rookie", description: "Play roulette for the first time", icon: "🎡", badgeType: "permanent", requirementType: "game_first", requirementValue: 1, requirementGame: "roulette" },
  { name: "Plinko Plunger", description: "Play plinko for the first time", icon: "🎰", badgeType: "permanent", requirementType: "game_first", requirementValue: 1, requirementGame: "plinko" },
  { name: "War General", description: "Win 5 multiplayer War matches", icon: "🗡️", badgeType: "permanent", requirementType: "pvp_wins", requirementValue: 5, requirementGame: "war" },
];

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthlyChallengeSeed(month: string) {
  return [
    { month, name: "Monthly Warrior", description: "Win 20 PvP matches this month", icon: "⚔️", requirementType: "pvp_wins", requirementValue: 20 },
    { month, name: "Losing Is Learning", description: "Lose $100,000 total this month", icon: "📉", requirementType: "total_losses_amount", requirementValue: 100000 },
    { month, name: "Hot Hands", description: "Achieve a 10-game win streak", icon: "🤲", requirementType: "win_streak", requirementValue: 10 },
    { month, name: "Social Butterfly", description: "Play 5 different game types", icon: "🦋", requirementType: "unique_games", requirementValue: 5 },
    { month, name: "High Stakes", description: "Place 50 bets over $10,000 each", icon: "💸", requirementType: "big_bets", requirementValue: 50 },
    { month, name: "Dice Master", description: "Play 100 dice games this month", icon: "🎲", requirementType: "game_played", requirementValue: 100 },
  ];
}

export async function seedBadgesAndChallenges(): Promise<void> {
  try {
    const [{ count }] = await db.select({ count: sql<number>`COUNT(*)` }).from(badgesTable);
    if (Number(count) === 0) {
      await db.insert(badgesTable).values(BADGES);
      logger.info({ count: BADGES.length }, "Seeded badges");
    }

    const month = currentMonth();
    const [{ count: challengeCount }] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(monthlyChallengesTable)
      .where(sql`month = ${month}`);

    if (Number(challengeCount) === 0) {
      await db.insert(monthlyChallengesTable).values(monthlyChallengeSeed(month));
      logger.info({ month, count: 6 }, "Seeded monthly challenges");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed badges/challenges");
  }
}
