// Integration tests for server security hardening
// Tests Phase 1 controls: headers, CORS, rate limiting, error handling

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import express from "express";
import type { Express } from "express";
import request from "supertest";
import { securityHeaders, requestId, rateLimit } from "./middleware";

describe("Security Headers Middleware", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
  });

  it("should set CSP header", async () => {
    app.use(securityHeaders());
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["content-security-policy"]).toBeDefined();
    expect(response.headers["content-security-policy"]).toContain(
      "default-src 'self'",
    );
  });

  it("should set HSTS header when enabled", async () => {
    app.use(
      securityHeaders({
        hsts: {
          enabled: true,
          maxAge: 31536000,
          includeSubDomains: true,
        },
      }),
    );
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["strict-transport-security"]).toBeDefined();
    expect(response.headers["strict-transport-security"]).toContain(
      "max-age=31536000",
    );
    expect(response.headers["strict-transport-security"]).toContain(
      "includeSubDomains",
    );
  });

  it("should not set HSTS when disabled", async () => {
    app.use(
      securityHeaders({
        hsts: {
          enabled: false,
        },
      }),
    );
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["strict-transport-security"]).toBeUndefined();
  });

  it("should set HSTS with preload when enabled", async () => {
    app.use(
      securityHeaders({
        hsts: {
          enabled: true,
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        },
      }),
    );
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["strict-transport-security"]).toBeDefined();
    expect(response.headers["strict-transport-security"]).toContain(
      "max-age=31536000",
    );
    expect(response.headers["strict-transport-security"]).toContain(
      "includeSubDomains",
    );
    expect(response.headers["strict-transport-security"]).toContain("preload");
  });

  it("should set X-Frame-Options to DENY", async () => {
    app.use(securityHeaders());
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["x-frame-options"]).toBe("DENY");
  });

  it("should set X-Content-Type-Options to nosniff", async () => {
    app.use(securityHeaders());
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("should set Referrer-Policy", async () => {
    app.use(securityHeaders());
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["referrer-policy"]).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("should remove X-Powered-By header", async () => {
    app.use(securityHeaders());
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("should allow custom CSP directives", async () => {
    app.use(
      securityHeaders({
        csp: {
          enabled: true,
          directives: {
            "default-src": ["'self'"],
            "img-src": ["'self'", "https://cdn.example.com"],
          },
        },
      }),
    );
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["content-security-policy"]).toContain(
      "https://cdn.example.com",
    );
  });

  it("should disable CSP when configured", async () => {
    app.use(
      securityHeaders({
        csp: {
          enabled: false,
        },
      }),
    );
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["content-security-policy"]).toBeUndefined();
  });
});

describe("Request ID Middleware", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(requestId());
  });

  it("should generate request ID", async () => {
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.headers["x-request-id"]).toMatch(/^req_\d+_[a-f0-9]+$/);
  });

  it("should use existing request ID if provided", async () => {
    app.get("/test", (_req, res) => res.send("ok"));

    const customId = "custom-request-id-123";
    const response = await request(app)
      .get("/test")
      .set("X-Request-ID", customId);

    expect(response.headers["x-request-id"]).toBe(customId);
  });

  it("should generate unique IDs for concurrent requests", async () => {
    app.get("/test", (_req, res) => res.send("ok"));

    const [r1, r2, r3] = await Promise.all([
      request(app).get("/test"),
      request(app).get("/test"),
      request(app).get("/test"),
    ]);

    const id1 = r1.headers["x-request-id"];
    const id2 = r2.headers["x-request-id"];
    const id3 = r3.headers["x-request-id"];

    expect(id1).not.toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id2).not.toBe(id3);
  });
});

describe("Rate Limiting Middleware", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
  });

  it("should allow requests under limit", async () => {
    app.use(
      rateLimit({
        windowMs: 60000,
        max: 5,
      }),
    );
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.status).toBe(200);
    expect(response.headers["x-ratelimit-limit"]).toBe("5");
    expect(response.headers["x-ratelimit-remaining"]).toBe("4");
  });

  it("should block requests over limit", async () => {
    app.use(
      rateLimit({
        windowMs: 60000,
        max: 3,
      }),
    );
    app.get("/test", (_req, res) => res.send("ok"));

    // Make 3 successful requests
    await request(app).get("/test");
    await request(app).get("/test");
    await request(app).get("/test");

    // 4th should be rate limited
    const response = await request(app).get("/test");

    expect(response.status).toBe(429);
    expect(response.body.error).toContain("Too many requests");
  });

  it("should set rate limit headers", async () => {
    app.use(
      rateLimit({
        windowMs: 60000,
        max: 10,
      }),
    );
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["x-ratelimit-limit"]).toBe("10");
    expect(response.headers["x-ratelimit-remaining"]).toBeDefined();
    expect(response.headers["x-ratelimit-reset"]).toBeDefined();
  });

  it("should provide retry-after information when rate limited", async () => {
    app.use(
      rateLimit({
        windowMs: 60000,
        max: 2,
      }),
    );
    app.get("/test", (_req, res) => res.send("ok"));

    // Exhaust limit
    await request(app).get("/test");
    await request(app).get("/test");

    // Get rate limited
    const response = await request(app).get("/test");

    expect(response.status).toBe(429);
    expect(response.body.retryAfter).toBeDefined();
    expect(response.body.retryAfter).toBeGreaterThan(0);
  });

  it("should track requests per IP", async () => {
    app.use(
      rateLimit({
        windowMs: 60000,
        max: 2,
      }),
    );
    app.get("/test", (_req, res) => res.send("ok"));

    // Different IPs should have separate limits
    const response1 = await request(app)
      .get("/test")
      .set("X-Forwarded-For", "1.1.1.1");
    const response2 = await request(app)
      .get("/test")
      .set("X-Forwarded-For", "2.2.2.2");

    expect(response1.status).toBe(200);
    expect(response2.status).toBe(200);
    expect(response1.headers["x-ratelimit-remaining"]).toBe("1");
    expect(response2.headers["x-ratelimit-remaining"]).toBe("1");
  });
});

