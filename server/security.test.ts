// Tests for security utilities

import { describe, it, expect } from "vitest";
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  generateSessionToken,
  sha256,
  sanitizeForLogging,
  validatePasswordStrength,
  SECURITY_CONFIG,
} from "./security";

describe("Password Hashing", () => {
  it("should hash a password", async () => {
    const password = "TestPassword123!";
    const hash = await hashPassword(password);

    expect(hash).toBeTruthy();
    expect(hash).toContain(":"); // Should contain salt:hash format

    const parts = hash.split(":");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toHaveLength(SECURITY_CONFIG.SALT_LENGTH * 2); // Hex encoding doubles length
  });

  it("should produce different hashes for same password", async () => {
    const password = "TestPassword123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2); // Different salts should produce different hashes
  });

  it("should verify correct password", async () => {
    const password = "TestPassword123!";
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);

    expect(isValid).toBe(true);
  });

  it("should reject incorrect password", async () => {
    const password = "TestPassword123!";
    const wrongPassword = "WrongPassword123!";
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(wrongPassword, hash);

    expect(isValid).toBe(false);
  });

  it("should reject invalid hash format", async () => {
    const password = "TestPassword123!";
    const isValid = await verifyPassword(password, "invalid-hash");

    expect(isValid).toBe(false);
  });
});

describe("Token Generation", () => {
  it("should generate secure token", () => {
    const token = generateSecureToken();

    expect(token).toBeTruthy();
    expect(token).toHaveLength(SECURITY_CONFIG.TOKEN_LENGTH * 2); // Hex encoding
    expect(/^[a-f0-9]+$/.test(token)).toBe(true); // Should be valid hex
  });

  it("should generate unique tokens", () => {
    const token1 = generateSecureToken();
    const token2 = generateSecureToken();

    expect(token1).not.toBe(token2);
  });

  it("should generate token with custom length", () => {
    const length = 48;
    const token = generateSecureToken(length);

    expect(token).toHaveLength(length * 2);
  });

  it("should generate session token with expiry", () => {
    const session = generateSessionToken();

    expect(session.token).toBeTruthy();
    expect(session.expiresAt).toBeGreaterThan(Date.now());
    expect(session.expiresAt).toBeLessThan(
      Date.now() + SECURITY_CONFIG.ACCESS_TOKEN_TTL * 1000 + 1000,
    ); // Allow 1s tolerance
  });
});

describe("SHA-256 Hashing", () => {
  it("should hash data with SHA-256", () => {
    const data = "test-data";
    const hash = sha256(data);

    expect(hash).toBeTruthy();
    expect(hash).toHaveLength(64); // SHA-256 produces 256 bits = 64 hex chars
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  it("should produce consistent hash", () => {
    const data = "test-data";
    const hash1 = sha256(data);
    const hash2 = sha256(data);

    expect(hash1).toBe(hash2);
  });

  it("should produce different hash for different data", () => {
    const hash1 = sha256("data1");
    const hash2 = sha256("data2");

    expect(hash1).not.toBe(hash2);
  });
});

describe("Sanitization for Logging", () => {
  it("should sanitize email addresses", () => {
    const input = "User email: john.doe@example.com";
    const sanitized = sanitizeForLogging(input);

    expect(sanitized).toContain("j***@e***.com");
    expect(sanitized).not.toContain("john.doe");
  });

  it("should sanitize IP addresses", () => {
    const input = "Request from 192.168.1.100";
    const sanitized = sanitizeForLogging(input);

    expect(sanitized).toContain("192.168.***");
    expect(sanitized).not.toContain("192.168.1.100");
  });

  it("should sanitize credit card numbers", () => {
    const input = "Card: 4532-1234-5678-9010";
    const sanitized = sanitizeForLogging(input);

    expect(sanitized).toContain("****-****-****-****");
    expect(sanitized).not.toContain("4532");
  });

  it("should sanitize phone numbers", () => {
    const input = "Phone: 555-123-4567";
    const sanitized = sanitizeForLogging(input);

    expect(sanitized).toContain("***-***-****");
    expect(sanitized).not.toContain("555-123-4567");
  });

  it("should handle multiple sensitive data types", () => {
    const input = "User john@example.com from 10.0.0.1 called 555-1234";
    const sanitized = sanitizeForLogging(input);

    expect(sanitized).not.toContain("john@example.com");
    expect(sanitized).not.toContain("10.0.0.1");
    expect(sanitized).not.toContain("555-1234");
  });
});

describe("Password Strength Validation", () => {
  it("should accept strong password", () => {
    const result = validatePasswordStrength("StrongPass123!");

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should reject short password", () => {
    const result = validatePasswordStrength("Short1!");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Password must be at least 8 characters long",
    );
  });

  it("should reject password without lowercase", () => {
    const result = validatePasswordStrength("PASSWORD123!");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain at least one lowercase letter",
    );
  });

  it("should reject password without uppercase", () => {
    const result = validatePasswordStrength("password123!");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain at least one uppercase letter",
    );
  });

  it("should reject password without number", () => {
    const result = validatePasswordStrength("PasswordABC!");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain at least one number",
    );
  });

  it("should reject password without special character", () => {
    const result = validatePasswordStrength("Password123");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain at least one special character",
    );
  });

  it("should reject common weak passwords", () => {
    const result = validatePasswordStrength("password");

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("Password is too common");
  });

  it("should reject too long password", () => {
    const longPassword = "A".repeat(129) + "1!";
    const result = validatePasswordStrength(longPassword);

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(
      "Password must be at most 128 characters long",
    );
  });

  it("should provide all relevant errors", () => {
    const result = validatePasswordStrength("weak");

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});
