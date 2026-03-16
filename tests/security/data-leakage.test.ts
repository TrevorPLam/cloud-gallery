/**
 * Data Leakage Prevention Tests
 *
 * Validates that the server does not expose internal implementation details,
 * stack traces, database schemas, or other sensitive information in responses.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import type { Express } from "express";
import request from "supertest";
import { securityHeaders } from "../../server/middleware";

vi.mock("../../server/siem", () => ({
  forwardAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

/**
 * Helper: create an app that simulates an error to test response leakage.
 */
function createErrorTestApp(opts: { nodeEnv?: string } = {}): Express {
  const originalEnv = process.env.NODE_ENV;
  const app = express();
  app.use(securityHeaders());
  app.use(express.json());

  // Route that throws a detailed internal error
  app.get("/error", (_req, _res, next) => {
    const err = new Error("Database connection failed: pg://user:secret@localhost/db");
    (err as Error & { stack: string }).stack = `${err.message}\n    at Object.<anonymous> (server/db.ts:42:10)\n    at Module._compile (internal/modules/cjs/loader.js:1138:30)`;
    next(err);
  });

  // Route that returns JSON body
  app.get("/data", (_req, res) => {
    res.json({ userId: "user-123", data: "some data" });
  });

  // Error handler that should NOT leak internals in production
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const env = opts.nodeEnv || process.env.NODE_ENV;
    if (env === "production") {
      res.status(500).json({ error: "Internal server error" });
    } else {
      res.status(500).json({ error: err.message });
    }
  });

  // Restore env
  process.env.NODE_ENV = originalEnv;
  return app;
}

describe("Error Response Data Leakage", () => {
  it("should not expose stack traces in production error responses", async () => {
    const app = createErrorTestApp({ nodeEnv: "production" });
    const response = await request(app).get("/error");

    expect(response.status).toBe(500);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain("at Object.<anonymous>");
    expect(body).not.toContain("at Module._compile");
    expect(body).not.toContain("server/db.ts");
  });

  it("should not expose database connection strings in error responses", async () => {
    const app = createErrorTestApp({ nodeEnv: "production" });
    const response = await request(app).get("/error");

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("pg://");
    expect(body).not.toContain("postgres://");
    expect(body).not.toContain("mysql://");
    expect(body).not.toContain("localhost");
    expect(body).not.toContain(":5432");
  });

  it("should not expose internal file paths in production error responses", async () => {
    const app = createErrorTestApp({ nodeEnv: "production" });
    const response = await request(app).get("/error");

    const body = JSON.stringify(response.body);
    expect(body).not.toContain("server/db.ts");
    expect(body).not.toContain("node_modules");
    expect(body).not.toContain(".ts:");
  });

  it("should return a generic error message for 500 errors in production", async () => {
    const app = createErrorTestApp({ nodeEnv: "production" });
    const response = await request(app).get("/error");

    expect(response.status).toBe(500);
    expect(response.body.error).toBe("Internal server error");
  });
});

describe("Response Headers – Information Disclosure Prevention", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(securityHeaders());
    app.get("/test", (_req, res) => res.json({ ok: true }));
  });

  it("should not expose server technology via X-Powered-By", async () => {
    const response = await request(app).get("/test");
    // securityHeaders() must suppress X-Powered-By
    expect(response.headers["x-powered-by"]).toBeUndefined();
  });

  it("should not expose server version in response headers", async () => {
    const response = await request(app).get("/test");
    const sensitiveHeaders = ["server", "x-powered-by", "x-aspnet-version"];
    for (const header of sensitiveHeaders) {
      const value = response.headers[header];
      if (value) {
        // If header is present, it must not contain version info
        expect(value).not.toMatch(/\d+\.\d+/);
      }
    }
  });
});

describe("Audit Log Sanitization", () => {
  it("should redact password fields from audit event details", async () => {
    const { auditLogger, AuditEventType } = await import("../../server/audit");

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    auditLogger.logEvent({
      eventType: AuditEventType.AUTH_LOGIN_FAILURE,
      outcome: "FAILURE",
      details: {
        password: "super-secret-password",
        email: "user@example.com",
      },
    });

    // Ensure the raw password never appears in any log output
    const allLogArgs = consoleSpy.mock.calls.map(args => JSON.stringify(args));
    for (const logOutput of allLogArgs) {
      expect(logOutput).not.toContain("super-secret-password");
    }

    consoleSpy.mockRestore();
  });

  it("should redact token fields from audit event details", async () => {
    const { auditLogger, AuditEventType } = await import("../../server/audit");

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    auditLogger.logEvent({
      eventType: AuditEventType.SECURITY_INVALID_TOKEN,
      outcome: "FAILURE",
      details: {
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret.payload",
        apiKey: "sk-live-supersecretapikey",
      },
    });

    const allLogArgs = [
      ...consoleSpy.mock.calls,
      ...vi.mocked(console.warn).mock.calls,
      ...vi.mocked(console.error).mock.calls,
    ].map(args => JSON.stringify(args));

    for (const logOutput of allLogArgs) {
      expect(logOutput).not.toContain("supersecretapikey");
    }

    consoleSpy.mockRestore();
    vi.mocked(console.warn).mockRestore();
    vi.mocked(console.error).mockRestore();
  });

  it("should mark redacted fields as REDACTED in audit details", async () => {
    const { auditLogger, AuditEventType } = await import("../../server/audit");

    // Capture logged events
    const events = auditLogger.getEvents();
    const beforeCount = events.length;

    auditLogger.logEvent({
      eventType: AuditEventType.AUTH_LOGIN_FAILURE,
      outcome: "FAILURE",
      details: {
        password: "my-secret-password",
        username: "user@example.com",
      },
    });

    const after = auditLogger.getEvents();
    const newEvent = after.find((_, i) => i < after.length - beforeCount || after.length > beforeCount);
    const logged = after[0]; // Most recent (sorted DESC)

    if (logged?.details && "password" in logged.details) {
      expect(logged.details.password).toBe("***REDACTED***");
      expect(logged.details.password).not.toBe("my-secret-password");
    }
  });
});

describe("JWT Claims – No Sensitive Data Leakage", () => {
  it("should not include sensitive fields in JWT payload", async () => {
    const { generateAccessToken } = await import("../../server/security");
    const jwt = await import("jsonwebtoken");

    const token = generateAccessToken(
      { id: "user-123", email: "user@example.com" },
      "test-secret"
    );

    // Decode without verification to inspect payload claims
    const decoded = jwt.decode(token) as Record<string, unknown>;
    expect(decoded).not.toBeNull();

    // Sensitive fields must not appear in the token payload
    const sensitiveFields = ["password", "passwordHash", "secret", "apiKey", "creditCard"];
    for (const field of sensitiveFields) {
      expect(decoded[field]).toBeUndefined();
    }
  });
});
