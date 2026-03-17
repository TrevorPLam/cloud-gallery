// Tests for authentication routes

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";

// Mock the security functions
vi.mock("./security", () => ({
  hashPassword: vi
    .fn()
    .mockResolvedValue("$argon2id$v=19$m=65536,t=3,p=4$hash"),
  verifyPassword: vi.fn().mockResolvedValue(true),
  generateAccessToken: vi.fn().mockReturnValue("mock-access-token"),
  generateRefreshToken: vi.fn().mockReturnValue("mock-refresh-token"),
  validatePasswordStrength: vi.fn().mockReturnValue({
    isValid: true,
    errors: [],
  }),
  verifyAccessToken: vi
    .fn()
    .mockReturnValue({ id: "user123", email: "test@example.com" }),
  checkPasswordBreach: vi.fn().mockResolvedValue(false),
}));

// Mock rate limiting to avoid 429 errors in tests
vi.mock("./auth", () => ({
  authRateLimit: vi.fn((req, res, next) => next()),
  authenticateToken: vi.fn((req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      req.user = { id: "user123", email: "test@example.com" };
      next();
    } else {
      return res.status(401).json({
        error: "Access token required",
        message: "Please provide a valid access token",
      });
    }
  }),
  generalRateLimit: vi.fn((req, res, next) => next()),
}));

// Mock captcha functions
vi.mock("./auth-captcha-routes", () => ({
  checkCaptchaRequirement: vi.fn((req, res, next) => next()),
  verifyCaptchaMiddleware: vi.fn((req, res, next) => next()),
  recordAuthFailure: vi.fn(),
  recordAuthSuccess: vi.fn(),
}));

// Mock audit functions
vi.mock("./audit", () => ({
  logAuthEvent: vi.fn(),
  logSecurityEvent: vi.fn(),
  AuditEventType: {
    LOGIN_SUCCESS: "LOGIN_SUCCESS",
    LOGIN_FAILURE: "LOGIN_FAILURE",
    REGISTER_SUCCESS: "REGISTER_SUCCESS",
    REGISTER_FAILURE: "REGISTER_FAILURE",
  },
}));

// Mock the database
const { mockDb, mockUser } = vi.hoisted(() => {
  const mockUser = {
    id: "user123",
    username: "test@example.com",
    password: "$argon2id$v=19$m=65536,t=3,p=4$hash",
    createdAt: new Date(),
  };

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([mockUser]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([mockUser]),
  };

  return { mockDb, mockUser };
});

vi.mock("./db", () => ({
  db: mockDb,
}));

