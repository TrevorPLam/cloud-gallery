# Secure Software Development Lifecycle (SDLC)

**Status**: 🟡 Partially Implemented  
**Owner**: Engineering/Security Team  
**Last Updated**: 2024-01-10

## Overview

A Secure SDLC embeds security at every phase of software development, from requirements through deployment and maintenance. This document defines Cloud Gallery's security practices, checkpoints, and responsibilities throughout the development lifecycle.

## Security Requirements Phase

### Security Requirement Categories

**Functional Security Requirements**:
```markdown
## Authentication
- [ ] Users must authenticate with email + password (min 12 chars)
- [ ] Failed authentication attempts must be rate-limited (5 attempts per 15 min)
- [ ] Passwords must be hashed with Argon2id (not bcrypt/scrypt)
- [ ] Session tokens must expire after 7 days of inactivity
- [ ] Refresh tokens must be rotated on each use

## Authorization
- [ ] Album owners can read, write, delete, and share
- [ ] Album viewers (via share link) can only read
- [ ] Photo deletion requires ownership check
- [ ] Share links must support expiration dates
- [ ] Share links must support revocation

## Data Protection
- [ ] Photos must be stored with access control enforcement
- [ ] User emails must not appear in URLs or logs
- [ ] Sensitive data (emails, tokens) must use secure storage on mobile
- [ ] Passwords must never be logged or sent to client
- [ ] Photo metadata must preserve EXIF privacy (strip GPS by default)
```

**Non-Functional Security Requirements**:
```markdown
## Performance vs Security
- [ ] Password hashing must complete within 500ms (balance security/UX)
- [ ] Rate limiting must not impact legitimate users
- [ ] HTTPS overhead acceptable (< 10% latency increase)

## Availability
- [ ] Rate limiting must not cause service unavailability
- [ ] Authentication failures must not lock accounts permanently (time-based only)
- [ ] Security logging must not fill disk (log rotation required)

## Compliance
- [ ] GDPR: User data export capability
- [ ] GDPR: User data deletion (right to be forgotten)
- [ ] CCPA: Privacy policy disclosure
- [ ] Data retention: Audit logs 7 years, application logs 90 days
```

### Requirements Elicitation Template

```markdown
# Feature: [Feature Name]
## Security Considerations

### Data Classification
What type of data does this feature handle?
- [ ] Public data (no restrictions)
- [ ] Internal data (employees only)
- [ ] Confidential data (authorized users)
- [ ] Sensitive PII (names, emails, phone)
- [ ] Critical PII (passwords, SSN, payment info)

### Trust Boundaries
Where does untrusted data enter the system?
- [ ] User input (forms, API requests)
- [ ] File uploads
- [ ] URL parameters
- [ ] Third-party APIs
- [ ] Database (if shared with other services)

### Authentication Required?
- [ ] Yes - Specify: [JWT, session cookie, API key]
- [ ] No - Public endpoint

### Authorization Model
Who can access this feature?
- [ ] Any authenticated user
- [ ] Resource owner only
- [ ] Admin only
- [ ] Public (no auth required)
- [ ] Custom (describe): _____

### Attack Surface
What could an attacker exploit?
- [ ] SQL injection (if using raw queries)
- [ ] XSS (if rendering user content)
- [ ] CSRF (if state-changing operation)
- [ ] Path traversal (if accessing files)
- [ ] Command injection (if executing system commands)
- [ ] IDOR (if accessing resources by ID)
- [ ] Rate limiting bypass
- [ ] Logic flaws (business rule violations)

### Privacy Implications
Does this feature collect/process/store personal data?
- [ ] Yes - Specify in privacy policy
- [ ] No

### Regulatory Impact
Does this feature affect compliance?
- [ ] GDPR (EU users)
- [ ] CCPA (CA users)
- [ ] HIPAA (health data)
- [ ] PCI DSS (payment data)
- [ ] None
```

## Threat Modeling Touchpoints

### When to Threat Model

**Required**:
1. **New features** with authentication/authorization
2. **New data flows** (especially external integrations)
3. **Privilege changes** (new admin roles, permissions)
4. **Architecture changes** (new services, databases)
5. **Third-party integrations** (OAuth providers, payment gateways)

**Optional** (recommended):
- Significant refactors of security-sensitive code
- After security incidents (to prevent recurrence)
- Annually for core features

### Threat Modeling Process (STRIDE)

