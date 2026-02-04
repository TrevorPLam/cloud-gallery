# Security Audit and Logging

**Status**: 🔴 Critical Gaps  
**Owner**: Security/Engineering Team  
**Last Updated**: 2024-01-10

## Overview

Comprehensive logging and audit trails enable security monitoring, incident detection, forensic investigation, and compliance. This document defines Cloud Gallery's logging strategy, PII handling, retention policies, and SIEM integration approach.

## Current Logging Analysis

### Server Request Logging

**Implementation**: `/server/index.ts:80-111`

```typescript
function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}
```

**Security Assessment**:

🔴 **Critical Issues**:
1. **PII Exposure** - Line 99: Logs full JSON response which may contain emails, names, tokens
2. **No structured logging** - Plain string concatenation prevents parsing
3. **Truncation without context** - Line 102-104: Truncates at 80 chars, may hide critical data
4. **No correlation IDs** - Cannot trace requests across services
5. **No security event categorization** - Auth failures, authorization, data access not distinguished
6. **No log levels** - Everything logged at same priority
7. **No request body logging** - POST/PUT data not captured
8. **No user context** - No user ID or session ID tracking

⚠️ **Medium Issues**:
1. **Performance impact** - Monkey-patching res.json adds overhead
2. **No log rotation** - Console.log may fill disk in production
3. **No log aggregation** - Logs not sent to centralized system

## Structured Logging Strategy

### Log Format

**Standard**: JSON structured logs compatible with ELK, Splunk, Datadog

```typescript
// server/lib/logger.ts
import winston from 'winston';
import { Request, Response } from 'express';

// Define log levels
const levels = {
  error: 0,    // System errors, failures
  warn: 1,     // Security warnings, deprecated features
  info: 2,     // Normal operations, lifecycle events
  http: 3,     // HTTP requests
  debug: 4,    // Detailed debugging
  security: 5, // Security-specific events (custom level)
};

// Custom format for security events
const securityFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

export const logger = winston.createLogger({
  levels,
  format: securityFormat,
  defaultMeta: {
    service: 'cloud-gallery-api',
    version: process.env.APP_VERSION || 'unknown',
    environment: process.env.NODE_ENV || 'development',
  },
  transports: [
    // Console for development
    new winston.transports.Console({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    
    // File for production
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 10,
    }),
    
    // Security-specific log
    new winston.transports.File({
      filename: 'logs/security.log',
      level: 'security',
      maxsize: 10485760,
      maxFiles: 30, // Longer retention for security events
    }),
  ],
});

// Add correlation ID to all logs
export function addCorrelationId(req: Request): string {
  const correlationId = req.header('X-Correlation-ID') || 
                        req.header('X-Request-ID') ||
                        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  (req as any).correlationId = correlationId;
  return correlationId;
}
```

### Log Entry Schema

```typescript
interface LogEntry {
  timestamp: string;          // ISO 8601
  level: string;              // error, warn, info, http, debug, security
  correlationId: string;      // Request tracking
  service: string;            // Service name
  version: string;            // App version
  environment: string;        // dev, staging, production
  
  // Request context
  method?: string;            // HTTP method
  path?: string;              // Request path (PII redacted)
  statusCode?: number;        // Response status
  duration?: number;          // Request duration (ms)
  ip?: string;                // Client IP (anonymized)
  userAgent?: string;         // User agent (truncated)
  
  // User context
  userId?: string;            // User ID (not email)
  sessionId?: string;         // Session ID
  
  // Security context
  securityEvent?: string;     // Event type: auth_success, auth_failure, etc.
  resource?: string;          // Resource accessed
  action?: string;            // Action performed
  result?: string;            // success, failure, denied
  reason?: string;            // Failure/denial reason
  
  // Error context
  error?: {
    message: string;
    stack?: string;           // Only in development
    code?: string;
  };
  
  // Additional metadata
  metadata?: Record<string, any>;
}
```

**Example**:
```json
{
  "timestamp": "2024-01-10T15:23:45.123Z",
  "level": "security",
  "correlationId": "req-1704902625-abc123",
  "service": "cloud-gallery-api",
  "version": "1.0.0",
  "environment": "production",
  "method": "POST",
  "path": "/api/auth/login",
  "statusCode": 401,
  "duration": 234,
  "ip": "203.0.113.0",
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0)",
  "securityEvent": "auth_failure",
  "resource": "auth",
  "action": "login",
  "result": "failure",
  "reason": "invalid_credentials",
  "metadata": {
    "attemptCount": 3,
    "email": "[REDACTED]"
  }
}
```

