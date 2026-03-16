// AI-META-BEGIN
// AI-META: Comprehensive audit logging for security compliance
// OWNERSHIP: server/security
// ENTRYPOINTS: server/routes.ts, server/index.ts
// DEPENDENCIES: crypto, drizzle-orm, @shared/schema
// DANGER: Audit logs required for compliance; ensure sensitive data redacted
// CHANGE-SAFETY: Safe to add event types; never remove existing types
// TESTS: server/audit.test.ts
// AI-META-END

// Comprehensive audit logging system for security compliance
// Tracks all security-relevant events for SOC2, HIPAA, PCI DSS compliance

import { createHash } from "crypto";
import type { Request, Response } from "express";
import { forwardAuditEvent } from "./siem";

/**
 * Audit event types for categorization
 */
export enum AuditEventType {
  // Authentication events
  AUTH_LOGIN_SUCCESS = "AUTH_LOGIN_SUCCESS",
  AUTH_LOGIN_FAILURE = "AUTH_LOGIN_FAILURE",
  AUTH_LOGOUT = "AUTH_LOGOUT",
  AUTH_REGISTER_SUCCESS = "AUTH_REGISTER_SUCCESS",
  AUTH_REGISTER_FAILURE = "AUTH_REGISTER_FAILURE",
  AUTH_TOKEN_REFRESH = "AUTH_TOKEN_REFRESH",
  AUTH_PASSWORD_CHANGE = "AUTH_PASSWORD_CHANGE",
  AUTH_PASSWORD_RESET = "AUTH_PASSWORD_RESET",

  // Data access events
  DATA_PHOTO_ACCESS = "DATA_PHOTO_ACCESS",
  DATA_PHOTO_CREATE = "DATA_PHOTO_CREATE",
  DATA_PHOTO_UPDATE = "DATA_PHOTO_UPDATE",
  DATA_PHOTO_DELETE = "DATA_PHOTO_DELETE",
  DATA_ALBUM_ACCESS = "DATA_ALBUM_ACCESS",
  DATA_ALBUM_CREATE = "DATA_ALBUM_CREATE",
  DATA_ALBUM_UPDATE = "DATA_ALBUM_UPDATE",
  DATA_ALBUM_DELETE = "DATA_ALBUM_DELETE",
  DATA_METADATA_ACCESS = "DATA_METADATA_ACCESS",
  DATA_METADATA_UPDATE = "DATA_METADATA_UPDATE",

  // Security events
  SECURITY_RATE_LIMIT_EXCEEDED = "SECURITY_RATE_LIMIT_EXCEEDED",
  SECURITY_INVALID_TOKEN = "SECURITY_INVALID_TOKEN",
  SECURITY_UNAUTHORIZED_ACCESS = "SECURITY_UNAUTHORIZED_ACCESS",
  SECURITY_FORBIDDEN_ACCESS = "SECURITY_FORBIDDEN_ACCESS",
  SECURITY_SUSPICIOUS_ACTIVITY = "SECURITY_SUSPICIOUS_ACTIVITY",
  SECURITY_ENCRYPTION_ERROR = "SECURITY_ENCRYPTION_ERROR",
  SECURITY_DECRYPTION_ERROR = "SECURITY_DECRYPTION_ERROR",

  // System events
  SYSTEM_ERROR = "SYSTEM_ERROR",
  SYSTEM_STARTUP = "SYSTEM_STARTUP",
  SYSTEM_SHUTDOWN = "SYSTEM_SHUTDOWN",
  SYSTEM_CONFIG_CHANGE = "SYSTEM_CONFIG_CHANGE",

  // Admin events
  ADMIN_USER_CREATE = "ADMIN_USER_CREATE",
  ADMIN_USER_UPDATE = "ADMIN_USER_UPDATE",
  ADMIN_USER_DELETE = "ADMIN_USER_DELETE",
  ADMIN_PERMISSION_CHANGE = "ADMIN_PERMISSION_CHANGE",
  ADMIN_DATA_EXPORT = "ADMIN_DATA_EXPORT",
  ADMIN_SYSTEM_BACKUP = "ADMIN_SYSTEM_BACKUP",
}

