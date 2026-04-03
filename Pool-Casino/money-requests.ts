import { pgTable, serial, integer, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const moneyRequestsTable = pgTable("money_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  message: text("message"),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull().default("10000.00"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export type MoneyRequest = typeof moneyRequestsTable.$inferSelect;
