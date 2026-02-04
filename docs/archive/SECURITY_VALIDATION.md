# Security Validation Checklist

**Purpose**: Runnable commands to validate security controls are working correctly.  
**Last Updated**: 2026-02-04  
**Audience**: Developers, Security Team, CI/CD

This document provides concrete validation steps for each security control, mapping to the THREAT_MODEL.md evidence requirements.

---

## Prerequisites

```bash
# Install dependencies
npm ci

# Set environment for testing
export NODE_ENV=development
```

---

## Phase 1: Runtime Hardening

### Control S1.1: Security Headers

**Test**: Verify security headers are present in all responses

```bash
# Start server
npm run server:dev &
SERVER_PID=$!
sleep 2

# Test security headers
curl -I http://localhost:5000/api/health 2>&1 | grep -E "(X-Frame-Options|X-Content-Type-Options|Content-Security-Policy|Strict-Transport-Security|Referrer-Policy)"

# Expected output (partial):
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Content-Security-Policy: default-src 'self'; ...
# Referrer-Policy: strict-origin-when-cross-origin

# Cleanup
kill $SERVER_PID
```

**Automated Test**:
```bash
npm test -- server/middleware.test.ts -t "Security Headers"
```

**Evidence**: `server/middleware.ts:securityHeaders()`, Test: `server/middleware.test.ts:7-108`

---

### Control S1.2: HSTS (Production Only)

**Test**: Verify HSTS is enabled in production mode

```bash
# Production mode
export NODE_ENV=production
npm run server:dev &
SERVER_PID=$!
sleep 2

curl -I http://localhost:5000/ | grep "Strict-Transport-Security"
# Expected: Strict-Transport-Security: max-age=31536000; includeSubDomains

# Development mode
kill $SERVER_PID
export NODE_ENV=development
npm run server:dev &
SERVER_PID=$!
sleep 2

curl -I http://localhost:5000/ | grep "Strict-Transport-Security"
# Expected: (no output - HSTS disabled in dev)

kill $SERVER_PID
```

**Automated Test**:
```bash
npm test -- server/middleware.test.ts -t "HSTS"
```

---

### Control S2.1: Password Strength Validation

**Test**: Verify password policy enforcement

```bash
npm test -- server/security.test.ts -t "Password Strength Validation"
```

**Expected**: All 11 tests pass:
- ✓ Accept strong password
- ✓ Reject short password (< 8 chars)
- ✓ Reject password without lowercase
- ✓ Reject password without uppercase
- ✓ Reject password without number
- ✓ Reject password without special character
- ✓ Reject common weak passwords
- ✓ Reject too long password (> 128 chars)
- ✓ Provide all relevant errors

**Evidence**: `server/security.ts:validatePasswordStrength()`, Test: `server/security.test.ts:163-239`

---

### Control S2.2 & D2.1: Rate Limiting

**Test**: Verify rate limits are enforced

```bash
npm test -- server/middleware.test.ts -t "Rate Limiting"
```

**Manual Test**:
```bash
npm run server:dev &
SERVER_PID=$!
sleep 2

# Send 5 requests rapidly (should succeed)
for i in {1..5}; do
  curl http://localhost:5000/api/health
  echo ""
done

# 6th request should be rate limited (if max=5)
curl -v http://localhost:5000/api/health 2>&1 | grep "429"
# Expected: < HTTP/1.1 429 Too Many Requests

kill $SERVER_PID
```

**Expected Headers**:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests left in window
- `X-RateLimit-Reset`: When the limit resets

---

### Control T1.1: SQL Injection Prevention

**Test**: Verify ORM usage (no raw SQL)

```bash
# Check that no raw SQL queries exist in codebase
grep -r "db.query\|db.execute\|db.raw" server/ shared/ --include="*.ts" --include="*.tsx"

# Expected: No matches (or only safe parameterized usage)
```

**Manual Test**:
```bash
# Attempt SQL injection in username field
npm test -- shared/schema.test.ts

# Schema validation should reject invalid inputs before DB
```

**Evidence**: `shared/schema.ts` uses Drizzle ORM exclusively

---

### Control I1.1: No Stack Traces in Production

**Test**: Verify errors don't leak stack traces in production

```bash
npm test -- server/middleware.test.ts -t "Error Handler"
```

**Manual Test**:
```bash
# Production mode
export NODE_ENV=production
npm run server:dev &
SERVER_PID=$!
sleep 2

# Trigger error endpoint (create test endpoint that throws)
curl http://localhost:5000/api/error-test
# Expected: {"error":"Internal Server Error","correlationId":"req_..."}
# Should NOT contain "stack" field

# Development mode
kill $SERVER_PID
export NODE_ENV=development
npm run server:dev &
SERVER_PID=$!
sleep 2

curl http://localhost:5000/api/error-test
# Expected: {"error":"...","correlationId":"...","stack":"...","path":"..."}
# Should contain "stack" field for debugging

kill $SERVER_PID
```

