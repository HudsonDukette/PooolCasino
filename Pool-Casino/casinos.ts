import {
  pgTable, serial, integer, text, numeric, boolean, timestamp,
} from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const casinosTable = pgTable("casinos", {
  id: serial("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => usersTable.id),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  emoji: text("emoji").notNull().default("🏦"),
  imageUrl: text("image_url"),
  bankroll: numeric("bankroll", { precision: 25, scale: 2 }).notNull().default("0.00"),
  minBet: numeric("min_bet", { precision: 15, scale: 2 }).notNull().default("100.00"),
  maxBet: numeric("max_bet", { precision: 15, scale: 2 }).notNull().default("10000.00"),
  isPaused: boolean("is_paused").notNull().default(false),
  purchasePrice: numeric("purchase_price", { precision: 25, scale: 2 }).notNull().default("0.00"),
  insolvencyWinnerId: integer("insolvency_winner_id").references(() => usersTable.id),
  insolvencyDebtAmount: numeric("insolvency_debt_amount", { precision: 25, scale: 2 }),
  totalBets: integer("total_bets").notNull().default(0),
  totalWagered: numeric("total_wagered", { precision: 25, scale: 2 }).notNull().default("0.00"),
  totalPaidOut: numeric("total_paid_out", { precision: 25, scale: 2 }).notNull().default("0.00"),
  cheapStorageLevel: integer("cheap_storage_level").notNull().default(0),
  standardStorageLevel: integer("standard_storage_level").notNull().default(0),
  expensiveStorageLevel: integer("expensive_storage_level").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Casino = typeof casinosTable.$inferSelect;

export const casinoGamesOwnedTable = pgTable("casino_games_owned", {
  id: serial("id").primaryKey(),
  casinoId: integer("casino_id").notNull().references(() => casinosTable.id),
  gameType: text("game_type").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CasinoGameOwned = typeof casinoGamesOwnedTable.$inferSelect;

export const casinoBetsTable = pgTable("casino_bets", {
  id: serial("id").primaryKey(),
  casinoId: integer("casino_id").notNull().references(() => casinosTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  gameType: text("game_type").notNull(),
  betAmount: numeric("bet_amount", { precision: 15, scale: 2 }).notNull(),
  result: text("result").notNull(),
  payout: numeric("payout", { precision: 15, scale: 2 }).notNull(),
  multiplier: numeric("multiplier", { precision: 10, scale: 4 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CasinoBet = typeof casinoBetsTable.$inferSelect;

export const casinoTransactionsTable = pgTable("casino_transactions", {
  id: serial("id").primaryKey(),
  casinoId: integer("casino_id").notNull().references(() => casinosTable.id),
  type: text("type").notNull(), // 'deposit' | 'withdraw' | 'tax' | 'bet_win' | 'bet_loss' | 'drink_sale'
  amount: numeric("amount", { precision: 25, scale: 2 }).notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CasinoTransaction = typeof casinoTransactionsTable.$inferSelect;

export const casinoDrinksTable = pgTable("casino_drinks", {
  id: serial("id").primaryKey(),
  casinoId: integer("casino_id").notNull().references(() => casinosTable.id),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🍹"),
  price: numeric("price", { precision: 15, scale: 2 }).notNull().default("500.00"),
  tier: text("tier").notNull().default("standard"), // 'cheap' | 'standard' | 'expensive'
  isAvailable: boolean("is_available").notNull().default(false),
  stock: integer("stock").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CasinoDrink = typeof casinoDrinksTable.$inferSelect;

export const userDrinksTable = pgTable("user_drinks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  casinoId: integer("casino_id").notNull().references(() => casinosTable.id),
  drinkId: integer("drink_id").notNull().references(() => casinoDrinksTable.id),
  drinkName: text("drink_name").notNull(),
  drinkEmoji: text("drink_emoji").notNull(),
  drinkPrice: numeric("drink_price", { precision: 15, scale: 2 }).notNull(),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserDrink = typeof userDrinksTable.$inferSelect;

export const monthlyTaxLogsTable = pgTable("monthly_tax_logs", {
  id: serial("id").primaryKey(),
  casinoId: integer("casino_id").notNull().references(() => casinosTable.id),
  taxAmount: numeric("tax_amount", { precision: 25, scale: 2 }).notNull(),
  bankrollBefore: numeric("bankroll_before", { precision: 25, scale: 2 }).notNull(),
  bankrollAfter: numeric("bankroll_after", { precision: 25, scale: 2 }).notNull(),
  taxedAt: timestamp("taxed_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MonthlyTaxLog = typeof monthlyTaxLogsTable.$inferSelect;

export const casinoGameOddsTable = pgTable("casino_game_odds", {
  id: serial("id").primaryKey(),
  casinoId: integer("casino_id").notNull().references(() => casinosTable.id),
  gameType: text("game_type").notNull(),
  payoutMultiplier: numeric("payout_multiplier", { precision: 5, scale: 4 }).notNull().default("1.0000"),
  payTableConfig: text("pay_table_config"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CasinoGameOdds = typeof casinoGameOddsTable.$inferSelect;
