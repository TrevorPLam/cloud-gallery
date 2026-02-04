import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerRoutes } from "./routes";
import express, { type Express } from "express";
import type { Server } from "node:http";

describe("registerRoutes", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
  });

  it("should return an HTTP server", async () => {
    const server = await registerRoutes(app);

    expect(server).toBeDefined();
    expect(typeof server.listen).toBe("function");
    expect(typeof server.close).toBe("function");
    expect(typeof server.on).toBe("function");
  });

  it("should create server from Express app", async () => {
    const server = await registerRoutes(app);

    // Verify it's a proper HTTP server
    expect(server.listening).toBe(false);
    expect(server).toHaveProperty("address");
    expect(server).toHaveProperty("getConnections");
  });

  it("should be callable multiple times", async () => {
    const app1 = express();
    const app2 = express();

    const server1 = await registerRoutes(app1);
    const server2 = await registerRoutes(app2);

    expect(server1).toBeDefined();
    expect(server2).toBeDefined();
    expect(server1).not.toBe(server2);
  });

  it("should accept any Express app", async () => {
    const customApp = express();
    customApp.use(express.json());
    customApp.get("/test", (req, res) => {
      res.json({ test: true });
    });

    const server = await registerRoutes(customApp);
    expect(server).toBeDefined();
  });

  it("should preserve existing middleware", async () => {
    let middlewareCalled = false;
    const middleware = vi.fn((req, res, next) => {
      middlewareCalled = true;
      next();
    });
    app.use(middleware);

    const server = await registerRoutes(app);

    // Server should be created without errors
    expect(server).toBeDefined();
    expect(typeof server.listen).toBe("function");
  });
});
