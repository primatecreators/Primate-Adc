import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const leads = sqliteTable("leads", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  language: text("language").notNull(),
  payload: text("payload").notNull(),
  files: text("files").notNull().default("[]"),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const leadRateLimits = sqliteTable("lead_rate_limits", {
  bucket: text("bucket").primaryKey(),
  count: integer("count").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});
