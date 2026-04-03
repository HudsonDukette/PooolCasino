import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const friendsTable = pgTable("friends", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  recipientId: integer("recipient_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Friend = typeof friendsTable.$inferSelect;