/**
 * Audit event severity levels
 */
export enum AuditSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

/**
 * Audit event interface
 */
export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  resource?: string;
  action?: string;
  outcome: "SUCCESS" | "FAILURE" | "ERROR";
  details?: Record<string, unknown>;
  errorMessage?: string;
  requestId?: string;
}

/**
 * Audit logger configuration
 */
interface AuditConfig {
  enableConsole: boolean;
  enableFile: boolean;
  enableDatabase: boolean;
  logLevel: AuditSeverity;
  retentionDays: number;
  sensitiveFields: string[];
}

/**
 * Default audit configuration
 */
const DEFAULT_CONFIG: AuditConfig = {
  enableConsole: true,
  enableFile: true,
  enableDatabase: false, // Can be enabled when database is available
  logLevel: AuditSeverity.LOW,
  retentionDays: 90,
  sensitiveFields: [
    "password",
    "token",
    "authorization",
    "cookie",
    "secret",
    "key",
    "creditCard",
    "ssn",
    "apiKey",
  ],
};

/**
 * Audit logger class
 */
class AuditLogger {
  private config: AuditConfig;
  private events: AuditEvent[] = []; // In-memory storage (replace with database in production)

  constructor(config: Partial<AuditConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return createHash("sha256")
      .update(`${Date.now()}-${Math.random()}`)
      .digest("hex")
      .substring(0, 16);
  }

  /**
   * Sanitize sensitive data from event details
   */
  private sanitizeDetails(
    details: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!details) return details;

    const sanitized = { ...details };

    // Always redact common sensitive fields for testing
    if ("password" in sanitized) {
      sanitized.password = "***REDACTED***";
    }
    if ("token" in sanitized) {
      sanitized.token = "***REDACTED***";
    }
    if ("apiKey" in sanitized) {
      sanitized.apiKey = "***REDACTED***";
    }

    for (const field of this.config.sensitiveFields) {
      // Check both exact match and case-insensitive match
      if (field in sanitized) {
        sanitized[field] = "***REDACTED***";
      } else {
        // Check for case-insensitive match
        const lowerField = field.toLowerCase();
        for (const key in sanitized) {
          if (key.toLowerCase() === lowerField) {
            sanitized[key] = "***REDACTED***";
          }
        }
      }
    }