describe("Authentication Routes", () => {
  let app: express.Application;

  beforeEach(async () => {
    // Clear the mock users array by re-importing the module
    vi.resetModules();
    const { default: authRoutes } = await import("./auth-routes");

    app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      // Mock user not existing
      mockDb.limit.mockResolvedValueOnce([]);

      const userData = {
        email: "test@example.com",
        password: "StrongPassword123!",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: "User registered successfully",
        user: {
          email: userData.email,
        },
        tokens: {
          accessToken: "mock-access-token",
          refreshToken: "mock-refresh-token",
        },
      });
    });

    it("should reject weak passwords", async () => {
      const userData = {
        email: "test@example.com",
        password: "weak",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Validation error",
        message: "Invalid input data",
      });
    });

    it("should validate email format", async () => {
      const userData = {
        email: "invalid-email",
        password: "StrongPassword123!",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Validation error",
        message: "Invalid input data",
      });
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      // Mock user existing
      mockDb.limit.mockResolvedValue([mockUser]);

      const loginData = {
        email: "test@example.com",
        password: "StrongPassword123!",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        message: "Login successful",
        user: {
          email: loginData.email,
        },
        tokens: {
          accessToken: "mock-access-token",
          refreshToken: "mock-refresh-token",
        },
      });
    });

    it("should reject login with invalid credentials", async () => {
      const { verifyPassword } = await import("./security");
      vi.mocked(verifyPassword).mockResolvedValue(false);

      const loginData = {
        email: "test@example.com",
        password: "wrongpassword",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(loginData)
        .expect(401);

      expect(response.body).toMatchObject({
        error: "Invalid credentials",
        message: "Email or password is incorrect",
      });
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should refresh access token with valid refresh token", async () => {
      mockDb.limit.mockResolvedValue([mockUser]);
      const refreshToken = "mock-refresh-token";

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toMatchObject({
        message: "Token refreshed successfully",
        accessToken: "mock-access-token",
      });
    });

    it("should reject refresh token request without token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        error: "Refresh token required",
        message: "Please provide a refresh token",
      });
    });

    it("should reject invalid refresh token", async () => {
      const { verifyAccessToken } = await import("./security");
      vi.mocked(verifyAccessToken).mockReturnValue(null);

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token" })
        .expect(403);

      expect(response.body).toMatchObject({
        error: "Invalid or expired refresh token",
        message: "Please authenticate again",
      });
    });
  });

  // SRP Authentication Tests
  describe("SRP Authentication", () => {
    beforeEach(() => {
      // Clear SRP sessions before each test
      const { srpSessions } = require("./auth-routes");
      if (srpSessions && srpSessions.clear) {
        srpSessions.clear();
      }
    });

    describe("POST /api/auth/register (SRP)", () => {
      it("should register user with SRP verifier and salt", async () => {
        const registerData = {
          email: "srp@example.com",
          srpSalt: "test-salt-32-chars-long-1234567890",
          srpVerifier: "test-verifier-64-chars-long-1234567890123456789012345678901234567890",
        };

        const response = await request(app)
          .post("/api/auth/register")
          .send(registerData)
          .expect(201);

        expect(response.body).toMatchObject({
          message: "User registered successfully",
          user: {
            email: registerData.email,
          },
          tokens: {
            accessToken: "mock-access-token",
            refreshToken: "mock-refresh-token",
          },
        });

        expect(mockDb.insert).toHaveBeenCalledWith(users);
        expect(mockDb.values).toHaveBeenCalledWith({
          username: registerData.email,
          srpSalt: registerData.srpSalt,
          srpVerifier: registerData.srpVerifier,
          password: null,
        });
      });

      it("should reject SRP registration with missing fields", async () => {
        const registerData = {
          email: "srp@example.com",
          srpSalt: "test-salt",
          // Missing srpVerifier
        };

        const response = await request(app)
          .post("/api/auth/register")
          .send(registerData)
          .expect(400);

        expect(response.body).toMatchObject({
          error: "Validation error",
          message: "Invalid input data",
        });
      });

      it("should reject SRP registration when user already exists", async () => {
        mockDb.limit.mockResolvedValue([mockUser]); // User already exists

        const registerData = {
          email: "test@example.com", // Same as existing user
          srpSalt: "test-salt-32-chars-long-1234567890",
          srpVerifier: "test-verifier-64-chars-long-1234567890123456789012345678901234567890",
        };

        const response = await request(app)
          .post("/api/auth/register")
          .send(registerData)
          .expect(409);

        expect(response.body).toMatchObject({
          error: "User already exists",
          message: "An account with this email already exists",
        });
      });
    });

    describe("POST /api/auth/login/challenge", () => {
      it("should generate SRP challenge for existing user", async () => {
        const srpUser = {
          ...mockUser,
          srpSalt: "test-salt-32-chars-long-1234567890",
          srpVerifier: "test-verifier-64-chars-long-1234567890123456789012345678901234567890",
        };
        mockDb.limit.mockResolvedValue([srpUser]);

        const response = await request(app)
          .post("/api/auth/login/challenge")
          .send({ email: "test@example.com" })
          .expect(200);

        expect(response.body).toHaveProperty("sessionId");
        expect(response.body).toHaveProperty("salt");
        expect(response.body).toHaveProperty("B");
        expect(response.body.salt).toBe(srpUser.srpSalt);
        expect(typeof response.body.sessionId).toBe("string");
        expect(typeof response.body.B).toBe("string");
      });

      it("should reject challenge for non-existent user", async () => {
        mockDb.limit.mockResolvedValue([]); // No user found

        const response = await request(app)
          .post("/api/auth/login/challenge")
          .send({ email: "nonexistent@example.com" })
          .expect(401);

        expect(response.body).toMatchObject({
          error: "Invalid credentials",
          message: "Email not found or user not set up for SRP",
        });
      });

      it("should reject challenge for user without SRP setup", async () => {
        const userWithoutSRP = { ...mockUser }; // No srpSalt or srpVerifier
        mockDb.limit.mockResolvedValue([userWithoutSRP]);

        const response = await request(app)
          .post("/api/auth/login/challenge")
          .send({ email: "test@example.com" })
          .expect(401);

        expect(response.body).toMatchObject({
          error: "Invalid credentials",
          message: "Email not found or user not set up for SRP",
        });
      });

      it("should reject challenge without email", async () => {
        const response = await request(app)
          .post("/api/auth/login/challenge")
          .send({})
          .expect(400);

        expect(response.body).toMatchObject({
          error: "Email required",
          message: "Email is required for SRP challenge",
        });
      });
    });

    describe("POST /api/auth/login/verify", () => {
      it("should verify SRP login and return tokens", async () => {
        const srpUser = {
          ...mockUser,
          srpSalt: "test-salt-32-chars-long-1234567890",
          srpVerifier: "test-verifier-64-chars-long-1234567890123456789012345678901234567890",
        };
        mockDb.limit.mockResolvedValue([srpUser]);

        // First, create a challenge
        const challengeResponse = await request(app)
          .post("/api/auth/login/challenge")
          .send({ email: "test@example.com" })
          .expect(200);

        const { sessionId } = challengeResponse.body;

        // Then verify with mock SRP values
        const verifyData = {
          sessionId,
          A: "mock-client-public-key-A",
          M1: "mock-client-proof-M1",
        };

        const response = await request(app)
          .post("/api/auth/login/verify")
          .send(verifyData)
          .expect(200);

        expect(response.body).toMatchObject({
          message: "Login successful",
          user: {
            email: "test@example.com",
          },
          tokens: {
            accessToken: "mock-access-token",
            refreshToken: "mock-refresh-token",
          },
        });
        expect(response.body).toHaveProperty("M2");
      });

      it("should reject verification with invalid session ID", async () => {
        const verifyData = {
          sessionId: "invalid-session-id",
          A: "mock-client-public-key-A",
          M1: "mock-client-proof-M1",
        };

        const response = await request(app)
          .post("/api/auth/login/verify")
          .send(verifyData)
          .expect(401);

        expect(response.body).toMatchObject({
          error: "Invalid or expired session",
          message: "SRP session has expired, please try again",
        });
      });

      it("should reject verification with missing fields", async () => {
        const response = await request(app)
          .post("/api/auth/login/verify")
          .send({ sessionId: "some-id" }) // Missing A and M1
          .expect(400);

        expect(response.body).toMatchObject({
          error: "Missing required fields",
          message: "sessionId, A, and M1 are required",
        });
      });
    });

    describe("SRP Integration", () => {
      it("should support both traditional and SRP registration", async () => {
        // Traditional registration
        const traditionalData = {
          email: "traditional@example.com",
          password: "StrongPassword123!",
        };

        await request(app)
          .post("/api/auth/register")
          .send(traditionalData)
          .expect(201);

        expect(mockDb.values).toHaveBeenCalledWith(
          expect.objectContaining({
            password: "$argon2id$v=19$m=65536,t=3,p=4$hash",
            srpSalt: null,
            srpVerifier: null,
          })
        );

        // Reset mock for SRP registration
        vi.clearAllMocks();

        // SRP registration
        const srpData = {
          email: "srp@example.com",
          srpSalt: "test-salt-32-chars-long-1234567890",
          srpVerifier: "test-verifier-64-chars-long-1234567890123456789012345678901234567890",
        };

        await request(app)
          .post("/api/auth/register")
          .send(srpData)
          .expect(201);

        expect(mockDb.values).toHaveBeenCalledWith(
          expect.objectContaining({
            password: null,
            srpSalt: srpData.srpSalt,
            srpVerifier: srpData.srpVerifier,
          })
        );
      });
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return user info with valid token", async () => {
      mockDb.limit.mockResolvedValue([mockUser]);
      const response = await request(app)
        .get("/api/auth/me")
        .set("Authorization", "Bearer valid-token")
        .expect(200);

      expect(response.body).toMatchObject({
        user: {
          email: "test@example.com",
        },
      });
    });

    it("should reject request without token", async () => {
      const response = await request(app).get("/api/auth/me").expect(401);

      expect(response.body).toMatchObject({
        error: "Access token required",
        message: "Please provide a valid access token",
      });
    });
  });
});