---

### Control I2.1: PII Sanitization in Logs

**Test**: Verify log sanitization works

```bash
npm test -- server/security.test.ts -t "Sanitization for Logging"
```

**Manual Test**:
```typescript
import { sanitizeForLogging } from './server/security';

// Test cases
console.log(sanitizeForLogging('User email: john.doe@example.com'));
// Expected: "User email: j***@e***.com"

console.log(sanitizeForLogging('Request from 192.168.1.100'));
// Expected: "Request from 192.168.***"

console.log(sanitizeForLogging('Card: 4532-1234-5678-9010'));
// Expected: "Card: ****-****-****-****"
```

**Evidence**: `server/security.ts:sanitizeForLogging()`, Test: `server/security.test.ts:103-161`

---

### Control I3.1: Remove X-Powered-By Header

**Test**: Verify information disclosure headers are removed

```bash
npm run server:dev &
SERVER_PID=$!
sleep 2

curl -I http://localhost:5000/ | grep "X-Powered-By"
# Expected: (no output)

kill $SERVER_PID
```

**Automated Test**:
```bash
npm test -- server/middleware.test.ts -t "should remove X-Powered-By"
```

---

### Control D1.1: Body Size Limits

**Test**: Verify large payloads are rejected

```bash
npm test -- server/middleware.test.ts -t "Body Size Limits"
```

**Manual Test**:
```bash
npm run server:dev &
SERVER_PID=$!
sleep 2

# Send large JSON payload (> 10MB if limit is 10MB)
dd if=/dev/zero bs=1M count=11 | base64 | \
  curl -X POST http://localhost:5000/api/test \
  -H "Content-Type: application/json" \
  -d @- -v 2>&1 | grep "413"

# Expected: HTTP 413 Payload Too Large

kill $SERVER_PID
```

**Expected**: Server rejects with 413 status code

---

### CORS Security

**Test**: Verify CORS allows only whitelisted origins

```bash
npm test -- server/middleware.test.ts -t "CORS Security"
```

**Manual Test**:
```bash
npm run server:dev &
SERVER_PID=$!
sleep 2

# Allowed origin (example - adjust based on config)
curl -H "Origin: http://localhost:19000" \
     -I http://localhost:5000/api/health | \
     grep "Access-Control-Allow-Origin"
# Expected: Access-Control-Allow-Origin: http://localhost:19000

# Disallowed origin
curl -H "Origin: https://evil.com" \
     -I http://localhost:5000/api/health | \
     grep "Access-Control-Allow-Origin"
# Expected: (no CORS header)

kill $SERVER_PID
```

**Critical**: Never use wildcard `*` with credentials

---

### Request Correlation IDs

**Test**: Verify every request has correlation ID

```bash
npm test -- server/middleware.test.ts -t "Request ID"
```

**Manual Test**:
```bash
npm run server:dev &
SERVER_PID=$!
sleep 2

curl -I http://localhost:5000/api/health | grep "X-Request-ID"
# Expected: X-Request-ID: req_1234567890_abc123def456

# Custom ID
curl -H "X-Request-ID: my-custom-id" \
     -I http://localhost:5000/api/health | \
     grep "X-Request-ID"
# Expected: X-Request-ID: my-custom-id

kill $SERVER_PID
```

---

## Phase 2: Supply Chain Security

### Dependency Vulnerabilities

**Test**: Check for known vulnerabilities

```bash
npm audit --audit-level=moderate
```

**Expected**: Zero critical and high severity vulnerabilities

**CI Integration**: `.github/workflows/security-scan.yml` blocks on critical/high

---

### Secret Scanning

**Test**: Ensure no secrets in code

```bash
# If gitleaks is installed
gitleaks detect --no-git -v

# Alternative: grep for common patterns
grep -r "password.*=.*['\"][^'\"]\{8,\}['\"]" server/ client/ --include="*.ts" --exclude="*.test.ts"
# Expected: No hardcoded passwords

grep -r "api[_-]?key.*=.*['\"][A-Za-z0-9]\{20,\}['\"]" server/ client/ --include="*.ts" --exclude="*.test.ts"
# Expected: No API keys
```

---

### Lockfile Integrity

**Test**: Verify package-lock.json is in sync

```bash
npm install --package-lock-only --dry-run
```

**Expected**: No changes to package-lock.json

---

## Phase 3: Authentication & Authorization

### Password Hashing

**Test**: Verify PBKDF2 implementation

```bash
npm test -- server/security.test.ts -t "Password Hashing"
```