```typescript
// Example threat model for Photo Upload feature

interface ThreatModel {
  feature: string;
  dataFlow: string[];
  threats: Threat[];
}

interface Threat {
  category: 'Spoofing' | 'Tampering' | 'Repudiation' | 'InfoDisclosure' | 'DoS' | 'ElevationOfPrivilege';
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  mitigation: string;
  status: 'Mitigated' | 'Accepted' | 'Transferred' | 'Unmitigated';
}

const photoUploadThreatModel: ThreatModel = {
  feature: 'Photo Upload',
  dataFlow: [
    'Client (React Native) -> API Server (/api/photos/upload) -> FileSystem/S3 -> Database (metadata)',
  ],
  threats: [
    {
      category: 'Spoofing',
      description: 'Attacker uploads photos as another user',
      severity: 'High',
      mitigation: 'Require JWT authentication, validate user ID from token matches upload owner',
      status: 'Mitigated',
    },
    {
      category: 'Tampering',
      description: 'Attacker modifies photo during upload (MITM)',
      severity: 'Medium',
      mitigation: 'Enforce HTTPS/TLS 1.3, verify file integrity with SHA-256 hash',
      status: 'Mitigated',
    },
    {
      category: 'Repudiation',
      description: 'User denies uploading malicious photo',
      severity: 'Low',
      mitigation: 'Audit log: record user ID, timestamp, file hash, IP address',
      status: 'Mitigated',
    },
    {
      category: 'InfoDisclosure',
      description: 'Photo EXIF contains GPS location, leaked via metadata API',
      severity: 'High',
      mitigation: 'Strip sensitive EXIF (GPS, camera serial) before storing, make opt-in',
      status: 'Unmitigated', // ACTION REQUIRED
    },
    {
      category: 'DoS',
      description: 'Attacker uploads massive files to exhaust storage/bandwidth',
      severity: 'High',
      mitigation: 'Limit file size (10MB), rate limit uploads (50 per hour), quota per user (15GB)',
      status: 'Mitigated',
    },
    {
      category: 'DoS',
      description: 'Attacker uploads zip bomb or malformed image to crash server',
      severity: 'Critical',
      mitigation: 'Validate file headers, use image processing library with DoS protections (sharp), limit decompression ratio',
      status: 'Mitigated',
    },
    {
      category: 'ElevationOfPrivilege',
      description: 'Photo filename contains path traversal (../../etc/passwd)',
      severity: 'Critical',
      mitigation: 'Generate random filenames (UUID), never use user-provided filenames, store in sandboxed directory',
      status: 'Mitigated',
    },
  ],
};
```

**Threat Modeling Output**:
```markdown
# Photo Upload Threat Model

## Unmitigated Threats (Blockers)
1. **EXIF GPS Disclosure** (High)
   - Risk: User location leaked via photo metadata
   - Mitigation: Implement EXIF stripping before storage
   - Owner: @backend-team
   - Deadline: Before production launch

## Mitigated Threats
- ✅ Authentication spoofing (JWT validation)
- ✅ MITM tampering (HTTPS enforcement)
- ✅ DoS via large files (size limits + rate limiting)
- ✅ Path traversal (UUID filenames)

## Accepted Risks
- None

## Dependencies
- sharp library (image processing)
- JWT authentication middleware
- Rate limiting middleware
```

### Threat Modeling Tools

```bash
# OWASP Threat Dragon (diagramming)
npx @owasp/threat-dragon

# Microsoft Threat Modeling Tool
# https://www.microsoft.com/en-us/securityengineering/sdl/threatmodeling

# Automated threat discovery with STRIDE GPT
# https://github.com/mrwadams/stride-gpt
```

## Secure Coding Standards

### Language-Specific Guidelines

#### TypeScript/JavaScript

