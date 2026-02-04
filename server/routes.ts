// AI-META-BEGIN
// AI-META: Route registration and HTTP server creation for Cloud Gallery API
// OWNERSHIP: server/routes
// ENTRYPOINTS: called by server/index.ts during bootstrap
// DEPENDENCIES: express, node:http
// DANGER: all routes must be prefixed with /api for proper CORS and logging
// CHANGE-SAFETY: safe to add new routes; httpServer creation should not change
// TESTS: npm run check:types, integration tests for new routes
// AI-META-END

import type { Express } from "express";
import { createServer, type Server } from "node:http";

// AI-NOTE: Currently empty route registration; designed for expansion with /api prefixed routes
export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  const httpServer = createServer(app);

  return httpServer;
}