## PII Redaction Policy

### PII Classification

```typescript
// server/lib/pii-redaction.ts

export enum PIILevel {
  PUBLIC = 0,      // Safe to log: IDs, timestamps
  SENSITIVE = 1,   // Redact: emails, names, partial IP
  CRITICAL = 2,    // Never log: passwords, tokens, SSN
}

export const PII_PATTERNS = {
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  ipv4: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  jwt: /eyJ[A-Za-z0-9-_=]+\.eyJ[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
  apiKey: /\b[A-Za-z0-9]{32,}\b/g,
};

export function redactPII(obj: any, level: PIILevel = PIILevel.SENSITIVE): any {
  if (typeof obj !== 'object' || obj === null) {
    return redactString(String(obj), level);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactPII(item, level));
  }

  const redacted: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    
    // Never log these fields
    if (['password', 'token', 'secret', 'authorization', 'cookie'].some(k => keyLower.includes(k))) {
      redacted[key] = '[REDACTED]';
      continue;
    }
    
    // Redact sensitive fields
    if (['email', 'phone', 'ssn', 'creditcard', 'address'].some(k => keyLower.includes(k))) {
      redacted[key] = redactString(String(value), PIILevel.SENSITIVE);
      continue;
    }
    
    // Recursively process nested objects
    if (typeof value === 'object' && value !== null) {
      redacted[key] = redactPII(value, level);
    } else {
      redacted[key] = redactString(String(value), level);
    }
  }
  
  return redacted;
}

export function redactString(str: string, level: PIILevel): string {
  if (level === PIILevel.PUBLIC) {
    return str;
  }
  
  let redacted = str;
  
  // Always redact tokens and keys
  redacted = redacted.replace(PII_PATTERNS.jwt, '[JWT_REDACTED]');
  redacted = redacted.replace(PII_PATTERNS.apiKey, '[KEY_REDACTED]');
  
  if (level >= PIILevel.SENSITIVE) {
    // Redact email - keep domain for debugging
    redacted = redacted.replace(PII_PATTERNS.email, (match) => {
      const [local, domain] = match.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    });
    
    // Redact credit cards completely
    redacted = redacted.replace(PII_PATTERNS.creditCard, '[CC_REDACTED]');
    
    // Redact SSN
    redacted = redacted.replace(PII_PATTERNS.ssn, '[SSN_REDACTED]');
    
    // Redact phone
    redacted = redacted.replace(PII_PATTERNS.phone, '[PHONE_REDACTED]');
    
    // Anonymize IP - keep first 2 octets
    redacted = redacted.replace(PII_PATTERNS.ipv4, (match) => {
      const parts = match.split('.');
      return `${parts[0]}.${parts[1]}.0.0`;
    });
  }
  
  return redacted;
}

// Specific field redaction for common cases
export function redactEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '[INVALID_EMAIL]';
  return `${local.substring(0, 2)}***@${domain}`;
}

export function redactIP(ip: string): string {
  const parts = ip.split('.');
  if (parts.length !== 4) return '[INVALID_IP]';
  return `${parts[0]}.${parts[1]}.0.0`;
}
```

**Usage**:
```typescript
logger.info('User logged in', redactPII({
  email: 'user@example.com',  // Becomes: us***@example.com
  ip: '203.0.113.45',          // Becomes: 203.0.0.0
  token: 'eyJhbGc...',         // Becomes: [JWT_REDACTED]
}));
```

## Log Levels and Categorization

### Level Guidelines

