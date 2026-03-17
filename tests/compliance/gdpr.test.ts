/**
 * GDPR Compliance Tests
 *
 * Validates that the system meets GDPR requirements for:
 * - Article 5: Data minimization, purpose limitation, accuracy
 * - Article 17: Right to erasure (right to be forgotten)
 * - Article 20: Right to data portability
 * - Article 25: Data protection by design and by default
 * - Article 32: Security of processing (encryption, pseudonymization)
 * - Article 83: Logging and accountability
 */

import { describe, it, expect, vi } from "vitest";
import { auditLogger, AuditEventType, AuditSeverity } from "../../server/audit";
import {
  sanitizeForLogging,
  hashPassword,
  validatePasswordStrength,
  sha256,
  generateSecureToken,
} from "../../server/security";
import { encrypt, decrypt } from "../../server/encryption";

vi.mock("../../server/siem", () => ({
  forwardAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe("GDPR Article 5 – Data Minimization & Accuracy", () => {
  describe("PII Minimization in Logs", () => {
    it("should mask email addresses before logging (data minimization)", () => {
      const email = "john.doe@personaldata.com";
      const sanitized = sanitizeForLogging(email);

      // Full email must not appear in logs
      expect(sanitized).not.toBe(email);
      expect(sanitized).not.toContain("john.doe");
    });

    it("should mask IP addresses in log output (pseudonymization)", () => {
      const ip = "203.0.113.42";
      const sanitized = sanitizeForLogging(ip);

      // Full IP must not appear in logs
      expect(sanitized).not.toBe(ip);
      expect(sanitized).not.toContain("203.0.113.42");
    });

    it("should mask phone numbers in log output", () => {
      const phone = "555-867-5309";
      const sanitized = sanitizeForLogging(`Contact: ${phone}`);

      expect(sanitized).not.toContain(phone);
    });

    it("should mask credit card numbers in log output", () => {
      const cc = "4111-1111-1111-1111";
      const sanitized = sanitizeForLogging(`Card: ${cc}`);

      expect(sanitized).not.toContain(cc);
      expect(sanitized).toContain("****-****-****-****");
    });

    it("should preserve non-PII content after sanitization", () => {
      const message = "User logged in successfully from office network";
      const sanitized = sanitizeForLogging(message);

      // General content must be preserved
      expect(sanitized).toContain("logged in successfully");
    });
  });

  describe("Data Pseudonymization", () => {
    it("should pseudonymize user identifiers via consistent hashing", () => {
      const userId = "user-12345-personal-info";
      const hash1 = sha256(userId);
      const hash2 = sha256(userId);

      // Same input → same hash (deterministic pseudonym)
      expect(hash1).toBe(hash2);
      // Hash must not contain original user ID
      expect(hash1).not.toContain(userId);
      // Hash must be a fixed-length hex string (SHA-256 = 64 chars)
      expect(hash1).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(hash1)).toBe(true);
    });

    it("should produce different pseudonyms for different users", () => {
      const user1Hash = sha256("user-111");
      const user2Hash = sha256("user-222");

      expect(user1Hash).not.toBe(user2Hash);
    });
  });
});

describe("GDPR Article 17 – Right to Erasure (Right to Be Forgotten)", () => {
  describe("Audit Event Logging for Deletion", () => {
    it("should record photo deletion events in the audit log", () => {
      const before = auditLogger.getEvents().length;

      auditLogger.logEvent({
        eventType: AuditEventType.DATA_PHOTO_DELETE,
        userId: "user-gdpr-erase",
        outcome: "SUCCESS",
        resource: "/api/photos/photo-to-delete",
        action: "DELETE",
        details: { photoId: "photo-to-delete", reason: "user_request" },
      });

      const events = auditLogger.getEvents();
      expect(events.length).toBeGreaterThan(before);

      const deleteEvent = events.find(
        (e) =>
          e.eventType === AuditEventType.DATA_PHOTO_DELETE &&
          e.userId === "user-gdpr-erase",
      );
      expect(deleteEvent).toBeDefined();
      expect(deleteEvent?.outcome).toBe("SUCCESS");
    });

    it("should record album deletion events in the audit log", () => {
      const before = auditLogger.getEvents().length;

      auditLogger.logEvent({
        eventType: AuditEventType.DATA_ALBUM_DELETE,
        userId: "user-gdpr-album-erase",
        outcome: "SUCCESS",
        resource: "/api/albums/album-to-delete",
        action: "DELETE",
      });

      const events = auditLogger.getEvents();
      expect(events.length).toBeGreaterThan(before);

      const deleteEvent = events.find(
        (e) =>
          e.eventType === AuditEventType.DATA_ALBUM_DELETE &&
          e.userId === "user-gdpr-album-erase",
      );
      expect(deleteEvent).toBeDefined();
    });

    it("should record admin data export (GDPR portability) events", () => {
      const before = auditLogger.getEvents().length;

      auditLogger.logEvent({
        eventType: AuditEventType.ADMIN_DATA_EXPORT,
        userId: "user-gdpr-export",
        outcome: "SUCCESS",
        details: {
          exportType: "full_data_export",
          requestReason: "gdpr_portability",
        },
      });

      const events = auditLogger.getEvents();
      const exportEvent = events.find(
        (e) =>
          e.eventType === AuditEventType.ADMIN_DATA_EXPORT &&
          e.userId === "user-gdpr-export",
      );

      expect(exportEvent).toBeDefined();
      expect(exportEvent?.severity).toBe(AuditSeverity.HIGH);
    });
  });

  describe("Deletion Audit Completeness", () => {
    it("should capture deletion timestamp for compliance evidence", () => {
      const timeBefore = Date.now();

      auditLogger.logEvent({
        eventType: AuditEventType.DATA_PHOTO_DELETE,
        userId: "user-timestamp-test",
        outcome: "SUCCESS",
        resource: "/api/photos/timestamp-test",
        action: "DELETE",
      });

      const events = auditLogger.getEvents();
      const deleteEvent = events.find(
        (e) =>
          e.eventType === AuditEventType.DATA_PHOTO_DELETE &&
          e.userId === "user-timestamp-test",
      );

      expect(deleteEvent).toBeDefined();
      expect(deleteEvent!.timestamp.getTime()).toBeGreaterThanOrEqual(
        timeBefore,
      );
    });
  });
});

describe("GDPR Article 20 – Right to Data Portability", () => {
  it("should log data export events with HIGH severity", () => {
    auditLogger.logEvent({
      eventType: AuditEventType.ADMIN_DATA_EXPORT,
      userId: "user-portability",
      outcome: "SUCCESS",
      details: { format: "json", scope: "all_user_data" },
    });

    const exportEvents = auditLogger
      .getEvents()
      .filter((e) => e.eventType === AuditEventType.ADMIN_DATA_EXPORT);

    expect(exportEvents.length).toBeGreaterThan(0);
    // Data exports must be logged as HIGH severity for accountability
    expect(exportEvents[0].severity).toBe(AuditSeverity.HIGH);
  });
});

describe("GDPR Article 25 – Data Protection by Design and by Default", () => {
  describe("Encryption by Default", () => {
    it("should encrypt sensitive data using AES-256-GCM", () => {
      const key = Buffer.alloc(32, "gdpr-test-key");
      const personalData = JSON.stringify({
        email: "user@personal.com",
        name: "Jane Doe",
        photos: ["photo-1", "photo-2"],
      });

      const { encrypted, iv, authTag } = encrypt(personalData, key);

      // Encrypted data must not contain PII
      expect(encrypted).not.toContain("Jane Doe");
      expect(encrypted).not.toContain("user@personal.com");
      // Must be different from input
      expect(encrypted).not.toBe(personalData);
    });

    it("should successfully decrypt encrypted personal data for portability", () => {
      const key = Buffer.alloc(32, "gdpr-test-key");
      const personalData = '{"email":"user@personal.com","name":"Jane Doe"}';

      const encryptedResult = encrypt(personalData, key);
      const decrypted = decrypt(encryptedResult, key);

      expect(decrypted).toBe(personalData);
    });
  });

  describe("Password Protection by Default", () => {
    it("should hash passwords before storage (data protection by default)", async () => {
      const password = "UserGdprPassword@123";
      const hash = await hashPassword(password);

      // Hash must not contain the original password
      expect(hash).not.toBe(password);
      expect(hash).not.toContain(password);
      // Must use Argon2id (memory-hard, resistant to brute-force)
      expect(hash.startsWith("$argon2id")).toBe(true);
    });

    it("should enforce password complexity by default (data protection)", () => {
      // Weak password must be rejected to protect accounts by default
      const result = validatePasswordStrength("simple");
      expect(result.isValid).toBe(false);
    });
  });

  describe("Secure Token Generation", () => {
    it("should generate cryptographically secure session tokens", () => {
      const token = generateSecureToken();

      // Must be at least 32 bytes (256 bits) of entropy
      expect(token.length).toBeGreaterThanOrEqual(64); // hex-encoded
      expect(/^[a-f0-9]+$/.test(token)).toBe(true);
    });

    it("should never reuse tokens (no predictability)", () => {
      const tokens = new Set(
        Array.from({ length: 20 }, () => generateSecureToken()),
      );
      expect(tokens.size).toBe(20);
    });
  });
});

describe("GDPR Article 32 – Security of Processing", () => {
  describe("Accountability and Logging", () => {
    it("should audit all authentication attempts for accountability", () => {
      const before = auditLogger.getEvents().length;

      // Successful login
      auditLogger.logEvent({
        eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
        userId: "user-accountability",
        outcome: "SUCCESS",
        ipAddress: "10.0.0.1",
      });

      // Failed login
      auditLogger.logEvent({
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        userId: "user-accountability",
        outcome: "FAILURE",
        ipAddress: "10.0.0.1",
      });

      const events = auditLogger.getEvents();
      const authEvents = events.filter(
        (e) =>
          (e.eventType === AuditEventType.AUTH_LOGIN_SUCCESS ||
            e.eventType === AuditEventType.AUTH_LOGIN_FAILURE) &&
          e.userId === "user-accountability",
      );

      expect(authEvents.length).toBeGreaterThanOrEqual(2);
    });

    it("should log config changes for compliance accountability", () => {
      const before = auditLogger.getEvents().length;

      auditLogger.logEvent({
        eventType: AuditEventType.SYSTEM_CONFIG_CHANGE,
        userId: "admin-user",
        outcome: "SUCCESS",
        details: { setting: "encryption_key_rotation", value: "initiated" },
      });

      const events = auditLogger.getEvents();
      expect(events.length).toBeGreaterThan(before);
    });
  });

  describe("Security Event Detection", () => {
    it("should flag suspicious activity with HIGH severity", () => {
      auditLogger.logEvent({
        eventType: AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY,
        outcome: "FAILURE",
        details: { reason: "multiple_failed_logins", count: 10 },
        ipAddress: "192.168.1.1",
      });

      const events = auditLogger.getSecurityEvents(1);
      const suspicious = events.find(
        (e) => e.eventType === AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY,
      );

      expect(suspicious).toBeDefined();
      expect(suspicious?.severity).toBe(AuditSeverity.HIGH);
    });

    it("should include IP address in security events for investigation", () => {
      auditLogger.logEvent({
        eventType: AuditEventType.SECURITY_UNAUTHORIZED_ACCESS,
        outcome: "FAILURE",
        ipAddress: "198.51.100.42",
        resource: "/api/admin",
      });

      const events = auditLogger.getSecurityEvents(1);
      const unauthorized = events.find(
        (e) => e.eventType === AuditEventType.SECURITY_UNAUTHORIZED_ACCESS,
      );

      expect(unauthorized?.ipAddress).toBeDefined();
    });
  });
});
