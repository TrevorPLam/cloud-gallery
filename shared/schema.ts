// AI-META-BEGIN
// AI-META: Database schema definitions using Drizzle ORM for user authentication
// OWNERSHIP: shared/schema
// ENTRYPOINTS: imported by server/storage.ts and any DB migration scripts
// DEPENDENCIES: drizzle-orm (schema builder), drizzle-zod (validation), zod
// DANGER: schema changes require database migrations; password field stores plaintext (hash before storing); unique constraint on username prevents duplicates
// CHANGE-SAFETY: adding fields is safe with defaults; removing fields requires migration; changing types is risky
// TESTS: check:types, db:push for schema validation
// AI-META-END

import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// AI-NOTE: UUID default uses Postgres gen_random_uuid() for server-side generation; ensures uniqueness without client coordination
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
