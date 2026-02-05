// AI-META-BEGIN
// AI-META: Unit tests for server route registration and mounted API surfaces
// OWNERSHIP: server/tests
// ENTRYPOINTS: validates registerRoutes in server/routes.ts
// DEPENDENCIES: vitest, supertest, express
// DANGER: Broken registration can silently disable auth/photo/upload APIs
// CHANGE-SAFETY: Keep mocked routers aligned with mounted prefixes to avoid false positives
// TESTS: server/routes.test.ts
// AI-META-END

import { beforeEach, describe, expect, it, vi } from "vitest";
import express, { type Express, Router } from "express";
import request from "supertest";

vi.mock("./auth-routes", () => {
  const router = Router();
  router.get("/health", (_req, res) => {
    res.status(200).json({ scope: "auth" });
  });
  return { default: router };
});

vi.mock("./photo-routes", () => {
  const router = Router();
  router.get("/health", (_req, res) => {
    res.status(200).json({ scope: "photos" });
  });
  return { default: router };
});

vi.mock("./upload-routes", () => {
  const router = Router();
  router.get("/health", (_req, res) => {
    res.status(200).json({ scope: "upload" });
  });
  return { default: router };
});

vi.mock("./auth", () => ({
  authenticateToken: vi.fn((req, _res, next) => {
    req.user = { id: "user-1", email: "user@example.com", username: "user" };
    next();
  }),
  generalRateLimit: vi.fn((_req, _res, next) => {
    next();
  }),
}));

describe("registerRoutes", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  it("returns an HTTP server instance", async () => {
    const { registerRoutes } = await import("./routes");
    const server = await registerRoutes(app);

    expect(server).toBeDefined();
    expect(typeof server.listen).toBe("function");
    expect(typeof server.close).toBe("function");
  });

  it("mounts auth/photo/upload routers at their expected API prefixes", async () => {
    const { registerRoutes } = await import("./routes");
    await registerRoutes(app);

    await request(app)
      .get("/api/auth/health")
      .expect(200)
      .expect({ scope: "auth" });

    await request(app)
      .get("/api/photos/health")
      .expect(200)
      .expect({ scope: "photos" });

    await request(app)
      .get("/api/upload/health")
      .expect(200)
      .expect({ scope: "upload" });
  });

  it("exposes the protected sample endpoint with authenticated user context", async () => {
    const { registerRoutes } = await import("./routes");
    await registerRoutes(app);

    const response = await request(app).get("/api/protected").expect(200);

    expect(response.body.message).toBe("This is a protected route");
    expect(response.body.user).toMatchObject({
      id: "user-1",
      email: "user@example.com",
    });
  });
});