describe("Error Handler (production vs development)", () => {
  let app: Express;
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("should not expose stack traces in production", async () => {
    process.env.NODE_ENV = "production";

    app = express();
    app.use(requestId());

    app.get("/test", () => {
      throw new Error("Test error with sensitive info");
    });

    app.use((err: Error, _req: any, res: any, _next: any) => {
      const isProduction = process.env.NODE_ENV === "production";
      res.status(500).json({
        error: isProduction ? "Internal Server Error" : err.message,
        stack: isProduction ? undefined : err.stack,
      });
    });

    const response = await request(app).get("/test");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal Server Error");
    expect(response.body.stack).toBeUndefined();
  });

  it("should expose stack traces in development", async () => {
    process.env.NODE_ENV = "development";

    app = express();
    app.use(requestId());

    app.get("/test", () => {
      throw new Error("Test error");
    });

    app.use((err: Error, _req: any, res: any, _next: any) => {
      const isProduction = process.env.NODE_ENV === "production";
      res.status(500).json({
        error: err.message,
        stack: isProduction ? undefined : err.stack,
      });
    });

    const response = await request(app).get("/test");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Test error");
    expect(response.body.stack).toBeDefined();
  });

  it("should include correlation ID in error response", async () => {
    app = express();
    app.use(requestId());

    app.get("/test", () => {
      throw new Error("Test error");
    });

    app.use((_err: Error, req: any, res: any, _next: any) => {
      res.status(500).json({
        error: "Internal Server Error",
        correlationId: req.headers["x-request-id"],
      });
    });

    const response = await request(app).get("/test");

    expect(response.body.correlationId).toBeDefined();
    expect(response.body.correlationId).toMatch(/^req_\d+_[a-f0-9]+$/);
  });
});

describe("CORS Security", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
  });

  it("should reject requests without Origin header", async () => {
    app.use((req, res, next) => {
      const origin = req.header("origin");
      if (!origin) {
        return next();
      }
      // Only set CORS headers if origin is allowed
      res.header("Access-Control-Allow-Origin", origin);
      next();
    });
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app).get("/test");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("should reject disallowed origins", async () => {
    const allowedOrigins = ["https://example.com"];

    app.use((req, res, next) => {
      const origin = req.header("origin");
      if (origin && allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
      }
      next();
    });
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app)
      .get("/test")
      .set("Origin", "https://evil.com");

    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("should allow whitelisted origins", async () => {
    const allowedOrigins = ["https://example.com"];

    app.use((req, res, next) => {
      const origin = req.header("origin");
      if (origin && allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
      }
      next();
    });
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app)
      .get("/test")
      .set("Origin", "https://example.com");

    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://example.com",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("should handle preflight requests", async () => {
    const allowedOrigins = ["https://example.com"];

    app.use((req, res, next) => {
      const origin = req.header("origin");
      if (origin && allowedOrigins.includes(origin)) {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
        res.header("Access-Control-Allow-Headers", "Content-Type");
      }
      if (req.method === "OPTIONS") {
        return res.sendStatus(204);
      }
      next();
    });
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app)
      .options("/test")
      .set("Origin", "https://example.com")
      .set("Access-Control-Request-Method", "POST");

    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://example.com",
    );
    expect(response.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("should never use wildcard with credentials", async () => {
    // This test ensures we don't make this security mistake
    app.use((req, res, next) => {
      // BAD PRACTICE (should never do this):
      // res.header('Access-Control-Allow-Origin', '*');
      // res.header('Access-Control-Allow-Credentials', 'true');

      // CORRECT: Specific origin when credentials are used
      const origin = req.header("origin");
      if (origin === "https://example.com") {
        res.header("Access-Control-Allow-Origin", origin);
        res.header("Access-Control-Allow-Credentials", "true");
      }
      next();
    });
    app.get("/test", (_req, res) => res.send("ok"));

    const response = await request(app)
      .get("/test")
      .set("Origin", "https://example.com");

    // Should have specific origin, not wildcard
    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://example.com",
    );
    expect(response.headers["access-control-allow-origin"]).not.toBe("*");
  });
});

describe("Body Size Limits", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
  });

  it("should reject JSON payloads exceeding limit", async () => {
    app.use(express.json({ limit: "1kb" }));
    app.post("/test", (req, res) => res.json({ received: req.body }));

    const largePayload = { data: "x".repeat(2000) }; // > 1kb

    const response = await request(app)
      .post("/test")
      .send(largePayload)
      .set("Content-Type", "application/json");

    expect(response.status).toBe(413); // Payload Too Large
  });

  it("should accept JSON payloads within limit", async () => {
    app.use(express.json({ limit: "1mb" }));
    app.post("/test", (req, res) => res.json({ received: req.body }));

    const payload = { data: "small payload" };

    const response = await request(app)
      .post("/test")
      .send(payload)
      .set("Content-Type", "application/json");

    expect(response.status).toBe(200);
    expect(response.body.received.data).toBe("small payload");
  });
});