```typescript
// ERROR - System failures requiring immediate action
logger.error('Database connection failed', {
  error: error.message,
  stack: error.stack,
  database: 'postgresql',
});

// WARN - Degraded performance, deprecated features, security warnings
logger.warn('Rate limit approaching threshold', {
  userId: userId,
  current: 45,
  limit: 50,
});

// INFO - Normal business operations
logger.info('Photo uploaded successfully', {
  userId: userId,
  photoId: photoId,
  size: fileSize,
});

// HTTP - All HTTP requests (separate logger)
logger.http('Request completed', {
  method: 'POST',
  path: '/api/photos',
  statusCode: 201,
  duration: 234,
});

// DEBUG - Detailed debugging information (development only)
logger.debug('Cache lookup', {
  key: cacheKey,
  hit: true,
  ttl: 3600,
});

// SECURITY - All security-relevant events
logger.log('security', 'Authorization check failed', {
  securityEvent: 'authorization_failure',
  userId: userId,
  resource: 'album',
  action: 'delete',
  reason: 'not_owner',
});
```

### Security Event Categories

```typescript
export enum SecurityEvent {
  // Authentication
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILURE = 'auth_failure',
  AUTH_LOCKOUT = 'auth_lockout',
  PASSWORD_RESET = 'password_reset',
  PASSWORD_CHANGE = 'password_change',
  MFA_ENABLED = 'mfa_enabled',
  MFA_DISABLED = 'mfa_disabled',
  
  // Authorization
  AUTHZ_SUCCESS = 'authorization_success',
  AUTHZ_FAILURE = 'authorization_failure',
  PERMISSION_DENIED = 'permission_denied',
  
  // Data Access
  DATA_READ = 'data_read',
  DATA_WRITE = 'data_write',
  DATA_DELETE = 'data_delete',
  DATA_EXPORT = 'data_export',
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
  
  // Session Management
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  SESSION_EXPIRED = 'session_expired',
  CONCURRENT_SESSION = 'concurrent_session',
  
  // Security Controls
  RATE_LIMIT_HIT = 'rate_limit_hit',
  RATE_LIMIT_BLOCK = 'rate_limit_block',
  INPUT_VALIDATION_FAILED = 'input_validation_failed',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  
  // Configuration Changes
  CONFIG_CHANGE = 'config_change',
  PERMISSION_CHANGE = 'permission_change',
  USER_ROLE_CHANGE = 'user_role_change',
  
  // Anomalies
  ANOMALY_DETECTED = 'anomaly_detected',
  BRUTE_FORCE_ATTEMPT = 'brute_force_attempt',
  CREDENTIAL_STUFFING = 'credential_stuffing',
}

export function logSecurityEvent(
  event: SecurityEvent,
  context: {
    userId?: string;
    resource?: string;
    action?: string;
    result: 'success' | 'failure' | 'denied';
    reason?: string;
    metadata?: Record<string, any>;
  }
) {
  logger.log('security', 'Security event', {
    securityEvent: event,
    ...redactPII(context),
    timestamp: new Date().toISOString(),
  });
}
```

## Audit Log Requirements

### Sensitive Actions Requiring Audit

```typescript
// server/middleware/audit-log.ts
import { Request, Response, NextFunction } from 'express';

export const AUDITABLE_ACTIONS = {
  // User Management
  'POST /api/auth/register': 'user_registration',
  'POST /api/auth/login': 'user_login',
  'POST /api/auth/logout': 'user_logout',
  'DELETE /api/users/:id': 'user_deletion',
  'PUT /api/users/:id/password': 'password_change',
  'PUT /api/users/:id/email': 'email_change',
  
  // Data Operations
  'POST /api/photos': 'photo_upload',
  'DELETE /api/photos/:id': 'photo_deletion',
  'POST /api/albums': 'album_creation',
  'DELETE /api/albums/:id': 'album_deletion',
  'POST /api/albums/:id/share': 'album_share',
  
  // Access Control
  'PUT /api/albums/:id/permissions': 'permission_change',
  'POST /api/share/link': 'share_link_creation',
  'DELETE /api/share/link/:id': 'share_link_revocation',
  
  // Configuration
  'PUT /api/settings/security': 'security_settings_change',
  'PUT /api/settings/privacy': 'privacy_settings_change',
};

export function auditLogMiddleware(req: Request, res: Response, next: NextFunction) {
  const routeKey = `${req.method} ${req.route?.path || req.path}`;
  const action = AUDITABLE_ACTIONS[routeKey as keyof typeof AUDITABLE_ACTIONS];
  
  if (!action) {
    return next();
  }
  
  const startTime = Date.now();
  
  // Capture response
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    const duration = Date.now() - startTime;
    
    logSecurityEvent(SecurityEvent.DATA_WRITE, {
      userId: (req as any).userId,
      resource: req.path,
      action: action,
      result: res.statusCode < 400 ? 'success' : 'failure',
      metadata: {
        method: req.method,
        statusCode: res.statusCode,
        duration,
        correlationId: (req as any).correlationId,
        // Do not log full request body - may contain sensitive data
        requestSize: req.header('content-length'),
        responseSize: JSON.stringify(body).length,
      },
    });
    
    return originalJson(body);
  };
  
  next();
}
```

