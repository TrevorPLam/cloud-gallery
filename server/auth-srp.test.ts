// SRP Authentication Integration Tests
// Tests for Secure Remote Password protocol implementation

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../index";
import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { 
  createVerifierAndSalt, 
  SRPClientSession, 
  SRPParameters, 
  SRPRoutines,
  SRPServerSession 
} from "tssrp6a";

describe("SRP Authentication", () => {
  const testEmail = "srp-test@example.com";
  const testPassword = "TestPassword123!";
  let userId: string;
  let srpSalt: string;
  let srpVerifier: string;

  beforeEach(async () => {
    // Clean up any existing test user
    await db.delete(users).where(eq(users.username, testEmail));

    // Generate SRP verifier and salt for testing
    const srp6aRoutines = new SRPRoutines(new SRPParameters());
    const { s: salt, v: verifier } = await createVerifierAndSalt(
      srp6aRoutines,
      testEmail,
      testPassword,
    );
    srpSalt = salt;
    srpVerifier = verifier;
  });

  afterEach(async () => {
    // Clean up test user
    await db.delete(users).where(eq(users.username, testEmail));
  });

  describe("SRP Registration", () => {
    it("should register a new user with SRP", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: testEmail,
          srpSalt,
          srpVerifier,
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("User registered successfully");
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();

      // Verify user was stored with SRP fields
      const storedUser = await db
        .select()
        .from(users)
        .where(eq(users.username, testEmail))
        .limit(1);

      expect(storedUser[0]).toBeDefined();
      expect(storedUser[0].srpSalt).toBe(srpSalt);
      expect(storedUser[0].srpVerifier).toBe(srpVerifier);
      expect(storedUser[0].password).toBeNull(); // Should be null for SRP users
      userId = storedUser[0].id;
    });

    it("should reject registration with missing SRP fields", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: testEmail,
          // Missing srpSalt and srpVerifier
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Validation error");
    });

    it("should reject registration with partial SRP fields", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: testEmail,
          srpSalt,
          // Missing srpVerifier
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain("Validation error");
    });

    it("should reject duplicate SRP registration", async () => {
      // First registration
      await request(app)
        .post("/api/auth/register")
        .send({
          email: testEmail,
          srpSalt,
          srpVerifier,
        });

      // Second registration with same email
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: testEmail,
          srpSalt: "different_salt",
          srpVerifier: "different_verifier",
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe("User already exists");
    });
  });

  describe("SRP Login Challenge", () => {
    beforeEach(async () => {
      // Create a test user with SRP
      const [user] = await db
        .insert(users)
        .values({
          username: testEmail,
          srpSalt,
          srpVerifier,
        })
        .returning();
      userId = user.id;
    });

    it("should generate SRP challenge for existing user", async () => {
      const response = await request(app)
        .post("/api/auth/login/challenge")
        .send({
          email: testEmail,
        });

      expect(response.status).toBe(200);
      expect(response.body.sessionId).toBeDefined();
      expect(response.body.salt).toBe(srpSalt);
      expect(response.body.B).toBeDefined();
      expect(response.body.B).toMatch(/^[0-9a-f]+$/i); // Should be hex string
    });

    it("should reject challenge for non-existent user", async () => {
      const response = await request(app)
        .post("/api/auth/login/challenge")
        .send({
          email: "nonexistent@example.com",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid credentials");
    });

    it("should reject challenge for user without SRP setup", async () => {
      // Create user without SRP fields
      await db.insert(users).values({
        username: "nosrp@example.com",
        password: "hashed_password",
      });

      const response = await request(app)
        .post("/api/auth/login/challenge")
        .send({
          email: "nosrp@example.com",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid credentials");
    });

    it("should reject challenge without email", async () => {
      const response = await request(app)
        .post("/api/auth/login/challenge")
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Email required");
    });
  });

  describe("SRP Login Verify", () => {
    let sessionId: string;
    let clientA: string;
    let clientM1: string;

    beforeEach(async () => {
      // Create a test user with SRP
      const [user] = await db
        .insert(users)
        .values({
          username: testEmail,
          srpSalt,
          srpVerifier,
        })
        .returning();
      userId = user.id;

      // Generate challenge first
      const challengeResponse = await request(app)
        .post("/api/auth/login/challenge")
        .send({ email: testEmail });

      sessionId = challengeResponse.body.sessionId;
      const serverB = challengeResponse.body.B;

      // Generate client proof
      const srp6aRoutines = new SRPRoutines(new SRPParameters());
      const clientSession = new SRPClientSession(srp6aRoutines);
      await clientSession.step1(testEmail, testPassword);
      const { A, M1 } = await clientSession.step2(srpSalt, serverB);
      clientA = A;
      clientM1 = M1;
    });

    it("should verify SRP login and return tokens", async () => {
      const response = await request(app)
        .post("/api/auth/login/verify")
        .send({
          sessionId,
          A: clientA,
          M1: clientM1,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Login successful");
      expect(response.body.user.email).toBe(testEmail);
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
      expect(response.body.M2).toBeDefined();
      expect(response.body.M2).toMatch(/^[0-9a-f]+$/i); // Should be hex string
    });

    it("should reject verification with invalid session ID", async () => {
      const response = await request(app)
        .post("/api/auth/login/verify")
        .send({
          sessionId: "invalid_session_id",
          A: clientA,
          M1: clientM1,
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Invalid or expired session");
    });

    it("should reject verification with missing fields", async () => {
      const response = await request(app)
        .post("/api/auth/login/verify")
        .send({
          sessionId,
          A: clientA,
          // Missing M1
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe("Missing required fields");
    });

    it("should reject verification with invalid client proof", async () => {
      const response = await request(app)
        .post("/api/auth/login/verify")
        .send({
          sessionId,
          A: clientA,
          M1: "invalid_proof",
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe("Authentication failed");
    });
  });

  describe("Complete SRP Flow", () => {
    it("should complete full SRP registration and login flow", async () => {
      // Step 1: Register with SRP
      const registerResponse = await request(app)
        .post("/api/auth/register")
        .send({
          email: testEmail,
          srpSalt,
          srpVerifier,
        });

      expect(registerResponse.status).toBe(201);
      expect(registerResponse.body.tokens.accessToken).toBeDefined();

      // Step 2: Login with SRP
      const challengeResponse = await request(app)
        .post("/api/auth/login/challenge")
        .send({ email: testEmail });

      expect(challengeResponse.status).toBe(200);
      expect(challengeResponse.body.sessionId).toBeDefined();

      // Step 3: Generate client proof
      const srp6aRoutines = new SRPRoutines(new SRPParameters());
      const clientSession = new SRPClientSession(srp6aRoutines);
      await clientSession.step1(testEmail, testPassword);
      const { A, M1 } = await clientSession.step2(srpSalt, challengeResponse.body.B);

      // Step 4: Verify login
      const verifyResponse = await request(app)
        .post("/api/auth/login/verify")
        .send({
          sessionId: challengeResponse.body.sessionId,
          A,
          M1,
        });

      expect(verifyResponse.status).toBe(200);
      expect(verifyResponse.body.tokens.accessToken).toBeDefined();
      expect(verifyResponse.body.M2).toBeDefined();

      // Step 5: Verify server proof (client-side verification)
      await clientSession.step3(verifyResponse.body.M2);

      // Flow completed successfully
      expect(true).toBe(true);
    });
  });

  describe("Security and Rate Limiting", () => {
    beforeEach(async () => {
      // Create a test user with SRP
      const [user] = await db
        .insert(users)
        .values({
          username: testEmail,
          srpSalt,
          srpVerifier,
        })
        .returning();
      userId = user.id;
    });

    it("should apply rate limiting to SRP challenge endpoint", async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post("/api/auth/login/challenge")
          .send({ email: testEmail })
      );

      const responses = await Promise.all(requests);
      
      // At least some requests should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(0);
      
      // Later requests should be rate limited
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    it("should apply rate limiting to SRP verify endpoint", async () => {
      // First get a valid session
      const challengeResponse = await request(app)
        .post("/api/auth/login/challenge")
        .send({ email: testEmail });

      const sessionId = challengeResponse.body.sessionId;

      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post("/api/auth/login/verify")
          .send({
            sessionId,
            A: "invalid_A",
            M1: "invalid_M1",
          })
      );

      const responses = await Promise.all(requests);
      
      // At least some requests should fail with authentication error
      const authFailCount = responses.filter(r => r.status === 401).length;
      expect(authFailCount).toBeGreaterThan(0);
      
      // Later requests should be rate limited
      const rateLimitedCount = responses.filter(r => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe("Backward Compatibility", () => {
    const legacyPassword = "LegacyPassword123!";
    let legacyUserId: string;

    beforeEach(async () => {
      // Create a user with traditional password (for backward compatibility testing)
      const { hashPassword } = await import("../security");
      const passwordHash = await hashPassword(legacyPassword);

      const [user] = await db
        .insert(users)
        .values({
          username: "legacy@example.com",
          password: passwordHash,
        })
        .returning();
      legacyUserId = user.id;
    });

    afterEach(async () => {
      // Clean up legacy user
      await db.delete(users).where(eq(users.username, "legacy@example.com"));
    });

    it("should still support traditional password registration", async () => {
      const response = await request(app)
        .post("/api/auth/register")
        .send({
          email: "newlegacy@example.com",
          password: "NewPassword123!",
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe("User registered successfully");

      // Clean up
      await db.delete(users).where(eq(users.username, "newlegacy@example.com"));
    });

    it("should still support traditional password login", async () => {
      const response = await request(app)
        .post("/api/auth/login")
        .send({
          email: "legacy@example.com",
          password: legacyPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe("Login successful");
      expect(response.body.tokens.accessToken).toBeDefined();
    });
  });
});
