// AI-META-BEGIN
// AI-META: Drizzle/Postgres database connection singleton and lifecycle helpers
// OWNERSHIP: server/data
// ENTRYPOINTS: imported by route modules and data services
// DEPENDENCIES: drizzle-orm/postgres-js, postgres, ../shared/schema
// DANGER: Misconfiguration can break all persistence paths or exhaust DB connections
// CHANGE-SAFETY: Maintain singleton exports and graceful shutdown helper semantics
// TESTS: npm run check:types, integration tests touching DB-backed routes
// AI-META-END

// ═══════════════════════════════════════════════════════════
// DATABASE CONNECTION SINGLETON
// ═══════════════════════════════════════════════════════════
// Central database connection used by all server routes
// "Singleton" = only ONE instance exists, shared everywhere

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";

// ═══════════════════════════════════════════════════════════
// ENVIRONMENT VALIDATION
// ═══════════════════════════════════════════════════════════
// Ensure DATABASE_URL is available before starting

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is required. " +
      "Please set it in your .env file or environment variables.",
  );
}

// ═══════════════════════════════════════════════════════════
// POSTGRES CLIENT CONFIGURATION
// ═══════════════════════════════════════════════════════════
// Create connection pool with sensible defaults

const connectionString = databaseUrl;
const client = postgres(connectionString, {
  // Connection pooling settings
  max: 10, // Maximum connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 10, // Give up connecting after 10 seconds

  // Development vs Production settings
  ssl: process.env.NODE_ENV === "production" ? "require" : false,

  // Logging (disable in production)
  debug: process.env.NODE_ENV === "development",
});

// ═══════════════════════════════════════════════════════════
// DRIZZLE ORM INSTANCE
// ═══════════════════════════════════════════════════════════
// Create Drizzle instance with schema

export const db = drizzle(client, {
  schema,
  logger: process.env.NODE_ENV === "development", // Enable query logging in dev
});

// ═══════════════════════════════════════════════════════════
// CONNECTION HEALTH CHECK
// ═══════════════════════════════════════════════════════════
// Test database connection on startup

export async function testConnection(): Promise<boolean> {
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
  console.log("🔄 Closing database connections...");
  await client.end();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("🔄 Closing database connections...");
  await client.end();
  process.exit(0);
});

// ═══════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════

export { client };
export default db;