### Audit Trail Schema

```typescript
interface AuditEntry {
  id: string;              // Unique audit ID
  timestamp: string;       // ISO 8601
  correlationId: string;   // Request correlation
  
  // Actor
  userId: string;          // Who performed the action
  sessionId: string;       // Session context
  ip: string;              // Source IP (anonymized)
  userAgent: string;       // Client information
  
  // Action
  action: string;          // Action performed
  resource: string;        // Resource affected
  resourceId?: string;     // Specific resource ID
  
  // Result
  result: 'success' | 'failure' | 'denied';
  reason?: string;         // Failure/denial reason
  statusCode?: number;     // HTTP status
  
  // Context
  before?: any;            // State before (for updates)
  after?: any;             // State after
  metadata?: Record<string, any>;
  
  // Integrity
  signature?: string;      // HMAC for tamper detection
}
```

## Log Retention Policy

### Retention Periods

```typescript
export const LOG_RETENTION = {
  // Application logs
  error: 90,        // 90 days
  warn: 60,         // 60 days
  info: 30,         // 30 days
  http: 7,          // 7 days
  debug: 3,         // 3 days (development only)
  
  // Security logs - longer retention
  security: 365,    // 1 year
  audit: 2555,      // 7 years (compliance requirement)
  
  // Specific event types
  auth_failure: 180,       // 6 months
  data_deletion: 2555,     // 7 years
  permission_change: 365,  // 1 year
};
```

### Log Rotation Configuration

```typescript
// server/lib/logger.ts - Update transport configuration
new winston.transports.File({
  filename: 'logs/security.log',
  level: 'security',
  maxsize: 10485760,  // 10MB per file
  maxFiles: 365,      // 1 year daily rotation
  tailable: true,     // Keep recent logs accessible
  zippedArchive: true, // Compress old logs
});

// Automated cleanup script
// scripts/cleanup-logs.ts
import fs from 'fs';
import path from 'path';

const LOG_DIR = path.resolve(__dirname, '../logs');
const now = Date.now();

Object.entries(LOG_RETENTION).forEach(([level, days]) => {
  const pattern = new RegExp(`${level}.*\\.log`);
  const maxAge = days * 24 * 60 * 60 * 1000;
  
  fs.readdirSync(LOG_DIR).forEach(file => {
    if (!pattern.test(file)) return;
    
    const filePath = path.join(LOG_DIR, file);
    const stats = fs.statSync(filePath);
    const age = now - stats.mtime.getTime();
    
    if (age > maxAge) {
      fs.unlinkSync(filePath);
      console.log(`Deleted expired log: ${file}`);
    }
  });
});
```

**Cron Configuration**:
```bash
# Daily log cleanup at 2 AM
0 2 * * * cd /app && node scripts/cleanup-logs.js
```

## Correlation IDs for Request Tracking

### Implementation

```typescript
// server/middleware/correlation-id.ts
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Accept client-provided correlation ID or generate new one
  const correlationId = req.header('X-Correlation-ID') ||
                        req.header('X-Request-ID') ||
                        uuidv4();
  
  // Attach to request
  (req as any).correlationId = correlationId;
  
  // Return in response headers
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Add to logger context
  logger.defaultMeta = {
    ...logger.defaultMeta,
    correlationId,
  };
  
  next();
}
```

**Client Implementation**:
```typescript
// client/lib/api.ts
import * as uuid from 'uuid';

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const correlationId = uuid.v4();
  
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      ...options.headers,
      'X-Correlation-ID': correlationId,
    },
  });
  
  // Log correlation ID for debugging
  console.debug(`Request ${correlationId}: ${endpoint}`);
  
  return response;
}
```

### Distributed Tracing

