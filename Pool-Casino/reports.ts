import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const reportsTable = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: integer("reporter_id").references(() => usersTable.id, { onDelete: "set null" }),
  reportedUserId: integer("reported_user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  details: text("details"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  reviewedBy: integer("reviewed_by").references(() => usersTable.id, { onDelete: "set null" }),
});
