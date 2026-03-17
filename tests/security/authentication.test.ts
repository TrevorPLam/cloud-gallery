/**
 * Authentication Security Tests
 *
 * Validates that authentication mechanisms correctly resist bypass attempts,
 * token manipulation, brute-force attacks, and other authentication attacks.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import type { Express } from "express";
import request from "supertest";
import expressRateLimit from "express-rate-limit";
import {
  generateAccessToken,
  verifyAccessToken,
  validatePasswordStrength,
  generateSecureToken,
  SECURITY_CONFIG,
} from "../../server/security";
import { authenticateToken } from "../../server/auth";
import { rateLimit } from "../../server/middleware";

// Mock JWT to have full control over token scenarios
vi.mock("jsonwebtoken", async () => {
  const actual =
    await vi.importActual<typeof import("jsonwebtoken")>("jsonwebtoken");
  return actual;
});

vi.mock("../../server/siem", () => ({
  forwardAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

const TEST_SECRET = "test-secret-key-for-security-testing-only";

describe("JWT Token Security", () => {
  describe("Token Generation", () => {
    it("should generate tokens with correct issuer and audience claims", () => {
      const payload = { id: "user-123", email: "user@example.com" };
      const token = generateAccessToken(payload, TEST_SECRET);
      const decoded = verifyAccessToken(token, TEST_SECRET) as Record<
        string,
        unknown
      >;

      expect(decoded).not.toBeNull();
      expect(decoded?.iss).toBe("cloud-gallery");
      expect(decoded?.aud).toBe("cloud-gallery-users");
    });

    it("should generate tokens that expire", () => {
      const payload = { id: "user-123", email: "user@example.com" };
      const token = generateAccessToken(payload, TEST_SECRET);
      const decoded = verifyAccessToken(token, TEST_SECRET) as Record<
        string,
        unknown
      >;

      expect(decoded).not.toBeNull();
      expect(decoded?.exp).toBeDefined();
      // Token must expire within the configured TTL (+1 second buffer)
      const now = Math.floor(Date.now() / 1000);
      expect(decoded?.exp as number).toBeLessThanOrEqual(
        now + SECURITY_CONFIG.ACCESS_TOKEN_TTL + 1,
      );
    });

    it("should generate unique tokens for different users", () => {
      // JWTs are deterministic for the same payload+second, but differ per user
      const tokens = new Set(
        Array.from({ length: 50 }, (_, i) =>
          generateAccessToken(
            { id: `user-${i}`, email: `user${i}@example.com` },
            TEST_SECRET,
          ),
        ),
      );

      // All 50 different-user tokens should be unique
      expect(tokens.size).toBe(50);
    });
  });

  describe("Token Verification", () => {
    it("should reject tokens signed with a different secret", () => {
      const payload = { id: "user-123", email: "user@example.com" };
      const token = generateAccessToken(payload, "different-secret");
      const decoded = verifyAccessToken(token, TEST_SECRET);

      expect(decoded).toBeNull();
    });

    it("should reject expired tokens", async () => {
      // Import jwt directly to create a token with very short expiry
      const jwt = await import("jsonwebtoken");
      const expiredToken = jwt.sign(
        {
          id: "user-123",
          email: "user@example.com",
          iss: "cloud-gallery",
          aud: "cloud-gallery-users",
        },
        TEST_SECRET,
        { expiresIn: 0 }, // Immediately expired
      );

      // Allow 1ms for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1));
      const decoded = verifyAccessToken(expiredToken, TEST_SECRET);
      expect(decoded).toBeNull();
    });

    it("should reject tokens with wrong issuer", async () => {
      const jwt = await import("jsonwebtoken");
      const maliciousToken = jwt.sign(
        { id: "user-123", email: "user@example.com" },
        TEST_SECRET,
        {
          issuer: "evil-issuer",
          audience: "cloud-gallery-users",
          expiresIn: 3600,
        },
      );

      const decoded = verifyAccessToken(maliciousToken, TEST_SECRET);
      expect(decoded).toBeNull();
    });

    it("should reject tokens with wrong audience", async () => {
      const jwt = await import("jsonwebtoken");
      const maliciousToken = jwt.sign(
        { id: "user-123", email: "user@example.com" },
        TEST_SECRET,
        {
          issuer: "cloud-gallery",
          audience: "wrong-audience",
          expiresIn: 3600,
        },
      );

      const decoded = verifyAccessToken(maliciousToken, TEST_SECRET);
      expect(decoded).toBeNull();
    });

    it("should reject tokens with 'none' algorithm", () => {
      // Attempt algorithm confusion - unsigned token
      const header = Buffer.from(
        JSON.stringify({ alg: "none", typ: "JWT" }),
      ).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          id: "admin",
          email: "admin@example.com",
          iss: "cloud-gallery",
          aud: "cloud-gallery-users",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString("base64url");
      const unsignedToken = `${header}.${payload}.`;

      const decoded = verifyAccessToken(unsignedToken, TEST_SECRET);
      expect(decoded).toBeNull();
    });

    it("should reject completely malformed tokens", () => {
      const malformedTokens = [
        "not-a-jwt",
        "only.two.parts",
        "",
        "a.b.c.d.e", // too many parts
        Buffer.from("{}").toString("base64"), // not JWT format
      ];

      for (const token of malformedTokens) {
        const decoded = verifyAccessToken(token, TEST_SECRET);
        expect(
          decoded,
          `Expected null for malformed token: ${token}`,
        ).toBeNull();
      }
    });
  });
});

describe("authenticateToken Middleware", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    const limiter = expressRateLimit({ windowMs: 60000, max: 100 });
    // Use real authenticateToken middleware (not mocked)
    app.get("/protected", limiter, authenticateToken, (_req, res) => {
      res.json({ success: true });
    });
  });

  it("should return 401 when Authorization header is missing", async () => {
    const response = await request(app).get("/protected");
    expect(response.status).toBe(401);
    expect(response.body.error).toBeDefined();
  });

  it("should return 401 when Authorization header has no Bearer token", async () => {
    const response = await request(app)
      .get("/protected")
      .set("Authorization", "");
    expect(response.status).toBe(401);
  });

  it("should return 403 when token is invalid", async () => {
    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer invalid.jwt.token");
    expect(response.status).toBe(403);
  });

  it("should return 403 when Bearer token is forged", async () => {
    const forgedToken = Buffer.from(
      JSON.stringify({ id: "admin", email: "admin@example.com" }),
    ).toString("base64");

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${forgedToken}`);
    expect(response.status).toBe(403);
  });

  it("should allow request with valid JWT token", async () => {
    const JWT_SECRET =
      process.env.JWT_SECRET || "your-secret-key-change-in-production";
    const jwt = await import("jsonwebtoken");
    const validToken = jwt.sign(
      { id: "user-123", email: "user@example.com" },
      JWT_SECRET,
      {
        issuer: "cloud-gallery",
        audience: "cloud-gallery-users",
        expiresIn: 3600,
      },
    );

    const response = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${validToken}`);
    expect(response.status).toBe(200);
  });

  it("should not expose sensitive information in 401 response body", async () => {
    const response = await request(app).get("/protected");
    const body = JSON.stringify(response.body);

    expect(body).not.toContain("secret");
    expect(body).not.toContain("private");
    expect(body).not.toContain("stack");
    expect(body).not.toContain("Error:");
  });

  it("should not expose sensitive information in 403 response body", async () => {
    const response = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer invalid-token");
    const body = JSON.stringify(response.body);

    expect(body).not.toContain("secret");
    expect(body).not.toContain("stack");
    expect(body).not.toContain("Error:");
  });
});

describe("Password Security", () => {
  describe("Password Strength Validation", () => {
    it("should reject passwords shorter than 8 characters", () => {
      const result = validatePasswordStrength("Sh0rt!");
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("8 characters"))).toBe(true);
    });

    it("should reject passwords without uppercase letters", () => {
      const result = validatePasswordStrength("lowercase123!");
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.toLowerCase().includes("uppercase")),
      ).toBe(true);
    });

    it("should reject passwords without lowercase letters", () => {
      const result = validatePasswordStrength("UPPERCASE123!");
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.toLowerCase().includes("lowercase")),
      ).toBe(true);
    });

    it("should reject passwords without numbers", () => {
      const result = validatePasswordStrength("NoNumbers!");
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.toLowerCase().includes("number")),
      ).toBe(true);
    });

    it("should reject passwords without special characters", () => {
      const result = validatePasswordStrength("NoSpecial123");
      expect(result.isValid).toBe(false);
      expect(
        result.errors.some((e) => e.toLowerCase().includes("special")),
      ).toBe(true);
    });

    it("should reject common passwords", () => {
      const weakPasswords = ["password", "12345678", "qwerty", "abc123"];
      for (const pw of weakPasswords) {
        const result = validatePasswordStrength(pw);
        expect(result.isValid, `Expected '${pw}' to be rejected`).toBe(false);
      }
    });

    it("should reject passwords exceeding 128 characters", () => {
      const tooLong = "Aa1!" + "x".repeat(125);
      const result = validatePasswordStrength(tooLong);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("128"))).toBe(true);
    });

    it("should accept strong passwords", () => {
      const strongPasswords = [
        "SecureP@ssw0rd",
        "Tr0ub4dor&3",
        "C0rrect-H0rse-Battery-Stapl3!",
        "M#9kPx$2wL",
      ];

      for (const pw of strongPasswords) {
        const result = validatePasswordStrength(pw);
        expect(result.isValid, `Expected '${pw}' to be accepted`).toBe(true);
      }
    });
  });

  describe("Secure Token Generation", () => {
    it("should generate tokens with sufficient entropy", () => {
      const token = generateSecureToken();
      // 32 bytes = 64 hex chars = 256 bits of entropy
      expect(token).toHaveLength(SECURITY_CONFIG.TOKEN_LENGTH * 2);
    });

    it("should generate unique tokens (no collisions in 100 trials)", () => {
      const tokens = new Set(
        Array.from({ length: 100 }, () => generateSecureToken()),
      );
      expect(tokens.size).toBe(100);
    });

    it("should generate hex-encoded tokens", () => {
      const token = generateSecureToken();
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });
  });
});
