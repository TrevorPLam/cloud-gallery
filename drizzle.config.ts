// AI-META-BEGIN
// AI-META: Drizzle ORM configuration for PostgreSQL database migrations
// OWNERSHIP: server/database
// ENTRYPOINTS: drizzle-kit CLI commands (npm run db:push)
// DEPENDENCIES: drizzle-kit, shared/schema.ts, DATABASE_URL env var
// DANGER: DATABASE_URL must be set or app crashes; schema changes require migration; url exposes credentials
// CHANGE-SAFETY: out directory can change; schema path must match actual schema file; dialect must stay postgresql
// TESTS: npm run db:push, verify migrations directory
// AI-META-END

import { defineConfig } from "drizzle-kit";

// AI-NOTE: Fail-fast on missing DATABASE_URL prevents silent errors during development
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
