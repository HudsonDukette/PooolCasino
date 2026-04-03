import { pgTable, text, serial, timestamp, numeric, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  email: text("email"),
  balance: numeric("balance", { precision: 25, scale: 2 }).notNull().default("10000.00"),
  isAdmin: boolean("is_admin").notNull().default(false),
  referralCode: text("referral_code").unique(),
  referredBy: integer("referred_by"),
  avatarUrl: text("avatar_url"),
  totalProfit: numeric("total_profit", { precision: 25, scale: 2 }).notNull().default("0.00"),
  biggestWin: numeric("biggest_win", { precision: 25, scale: 2 }).notNull().default("0.00"),
  biggestBet: numeric("biggest_bet", { precision: 25, scale: 2 }).notNull().default("0.00"),
  gamesPlayed: text("games_played").notNull().default("0"),
  winStreak: text("win_streak").notNull().default("0"),
  currentStreak: text("current_streak").notNull().default("0"),
  totalWins: text("total_wins").notNull().default("0"),
  totalLosses: text("total_losses").notNull().default("0"),
  lastDailyClaim: timestamp("last_daily_claim", { withTimezone: true }),
  lastBetAt: timestamp("last_bet_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  crazyGamesUserId: text("crazy_games_user_id").unique(),
  isCrazyGamesLinked: boolean("is_crazy_games_linked").notNull().default(false),
  deviceId: text("device_id").unique(),
  isGuest: boolean("is_guest").notNull().default(false),
  suspendedUntil: timestamp("suspended_until", { withTimezone: true }),
  bannedUntil: timestamp("banned_until", { withTimezone: true }),
  permanentlyBanned: boolean("permanently_banned").notNull().default(false),
  banReason: text("ban_reason"),
  isOwner: boolean("is_owner").notNull().default(false),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
