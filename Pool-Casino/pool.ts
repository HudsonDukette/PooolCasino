import { pgTable, serial, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const poolTable = pgTable("pool", {
  id: serial("id").primaryKey(),
  totalAmount: numeric("total_amount", { precision: 15, scale: 2 }).notNull().default("1000000.00"),
  biggestWin: numeric("biggest_win", { precision: 15, scale: 2 }).notNull().default("0.00"),
  biggestBet: numeric("biggest_bet", { precision: 15, scale: 2 }).notNull().default("0.00"),
});

export const insertPoolSchema = createInsertSchema(poolTable).omit({ id: true });
export type InsertPool = z.infer<typeof insertPoolSchema>;
export type Pool = typeof poolTable.$inferSelect;
