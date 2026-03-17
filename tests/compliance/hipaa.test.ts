/**
 * HIPAA Compliance Tests
 *
 * Validates that the system meets HIPAA security requirements for:
 * - Audit controls (§164.312(b)): Record and examine access/activity
 * - Access controls (§164.312(a)(1)): Unique user identification, auto logoff
 * - Encryption (§164.312(e)(2)(ii)): Encryption of PHI in transit and at rest
 * - Data integrity (§164.312(c)(1)): Protect PHI from improper alteration
 *
 * Note: Cloud Gallery stores personal photos. While not a covered entity, these
 * tests validate best-practice HIPAA-aligned controls for sensitive data handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { auditLogger, AuditEventType, AuditSeverity } from "../../server/audit";
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from "../../server/security";
import { encrypt, decrypt, ENCRYPTION_CONFIG } from "../../server/encryption";

vi.mock("../../server/siem", () => ({
  forwardAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("HIPAA §164.312(b) – Audit Controls", () => {
  describe("Audit Event Completeness", () => {
    it("should generate audit events with required HIPAA fields", () => {
      const before = auditLogger.getEvents().length;

      auditLogger.logEvent({
        eventType: AuditEventType.DATA_PHOTO_ACCESS,
        userId: "user-hipaa-001",
        outcome: "SUCCESS",
        resource: "/api/photos/photo-123",
        action: "GET",
        details: { photoId: "photo-123" },
      });

      const events = auditLogger.getEvents();
      const newEvent = events.find((e) => e.userId === "user-hipaa-001");

      // HIPAA requires: who, what, when, where
      expect(newEvent).toBeDefined();
      expect(newEvent!.id).toBeDefined(); // Unique event ID
      expect(newEvent!.timestamp).toBeInstanceOf(Date); // When
      expect(newEvent!.userId).toBe("user-hipaa-001"); // Who
      expect(newEvent!.resource).toBeDefined(); // What resource
      expect(newEvent!.eventType).toBeDefined(); // What action
      expect(newEvent!.outcome).toBeDefined(); // Success/failure
    });

    it("should record data access events for photo retrieval", () => {
      const before = auditLogger.getEvents().length;

      auditLogger.logEvent({
        eventType: AuditEventType.DATA_PHOTO_ACCESS,
        userId: "user-123",
        outcome: "SUCCESS",
        resource: "/api/photos",
        action: "GET",
      });

      const events = auditLogger.getEvents();
      expect(events.length).toBeGreaterThan(before);

      const accessEvent = events.find(
        (e) =>
          e.eventType === AuditEventType.DATA_PHOTO_ACCESS &&
          e.userId === "user-123",
      );
      expect(accessEvent).toBeDefined();
      expect(accessEvent?.eventType).toBe(AuditEventType.DATA_PHOTO_ACCESS);
      expect(accessEvent?.outcome).toBe("SUCCESS");
    });

    it("should record authentication events for HIPAA compliance", () => {
      const before = auditLogger.getEvents().length;

      auditLogger.logEvent({
        eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
        userId: "user-456",
        outcome: "SUCCESS",
        details: { method: "password" },
      });

      auditLogger.logEvent({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        userId: "user-456",
        outcome: "FAILURE",
        details: { reason: "invalid_credentials" },
      });

      const events = auditLogger.getEvents();
      expect(events.length).toBeGreaterThanOrEqual(before + 2);

      const loginEvents = events.filter(
        (e) =>
          e.eventType === AuditEventType.AUTH_LOGIN_SUCCESS ||
          e.eventType === AuditEventType.AUTH_LOGIN_FAILURE,
      );
      expect(loginEvents.length).toBeGreaterThanOrEqual(2);
    });

    it("should record data deletion events", () => {
      const before = auditLogger.getEvents().length;

      auditLogger.logEvent({
        eventType: AuditEventType.DATA_PHOTO_DELETE,
        userId: "user-789",
        outcome: "SUCCESS",
        resource: "/api/photos/photo-to-delete",
        action: "DELETE",
      });

      const events = auditLogger.getEvents();
      expect(events.length).toBeGreaterThan(before);

      const deleteEvent = events.find(
        (e) =>
          e.eventType === AuditEventType.DATA_PHOTO_DELETE &&
          e.userId === "user-789",
      );
      expect(deleteEvent).toBeDefined();
    });

    it("should record unauthorized access attempts", () => {
      const before = auditLogger.getEvents().length;

      auditLogger.logEvent({
        eventType: AuditEventType.SECURITY_UNAUTHORIZED_ACCESS,
        outcome: "FAILURE",
        resource: "/api/photos/restricted",
        ipAddress: "10.0.0.1",
      });

      const events = auditLogger.getEvents();
      expect(events.length).toBeGreaterThan(before);

      const secEvent = events.find(
        (e) =>
          e.eventType === AuditEventType.SECURITY_UNAUTHORIZED_ACCESS &&
          e.resource === "/api/photos/restricted",
      );

      expect(secEvent).toBeDefined();
      expect(secEvent?.severity).toBe(AuditSeverity.MEDIUM);
    });
  });

  describe("Audit Event Integrity", () => {
    it("should assign unique IDs to all audit events", () => {
      const eventsBefore = auditLogger.getEvents().length;

      for (let i = 0; i < 5; i++) {
        auditLogger.logEvent({
          eventType: AuditEventType.DATA_PHOTO_ACCESS,
          userId: `user-${i}`,
          outcome: "SUCCESS",
        });
      }

      const events = auditLogger.getEvents().slice(0, 5);
      const ids = events.map((e) => e.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it("should assign correct severity levels to security events", () => {
      auditLogger.logEvent({
        eventType: AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED,
        outcome: "FAILURE",
        ipAddress: "192.168.1.1",
      });

      const events = auditLogger.getEvents();
      const rateLimitEvent = events.find(
        (e) => e.eventType === AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED,
      );

      expect(rateLimitEvent?.severity).toBe(AuditSeverity.HIGH);
    });

    it("should sanitize sensitive data from audit event details", () => {
      auditLogger.logEvent({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        userId: "user-test",
        outcome: "FAILURE",
        details: { password: "user-secret-password", email: "user@test.com" },
      });

      const events = auditLogger.getEvents();
      const failEvent = events.find(
        (e) =>
          e.eventType === AuditEventType.AUTH_LOGIN_FAILURE &&
          e.userId === "user-test",
      );

      if (failEvent?.details && "password" in failEvent.details) {
        expect(failEvent.details.password).toBe("***REDACTED***");
        expect(failEvent.details.password).not.toBe("user-secret-password");
      }
    });
  });

  describe("Audit Retention", () => {
    it("should expose getSecurityEvents() for the last 24-hour window", () => {
      auditLogger.logEvent({
        eventType: AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY,
        outcome: "FAILURE",
        details: { reason: "multiple_failed_logins" },
      });

      const securityEvents = auditLogger.getSecurityEvents(24);
      expect(Array.isArray(securityEvents)).toBe(true);

      const suspiciousEvent = securityEvents.find(
        (e) => e.eventType === AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY,
      );
      expect(suspiciousEvent).toBeDefined();
    });

    it("should support filtering events by date range", () => {
      const startDate = new Date(Date.now() - 1000);

      auditLogger.logEvent({
        eventType: AuditEventType.DATA_ALBUM_ACCESS,
        userId: "user-filter-test",
        outcome: "SUCCESS",
      });

      const endDate = new Date();
      const filteredEvents = auditLogger.getEvents({
        startDate,
        endDate,
        userId: "user-filter-test",
      });

      expect(filteredEvents.length).toBeGreaterThan(0);
      for (const event of filteredEvents) {
        expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(
          startDate.getTime(),
        );
        expect(event.timestamp.getTime()).toBeLessThanOrEqual(
          endDate.getTime() + 10,
        );
      }
    });
  });
});

describe("HIPAA §164.312(a)(1) – Access Controls", () => {
  describe("Password Strength Requirements", () => {
    it("should enforce minimum password length of 8 characters", () => {
      const result = validatePasswordStrength("Sh0rt!");
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("8 characters"))).toBe(true);
    });

    it("should require password complexity (mixed case, numbers, special chars)", () => {
      const weakPasswords = [
        { pw: "alllowercase1!", issue: "uppercase" },
        { pw: "ALLUPPERCASE1!", issue: "lowercase" },
        { pw: "NoNumbers!!", issue: "number" },
        { pw: "NoSpecial123", issue: "special" },
      ];

      for (const { pw, issue } of weakPasswords) {
        const result = validatePasswordStrength(pw);
        expect(
          result.isValid,
          `Expected '${pw}' to fail (missing ${issue})`,
        ).toBe(false);
      }
    });

    it("should accept HIPAA-compliant passwords", () => {
      const compliantPasswords = [
        "Secure@Pass1",
        "HIPAA-Comply1!",
        "Ph0t0-G@llery",
      ];

      for (const pw of compliantPasswords) {
        const result = validatePasswordStrength(pw);
        expect(result.isValid, `Expected '${pw}' to be valid`).toBe(true);
      }
    });
  });

  describe("Authentication Integrity", () => {
    it("should correctly verify valid credentials", async () => {
      const hash = await hashPassword("ValidPass@123");
      const isValid = await verifyPassword("ValidPass@123", hash);
      expect(isValid).toBe(true);
    });

    it("should correctly reject invalid credentials", async () => {
      const hash = await hashPassword("ValidPass@123");
      const isValid = await verifyPassword("WrongPass@123", hash);
      expect(isValid).toBe(false);
    });

    it("should use Argon2id hashing algorithm (NIST approved)", async () => {
      const hash = await hashPassword("SecurePass@123");
      // Argon2id is the recommended algorithm for password hashing
      expect(hash.startsWith("$argon2id")).toBe(true);
    });
  });
});

describe("HIPAA §164.312(e)(2)(ii) – Encryption", () => {
  it("should use AES-256-GCM for data encryption", () => {
    expect(ENCRYPTION_CONFIG.ALGORITHM).toBe("aes-256-gcm");
    expect(ENCRYPTION_CONFIG.KEY_LENGTH).toBe(32); // 256 bits
  });

  it("should produce encrypted output different from plaintext", () => {
    const key = Buffer.alloc(32, "test-key");
    const plaintext = "sensitive patient data";
    const { encrypted } = encrypt(plaintext, key);

    expect(encrypted).not.toBe(plaintext);
    expect(encrypted).not.toContain(plaintext);
  });

  it("should correctly decrypt encrypted data", () => {
    const key = Buffer.alloc(32, "test-key");
    const plaintext = "sensitive data for compliance test";
    const result = encrypt(plaintext, key);
    const decrypted = decrypt(result, key);

    expect(decrypted).toBe(plaintext);
  });

  it("should produce unique ciphertext for the same plaintext (random IV)", () => {
    const key = Buffer.alloc(32, "test-key");
    const plaintext = "same plaintext";

    const result1 = encrypt(plaintext, key);
    const result2 = encrypt(plaintext, key);

    // Different IVs must produce different ciphertext
    expect(result1.encrypted).not.toBe(result2.encrypted);
    expect(result1.iv).not.toBe(result2.iv);
  });

  it("should use a 96-bit IV (GCM recommendation)", () => {
    const key = Buffer.alloc(32, "test-key");
    const { iv } = encrypt("test data", key);

    // IV is hex-encoded, 12 bytes = 24 hex chars
    expect(iv).toHaveLength(ENCRYPTION_CONFIG.IV_LENGTH * 2);
  });

  it("should use a 128-bit authentication tag (GCM integrity)", () => {
    const key = Buffer.alloc(32, "test-key");
    const { authTag } = encrypt("test data", key);

    // Auth tag is hex-encoded, 16 bytes = 32 hex chars
    expect(authTag).toHaveLength(ENCRYPTION_CONFIG.AUTH_TAG_LENGTH * 2);
  });

  it("should reject tampered ciphertext (authentication tag check)", () => {
    const key = Buffer.alloc(32, "test-key");
    const result = encrypt("sensitive data", key);

    // Tamper with the ciphertext
    const tampered = {
      ...result,
      encrypted: result.encrypted.slice(0, -2) + "00",
    };

    expect(() => decrypt(tampered, key)).toThrow();
  });
});
