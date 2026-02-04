// Tests for authentication routes

import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import authRoutes from "./auth-routes";

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

describe("Authentication Routes", () => {
  let app: express.Application;

  beforeEach(() => {
    // Clear the mock users array by re-importing the module
    vi.resetModules();
    app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
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

  describe("GET /api/auth/me", () => {
    it("should return user info with valid token", async () => {
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
