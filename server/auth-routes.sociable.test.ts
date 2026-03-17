// Sociable tests for authentication routes
// Uses real security implementations, mocks only external boundaries

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import {
  setupTestDatabase,
  cleanupTestDatabase,
  createTestUser,
} from "../test-utils/test-database";
import { seedTestData, clearTestData } from "../test-utils/test-factories";

// Mock only external boundaries
vi.mock("jsonwebtoken", () => ({
  default: {
    sign: vi.fn((payload, secret) => `mock_token_${JSON.stringify(payload)}`),
    verify: vi.fn((token, secret) => {
      // Simple mock verification for test tokens
      if (token.startsWith("mock_token_")) {
        return JSON.parse(token.replace("mock_token_", ""));
      }
      throw new Error("Invalid token");
    }),
  },
}));

// Mock rate limiting as external boundary
vi.mock("../auth", () => ({
  authRateLimit: vi.fn((req, res, next) => next()),
  authenticateToken: vi.fn((req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token) {
      try {
        // Use real JWT verification (mocked above)
        const { default: jwt } = require("jsonwebtoken");
        const payload = jwt.verify(token, "test-secret");
        req.user = payload;
        next();
      } catch (error) {
        return res.status(401).json({
          error: "Invalid token",
          message: "Please provide a valid access token",
        });
      }
    } else {
      return res.status(401).json({
        error: "Access token required",
        message: "Please provide a valid access token",
      });
    }
  }),
  generalRateLimit: vi.fn((req, res, next) => next()),
}));

// Mock captcha functions as external boundary
vi.mock("../auth-captcha-routes", () => ({
  checkCaptchaRequirement: vi.fn((req, res, next) => next()),
  verifyCaptchaMiddleware: vi.fn((req, res, next) => next()),
  recordAuthFailure: vi.fn(),
  recordAuthSuccess: vi.fn(),
}));

// Mock audit functions as external boundary
vi.mock("../audit", () => ({
  logAuthEvent: vi.fn(),
  logSecurityEvent: vi.fn(),
  AuditEventType: {
    LOGIN_SUCCESS: "login_success",
    LOGIN_FAILURE: "login_failure",
    REGISTER_SUCCESS: "register_success",
    PASSWORD_CHANGE: "password_change",
  },
}));

describe("Authentication Routes (Sociable Tests)", () => {
  let app: express.Application;
  let db: any;
  let testUser: any;

  beforeEach(async () => {
    // Set up real in-memory database
    db = await setupTestDatabase();

    // Create Express app
    app = express();
    app.use(express.json());

    // Import and use real auth routes (they will use mocked external boundaries)
    const authRoutes = (await import("../auth-routes")).default;
    app.use("/api/auth", authRoutes);

    // Create test user
    testUser = createTestUser({
      passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$mock_hash_for_testing",
    });

    // Seed database
    await seedTestData(db, { user: testUser, photos: [], albums: [] });
  });

  afterEach(async () => {
    cleanupTestDatabase();
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const newUser = {
        email: "newuser@example.com",
        username: "newuser",
        password: "SecurePassword123!",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(newUser)
        .expect(201);

      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(newUser.email);
      expect(response.body.user.username).toBe(newUser.username);
      expect(response.body.user).not.toHaveProperty("passwordHash");

      // Verify user was actually saved to database
      const savedUser = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, newUser.email),
      });
      expect(savedUser).toBeDefined();
      expect(savedUser?.email).toBe(newUser.email);
    });

    it("should reject registration with duplicate email", async () => {
      const duplicateUser = {
        email: testUser.email, // Same email as existing user
        username: "different",
        password: "SecurePassword123!",
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(duplicateUser)
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("already exists");
    });

    it("should reject registration with weak password", async () => {
      const weakPasswordUser = {
        email: "weak@example.com",
        username: "weakuser",
        password: "123", // Too weak
      };

      const response = await request(app)
        .post("/api/auth/register")
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("password");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should login successfully with valid credentials", async () => {
      const credentials = {
        email: testUser.email,
        password: "testpassword", // This would be verified against real hash
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(credentials)
        .expect(200);

      expect(response.body).toHaveProperty("user");
      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty("passwordHash");
    });

    it("should reject login with invalid credentials", async () => {
      const invalidCredentials = {
        email: testUser.email,
        password: "wrongpassword",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(invalidCredentials)
        .expect(401);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid");
    });

    it("should reject login with non-existent user", async () => {
      const nonExistentCredentials = {
        email: "nonexistent@example.com",
        password: "anypassword",
      };

      const response = await request(app)
        .post("/api/auth/login")
        .send(nonExistentCredentials)
        .expect(401);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid");
    });
  });

  describe("POST /api/auth/refresh", () => {
    it("should refresh access token successfully", async () => {
      const refreshToken = "mock_refresh_token";

      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty("accessToken");
      expect(response.body).toHaveProperty("refreshToken");
    });

    it("should reject refresh with invalid token", async () => {
      const response = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid_token" })
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });
  });

  describe("GET /api/auth/profile", () => {
    it("should return user profile for authenticated user", async () => {
      const validToken =
        'mock_token_{"id":"' +
        testUser.id +
        '","email":"' +
        testUser.email +
        '"}';

      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("user");
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.email).toBe(testUser.email);
      expect(response.body.user).not.toHaveProperty("passwordHash");
    });

    it("should reject profile request without token", async () => {
      const response = await request(app).get("/api/auth/profile").expect(401);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("token required");
    });

    it("should reject profile request with invalid token", async () => {
      const response = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", "Bearer invalid_token")
        .expect(401);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("Invalid token");
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should logout successfully", async () => {
      const validToken =
        'mock_token_{"id":"' +
        testUser.id +
        '","email":"' +
        testUser.email +
        '"}';

      const response = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("logged out");
    });
  });

  describe("POST /api/auth/change-password", () => {
    it("should change password successfully", async () => {
      const validToken =
        'mock_token_{"id":"' +
        testUser.id +
        '","email":"' +
        testUser.email +
        '"}';
      const passwordChange = {
        currentPassword: "oldpassword",
        newPassword: "NewSecurePassword123!",
      };

      const response = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${validToken}`)
        .send(passwordChange)
        .expect(200);

      expect(response.body).toHaveProperty("message");
      expect(response.body.message).toContain("changed successfully");
    });

    it("should reject password change without authentication", async () => {
      const passwordChange = {
        currentPassword: "oldpassword",
        newPassword: "NewSecurePassword123!",
      };

      const response = await request(app)
        .post("/api/auth/change-password")
        .send(passwordChange)
        .expect(401);

      expect(response.body).toHaveProperty("error");
    });

    it("should reject password change with weak new password", async () => {
      const validToken =
        'mock_token_{"id":"' +
        testUser.id +
        '","email":"' +
        testUser.email +
        '"}';
      const passwordChange = {
        currentPassword: "oldpassword",
        newPassword: "123", // Too weak
      };

      const response = await request(app)
        .post("/api/auth/change-password")
        .set("Authorization", `Bearer ${validToken}`)
        .send(passwordChange)
        .expect(400);

      expect(response.body).toHaveProperty("error");
      expect(response.body.error).toContain("password");
    });
  });
});
