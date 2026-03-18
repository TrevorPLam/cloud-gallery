// AI-META-BEGIN
// AI-META: Security tests for password reset flow with comprehensive coverage
// OWNERSHIP: server/auth-routes.test.ts
// ENTRYPOINTS: test runner (vitest)
// DEPENDENCIES: vitest, supertest, drizzle-orm mocks, security utilities
// DANGER: Security tests must validate all attack vectors and edge cases
// CHANGE-SAFETY: Update tests when adding new security controls or changing validation logic
// TESTS: npm run test
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import { app } from "./index";
import { db } from "./db";
import { users, passwordResetTokens } from "../shared/schema";
import { generateSecureToken, hashPassword } from "./security";
import { eq } from "drizzle-orm";

// Mock database
vi.mock("./db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock security utilities
vi.mock("./security", () => ({
  generateSecureToken: vi.fn(() => "mock-reset-token-123"),
  hashPassword: vi.fn((token: string) => `hashed-${token}`),
  validatePasswordStrength: vi.fn(() => ({ isValid: true, errors: [] })),
  checkPasswordBreach: vi.fn(() => false),
}));

// Mock audit logging
vi.mock("./audit", () => ({
  logAuthEvent: vi.fn(),
  logSecurityEvent: vi.fn(),
  AuditEventType: {
    SRP_INVALID_REQUEST: "SRP_INVALID_REQUEST",
  },
}));

describe("Password Reset Security Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/auth/forgot-password", () => {
    it("should always return 200 to prevent email enumeration", async () => {
      // Mock user not found
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nonexistent@example.com" })
        .expect(200);

      expect(response.body.message).toBe("If that email exists, a reset link was sent.");
    });

    it("should rate limit password reset requests", async () => {
      // Mock user exists
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "user-123", username: "test@example.com" }]),
          }),
        }),
      } as any);

      // Make multiple requests to trigger rate limiting
      const requests = Array(6).fill(null).map(() =>
        request(app)
          .post("/api/auth/forgot-password")
          .send({ email: "test@example.com" })
      );

      const responses = await Promise.all(requests);
      
      // First 5 should succeed
      for (let i = 0; i < 5; i++) {
        expect(responses[i].status).toBe(200);
      }
      
      // 6th should be rate limited
      expect(responses[5].status).toBe(429);
      expect(responses[5].body.error).toBe("Too many password reset requests");
    });

    it("should validate email format", async () => {
      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "invalid-email" })
        .expect(400);

      expect(response.body.error).toBe("Validation error");
      expect(response.body.details).toBeDefined();
    });

    it("should generate and store reset token for valid user", async () => {
      // Mock user exists
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "user-123", username: "test@example.com" }]),
          }),
        }),
      } as any);

      // Mock database insert
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "test@example.com" })
        .expect(200);

      expect(response.body.message).toBe("If that email exists, a reset link was sent.");
      expect(db.insert).toHaveBeenCalledWith(passwordResetTokens);
      expect(generateSecureToken).toHaveBeenCalledWith(32);
    });

    it("should handle database errors gracefully", async () => {
      // Mock database error
      vi.mocked(db.select).mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "test@example.com" })
        .expect(200);

      // Should still return 200 to prevent enumeration
      expect(response.body.message).toBe("If that email exists, a reset link was sent.");
    });
  });

  describe("POST /api/auth/reset-password", () => {
    beforeEach(() => {
      // Mock valid token lookup
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "token-123",
                userId: "user-123",
                token: "hashed-mock-reset-token-123",
                expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
                usedAt: null,
              },
            ]),
          }),
        }),
      } as any);

      // Mock user lookup
      vi.mocked(db.select).mockReturnValue([
        {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                { id: "user-123", username: "test@example.com" },
              ]),
            }),
          }),
        },
        {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        },
      ] as any);

      // Mock database updates
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);
    });

    it("should reset password with valid token", async () => {
      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "mock-reset-token-123",
          newPassword: "NewSecurePassword123!",
        })
        .expect(200);

      expect(response.body.message).toBe("Password reset successfully");
      expect(hashPassword).toHaveBeenCalledWith("NewSecurePassword123!");
      expect(db.update).toHaveBeenCalledTimes(2); // Once for password, once for token
    });

    it("should reject invalid token", async () => {
      // Mock no token found
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "invalid-token",
          newPassword: "NewSecurePassword123!",
        })
        .expect(400);

      expect(response.body.error).toBe("Invalid or expired token");
    });

    it("should reject expired token", async () => {
      // Mock expired token
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "token-123",
                userId: "user-123",
                token: "hashed-mock-reset-token-123",
                expiresAt: new Date(Date.now() - 1000), // Expired
                usedAt: null,
              },
            ]),
          }),
        }),
      } as any);

      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "expired-token",
          newPassword: "NewSecurePassword123!",
        })
        .expect(400);

      expect(response.body.error).toBe("Invalid or expired token");
    });

    it("should reject already used token", async () => {
      // Mock used token
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "token-123",
                userId: "user-123",
                token: "hashed-mock-reset-token-123",
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                usedAt: new Date(), // Already used
              },
            ]),
          }),
        }),
      } as any);

      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "used-token",
          newPassword: "NewSecurePassword123!",
        })
        .expect(400);

      expect(response.body.error).toBe("Invalid or expired token");
    });

    it("should validate password strength", async () => {
      // Mock weak password validation
      vi.mocked(require("./security")).validatePasswordStrength.mockReturnValue({
        isValid: false,
        errors: ["Password must be at least 8 characters long"],
      });

      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "mock-reset-token-123",
          newPassword: "weak",
        })
        .expect(400);

      expect(response.body.error).toBe("Weak password");
      expect(response.body.details).toBeDefined();
    });

    it("should reject breached passwords", async () => {
      // Mock breached password
      vi.mocked(require("./security")).checkPasswordBreach.mockResolvedValue(true);

      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "mock-reset-token-123",
          newPassword: "password123",
        })
        .expect(400);

      expect(response.body.error).toBe("Breached password");
    });

    it("should validate input format", async () => {
      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "",
          newPassword: "",
        })
        .expect(400);

      expect(response.body.error).toBe("Validation error");
      expect(response.body.details).toBeDefined();
    });

    it("should handle token reuse prevention", async () => {
      // First reset should succeed
      await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "mock-reset-token-123",
          newPassword: "NewSecurePassword123!",
        })
        .expect(200);

      // Second reset with same token should fail
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "token-123",
                userId: "user-123",
                token: "hashed-mock-reset-token-123",
                expiresAt: new Date(Date.now() + 15 * 60 * 1000),
                usedAt: new Date(), // Now marked as used
              },
            ]),
          }),
        }),
      } as any);

      const response = await request(app)
        .post("/api/auth/reset-password")
        .send({
          token: "mock-reset-token-123",
          newPassword: "AnotherPassword123!",
        })
        .expect(400);

      expect(response.body.error).toBe("Invalid or expired token");
    });
  });

  describe("Security Edge Cases", () => {
    it("should handle malformed requests safely", async () => {
      const response = await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: null })
        .expect(400);

      expect(response.body.error).toBe("Validation error");
    });

    it("should prevent timing attacks on email lookup", async () => {
      const startTime = Date.now();
      
      // Request with non-existent email
      await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "nonexistent@example.com" })
        .expect(200);

      const nonExistentTime = Date.now() - startTime;

      // Mock user exists for timing test
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "user-123", username: "test@example.com" }]),
          }),
        }),
      } as any);

      const existentStartTime = Date.now();
      
      // Request with existing email
      await request(app)
        .post("/api/auth/forgot-password")
        .send({ email: "test@example.com" })
        .expect(200);

      const existentTime = Date.now() - existentStartTime;

      // Timing difference should be minimal (within 100ms)
      expect(Math.abs(nonExistentTime - existentTime)).toBeLessThan(100);
    });

    it("should handle concurrent reset requests safely", async () => {
      // Mock user exists
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "user-123", username: "test@example.com" }]),
          }),
        }),
      } as any);

      // Mock database insert
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      } as any);

      // Send multiple concurrent requests
      const requests = Array(3).fill(null).map(() =>
        request(app)
          .post("/api/auth/forgot-password")
          .send({ email: "test@example.com" })
      );

      const responses = await Promise.all(requests);
      
      // All should return 200
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.message).toBe("If that email exists, a reset link was sent.");
      });

      // Should attempt to create 3 tokens
      expect(db.insert).toHaveBeenCalledTimes(3);
    });
  });
});
