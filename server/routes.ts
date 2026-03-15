// AI-META-BEGIN
// AI-META: Express route registration and API endpoint definitions
// OWNERSHIP: server/api
// ENTRYPOINTS: server/index.ts
// DEPENDENCIES: express, all route handlers
// DANGER: Route ordering matters - auth middleware must run first
// CHANGE-SAFETY: Safe to add routes; be careful reordering middleware
// TESTS: server/routes.test.ts
// AI-META-END

import type { Express } from "express";
import { createServer, type Server } from "node:http";
import authRoutes from "./auth-routes";
import uploadRoutes from "./upload-routes";
import photoRoutes from "./photo-routes";
import albumRoutes from "./album-routes";
import mlRoutes from "./ml-routes";
import duplicateRoutes from "./duplicate-routes";
import searchRoutes from "./search-routes";
import smartAlbumRoutes from "./smart-album-routes";
import memoryRoutes from "./memory-routes";
import { authenticateToken, generalRateLimit } from "./auth";

// AI-NOTE: Currently empty route registration; designed for expansion with /api prefixed routes
export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // Authentication routes (with rate limiting)
  app.use("/api/auth", authRoutes);

  // Photo routes (with authentication)
  app.use("/api/photos", photoRoutes);

  // Duplicate detection routes (with authentication)
  app.use("/api/photos/duplicates", duplicateRoutes);

  // Album routes (with authentication)
  app.use("/api/albums", albumRoutes);

  // Upload routes (with authentication)
  app.use("/api/upload", uploadRoutes);

  // ML analysis routes (with authentication)
  app.use("/api/ml", mlRoutes);

  // Search routes (with authentication)
  app.use("/api/search", searchRoutes);

  // Smart albums routes (with authentication)
  app.use("/api/smart-albums", smartAlbumRoutes);

  // Memory routes (with authentication)
  app.use("/api/memories", memoryRoutes);

  // Example protected route
  app.get("/api/protected", authenticateToken, (req, res) => {
    res.json({
      message: "This is a protected route",
      user: req.user,
    });
  });

  // General API routes with rate limiting
  app.use("/api", generalRateLimit);

  const httpServer = createServer(app);

  return httpServer;
}