```typescript
// ✅ GOOD: Parameterized queries prevent SQL injection
const photos = await db.query(
  'SELECT * FROM photos WHERE user_id = $1',
  [userId]
);

// ❌ BAD: String concatenation enables SQL injection
const photos = await db.query(
  `SELECT * FROM photos WHERE user_id = '${userId}'`
);

// ✅ GOOD: Validate and sanitize input
import { z } from 'zod';
const PhotoSchema = z.object({
  title: z.string().max(100),
  description: z.string().max(1000).optional(),
});
const validated = PhotoSchema.parse(req.body);

// ❌ BAD: Trust user input directly
const { title, description } = req.body;
await db.insert({ title, description });

// ✅ GOOD: Use content security policy to prevent XSS
res.setHeader('Content-Security-Policy', "default-src 'self'");

// ❌ BAD: Render unsanitized HTML
const html = `<div>${userInput}</div>`; // XSS if userInput = '<script>alert(1)</script>'

// ✅ GOOD: Hash passwords with Argon2id
import argon2 from 'argon2';
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MB
  timeCost: 3,
  parallelism: 4,
});

// ❌ BAD: Weak password hashing
const hash = crypto.createHash('sha256').update(password).digest('hex');

// ✅ GOOD: Generate cryptographically secure tokens
import crypto from 'crypto';
const token = crypto.randomBytes(32).toString('hex');

// ❌ BAD: Predictable tokens
const token = Math.random().toString(36);

// ✅ GOOD: Constant-time comparison prevents timing attacks
import crypto from 'crypto';
const valid = crypto.timingSafeEqual(
  Buffer.from(provided),
  Buffer.from(expected)
);

// ❌ BAD: Timing attack vulnerable
const valid = providedToken === expectedToken;

// ✅ GOOD: Secure random filename prevents path traversal
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
const safeFilename = `${uuidv4()}${path.extname(originalName)}`;

// ❌ BAD: User-controlled filename
const filepath = path.join('/uploads', req.body.filename); // Path traversal!

// ✅ GOOD: Whitelist allowed values
const ALLOWED_SORT = ['date', 'name', 'size'];
const sort = ALLOWED_SORT.includes(req.query.sort) ? req.query.sort : 'date';

// ❌ BAD: Direct use in query
const sql = `SELECT * FROM photos ORDER BY ${req.query.sort}`; // SQL injection

// ✅ GOOD: Validate environment variables at startup
import { z } from 'zod';
const EnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  NODE_ENV: z.enum(['development', 'staging', 'production']),
});
const env = EnvSchema.parse(process.env);

// ❌ BAD: Assume environment variables exist
const dbUrl = process.env.DATABASE_URL; // Could be undefined
```

#### React Native (Client)

```typescript
// ✅ GOOD: Store tokens in secure storage
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('auth_token', token);

// ❌ BAD: Store tokens in AsyncStorage (unencrypted)
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.setItem('auth_token', token);

// ✅ GOOD: Validate deep links
const DeepLinkSchema = z.object({
  path: z.enum(['/share', '/album']),
  id: z.string().uuid(),
});
const result = DeepLinkSchema.safeParse(parsed);
if (!result.success) return;

// ❌ BAD: Trust deep link data
const { path, id } = Linking.parse(url);
navigate(path, { id }); // Unvalidated navigation

// ✅ GOOD: Sanitize display data
import { Text } from 'react-native';
<Text>{user.name}</Text> // React Native auto-escapes

// ❌ BAD: Render HTML from user input (if using WebView)
<WebView 
  source={{ html: userContent }} // XSS risk
  javaScriptEnabled={true}
/>

// ✅ GOOD: Disable JavaScript in WebView unless necessary
<WebView 
  source={{ html: trustedContent }}
  javaScriptEnabled={false}
  originWhitelist={['https://*']}
/>
```

### Input Validation Rules

```typescript
// server/lib/validation.ts
import { z } from 'zod';

// Common patterns
export const Patterns = {
  UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
  FILENAME: /^[a-zA-Z0-9._-]+$/,
};

// Validation schemas
export const UserSchemas = {
  email: z.string().email().max(255),
  password: z.string().min(12).max(128),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z\s'-]+$/),
};

export const PhotoSchemas = {
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  description: z.string().max(1000).optional(),
  albumIds: z.array(z.string().uuid()).max(50),
};

export const AlbumSchemas = {
  id: z.string().uuid(),
  title: z.string().min(1).max(100),
  photoIds: z.array(z.string().uuid()).max(1000),
};

// Validation middleware
export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.errors,
      });
    }
    
    req.body = result.data; // Use validated data
    next();
  };
}

// Usage
app.post('/api/photos',
  validateBody(z.object({
    title: PhotoSchemas.title,
    albumIds: PhotoSchemas.albumIds,
  })),
  photoController.create
);
```

### Output Encoding Rules

```typescript
// server/lib/encoding.ts

// HTML encoding (for web responses)
export function encodeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// URL encoding (for query parameters)
export function encodeURL(str: string): string {
  return encodeURIComponent(str);
}

// JSON encoding (for API responses)
export function encodeJSON(obj: any): string {
  return JSON.stringify(obj); // Built-in escaping
}

// SQL identifier encoding (column/table names)
export function encodeSQLIdentifier(identifier: string): string {
  // Whitelist approach
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error('Invalid SQL identifier');
  }
  return identifier;
}

// Usage in responses
app.get('/api/user/:id', async (req, res) => {
  const user = await getUser(req.params.id);
  
  // JSON response - automatic encoding
  res.json({
    name: user.name, // No manual encoding needed
    email: user.email,
  });
});

// HTML response - manual encoding required
app.get('/profile/:id', async (req, res) => {
  const user = await getUser(req.params.id);
  
  const html = `
    <div>
      <h1>${encodeHTML(user.name)}</h1>
      <p>${encodeHTML(user.bio)}</p>
    </div>
  `;
  
  res.send(html);
});
```

