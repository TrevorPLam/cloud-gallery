# Identity and Access Control

[← Back to Security Index](./00_INDEX.md)

**Purpose**: Define authentication, authorization, and access control policies for Cloud Gallery. Ensures only legitimate users access their own data.

**Last Updated**: 2026-02-04  
**Next Review**: Before cloud sync implementation

---

## Table of Contents
- [Current State](#current-state)
- [Future Authentication Requirements](#future-authentication-requirements)
- [Session Management](#session-management)
- [Cookie Security](#cookie-security)
- [Token Handling](#token-handling)
- [Rate Limiting](#rate-limiting)
- [Multi-Factor Authentication](#multi-factor-authentication)
- [Authorization Model](#authorization-model)
- [Permission Model](#permission-model)

---

## Current State

**Authentication**: **None** (MVP - Local-first app)

Cloud Gallery currently has **no authentication system**. The app is local-first, storing all data on device:
- Photos stored in device AsyncStorage
- No user accounts or login
- Physical device access = full data access
- Relies on OS-level device lock screen for protection

**Evidence**: 
- [client/lib/storage.ts](../../client/lib/storage.ts) - Pure local storage operations
- [server/routes.ts](../../server/routes.ts) - No auth routes defined
- [shared/schema.ts:17-23](../../shared/schema.ts) - User schema defined but unused

**Security Posture**:
- ✅ **Acceptable for MVP**: No network transmission of sensitive data
- ✅ **Device security**: iOS/Android OS enforces app sandboxing
- ⚠️ **Risk**: Device theft or sharing compromises photos
- ⚠️ **Risk**: No protection against malicious apps on rooted/jailbroken devices

**Mitigation Strategy**:
1. Trust OS device lock screen (PIN, biometric)
2. Trust OS app sandboxing (separate AsyncStorage per app)
3. Future: Add app-level PIN/biometric unlock
4. Future: Encrypt sensitive photo metadata at rest

---

## Future Authentication Requirements

When cloud sync is implemented, authentication becomes **mandatory**. Requirements:

### Supported Authentication Methods

#### Primary: Username + Password
- **Minimum password complexity**:
  - ≥ 12 characters (encourage 16+)
  - Mix of uppercase, lowercase, numbers, special characters
  - Not in common password breach list (check against Have I Been Pwned API)
  - No username/email in password
  
- **Storage**:
  - Hash with **Argon2id** (preferred) or bcrypt (minimum work factor 12)
  - Never store plaintext passwords
  - No password hints or security questions
  
- **Evidence**: [shared/schema.ts:22](../../shared/schema.ts) - Password field exists (currently stores plaintext - **MUST HASH**)

**Implementation**:
```typescript
// server/auth/password.ts (future)
import argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  // Argon2id with recommended parameters
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,  // 64 MB
    timeCost: 3,
    parallelism: 4
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
```

#### Secondary: OAuth 2.0 (Future Enhancement)
- **Supported Providers**: Google, Apple Sign-In
- **Benefits**: No password management, leverages platform security, MFA built-in
- **Implementation**: Standard OAuth 2.0 Authorization Code flow with PKCE
- **Token storage**: Refresh token in secure storage, access token in memory only

#### Tertiary: Biometric (Mobile-only)
- **Platforms**: Face ID (iOS), Touch ID (iOS), Fingerprint (Android), Face Unlock (Android)
- **Implementation**: Local device authentication, not server authentication
- **Use case**: Quick unlock without password re-entry
- **Fallback**: Always allow password as backup

---

## Session Management

### Access Token Strategy

**Token Type**: JWT (JSON Web Tokens)

**Access Token Lifetime**: **15 minutes**
- Short-lived to limit replay attack window
- Expired tokens cannot be used even if intercepted
- Forces refresh token usage

**Refresh Token Lifetime**: **7 days**
- Allows persistent login without frequent password re-entry
- Longer than access token but limited to prevent indefinite access

**Token Rotation**:
- Refresh token rotated on each use (one-time use)
- Old refresh token invalidated immediately
- Prevents token reuse if stolen

**Implementation Strategy**:
```typescript
// server/auth/jwt.ts (future)
import jwt from 'jsonwebtoken';

interface TokenPayload {
  userId: string;
  username: string;
  iat: number;
  exp: number;
}

export function generateAccessToken(userId: string, username: string): string {
  return jwt.sign(
    { userId, username },
    process.env.JWT_ACCESS_SECRET!,
    { expiresIn: '15m', algorithm: 'HS256' }
  );
}

export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: '7d', algorithm: 'HS256' }
  );
}

export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_ACCESS_SECRET!, {
      algorithms: ['HS256']
    }) as TokenPayload;
  } catch {
    return null;  // Expired or invalid
  }
}
```

### Session Invalidation

**Logout**:
- Client discards access token and refresh token
- Server adds refresh token to blocklist (Redis or DB)
- All API requests with that token immediately fail

**Password Change**:
- Invalidate ALL refresh tokens for user
- Force re-authentication on all devices

**Account Deletion**:
- Invalidate all tokens
- Delete all user data (photos, albums, profile)

**Inactivity Timeout**:
- After 7 days without refresh, user must re-authenticate
- Configurable per user (premium users get longer)

---

## Cookie Security

When using cookies for session management (web platform):

### Cookie Attributes (MANDATORY)

```typescript
// server/auth/cookies.ts (future)
app.use(cookieParser());

function setAuthCookie(res: Response, token: string) {
  res.cookie('refreshToken', token, {
    httpOnly: true,      // Prevent JavaScript access (XSS protection)
    secure: true,        // HTTPS only (prevent MITM)
    sameSite: 'strict',  // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    path: '/api/auth',   // Limit scope
    domain: undefined    // Current domain only, no subdomains
  });
}
```

**Attribute Rationale**:
- `httpOnly: true` - XSS cannot steal tokens via `document.cookie`
- `secure: true` - Forces HTTPS, prevents cleartext transmission
- `sameSite: 'strict'` - Blocks CSRF attacks (cookie not sent on cross-site requests)
- `maxAge` - Explicit expiration, not session-only
- `path: /api/auth` - Minimize exposure, only sent to auth endpoints
- No `domain` attribute - Same-origin only

**CSRF Token** (if using SameSite=lax or for extra defense):
- Generate random CSRF token on login
- Store in cookie with httpOnly: false (client needs to read it)
- Require `X-CSRF-Token` header on state-changing requests
- Validate token matches session

---

## Token Handling

### Security Rules (CRITICAL)

#### ❌ NEVER:
1. **Store tokens in localStorage or sessionStorage** (XSS can read)
2. **Pass tokens in URL query parameters** (logged in server logs, browser history, referrer headers)
3. **Log tokens** (even accidentally in debug logs)
4. **Store tokens in React state without encryption** (DevTools can inspect)
5. **Transmit tokens over HTTP** (only HTTPS)

#### ✅ ALWAYS:
1. **Store access tokens in memory only** (React Query cache or React state)
2. **Store refresh tokens in httpOnly cookies** (web) or secure storage (mobile)
3. **Use Authorization header** for access tokens: `Authorization: Bearer <token>`
4. **Sanitize logs** to remove tokens before writing
5. **Validate tokens on server** - never trust client

### Mobile Token Storage

**iOS**:
- Use **Keychain Services** for refresh token
- Access token in memory only (React state)
- Keychain encrypted by OS, protected by device lock

**Android**:
- Use **Android Keystore** for refresh token
- Access token in memory only
- Keystore hardware-backed on modern devices

**Implementation**:
```typescript
// client/lib/secure-storage.ts (future)
import * as SecureStore from 'expo-secure-store';

export async function saveRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync('refreshToken', token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED  // iOS only
  });
}

export async function getRefreshToken(): Promise<string | null> {
  return await SecureStore.getItemAsync('refreshToken');
}

export async function deleteRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync('refreshToken');
}
```

### Token Validation

Server MUST validate tokens on EVERY request:
1. Verify signature (HMAC or RSA)
2. Check expiration (exp claim)
3. Check not-before (nbf claim if present)
4. Validate issuer (iss claim)
5. Check token not in blocklist (for refresh tokens)
6. Verify user still exists and is active

**Middleware Implementation**:
```typescript
// server/middleware/auth.ts (future)
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/jwt';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  const payload = verifyAccessToken(token);
  
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  
  // Attach user to request
  req.user = { id: payload.userId, username: payload.username };
  next();
}
```

---

## Rate Limiting

Prevent brute force attacks and DoS by limiting request rates.

### Login Endpoint
- **Limit**: 5 attempts per IP per 15 minutes
- **Action on exceed**: 429 Too Many Requests, require CAPTCHA
- **Lockout**: After 10 failed attempts for same username, lock account for 30 min

### Token Refresh Endpoint
- **Limit**: 10 refreshes per user per hour
- **Action on exceed**: 429 Too Many Requests, force re-login

### API Endpoints (General)
- **Limit**: 100 requests per IP per minute (unauthenticated)
- **Limit**: 1000 requests per user per minute (authenticated)
- **Action on exceed**: 429 Too Many Requests with Retry-After header

### Implementation
```typescript
// server/middleware/rate-limit.ts (future)
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export const loginRateLimiter = rateLimit({
  store: new RedisStore({ client: redis, prefix: 'rl:login:' }),
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // 5 requests per window
  message: { error: 'Too many login attempts, try again later' },
  standardHeaders: true,  // Return rate limit info in headers
  legacyHeaders: false
});

export const apiRateLimiter = rateLimit({
  store: new RedisStore({ client: redis, prefix: 'rl:api:' }),
  windowMs: 60 * 1000,  // 1 minute
  max: 100,
  message: { error: 'Rate limit exceeded' }
});
```

**Configuration**:
- Use Redis for distributed rate limiting (supports multiple server instances)
- Return `X-RateLimit-*` headers so clients can back off
- Log rate limit violations for anomaly detection

---

## Multi-Factor Authentication

MFA adds critical defense against credential theft.

### MFA Strategy (Future)

**Phase 1 (Optional MFA)**:
- Users can enable MFA in settings
- TOTP (Time-based One-Time Password) using apps like Google Authenticator, Authy
- Backup codes provided (10 single-use codes)

**Phase 2 (Mandatory for Sensitive Operations)**:
- MFA required for:
  - Password change
  - Email change
  - Account deletion
  - Export all data

**Phase 3 (Risk-Based MFA)**:
- Trigger MFA if:
  - Login from new device
  - Login from unusual location (IP geolocation)
  - Login after password breach detected
  - Multiple failed login attempts

### TOTP Implementation
```typescript
// server/auth/mfa.ts (future)
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';

export function generateMFASecret(username: string): { secret: string; qrCode: string } {
  const secret = speakeasy.generateSecret({
    name: `Cloud Gallery (${username})`,
    issuer: 'Cloud Gallery'
  });
  
  const qrCode = await qrcode.toDataURL(secret.otpauth_url!);
  
  return {
    secret: secret.base32,
    qrCode
  };
}

export function verifyMFAToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1  // Allow 1 time-step tolerance for clock skew
  });
}
```

**Backup Codes**:
- Generate 10 random 8-character codes on MFA setup
- Hash codes before storing (bcrypt)
- Each code is single-use
- User can regenerate codes anytime (invalidates old ones)

---

## Authorization Model

**Principle**: **Deny by Default**

All resources are denied unless explicitly allowed.

### Access Control Rules

1. **Unauthenticated users**: 
   - ❌ Cannot access any `/api/*` routes (except `/api/auth/login`, `/api/auth/register`)
   
2. **Authenticated users**:
   - ✅ Can access own photos, albums, profile
   - ❌ Cannot access other users' data
   - ❌ Cannot perform admin operations
   
3. **Administrators** (future):
   - ✅ Can view audit logs
   - ✅ Can suspend user accounts
   - ❌ Cannot view user photos (end-to-end encryption prevents this)

### Resource Ownership Validation

Every API request MUST validate resource ownership:

```typescript
// server/middleware/ownership.ts (future)
export async function requirePhotoOwnership(req: Request, res: Response, next: NextFunction) {
  const photoId = req.params.photoId;
  const userId = req.user!.id;  // Set by requireAuth middleware
  
  const photo = await db.query.photos.findFirst({
    where: eq(photos.id, photoId)
  });
  
  if (!photo) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  
  if (photo.userId !== userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  req.photo = photo;  // Attach to request for handler
  next();
}

// Usage in route
app.delete('/api/photos/:photoId', requireAuth, requirePhotoOwnership, async (req, res) => {
  // User is authenticated AND owns this photo
  await deletePhoto(req.photo!.id);
  res.status(204).send();
});
```

### Cross-Tenant Isolation

Ensure users cannot access other users' data even with valid session:

**Database Schema**:
```typescript
// shared/schema.ts (extend current schema)
export const photos = pgTable('photos', {
  id: varchar('id').primaryKey(),
  userId: varchar('user_id').notNull().references(() => users.id),  // CRITICAL: foreign key
  uri: text('uri').notNull(),
  // ... other fields
});

// Add index for fast user-scoped queries
export const photoUserIdIndex = index('photo_user_id_idx').on(photos.userId);
```

**Query Pattern**:
```typescript
// ALWAYS filter by userId
const userPhotos = await db.query.photos.findMany({
  where: eq(photos.userId, req.user!.id)  // CRITICAL: user isolation
});

// NEVER do:
// const allPhotos = await db.query.photos.findMany();  // ❌ Leaks all users' data
```

---

## Permission Model

### Resource Permissions (Future)

When implementing shared albums or collaboration:

| Resource | Owner | Viewer | Editor | Admin |
|----------|-------|--------|--------|-------|
| View photo | ✅ | ✅ | ✅ | ✅ |
| Edit photo metadata | ✅ | ❌ | ✅ | ✅ |
| Delete photo | ✅ | ❌ | ❌ | ✅ |
| Share album | ✅ | ❌ | ❌ | ✅ |
| Add to album | ✅ | ❌ | ✅ | ✅ |
| Invite users | ✅ | ❌ | ❌ | ✅ |

**Implementation**: Role-Based Access Control (RBAC)
- Roles stored in `album_members` join table
- Check role on each operation
- Default role for album creator: Owner

---

## Validation Commands

```bash
# Check user schema is defined
grep -n "users = pgTable" shared/schema.ts
# Expected: Schema exists with username, password fields

# Verify no hardcoded credentials
grep -r "password.*=.*['\"]" server/ client/ shared/
# Expected: No results (passwords should never be hardcoded)

# Check for JWT usage (future)
grep -r "jwt" package.json
# Expected: jsonwebtoken in dependencies (after auth implemented)

# Verify secure storage on mobile (future)
grep -r "SecureStore" client/lib/
# Expected: Used for refresh token storage

# Check for rate limiting (future)
grep -r "rateLimit" server/
# Expected: Applied to auth routes
```

---

## Related Documentation

- [10_THREAT_MODEL.md](./10_THREAT_MODEL.md) - Authentication threats (AC1, AC2)
- [12_CRYPTO_POLICY.md](./12_CRYPTO_POLICY.md) - Password hashing, token signing
- [13_APPSEC_BOUNDARIES.md](./13_APPSEC_BOUNDARIES.md) - Input validation for auth inputs
- [User Schema](../../shared/schema.ts) - Database user table

---

## Implementation Checklist (Cloud Sync Launch)

- [ ] Implement Argon2id password hashing
- [ ] Generate JWT access tokens (15 min) and refresh tokens (7 days)
- [ ] Store refresh tokens in httpOnly cookies (web) and secure storage (mobile)
- [ ] Implement rate limiting on `/api/auth/login` (5 attempts / 15 min)
- [ ] Add `requireAuth` middleware to protect API routes
- [ ] Add `requireOwnership` validation for resource access
- [ ] Filter all DB queries by `userId` for tenant isolation
- [ ] Implement token blocklist (Redis) for logout
- [ ] Add MFA setup flow (optional initially)
- [ ] Security test: Attempt cross-user data access
- [ ] Security test: Token replay after logout
- [ ] Security test: Brute force login attempts

**Next Review**: During cloud sync design phase