    return sanitized;
  }

  /**
   * Determine severity based on event type
   */
  private getSeverity(eventType: AuditEventType): AuditSeverity {
    switch (eventType) {
      case AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED:
      case AuditEventType.SECURITY_SUSPICIOUS_ACTIVITY:
      case AuditEventType.SECURITY_ENCRYPTION_ERROR:
      case AuditEventType.SECURITY_DECRYPTION_ERROR:
        return AuditSeverity.HIGH;

      case AuditEventType.SECURITY_UNAUTHORIZED_ACCESS:
      case AuditEventType.SECURITY_FORBIDDEN_ACCESS:
      case AuditEventType.SECURITY_INVALID_TOKEN:
      case AuditEventType.SYSTEM_ERROR:
        return AuditSeverity.MEDIUM;

      case AuditEventType.ADMIN_USER_DELETE:
      case AuditEventType.ADMIN_DATA_EXPORT:
      case AuditEventType.ADMIN_SYSTEM_BACKUP:
        return AuditSeverity.HIGH;

      default:
        return AuditSeverity.LOW;
    }
  }

  /**
   * Extract client information from request
   */
  private extractClientInfo(req: Request): {
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
  } {
    return {
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent"),
      sessionId: (req as { session?: { id?: string } }).session?.id,
    };
  }

  /**
   * Log an audit event
   */
  public logEvent(
    event: Omit<AuditEvent, "id" | "timestamp" | "severity">,
  ): void {
    const auditEvent: AuditEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      ...event,
      severity: this.getSeverity(event.eventType),
      details: event.details ? this.sanitizeDetails(event.details) : undefined,
    };

    // Store event (in production, this would go to a database)
    this.events.push(auditEvent);

    // Log to console if enabled
    if (this.config.enableConsole) {
      this.logToConsole(auditEvent);
    }

    // Log to file if enabled
    if (this.config.enableFile) {
      this.logToFile(auditEvent);
    }

    void forwardAuditEvent(auditEvent);
  }

  /**
   * Log event to console
   */
  private logToConsole(event: AuditEvent): void {
    const logLevel = this.getLogLevel(event.severity);
    const message = `[AUDIT] ${event.timestamp.toISOString()} ${event.eventType} ${event.outcome}`;

    const logData = {
      id: event.id,
      userId: event.userId,
      ipAddress: event.ipAddress,
      resource: event.resource,
      action: event.action,
      details: event.details,
      errorMessage: event.errorMessage,
      requestId: event.requestId,
    };

    console[logLevel](message, logData);
  }

  /**
   * Log event to file (simplified for demo)
   */
  private logToFile(event: AuditEvent): void {
    // In production, this would write to a secure log file
    // For now, we'll just add to console with file marker
    console.log(`[FILE_LOG] ${JSON.stringify(event)}`);
  }

  /**
   * Get appropriate console log level
   */
  private getLogLevel(severity: AuditSeverity): "log" | "warn" | "error" {
    switch (severity) {
      case AuditSeverity.CRITICAL:
      case AuditSeverity.HIGH:
        return "error";
      case AuditSeverity.MEDIUM:
        return "warn";
      default:
        return "log";
    }
  }

  /**
   * Create audit middleware for Express
   */
  public middleware() {
    return (req: Request, res: Response, next: () => void) => {
      const startTime = Date.now();
      const clientInfo = this.extractClientInfo(req);

      // Store audit info on request for use in route handlers
      (req as any).audit = {
        logEvent: (
          eventType: AuditEventType,
          details?: Record<string, unknown>,
        ) => {
          this.logEvent({
            eventType,
            userId: (req as any).user?.id,
            sessionId: clientInfo.sessionId,
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
            resource: req.path,
            action: req.method,
            outcome: res.statusCode < 400 ? "SUCCESS" : "FAILURE",
            details,
            requestId: (req as any).requestId,
          });
        },
        clientInfo,
        startTime,
        logged: false, // Prevent duplicate logging
      };

      // Log request completion
      res.on("finish", () => {
        const audit = (req as any).audit;

        if (audit && !audit.logged) {
          const duration = Date.now() - startTime;

          this.logEvent({
            eventType: this.getEventTypeFromRequest(req, res),
            userId: (req as any).user?.id,
            sessionId: clientInfo.sessionId,
            ipAddress: clientInfo.ipAddress,
            userAgent: clientInfo.userAgent,
            resource: req.path,
            action: req.method,
            outcome: res.statusCode < 400 ? "SUCCESS" : "FAILURE",
            details: {
              statusCode: res.statusCode,
              duration: `${duration}ms`,
              contentLength: res.get("Content-Length"),
            },
            requestId: (req as any).requestId,
          });

          audit.logged = true;
        }
      });

      next();
    };
  }

  /**
   * Determine event type from HTTP request
   */
  private getEventTypeFromRequest(req: Request, res: Response): AuditEventType {
    const path = req.path;
    const method = req.method;
    const statusCode = res.statusCode;

    // Authentication events
    if (path.includes("/auth/login")) {
      return statusCode === 200
        ? AuditEventType.AUTH_LOGIN_SUCCESS
        : AuditEventType.AUTH_LOGIN_FAILURE;
    }

    if (path.includes("/auth/register")) {
      return statusCode === 201
        ? AuditEventType.AUTH_REGISTER_SUCCESS
        : AuditEventType.AUTH_REGISTER_FAILURE;
    }

    if (path.includes("/auth/refresh")) {
      return AuditEventType.AUTH_TOKEN_REFRESH;
    }

    // Data access events
    if (path.includes("/photos")) {
      if (method === "GET") return AuditEventType.DATA_PHOTO_ACCESS;
      if (method === "POST") return AuditEventType.DATA_PHOTO_CREATE;
      if (method === "PUT") return AuditEventType.DATA_PHOTO_UPDATE;
      if (method === "DELETE") return AuditEventType.DATA_PHOTO_DELETE;
    }

    if (path.includes("/albums")) {
      if (method === "GET") return AuditEventType.DATA_ALBUM_ACCESS;
      if (method === "POST") return AuditEventType.DATA_ALBUM_CREATE;
      if (method === "PUT") return AuditEventType.DATA_ALBUM_UPDATE;
      if (method === "DELETE") return AuditEventType.DATA_ALBUM_DELETE;
    }

    // Security events
    if (statusCode === 401) return AuditEventType.SECURITY_UNAUTHORIZED_ACCESS;
    if (statusCode === 403) return AuditEventType.SECURITY_FORBIDDEN_ACCESS;
    if (statusCode === 429) return AuditEventType.SECURITY_RATE_LIMIT_EXCEEDED;

    return AuditEventType.SYSTEM_ERROR; // Default for unknown requests
  }

  /**
   * Get audit events with filtering
   */
  public getEvents(filter?: {
    userId?: string;
    eventType?: AuditEventType;
    severity?: AuditSeverity;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
  }): AuditEvent[] {
    let events = [...this.events];

    if (filter) {
      if (filter.userId) {
        events = events.filter((e) => e.userId === filter.userId);
      }
      if (filter.eventType) {
        events = events.filter((e) => e.eventType === filter.eventType);
      }
      if (filter.severity) {
        events = events.filter((e) => e.severity === filter.severity);
      }
      if (filter.startDate) {
        events = events.filter((e) => e.timestamp >= filter.startDate!);
      }
      if (filter.endDate) {
        events = events.filter((e) => e.timestamp <= filter.endDate!);
      }
      if (filter.limit) {
        events = events.slice(0, filter.limit);
      }
    }

    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get security events for monitoring
   */
  public getSecurityEvents(hours: number = 24): AuditEvent[] {
    const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.getEvents({
      startDate,
      eventType: undefined, // Will be filtered by security event types
    }).filter(
      (event) =>
        event.eventType.toString().startsWith("SECURITY_") ||
        event.severity === AuditSeverity.HIGH ||
        event.severity === AuditSeverity.CRITICAL,
    );
  }

  /**
   * Clean up old events based on retention policy
   */
  public cleanup(): void {
    const cutoffDate = new Date(
      Date.now() - this.config.retentionDays * 24 * 60 * 60 * 1000,
    );
    this.events = this.events.filter((event) => event.timestamp >= cutoffDate);
  }
}

// Create and export the audit logger instance
export const auditLogger = new AuditLogger();

// Export convenience functions
export const logAuthEvent = (
  eventType: AuditEventType,
  userId: string,
  details?: Record<string, unknown>,
) => {
  auditLogger.logEvent({
    eventType,
    userId,
    outcome: "SUCCESS",
    details,
  });
};

export const logSecurityEvent = (
  eventType: AuditEventType,
  details: Record<string, unknown>,
  userId?: string,
) => {
  auditLogger.logEvent({
    eventType,
    userId,
    outcome: "FAILURE",
    details,
  });
};

export const logDataEvent = (
  eventType: AuditEventType,
  userId: string,
  resource: string,
  action: string,
  details?: Record<string, unknown>,
) => {
  auditLogger.logEvent({
    eventType,
    userId,
    resource,
    action,
    outcome: "SUCCESS",
    details,
  });
};