```typescript
// For microservices, propagate correlation ID
export function propagateCorrelationId(req: Request, targetUrl: string) {
  return fetch(targetUrl, {
    headers: {
      'X-Correlation-ID': (req as any).correlationId,
      // Add distributed tracing headers
      'X-B3-TraceId': (req as any).traceId,
      'X-B3-SpanId': (req as any).spanId,
    },
  });
}
```

## Enhanced Request Logging

### Replacement for Current Implementation

```typescript
// server/middleware/request-logger.ts
import { Request, Response, NextFunction } from 'express';
import { logger, redactPII } from '../lib/logger';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId;
  
  // Log request start
  logger.http('Request started', {
    correlationId,
    method: req.method,
    path: redactPII(req.path),
    query: redactPII(req.query),
    ip: redactIP(req.ip),
    userAgent: req.header('user-agent')?.substring(0, 100),
    userId: (req as any).userId,
    contentLength: req.header('content-length'),
  });
  
  // Capture response
  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    const duration = Date.now() - startTime;
    const level = res.statusCode >= 500 ? 'error' : 
                  res.statusCode >= 400 ? 'warn' : 'http';
    
    logger.log(level, 'Request completed', {
      correlationId,
      method: req.method,
      path: redactPII(req.path),
      statusCode: res.statusCode,
      duration,
      responseSize: JSON.stringify(body).length,
      userId: (req as any).userId,
    });
    
    // Log slow requests
    if (duration > 1000) {
      logger.warn('Slow request detected', {
        correlationId,
        path: req.path,
        duration,
      });
    }
    
    return originalJson(body);
  };
  
  next();
}
```

**Migration**:
```typescript
// server/index.ts - Replace setupRequestLogging
import { requestLoggerMiddleware } from './middleware/request-logger';

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  
  // Add correlation ID first
  app.use(correlationIdMiddleware);
  
  // Then request logger (replaces setupRequestLogging)
  app.use(requestLoggerMiddleware);
  
  // Then audit logger
  app.use(auditLogMiddleware);
  
  // ...
})();
```

## Alerting Triggers and Thresholds

### Critical Alerts

```typescript
// server/lib/alerting.ts
export interface AlertConfig {
  name: string;
  condition: (events: LogEntry[]) => boolean;
  threshold: number;
  windowMs: number;
  severity: 'critical' | 'high' | 'medium';
  notification: string[]; // Email, Slack, PagerDuty
}

export const ALERT_RULES: AlertConfig[] = [
  {
    name: 'Multiple Authentication Failures',
    condition: (events) => events.filter(e => 
      e.securityEvent === 'auth_failure'
    ).length >= 5,
    threshold: 5,
    windowMs: 5 * 60 * 1000, // 5 minutes
    severity: 'high',
    notification: ['security-team@company.com', 'slack-security'],
  },
  
  {
    name: 'Credential Stuffing Attack',
    condition: (events) => {
      const uniqueUsers = new Set(events.map(e => e.userId)).size;
      const failures = events.filter(e => e.securityEvent === 'auth_failure').length;
      return failures >= 10 && uniqueUsers >= 5;
    },
    threshold: 10,
    windowMs: 60 * 1000, // 1 minute
    severity: 'critical',
    notification: ['security-team@company.com', 'pagerduty'],
  },
  
  {
    name: 'Elevated Error Rate',
    condition: (events) => events.filter(e => 
      e.level === 'error'
    ).length >= 20,
    threshold: 20,
    windowMs: 5 * 60 * 1000,
    severity: 'high',
    notification: ['engineering-team@company.com', 'slack-ops'],
  },
  
  {
    name: 'Unauthorized Data Access Attempts',
    condition: (events) => events.filter(e => 
      e.securityEvent === 'authorization_failure' && 
      e.resource?.includes('sensitive')
    ).length >= 3,
    threshold: 3,
    windowMs: 10 * 60 * 1000,
    severity: 'critical',
    notification: ['security-team@company.com', 'pagerduty'],
  },
  
  {
    name: 'Rate Limit Blocks',
    condition: (events) => events.filter(e => 
      e.securityEvent === 'rate_limit_block'
    ).length >= 10,
    threshold: 10,
    windowMs: 5 * 60 * 1000,
    severity: 'medium',
    notification: ['security-team@company.com'],
  },
  
  {
    name: 'Mass Data Deletion',
    condition: (events) => events.filter(e => 
      e.action === 'data_delete'
    ).length >= 100,
    threshold: 100,
    windowMs: 60 * 60 * 1000, // 1 hour
    severity: 'critical',
    notification: ['security-team@company.com', 'pagerduty'],
  },
];

// Alert evaluation engine
export class AlertEngine {
  private eventBuffer: Map<string, LogEntry[]> = new Map();
  
  processEvent(event: LogEntry) {
    ALERT_RULES.forEach(rule => {
      const key = `${rule.name}-${event.correlationId}`;
      const events = this.eventBuffer.get(key) || [];
      events.push(event);
      
      // Keep only events within window
      const cutoff = Date.now() - rule.windowMs;
      const recent = events.filter(e => 
        new Date(e.timestamp).getTime() > cutoff
      );
      
      this.eventBuffer.set(key, recent);
      
      // Check threshold
      if (rule.condition(recent)) {
        this.triggerAlert(rule, recent);
      }
    });
  }
  
  private triggerAlert(rule: AlertConfig, events: LogEntry[]) {
    logger.log('security', `ALERT: ${rule.name}`, {
      severity: rule.severity,
      threshold: rule.threshold,
      eventCount: events.length,
      window: rule.windowMs,
      events: events.slice(0, 10), // First 10 events
    });
    
    // Send notifications
    rule.notification.forEach(channel => {
      this.sendNotification(channel, rule, events);
    });
  }
  
  private sendNotification(channel: string, rule: AlertConfig, events: LogEntry[]) {
    // Implementation for email, Slack, PagerDuty, etc.
  }
}
```