**Expected**: All tests pass:
- ✓ Hash a password (salt:hash format)
- ✓ Produce different hashes for same password (random salt)
- ✓ Verify correct password (timing-safe comparison)
- ✓ Reject incorrect password
- ✓ Reject invalid hash format

**Evidence**: `server/security.ts:hashPassword()`, `server/security.ts:verifyPassword()`

---

### Token Generation

**Test**: Verify secure random token generation

```bash
npm test -- server/security.test.ts -t "Token Generation"
```

**Expected**: All tests pass:
- ✓ Generate secure token (crypto.randomBytes)
- ✓ Generate unique tokens
- ✓ Generate custom length tokens
- ✓ Generate session token with expiry

---

## Phase 4: Full Test Suite

### Run All Security Tests

```bash
npm test -- server/security.test.ts server/middleware.test.ts
```

**Expected**: 50+ tests passing

### Generate Coverage Report

```bash
npm run test:coverage
```

**Expected**: 
- Security modules: >90% coverage
- Middleware: >80% coverage

---

## Phase 5: CI/CD Validation

### Local CI Simulation

```bash
# Run full CI pipeline locally
npm ci
npm run lint
npm run check:types
npm run test
npm audit --audit-level=moderate

# If all pass, code is ready
echo "✓ All security checks passed"
```

### GitHub Actions

**Verify workflows are enabled**:
- `.github/workflows/test-coverage.yml` - Tests + linting
- `.github/workflows/security-scan.yml` - Security gates

**Check latest run**:
```bash
gh run list --workflow=security-scan.yml --limit=1
gh run list --workflow=test-coverage.yml --limit=1
```

---

## Production Deployment Checklist

Before deploying to production, verify:

- [ ] `NODE_ENV=production` is set
- [ ] `TRUST_PROXY` is configured for load balancer
- [ ] Rate limiting uses Redis (not in-memory)
- [ ] HTTPS is enforced (HSTS enabled)
- [ ] Error handler doesn't leak stack traces (test above)
- [ ] Logs use PII sanitization
- [ ] CORS whitelist is production domains only (no localhost)
- [ ] Body size limits are appropriate for workload
- [ ] Database credentials are in secure secrets manager (not env vars in code)
- [ ] All npm audit findings are resolved or risk-accepted

---

## Troubleshooting

### Test Failures

1. **Rate limiting tests fail**: May be due to timing. Increase timeouts or run sequentially.
2. **CORS tests fail**: Check that test origins match configured whitelist.
3. **Header tests fail**: Verify middleware is applied before routes.

### Performance Impact

Security middleware should add < 10ms overhead per request. If higher:

1. Check if rate limiter is using in-memory store (switch to Redis for prod)
2. Verify CSP directives aren't overly complex
3. Profile with `console.time()` around middleware calls

---

## Evidence Map

| Control ID | Validation Command | Expected Result | Test Location |
|------------|-------------------|-----------------|---------------|
| S1.1 | `npm test -- server/middleware.test.ts -t "Security Headers"` | 8 tests pass | `middleware.test.ts:7-108` |
| S1.2 | `npm test -- server/middleware.test.ts -t "HSTS"` | 2 tests pass | `middleware.test.ts:32-60` |
| S2.1 | `npm test -- server/security.test.ts -t "Password Strength"` | 11 tests pass | `security.test.ts:163-239` |
| S2.2 | `npm test -- server/middleware.test.ts -t "Rate Limiting"` | 6 tests pass | `middleware.test.ts:149-244` |
| T1.1 | `grep -r "db.query" server/` | No matches | Manual check |
| I1.1 | `npm test -- server/middleware.test.ts -t "Error Handler"` | 3 tests pass | `middleware.test.ts:246-321` |
| I2.1 | `npm test -- server/security.test.ts -t "Sanitization"` | 6 tests pass | `security.test.ts:103-161` |
| I3.1 | `npm test -- server/middleware.test.ts -t "X-Powered-By"` | 1 test passes | `middleware.test.ts:90-97` |
| D1.1 | `npm test -- server/middleware.test.ts -t "Body Size"` | 2 tests pass | `middleware.test.ts:379-416` |
| D2.1 | `npm test -- server/middleware.test.ts -t "Rate Limiting"` | 6 tests pass | `middleware.test.ts:149-244` |

---

## Continuous Validation

**Daily**: CI runs all tests on every commit  
**Weekly**: Dependency vulnerability scan (Dependabot)  
**Monthly**: Manual penetration testing (if applicable)  
**Quarterly**: Full security review and threat model update

---

## Contact

**Security Issues**: GitHub Security Advisories  
**Questions**: Open issue with `security` label  
**Validation Failures**: Tag Security Team in PR

**Last Updated**: 2026-02-04  
**Next Review**: 2026-03-04