## PR Security Checklist

### Template for Pull Request Description

```markdown
## Security Checklist

### Authentication & Authorization
- [ ] New endpoints require authentication (or explicitly public)
- [ ] Authorization checks verify resource ownership
- [ ] User IDs are retrieved from validated JWT/session (not request body)
- [ ] No authentication bypass paths

### Input Validation
- [ ] All user input validated with Zod schemas (or equivalent)
- [ ] File uploads validate type, size, and content
- [ ] Query parameters validated (type, range, whitelist)
- [ ] No SQL injection vectors (parameterized queries only)
- [ ] No command injection vectors (avoid shell execution)

### Output Encoding
- [ ] User content properly escaped in responses
- [ ] Error messages don't leak sensitive info (stack traces, DB errors)
- [ ] Logs don't contain PII or secrets

### Data Protection
- [ ] Passwords hashed with Argon2id (not bcrypt/MD5/SHA)
- [ ] Secrets stored in environment variables (not hardcoded)
- [ ] Sensitive data uses SecureStore on mobile (not AsyncStorage)
- [ ] No secrets in logs, URLs, or client-side code

### Cryptography
- [ ] Using crypto.randomBytes() for tokens (not Math.random())
- [ ] Token comparisons use crypto.timingSafeEqual()
- [ ] TLS/HTTPS enforced for all external connections
- [ ] No deprecated crypto algorithms (MD5, SHA1, RC4)

### API Security
- [ ] Rate limiting applied to new endpoints
- [ ] CORS configured correctly (no wildcard origins in production)
- [ ] CSRF protection for state-changing operations
- [ ] No IDOR vulnerabilities (direct object reference without authz)

### Dependency Security
- [ ] New dependencies scanned for vulnerabilities (npm audit)
- [ ] No unnecessary dependencies added
- [ ] Dependencies pinned to specific versions

### Error Handling
- [ ] Errors logged with sufficient context (correlation ID)
- [ ] Errors don't expose internal implementation details
- [ ] Failed operations don't leave system in inconsistent state

### Testing
- [ ] Security-sensitive code has unit tests
- [ ] Authorization tests cover both positive and negative cases
- [ ] Input validation tests include malicious payloads

### Documentation
- [ ] New security controls documented
- [ ] Threat model updated (if applicable)
- [ ] Breaking security changes highlighted

---
**Reviewer**: Please verify checklist items before approving.
```

### Automated PR Checks

```yaml
# .github/workflows/pr-security.yml
name: PR Security Checks

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      # Dependency scanning
      - name: npm audit
        run: npm audit --audit-level=moderate
      
      # Secret scanning
      - name: Secret scanning
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.pull_request.base.sha }}
          head: ${{ github.event.pull_request.head.sha }}
      
      # SAST scanning
      - name: CodeQL Analysis
        uses: github/codeql-action/analyze@v2
        with:
          languages: javascript,typescript
      
      # Linting for security issues
      - name: ESLint security plugin
        run: npm run lint
      
      # Check for hardcoded secrets
      - name: Detect secrets
        uses: reviewdog/action-detect-secrets@master
```

## Code Review Security Guidelines

### Reviewer Responsibilities

**Security Focus Areas**:

1. **Authentication/Authorization** (10 min per review)
   - Verify all endpoints check auth status
   - Confirm user ownership checks on resource access
   - Ensure admin actions require admin role

2. **Input Validation** (15 min per review)
   - Check all user input validated before use
   - Verify file uploads have type/size restrictions
   - Confirm SQL queries use parameterization

3. **Sensitive Data** (10 min per review)
   - Ensure passwords never logged or returned to client
   - Verify tokens use secure generation (crypto.randomBytes)
   - Check PII redaction in logs

4. **Dependencies** (5 min per review)
   - Review new dependencies for known vulnerabilities
   - Verify lockfile updated (package-lock.json)
   - Check for unnecessary dependencies

**Review Comments Template**:

```markdown
## Security Issue: [Severity]

**Category**: [Auth/Input Validation/Crypto/etc.]

**Issue**: 
User input not validated before database query (SQL injection risk)

**Location**: 
`server/controllers/photo.ts:45-48`

**Recommendation**:
```typescript
// Replace with parameterized query
const photos = await db.query(
  'SELECT * FROM photos WHERE album_id = $1',
  [albumId]
);
```

**References**:
- OWASP SQL Injection: https://owasp.org/www-community/attacks/SQL_Injection
- Internal docs: docs/security/20_SECURE_CODING.md
```

