import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const chatRoomsTable = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("public"),
  createdBy: integer("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessagesTable = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => chatRoomsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  isAdminBroadcast: boolean("is_admin_broadcast").notNull().default(false),
});

export const chatRoomMembersTable = pgTable("chat_room_members", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => chatRoomsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatRoom = typeof chatRoomsTable.$inferSelect;
export type ChatMessage = typeof chatMessagesTable.$inferSelect;
export type ChatRoomMember = typeof chatRoomMembersTable.$inferSelect;
