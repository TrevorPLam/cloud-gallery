// ═══════════════════════════════════════════════════════════
// DATABASE CONNECTION SINGLETON
// ═══════════════════════════════════════════════════════════
// Central database connection used by all server routes
// "Singleton" = only ONE instance exists, shared everywhere

import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";

// ═══════════════════════════════════════════════════════════
// ENVIRONMENT VALIDATION
// ═══════════════════════════════════════════════════════════
// Ensure DATABASE_URL is available before starting

const databaseUrl = process.env.DATABASE_URL;
const isDbDisabledByFlag =
  process.env.DISABLE_DB === "true" || process.env.DISABLE_DB === "1";

export const isDbConfigured = Boolean(databaseUrl) && !isDbDisabledByFlag;

const disabledDb = new Proxy(
  {},
  {
    get() {
      throw new Error(
        "Database is disabled because DATABASE_URL is not set. " +
          "Set DATABASE_URL (and run Postgres) to enable DB-backed routes.",
      );
    },
  },
) as unknown as PostgresJsDatabase<typeof schema>;

// ═══════════════════════════════════════════════════════════
// POSTGRES CLIENT CONFIGURATION
// ═══════════════════════════════════════════════════════════
// Create connection pool with sensible defaults

const client = isDbConfigured
  ? postgres(databaseUrl!, {
      // Connection pooling settings
      max: 10, // Maximum connections in pool
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Give up connecting after 10 seconds

      // Development vs Production settings
      ssl: process.env.NODE_ENV === "production" ? "require" : false,

      // Logging (disable in production)
      debug: process.env.NODE_ENV === "development",
    })
  : null;

// ═══════════════════════════════════════════════════════════
// DRIZZLE ORM INSTANCE
// ═══════════════════════════════════════════════════════════
// Create Drizzle instance with schema

export const db: PostgresJsDatabase<typeof schema> = isDbConfigured
  ? drizzle(client!, {
      schema,
      logger: process.env.NODE_ENV === "development", // Enable query logging in dev
    })
  : disabledDb;

// ═══════════════════════════════════════════════════════════
// CONNECTION HEALTH CHECK
// ═══════════════════════════════════════════════════════════
// Test database connection on startup

export async function testConnection(): Promise<boolean> {
  if (!isDbConfigured || !client) {
    console.warn(
      isDbDisabledByFlag
        ? "⚠️  Database disabled (DISABLE_DB=1)"
        : "⚠️  Database disabled (DATABASE_URL not set)",
    );
    return false;
  }

  try {
    // Simple query to test connection
    await client`SELECT 1`;
    console.log("✅ Database connection successful");
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════
// Close connections when server shuts down

process.on("SIGINT", async () => {
  if (client) {
    console.log("🔄 Closing database connections...");
    await client.end();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (client) {
    console.log("🔄 Closing database connections...");
    await client.end();
  }
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

export { client };
export default db;
