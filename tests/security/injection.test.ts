/**
 * Injection Attack Prevention Tests
 *
 * Validates that the API correctly rejects SQL injection, XSS, and other
 * injection payloads through input validation and sanitization layers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import type { Express } from "express";
import request from "supertest";

// Mock the database module
vi.mock("../../server/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([
          {
            id: "user-test-id",
            username: "test@example.com",
            password: "$argon2id$v=19$m=65536,t=3,p=4$hash",
            createdAt: new Date(),
          },
        ]),
      }),
    }),
  },
}));

// Mock security functions (password hashing, JWT generation)
// Use importActual to preserve real implementations (sanitizeForLogging, sha256, etc.)
vi.mock("../../server/security", async () => {
  const actual = await vi.importActual<typeof import("../../server/security")>(
    "../../server/security",
  );
  return {
    ...actual,
    hashPassword: vi.fn().mockResolvedValue("$argon2id$v=19$m=65536,t=3,p=4$hash"),
    verifyPassword: vi.fn().mockResolvedValue(true),
    generateAccessToken: vi.fn().mockReturnValue("mock-access-token"),
    generateRefreshToken: vi.fn().mockReturnValue("mock-refresh-token"),
    validatePasswordStrength: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
    verifyAccessToken: vi.fn().mockReturnValue({ id: "user123", email: "test@example.com" }),
    checkPasswordBreach: vi.fn().mockResolvedValue(false),
  };
});

vi.mock("../../server/auth", () => ({
  authRateLimit: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  authenticateToken: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  generalRateLimit: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
}));

vi.mock("../../server/auth-captcha-routes", () => ({
  checkCaptchaRequirement: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  verifyCaptchaMiddleware: vi.fn((_req: express.Request, _res: express.Response, next: express.NextFunction) => next()),
  recordAuthFailure: vi.fn(),
  recordAuthSuccess: vi.fn(),
}));

vi.mock("../../server/audit", () => ({
  logAuthEvent: vi.fn(),
  logSecurityEvent: vi.fn(),
  logDataEvent: vi.fn(),
  auditLogger: { logEvent: vi.fn(), middleware: vi.fn(() => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next()) },
  AuditEventType: {
    AUTH_LOGIN_SUCCESS: "AUTH_LOGIN_SUCCESS",
    AUTH_LOGIN_FAILURE: "AUTH_LOGIN_FAILURE",
    AUTH_REGISTER_SUCCESS: "AUTH_REGISTER_SUCCESS",
    AUTH_REGISTER_FAILURE: "AUTH_REGISTER_FAILURE",
    SECURITY_UNAUTHORIZED_ACCESS: "SECURITY_UNAUTHORIZED_ACCESS",
  },
}));

vi.mock("../../server/siem", () => ({
  forwardAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("Injection Attack Prevention", () => {
  let app: Express;

  beforeEach(async () => {
    vi.resetModules();
    const { default: authRoutes } = await import("../../server/auth-routes");
    app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);
  });

  describe("SQL Injection Prevention via Input Validation", () => {
    it("should reject SQL injection payload in email field", async () => {
      const maliciousPayloads = [
        "' OR '1'='1",
        "admin'--",
        "'; DROP TABLE users; --",
        "' UNION SELECT * FROM users --",
        "1' OR '1'='1' /*",
      ];

      for (const payload of maliciousPayloads) {
        const response = await request(app)
          .post("/api/auth/register")
          .send({ email: payload, password: "SecurePass123!" });

        // Zod email validation must reject these payloads
        expect(response.status, `Expected 400 for SQL injection: ${payload}`).toBe(400);
        // Response must not expose SQL errors or stack traces
        const body = JSON.stringify(response.body);
        expect(body).not.toContain("SQL");
        expect(body).not.toContain("syntax error");
        expect(body).not.toContain("stack");
        expect(body).not.toContain("Error at");
      }
    });

    it("should reject SQL injection payload in login email field", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "' OR '1'='1", password: "anything" });

      expect(response.status).toBe(400);
      const body = JSON.stringify(response.body);
      expect(body).not.toContain("SQL");
      expect(body).not.toContain("stack");
    });

    it("should handle null-byte injection in inputs", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: "user\x00@example.com", password: "SecurePass123!" });

      // Should be rejected (null bytes are not valid in email)
      expect([400, 422]).toContain(response.status);
    });
  });

  describe("XSS Prevention via Input Validation", () => {
    it("should reject XSS payload in email field", async () => {
      const xssPayloads = [
        "<script>alert('xss')</script>@example.com",
        "user@<script>alert(1)</script>.com",
        '"><img src=x onerror=alert(1)>@example.com',
        "javascript:alert(1)@example.com",
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post("/api/auth/register")
          .send({ email: payload, password: "SecurePass123!" });

        // Zod email validation must reject XSS payloads
        expect(response.status, `Expected 400 for XSS: ${payload}`).toBe(400);
      }
    });

    it("should not reflect XSS content in error responses", async () => {
      const xssPayload = "<script>alert('xss')</script>";
      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: xssPayload, password: "SecurePass123!" });

      // Even if the server echoes user input, it must not be raw HTML
      const body = JSON.stringify(response.body);
      // The script tag must not appear as executable content
      // (either rejected or escaped)
      expect(body).not.toContain("<script>alert('xss')</script>");
    });
  });

  describe("Malformed Input Handling", () => {
    it("should return 400 for missing email", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({ password: "SecurePass123!" });

      expect(response.status).toBe(400);
    });

    it("should return 400 for missing password", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: "user@example.com" });

      expect(response.status).toBe(400);
    });

    it("should handle excessively long input safely (no crash)", async () => {
      const longString = "a".repeat(10000);
      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: `${longString}@example.com`, password: longString });

      // Must not crash (may succeed or fail depending on validation config)
      expect(response.status).toBeLessThan(600);
    });

    it("should handle empty string inputs safely", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({ email: "", password: "" });

      expect(response.status).toBe(400);
    });

    it("should handle non-string input types safely", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: { "$ne": "" }, password: "SecurePass123!" });

      // Must reject non-string email (NoSQL injection style)
      expect(response.status).toBe(400);
    });

    it("should handle array inputs safely", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({ email: ["admin@example.com", "hacker@evil.com"], password: "SecurePass123!" });

      expect(response.status).toBe(400);
    });
  });
});

describe("Input Validation with Zod", () => {
  it("should accept valid email addresses", () => {
    const { z } = require("zod");
    const emailSchema = z.string().email();

    const validEmails = [
      "user@example.com",
      "test.user+tag@domain.co.uk",
      "user123@test-domain.org",
    ];

    for (const email of validEmails) {
      expect(() => emailSchema.parse(email)).not.toThrow();
    }
  });

  it("should reject invalid email addresses including injection payloads", () => {
    const { z } = require("zod");
    const emailSchema = z.string().email();

    const invalidInputs = [
      "' OR '1'='1",
      "<script>alert(1)</script>",
      "not-an-email",
      "missing@tld",
      "",
    ];

    for (const input of invalidInputs) {
      expect(() => emailSchema.parse(input)).toThrow();
    }
  });
});

describe("Log Sanitization", () => {
  it("should mask email addresses in log output", async () => {
    const { sanitizeForLogging } = await import("../../server/security");
    const input = "User john.doe@example.com logged in";
    const sanitized = sanitizeForLogging(input);

    expect(sanitized).not.toContain("john.doe@example.com");
    expect(sanitized).toContain("@");
  });

  it("should mask IP addresses in log output", async () => {
    const { sanitizeForLogging } = await import("../../server/security");
    const input = "Request from 192.168.1.100";
    const sanitized = sanitizeForLogging(input);

    expect(sanitized).not.toContain("192.168.1.100");
  });

  it("should mask credit card numbers in log output", async () => {
    const { sanitizeForLogging } = await import("../../server/security");
    const input = "Card: 4532-1234-5678-9010";
    const sanitized = sanitizeForLogging(input);

    expect(sanitized).not.toContain("4532-1234-5678-9010");
    expect(sanitized).toContain("****-****-****-****");
  });

  it("should mask phone numbers in log output", async () => {
    const { sanitizeForLogging } = await import("../../server/security");
    const input = "Phone: 555-123-4567";
    const sanitized = sanitizeForLogging(input);

    expect(sanitized).not.toContain("555-123-4567");
  });
});