### Security Review Checklist for Reviewers

```markdown
## High-Risk Changes (Require Security Review)
- [ ] Authentication/authorization logic
- [ ] Password/token handling
- [ ] File upload processing
- [ ] Payment processing
- [ ] Admin functionality
- [ ] Database schema changes
- [ ] New external integrations
- [ ] Cryptography implementation

## Review Verification
- [ ] Ran code locally and tested security controls
- [ ] Verified unit tests cover security cases
- [ ] Checked for information disclosure in errors/logs
- [ ] Confirmed input validation on all endpoints
- [ ] No hardcoded secrets or credentials
- [ ] Dependencies scanned for vulnerabilities

## Approval
- [ ] All security concerns addressed
- [ ] No blocking security issues remain
- [ ] Changes align with secure coding standards

**Reviewer**: @security-team
**Date**: YYYY-MM-DD
```

## Security Testing Strategy

### Test Pyramid

```
         /\
        /  \  E2E Security Tests (10%)
       /____\  - Penetration testing scenarios
      /      \  - Full authentication flows
     /        \ Integration Security Tests (30%)
    /__________\ - API authorization tests
   /            \ - CORS/CSRF verification
  /              \ Unit Security Tests (60%)
 /________________\ - Input validation
                    - Crypto function tests
                    - PII redaction tests
```

### Unit Security Tests

```typescript
// server/__tests__/security/input-validation.test.ts
import { describe, it, expect } from 'vitest';
import { validateBody } from '@/lib/validation';
import { PhotoSchemas } from '@/lib/validation';

describe('Input Validation Security', () => {
  it('should reject SQL injection attempts', () => {
    const malicious = {
      title: "'; DROP TABLE photos; --",
      description: "normal description",
    };
    
    const schema = z.object({
      title: PhotoSchemas.title,
      description: PhotoSchemas.description,
    });
    
    expect(() => schema.parse(malicious)).toThrow();
  });
  
  it('should reject XSS payloads', () => {
    const malicious = {
      title: '<script>alert(1)</script>',
    };
    
    expect(() => PhotoSchemas.title.parse(malicious.title)).toThrow();
  });
  
  it('should reject path traversal in filenames', () => {
    const malicious = '../../etc/passwd';
    
    expect(() => PhotoSchemas.filename.parse(malicious)).toThrow();
  });
  
  it('should reject oversized input', () => {
    const malicious = {
      title: 'A'.repeat(10000), // DoS attempt
    };
    
    expect(() => PhotoSchemas.title.parse(malicious.title)).toThrow();
  });
});

// server/__tests__/security/authentication.test.ts
describe('Authentication Security', () => {
  it('should reject requests without token', async () => {
    const res = await request(app)
      .get('/api/photos')
      .expect(401);
    
    expect(res.body.error).toBe('Unauthorized');
  });
  
  it('should reject expired tokens', async () => {
    const expiredToken = generateExpiredToken();
    
    const res = await request(app)
      .get('/api/photos')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });
  
  it('should reject tampered tokens', async () => {
    const validToken = generateToken({ userId: 'user1' });
    const tampered = validToken.slice(0, -1) + 'X';
    
    const res = await request(app)
      .get('/api/photos')
      .set('Authorization', `Bearer ${tampered}`)
      .expect(401);
  });
});

// server/__tests__/security/authorization.test.ts
describe('Authorization Security', () => {
  it('should prevent IDOR - user cannot delete other user photos', async () => {
    const user1Token = await login('user1@example.com');
    const user2Photo = await createPhoto('user2@example.com');
    
    const res = await request(app)
      .delete(`/api/photos/${user2Photo.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(403);
    
    expect(res.body.error).toContain('Forbidden');
  });
  
  it('should prevent privilege escalation - normal user cannot access admin endpoint', async () => {
    const userToken = await login('user@example.com');
    
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });
});