## Log Aggregation and SIEM Integration

### ELK Stack Integration

```yaml
# docker-compose.yml
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
      - ELASTIC_PASSWORD=changeme
    volumes:
      - elasticsearch-data:/usr/share/elasticsearch/data
    
  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf:ro
      - ./logs:/logs:ro
    depends_on:
      - elasticsearch
  
  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
      - ELASTICSEARCH_USERNAME=elastic
      - ELASTICSEARCH_PASSWORD=changeme
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

**Logstash Configuration**:
```ruby
# logstash.conf
input {
  file {
    path => "/logs/*.log"
    start_position => "beginning"
    codec => json
  }
}

filter {
  # Parse timestamp
  date {
    match => [ "timestamp", "ISO8601" ]
  }
  
  # Extract user ID
  if [userId] {
    mutate {
      add_field => { "user_id" => "%{userId}" }
    }
  }
  
  # Tag security events
  if [securityEvent] {
    mutate {
      add_tag => [ "security" ]
    }
  }
  
  # Tag errors
  if [level] == "error" {
    mutate {
      add_tag => [ "error" ]
    }
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    user => "elastic"
    password => "changeme"
    index => "cloud-gallery-%{+YYYY.MM.dd}"
  }
}
```

### Datadog Integration

```typescript
// server/lib/logger.ts - Add Datadog transport
import DatadogWinston from '@datadog/datadog-winston';

logger.add(new DatadogWinston({
  apiKey: process.env.DD_API_KEY,
  service: 'cloud-gallery-api',
  ddsource: 'nodejs',
  ddtags: `env:${process.env.NODE_ENV}`,
}));
```

### Splunk Integration

```typescript
// server/lib/logger.ts - Add Splunk transport
import SplunkStreamingTransport from 'winston-splunk-httplogger';

