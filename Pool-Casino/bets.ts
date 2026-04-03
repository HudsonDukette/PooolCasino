import { pgTable, serial, integer, text, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const betsTable = pgTable("bets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  gameType: text("game_type").notNull(),
  betAmount: numeric("bet_amount", { precision: 15, scale: 2 }).notNull(),
  result: text("result").notNull(),
  payout: numeric("payout", { precision: 15, scale: 2 }).notNull(),
  multiplier: numeric("multiplier", { precision: 10, scale: 4 }),
  timestamp: timestamp("timestamp", { withTimezone: true }).notNull().defaultNow(),
});

export const insertBetSchema = createInsertSchema(betsTable).omit({ id: true, timestamp: true });
export type InsertBet = z.infer<typeof insertBetSchema>;
export type Bet = typeof betsTable.$inferSelect;
