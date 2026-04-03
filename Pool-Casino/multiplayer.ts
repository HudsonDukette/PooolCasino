import { pgTable, serial, integer, text, numeric, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const multiplayerQueueTable = pgTable("multiplayer_queue", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  gameType: text("game_type").notNull(),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
});

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  gameType: text("game_type").notNull(),
  status: text("status").notNull().default("pending"),
  winnerId: integer("winner_id").references(() => usersTable.id),
  totalRounds: integer("total_rounds").notNull().default(3),
  finalBet: numeric("final_bet", { precision: 15, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const matchPlayersTable = pgTable("match_players", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  betAmount: numeric("bet_amount", { precision: 15, scale: 2 }).notNull().default("0"),
  accepted: boolean("accepted").notNull().default(false),
  score: integer("score").notNull().default(0),
});

export const matchRoundsTable = pgTable("match_rounds", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull().references(() => matchesTable.id, { onDelete: "cascade" }),
  roundNumber: integer("round_number").notNull(),
  gameData: jsonb("game_data").notNull().default({}),
  winnerId: integer("winner_id").references(() => usersTable.id),
});

export const badgesTable = pgTable("badges", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("🏆"),
  badgeType: text("badge_type").notNull().default("permanent"),
  requirementType: text("requirement_type").notNull(),
  requirementValue: integer("requirement_value").notNull().default(1),
  requirementGame: text("requirement_game"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userBadgesTable = pgTable("user_badges", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  badgeId: integer("badge_id").notNull().references(() => badgesTable.id, { onDelete: "cascade" }),
  earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  progress: integer("progress").notNull().default(0),
  claimed: boolean("claimed").notNull().default(false),
});

export const monthlyChallengesTable = pgTable("monthly_challenges", {
  id: serial("id").primaryKey(),
  month: text("month").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  icon: text("icon").notNull().default("🎯"),
  requirementType: text("requirement_type").notNull(),
  requirementValue: integer("requirement_value").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userMonthlyProgressTable = pgTable("user_monthly_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  challengeId: integer("challenge_id").notNull().references(() => monthlyChallengesTable.id, { onDelete: "cascade" }),
  progress: integer("progress").notNull().default(0),
  claimed: boolean("claimed").notNull().default(false),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
});