logger.add(new SplunkStreamingTransport({
  splunk: {
    token: process.env.SPLUNK_TOKEN,
    url: process.env.SPLUNK_URL,
    index: 'cloud-gallery',
    sourcetype: 'nodejs',
  },
}));
```

## Forensics Readiness

### Evidence Preservation

```typescript
// server/lib/forensics.ts
export class ForensicsCapture {
  /**
   * Capture complete request context for security investigation
   * Call immediately when security incident detected
   */
  static captureIncident(req: Request, reason: string): string {
    const incidentId = `incident-${Date.now()}-${Math.random().toString(36)}`;
    
    const evidence = {
      incidentId,
      timestamp: new Date().toISOString(),
      reason,
      
      // Request details
      request: {
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        headers: this.sanitizeHeaders(req.headers),
        body: redactPII(req.body),
        ip: req.ip,
        correlationId: (req as any).correlationId,
      },
      
      // User context
      user: {
        userId: (req as any).userId,
        sessionId: (req as any).sessionId,
        userAgent: req.header('user-agent'),
      },
      
      // System context
      system: {
        pid: process.pid,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
    };
    
    // Write to forensics log (never rotated)
    fs.appendFileSync(
      'logs/forensics.log',
      JSON.stringify(evidence) + '\n'
    );
    
    logger.log('security', 'Forensics evidence captured', {
      incidentId,
      reason,
    });
    
    return incidentId;
  }
  
  private static sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    delete sanitized['x-api-key'];
    
    return sanitized;
  }
}
```

**Usage**:
```typescript
// Capture evidence when suspicious activity detected
if (failedAttempts >= 5) {
  const incidentId = ForensicsCapture.captureIncident(
    req,
    'Multiple authentication failures'
  );
  
  logger.log('security', 'Suspicious activity detected', {
    incidentId,
    userId: userId,
    attemptCount: failedAttempts,
  });
}
```

### Audit Log Integrity

```typescript
// Prevent audit log tampering with HMAC
import crypto from 'crypto';

const AUDIT_SECRET = process.env.AUDIT_LOG_SECRET || 'change-me-in-production';

export function signAuditEntry(entry: AuditEntry): AuditEntry {
  const payload = JSON.stringify({
    timestamp: entry.timestamp,
    userId: entry.userId,
    action: entry.action,
    resource: entry.resource,
    result: entry.result,
  });
  
  const signature = crypto
    .createHmac('sha256', AUDIT_SECRET)
    .update(payload)
    .digest('hex');
  
  return {
    ...entry,
    signature,
  };
}

export function verifyAuditEntry(entry: AuditEntry): boolean {
  const { signature, ...rest } = entry;
  const signed = signAuditEntry(rest);
  return signed.signature === signature;
}
```

## Validation and Testing

```bash
# Test structured logging
npm run server:dev
curl http://localhost:5000/api/test
cat logs/combined.log | jq .

# Test PII redaction
echo '{"email":"user@example.com","password":"secret"}' | \
  node -e "const {redactPII} = require('./server/lib/pii-redaction'); console.log(JSON.stringify(redactPII(JSON.parse(require('fs').readFileSync(0, 'utf-8'))))))"

# Test correlation IDs
for i in {1..3}; do
  curl -H "X-Correlation-ID: test-$i" http://localhost:5000/api/test
done
cat logs/combined.log | jq 'select(.correlationId | startswith("test-"))'

# Test alerting
# Simulate multiple failed logins
for i in {1..10}; do
  curl -X POST http://localhost:5000/api/auth/login -d '{"email":"test@example.com","password":"wrong"}'
done
cat logs/security.log | jq 'select(.securityEvent == "auth_failure")'

# Verify log rotation
ls -lh logs/
# Should see rotated files with timestamps

# Test SIEM integration
curl -X POST http://localhost:5000/api/test
# Check Elasticsearch/Datadog/Splunk for log entry
```

## Remediation Priorities

1. **Critical (P0)** - Implement immediately:
   - Replace plain text logging with structured JSON logs
   - Implement PII redaction in all log statements
   - Add correlation IDs to all requests
   - Separate security logs from application logs

2. **High (P1)** - Next sprint:
   - Add audit logging for sensitive actions
   - Implement log retention and rotation
   - Set up critical security alerts
   - Configure SIEM integration

3. **Medium (P2)** - Within 2 sprints:
   - Add forensics capture for security incidents
   - Implement audit log integrity checking
   - Configure distributed tracing
   - Set up log aggregation dashboard

4. **Low (P3)** - Backlog:
   - Advanced anomaly detection
   - Machine learning-based threat detection
   - Automated response to security events

## References

- OWASP Logging Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html
- OWASP Application Logging Vocabulary: https://owasp.org/www-community/OWASP_Application_Security_Logging_Standard
- Winston Logger: https://github.com/winstonjs/winston
- ELK Stack: https://www.elastic.co/what-is/elk-stack
- NIST Logging Guidelines: https://csrc.nist.gov/publications/detail/sp/800-92/final

---
*This document should be reviewed quarterly and after any security incidents.*
