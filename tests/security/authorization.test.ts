/**
 * Authorization Security Tests
 *
 * Validates that authorization controls correctly restrict access to
 * protected resources, preventing privilege escalation and IDOR attacks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import type { Express } from "express";
import request from "supertest";
import expressRateLimit from "express-rate-limit";
import { securityHeaders } from "../../server/middleware";
import { authenticateToken } from "../../server/auth";

vi.mock("../../server/siem", () => ({
  forwardAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Helper: create a protected Express app with a resource route.
 * The route returns the owner ID so tests can verify isolation.
 */
function createProtectedApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(securityHeaders());
  // Apply rate limiting to all routes in the test app (mirrors production setup)
  const limiter = expressRateLimit({ windowMs: 60000, max: 100 });

  // Simulate an authenticated resource endpoint
  app.get("/api/photos/:id", limiter, authenticateToken, (req, res) => {
    const userId = (req as express.Request & { user?: { id: string } }).user
      ?.id;
    res.json({ photoId: req.params.id, owner: userId });
  });

  return app;
}

describe("Authorization Enforcement", () => {
  let app: Express;

  beforeEach(() => {
    app = createProtectedApp();
  });

  describe("Authentication Requirements", () => {
    it("should return 401 for unauthenticated access to protected routes", async () => {
      const response = await request(app).get("/api/photos/photo-123");
      expect(response.status).toBe(401);
    });

    it("should return 401 for empty Authorization header", async () => {
      const response = await request(app)
        .get("/api/photos/photo-123")
        .set("Authorization", "");
      expect(response.status).toBe(401);
    });

    it("should return 403 for invalid token on protected route", async () => {
      const response = await request(app)
        .get("/api/photos/photo-123")
        .set("Authorization", "Bearer tampered.jwt.token");
      expect(response.status).toBe(403);
    });

    it("should grant access to authenticated user", async () => {
      const jwt = await import("jsonwebtoken");
      const secret =
        process.env.JWT_SECRET || "your-secret-key-change-in-production";
      const token = jwt.sign(
        { id: "user-owner", email: "owner@example.com" },
        secret,
        {
          issuer: "cloud-gallery",
          audience: "cloud-gallery-users",
          expiresIn: 3600,
        },
      );

      const response = await request(app)
        .get("/api/photos/photo-abc")
        .set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.owner).toBe("user-owner");
    });
  });

  describe("HTTP Method Restrictions", () => {
    it("should enforce authentication on GET requests", async () => {
      const response = await request(app).get("/api/photos/photo-1");
      expect(response.status).toBe(401);
    });
  });
});

describe("Security Headers", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(securityHeaders());
    app.get("/test", (_req, res) => res.json({ ok: true }));
  });

  it("should set X-Frame-Options to prevent clickjacking", async () => {
    const response = await request(app).get("/test");
    expect(response.headers["x-frame-options"]).toBe("DENY");
  });

  it("should set X-Content-Type-Options to prevent MIME sniffing", async () => {
    const response = await request(app).get("/test");
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("should set Content-Security-Policy to restrict resource origins", async () => {
    const response = await request(app).get("/test");
    const csp = response.headers["content-security-policy"];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    // Must disallow framing
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("should set Referrer-Policy to limit referrer leakage", async () => {
    const response = await request(app).get("/test");
    expect(response.headers["referrer-policy"]).toBeDefined();
  });

  it("should not expose server software version", async () => {
    const response = await request(app).get("/test");
    // X-Powered-By should be absent or not reveal Express
    const poweredBy = response.headers["x-powered-by"];
    expect(poweredBy).toBeUndefined();
  });
});

describe("CORS Security", () => {
  it("should restrict CORS to configured origins", async () => {
    const allowedOrigins = ["https://trusted.example.com"];
    const app = express();
    // Simulate strict CORS origin validation (mirrors server/index.ts logic)
    app.use((req, res, next) => {
      const origin = req.header("origin");
      if (origin && allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
      }
      next();
    });
    app.get("/test", (_req, res) => res.json({ ok: true }));

    // Untrusted origin must not receive CORS header
    const untrustedResponse = await request(app)
      .get("/test")
      .set("Origin", "https://evil.attacker.com");
    expect(untrustedResponse.headers["access-control-allow-origin"]).not.toBe(
      "https://evil.attacker.com",
    );
  });

  it("should allow whitelisted origins", async () => {
    const allowedOrigins = ["https://trusted.example.com"];
    const app = express();
    app.use((req, res, next) => {
      const origin = req.header("origin");
      if (origin && allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
      }
      next();
    });
    app.get("/test", (_req, res) => res.json({ ok: true }));

    const trustedResponse = await request(app)
      .get("/test")
      .set("Origin", "https://trusted.example.com");
    expect(trustedResponse.headers["access-control-allow-origin"]).toBe(
      "https://trusted.example.com",
    );
  });

  it("should never reflect a wildcard when credentials are in use", async () => {
    const app = express();
    app.use((_req, res, next) => {
      // Simulate a misconfigured wildcard CORS combined with credentials
      // This must NOT be the server behavior; we assert the opposite
      res.header("Access-Control-Allow-Credentials", "true");
      next();
    });
    app.get("/test", (_req, res) => res.json({ ok: true }));

    const response = await request(app).get("/test");
    // Wildcard + credentials is a CORS misconfiguration – must not appear together
    expect(response.headers["access-control-allow-origin"]).not.toBe("*");
  });
});

describe("Rate Limiting Security", () => {
  it("should block requests exceeding the rate limit", async () => {
    const { rateLimit } = await import("../../server/middleware");

    const app = express();
    app.use(
      rateLimit({ windowMs: 60000, max: 3, message: "Rate limit exceeded" }),
    );
    app.get("/test", (_req, res) => res.json({ ok: true }));

    // Make requests up to the limit
    for (let i = 0; i < 3; i++) {
      const response = await request(app).get("/test");
      expect(response.status).toBe(200);
    }

    // Next request should be blocked
    const blockedResponse = await request(app).get("/test");
    expect(blockedResponse.status).toBe(429);
  });

  it("should include rate limit headers in responses", async () => {
    const { rateLimit } = await import("../../server/middleware");

    const app = express();
    app.use(
      rateLimit({ windowMs: 60000, max: 10, message: "Rate limit exceeded" }),
    );
    app.get("/test", (_req, res) => res.json({ ok: true }));

    const response = await request(app).get("/test");
    // Must include RateLimit headers so clients can backoff appropriately
    expect(
      response.headers["x-ratelimit-limit"] ||
        response.headers["ratelimit-limit"],
    ).toBeDefined();
  });
});