// server/__tests__/security/crypto.test.ts
describe('Cryptography Security', () => {
  it('should use cryptographically secure random', () => {
    const token1 = generateToken();
    const token2 = generateToken();
    
    expect(token1).not.toBe(token2);
    expect(token1.length).toBe(64); // 32 bytes hex
  });
  
  it('should use constant-time comparison', () => {
    const secret = 'mysecret';
    const correct = 'mysecret';
    const incorrect = 'mysecrex';
    
    // Timing should not reveal position of difference
    const start1 = performance.now();
    const result1 = timingSafeEqual(Buffer.from(secret), Buffer.from(correct));
    const time1 = performance.now() - start1;
    
    const start2 = performance.now();
    const result2 = timingSafeEqual(Buffer.from(secret), Buffer.from(incorrect));
    const time2 = performance.now() - start2;
    
    expect(result1).toBe(true);
    expect(result2).toBe(false);
    expect(Math.abs(time1 - time2)).toBeLessThan(0.1); // Similar timing
  });
});
```

### Integration Security Tests

```typescript
// server/__tests__/security/integration/cors.test.ts
describe('CORS Security', () => {
  it('should block requests from unauthorized origins', async () => {
    const res = await request(app)
      .get('/api/photos')
      .set('Origin', 'https://evil.com')
      .expect(200); // Request succeeds but no CORS headers
    
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
  
  it('should allow requests from whitelisted origins', async () => {
    const res = await request(app)
      .get('/api/photos')
      .set('Origin', 'https://cloudgallery.app')
      .expect(200);
    
    expect(res.headers['access-control-allow-origin']).toBe('https://cloudgallery.app');
  });
});

// server/__tests__/security/integration/rate-limit.test.ts
describe('Rate Limiting Security', () => {
  it('should block after rate limit exceeded', async () => {
    const requests = Array(11).fill(null).map(() =>
      request(app).post('/api/auth/login').send({
        email: 'user@example.com',
        password: 'wrongpassword',
      })
    );
    
    const responses = await Promise.all(requests);
    const blocked = responses.filter(r => r.status === 429);
    
    expect(blocked.length).toBeGreaterThan(0);
  });
});
```

### E2E Security Tests

```typescript
// e2e/security/authentication-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow Security', () => {
  test('should prevent session fixation', async ({ page, context }) => {
    // Get session cookie before login
    await page.goto('/login');
    const beforeCookies = await context.cookies();
    const sessionBefore = beforeCookies.find(c => c.name === 'session');
    
    // Login
    await page.fill('[name="email"]', 'user@example.com');
    await page.fill('[name="password"]', 'SecurePassword123!');
    await page.click('[type="submit"]');
    
    // Get session cookie after login
    await page.waitForURL('/dashboard');
    const afterCookies = await context.cookies();
    const sessionAfter = afterCookies.find(c => c.name === 'session');
    
    // Session ID should change after login
    expect(sessionAfter?.value).not.toBe(sessionBefore?.value);
  });
  
  test('should logout on multiple tab login (session hijacking prevention)', async ({ browser }) => {
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    // Login in first tab
    await page1.goto('/login');
    await page1.fill('[name="email"]', 'user@example.com');
    await page1.fill('[name="password"]', 'SecurePassword123!');
    await page1.click('[type="submit"]');
    await page1.waitForURL('/dashboard');
    
    // Login in second tab (different device simulation)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.goto('/login');
    await page2.fill('[name="email"]', 'user@example.com');
    await page2.fill('[name="password"]', 'SecurePassword123!');
    await page2.click('[type="submit"]');
    await page2.waitForURL('/dashboard');
    
    // First tab should be logged out or warned
    await page1.reload();
    const isLoggedOut = await page1.url().includes('/login');
    const hasWarning = await page1.locator('text=Session expired').isVisible();
    
    expect(isLoggedOut || hasWarning).toBe(true);
  });
});
```

## Security Regression Tests

**Purpose**: Prevent reintroduction of fixed vulnerabilities

```typescript
// server/__tests__/security/regression.test.ts
describe('Security Regression Tests', () => {
  // Issue #123: IDOR vulnerability in photo deletion
  it('[CVE-2024-001] should prevent unauthorized photo deletion', async () => {
    const user1Token = await login('user1@example.com');
    const user2Photo = await createPhoto('user2@example.com');
    
    const res = await request(app)
      .delete(`/api/photos/${user2Photo.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .expect(403);
    
    // Verify photo still exists
    const photo = await getPhoto(user2Photo.id);
    expect(photo).toBeDefined();
  });
  
  // Issue #145: SQL injection in album search
  it('[CVE-2024-002] should prevent SQL injection in search', async () => {
    const token = await login('attacker@example.com');
    
    const res = await request(app)
      .get('/api/albums/search')
      .query({ q: "' OR '1'='1" })
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    
    // Should return empty or safe results, not all albums
    expect(res.body.length).toBeLessThan(10);
  });
  
  // Issue #167: Password reset token reuse
  it('[CVE-2024-003] should prevent password reset token reuse', async () => {
    const token = await requestPasswordReset('user@example.com');
    
    // Use token once
    await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NewSecure123!' })
      .expect(200);
    
    // Try to reuse token
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'AnotherPassword123!' })
      .expect(400);
    
    expect(res.body.error).toContain('Invalid or expired token');
  });
});
```

## Fuzzing for Parsers/Decoders

**Purpose**: Discover crashes and unexpected behavior with malformed input

```typescript
// server/__tests__/security/fuzz/image-parser.fuzz.ts
import { describe, it } from 'vitest';
import { processImage } from '@/lib/image-processing';

describe('Image Parser Fuzzing', () => {
  it('should handle malformed JPEG headers', async () => {
    const malformed = Buffer.from([
      0xFF, 0xD8, // JPEG magic bytes
      0xFF, 0xFF, 0xFF, // Invalid marker
    ]);
    
    await expect(processImage(malformed)).rejects.toThrow();
  });
  
  it('should handle oversized dimensions', async () => {
    // Craft JPEG with 999999x999999 dimensions
    const malicious = craftJPEGWithDimensions(999999, 999999);
    
    await expect(processImage(malicious)).rejects.toThrow(/dimensions/i);
  });
  
  it('should handle zip bomb images', async () => {
    // 10GB decompressed from 10KB compressed
    const zipBomb = await fetch('https://example.com/zip-bomb.jpg').then(r => r.arrayBuffer());
    
    await expect(
      processImage(Buffer.from(zipBomb))
    ).rejects.toThrow(/size limit/i);
  });
});

// Automated fuzzing with AFL
```bash
# Install American Fuzzy Lop
npm install -g afl-fuzz

# Instrument code for fuzzing
npm run build:fuzz

# Run fuzzer on image parser
afl-fuzz -i testcases/ -o findings/ -- ./fuzz-target @@
```

## Security Training Requirements

### Developer Onboarding

**Week 1**:
- [ ] Complete OWASP Top 10 training (4 hours)
- [ ] Review secure coding standards document
- [ ] Watch SQL injection demonstration
- [ ] Watch XSS demonstration

**Week 2**:
- [ ] Complete secure code review training (2 hours)
- [ ] Review past security incidents and lessons learned
- [ ] Pair with security champion on first PR review

**Ongoing** (Quarterly):
- [ ] Security newsletter with recent vulnerabilities
- [ ] Brown bag session on new attack techniques
- [ ] Capture-the-Flag (CTF) security exercises

### Training Resources

```markdown
## Internal Training
- Secure Coding Guidelines: docs/security/50_SECURE_SDLC.md
- Threat Modeling Guide: docs/security/THREAT_MODELING.md
- Security Incident Retrospectives: docs/security/incidents/

## External Training
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- PortSwigger Web Security Academy: https://portswigger.net/web-security
- SANS Secure Coding: https://www.sans.org/cyber-security-courses/secure-coding/
- PentesterLab: https://pentesterlab.com/

## Practice Platforms
- HackTheBox: https://www.hackthebox.com/
- TryHackMe: https://tryhackme.com/
- OWASP WebGoat: https://owasp.org/www-project-webgoat/
```

## Time-Boxed Waivers Policy

**When to Grant Waivers**:
- Security control blocks critical business need
- Compensating controls reduce risk to acceptable level
- Time-limited exception while permanent fix developed

**Waiver Process**:
```markdown
## Security Waiver Request

**Requestor**: @developer-name
**Date**: YYYY-MM-DD
**Expiration**: YYYY-MM-DD (max 90 days)

### Security Control
Which security requirement needs waiver?
Example: "Password complexity requirement (min 12 chars)"

### Business Justification
Why is this waiver necessary?
Example: "Legacy API integration requires 8-char password for compatibility"

### Risk Assessment
What is the security risk if waived?
- **Likelihood**: Low / Medium / High
- **Impact**: Low / Medium / High
- **Overall Risk**: Low / Medium / High / Critical

### Compensating Controls
What mitigations reduce the risk?
Example: "Implement account lockout after 3 failed attempts, require 2FA"

### Remediation Plan
How and when will this be fixed permanently?
Example: "Migrate to OAuth2 by 2024-Q2, removing password dependency"

### Approval
- [ ] Security Team: @security-lead
- [ ] Engineering Manager: @eng-manager
- [ ] CISO: @ciso (if High/Critical risk)

### Tracking
- Jira ticket: SEC-123
- Review date: YYYY-MM-DD (30 days before expiration)
```

**Waiver Tracking**:
```typescript
// scripts/security-waivers.ts
interface SecurityWaiver {
  id: string;
  control: string;
  justification: string;
  risk: 'Low' | 'Medium' | 'High' | 'Critical';
  compensating: string[];
  expiration: Date;
  approved: boolean;
  approvers: string[];
}

// Automated expiration alerts
const waivers = loadWaivers();
const expiringSoon = waivers.filter(w => 
  w.expiration.getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000
);

if (expiringSoon.length > 0) {
  sendAlert('Security waivers expiring in 7 days', expiringSoon);
}
```

## Security Champions Program

**Role**: Security Champions are developers embedded in each team who advocate for security

**Responsibilities**:
- Lead security discussions in sprint planning
- Review PRs for security issues
- Triage security findings from automated tools
- Coordinate with security team on incidents
- Deliver security training to team

**Selection Criteria**:
- 2+ years development experience
- Demonstrated interest in security
- Strong code review skills
- Good communicator

**Support**:
- Monthly security champion sync (1 hour)
- Dedicated Slack channel (#security-champions)
- 20% time allocation for security activities
- Priority access to security training

## Third-Party Code Review

**When Required**:
- Open-source dependencies with < 1000 weekly downloads
- Dependencies with no recent updates (> 1 year)
- Dependencies with known vulnerabilities
- Vendor-provided SDKs
- Code copied from Stack Overflow / blog posts

**Review Process**:
```markdown
## Third-Party Code Review

### Dependency Info
- Name: lodash.merge
- Version: 4.6.2
- License: MIT
- GitHub: https://github.com/lodash/lodash
- Downloads: 20M/week

### Security Check
- [ ] npm audit shows no vulnerabilities
- [ ] GitHub Security tab has no alerts
- [ ] Snyk scan passes
- [ ] No hardcoded secrets in source
- [ ] No obfuscated code

### Functionality Review
- [ ] Code does what it claims
- [ ] No unexpected network requests
- [ ] No filesystem access beyond documented
- [ ] No eval() or Function() usage

### Maintenance Check
- [ ] Recent commits (within 6 months)
- [ ] Responsive to security issues
- [ ] Active maintainers (2+)
- [ ] Good test coverage (>80%)

### Alternatives Considered
- Native JavaScript: Array.merge() - insufficient
- lodash: Full library - too large (70KB)
- lodash.merge: Targeted function - optimal (5KB)

### Approval
- [ ] Developer: @dev-name
- [ ] Security Champion: @champion-name
```

## Pre-Production Security Validation

**Staging Environment Checks** (Before Production Deploy):

```bash
#!/bin/bash
# scripts/pre-production-security-check.sh

echo "🔒 Pre-Production Security Validation"

# 1. Dependency vulnerabilities
echo "📦 Checking dependencies..."
npm audit --audit-level=high || exit 1

# 2. Secret detection
echo "🔑 Scanning for secrets..."
npx detect-secrets --scan --exclude-files package-lock.json || exit 1

# 3. SAST scanning
echo "🔍 Running SAST..."
npm run lint:security || exit 1

# 4. Configuration validation
echo "⚙️ Validating configuration..."
npm run validate:env || exit 1

# 5. Security headers
echo "🛡️ Testing security headers..."
curl -I https://staging.cloudgallery.app | grep -q "Strict-Transport-Security" || exit 1
curl -I https://staging.cloudgallery.app | grep -q "X-Content-Type-Options: nosniff" || exit 1

# 6. HTTPS enforcement
echo "🔒 Testing HTTPS enforcement..."
curl -I http://staging.cloudgallery.app | grep -q "301\|302" || exit 1

# 7. Authentication tests
echo "🔐 Testing authentication..."
npm run test:auth || exit 1

# 8. Rate limiting
echo "🚦 Testing rate limits..."
npm run test:rate-limit || exit 1

echo "✅ All security checks passed!"
```

**Production Deployment Gate**:
```yaml
# .github/workflows/deploy-production.yml
jobs:
  security-validation:
    runs-on: ubuntu-latest
    steps:
      - name: Security Checks
        run: ./scripts/pre-production-security-check.sh
      
      - name: Penetration Test Results
        run: |
          # Verify recent pentest passed
          if [ ! -f "pentest-$(date +%Y-%m).passed" ]; then
            echo "No penetration test results for this month"
            exit 1
          fi
  
  deploy:
    needs: security-validation
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Production
        run: npm run deploy:production
```

## References

- Microsoft SDL: https://www.microsoft.com/en-us/securityengineering/sdl
- OWASP SAMM: https://owaspsamm.org/
- NIST Secure Software Development Framework: https://csrc.nist.gov/publications/detail/sp/800-218/final
- BSIMM: https://www.bsimm.com/

---
*This document should be reviewed annually and after major security incidents.*
