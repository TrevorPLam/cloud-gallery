# Cryptography Policy

[← Back to Security Index](./00_INDEX.md)

**Purpose**: Define approved cryptographic algorithms, key management practices, and TLS requirements for Cloud Gallery. Ensures all cryptography is implemented correctly and securely.

**Last Updated**: 2026-02-04  
**Next Review**: Annually or before implementing encryption features

---

## Table of Contents
- [Core Principles](#core-principles)
- [Approved Algorithms](#approved-algorithms)
- [Key Management](#key-management)
- [TLS Requirements](#tls-requirements)
- [Data Encryption](#data-encryption)
- [Secure Storage](#secure-storage)
- [Validation](#validation)

---

## Core Principles

### 1. No Custom Cryptography
**Rule**: NEVER implement custom cryptographic algorithms or protocols.

**Rationale**: Cryptography is extremely difficult to implement correctly. Even experts make mistakes. One flaw can compromise entire system security.

**Policy**:
- ✅ Use well-tested libraries: Node.js `crypto` module, `libsodium`, `@noble/hashes`
- ✅ Use standard protocols: TLS 1.2+, OAuth 2.0, JWT (with standard libs)
- ❌ Do NOT implement own encryption, hashing, or signature schemes
- ❌ Do NOT modify cryptographic library internals

**Evidence**: No custom crypto in codebase currently.

**Validation**:
```bash
# Check for suspicious custom crypto patterns
grep -r "function encrypt\|function decrypt\|function hash" server/ client/
# Expected: Only usage of library functions, not custom implementations

# Verify using standard libraries
grep -r "crypto\|bcrypt\|argon2\|sodium" package.json
# Expected: Standard crypto libraries (when added)
```

### 2. Use Strong Defaults
**Rule**: Always use maximum security settings unless there's a compelling compatibility reason.

**Policy**:
- ✅ Prefer stronger algorithm when multiple options exist (AES-256 over AES-128)
- ✅ Use recommended parameters (Argon2 memory cost, PBKDF2 iterations)
- ✅ Enable all security features by default (HTTPS, secure cookies, HSTS)
- ❌ Do NOT weaken crypto for convenience or performance without explicit risk acceptance

### 3. Crypto Agility
**Rule**: Design systems to allow algorithm upgrades without major refactoring.

**Implementation**:
- Version crypto operations (e.g., `v1:encrypted-data-here`)
- Store algorithm metadata with encrypted data
- Plan for algorithm deprecation (SHA-1 → SHA-256, TLS 1.0 → 1.2)

---

## Approved Algorithms

### Symmetric Encryption

#### AES-256-GCM (Recommended)
- **Use Case**: Encrypting sensitive photo metadata, user data
- **Key Size**: 256 bits
- **Mode**: GCM (Galois/Counter Mode) - provides authentication + encryption
- **IV Size**: 96 bits (12 bytes) - MUST be unique per encryption
- **Authentication Tag**: 128 bits (16 bytes)

**Why GCM?**
- Authenticated encryption (prevents tampering)
- Parallelizable (good performance)
- Industry standard (NIST-approved)

**Implementation**:
```typescript
// server/crypto/encryption.ts (future)
import crypto from 'crypto';

export function encrypt(plaintext: string, key: Buffer): { 
  ciphertext: string; 
  iv: string; 
  authTag: string;
} {
  const iv = crypto.randomBytes(12);  // 96-bit IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    ciphertext,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

export function decrypt(
  ciphertext: string, 
  key: Buffer, 
  iv: string, 
  authTag: string
): string {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm', 
    key, 
    Buffer.from(iv, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
  plaintext += decipher.final('utf8');
  
  return plaintext;
}
```

**Critical Rules**:
- ❌ **NEVER reuse IVs** - Generate new random IV for each encryption
- ❌ **NEVER ignore auth tag** - Always verify tag on decryption (prevents tampering)
- ✅ **Use crypto.randomBytes()** for IV generation (cryptographically secure)

#### ChaCha20-Poly1305 (Alternative)
- **Use Case**: Mobile platforms (better performance on ARM without AES-NI)
- **Key Size**: 256 bits
- **Nonce Size**: 96 bits
- **Library**: `@noble/ciphers` or `libsodium`

**When to use**: On mobile devices without hardware AES acceleration.

### Asymmetric Encryption

#### RSA-2048 (Minimum), RSA-4096 (Recommended)
- **Use Case**: Key exchange, future end-to-end encryption
- **Key Size**: 4096 bits (recommended), 2048 bits (minimum)
- **Padding**: OAEP with SHA-256
- **⚠️ Deprecation**: RSA-2048 deprecated after 2030 per NIST

**Implementation**:
```typescript
// RSA key generation (future)
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});
```

#### Elliptic Curve: X25519 (Preferred for Key Exchange)
- **Use Case**: Diffie-Hellman key exchange, forward secrecy
- **Curve**: Curve25519
- **Library**: `@noble/curves` or Node.js `crypto.diffieHellman`

**Why Curve25519?**
- Faster than RSA
- Smaller keys (32 bytes vs 256 bytes for RSA-2048)
- Safe from timing attacks by design
- Used by Signal Protocol, WireGuard

### Hashing

#### Passwords: Argon2id (Recommended)
- **Use Case**: Password hashing for user authentication
- **Variant**: Argon2id (hybrid mode - best of Argon2i and Argon2d)
- **Parameters**:
  - Memory Cost: 64 MB (65536 KiB)
  - Time Cost: 3 iterations
  - Parallelism: 4 threads
  - Salt: 16 bytes (random per password)
  
**Why Argon2id?**
- Winner of Password Hashing Competition (2015)
- Resistant to GPU/ASIC attacks (memory-hard)
- Resistant to side-channel attacks

**Evidence**: [shared/schema.ts:22](../../shared/schema.ts) - Password field exists (needs hashing)

**Implementation**: See [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md#primary-username--password)

#### Passwords: bcrypt (Acceptable Alternative)
- **Use Case**: Password hashing if Argon2 unavailable
- **Work Factor**: Minimum 12 (2^12 rounds = 4096)
- **Salt**: Automatic (generated by bcrypt library)

**When to use**: If Argon2 not available on platform (unlikely in 2026).

#### General Hashing: SHA-256
- **Use Case**: File integrity checks, non-password hashing
- **Output Size**: 256 bits (32 bytes)
- **Library**: Node.js `crypto.createHash('sha256')`

**Implementation**:
```typescript
import crypto from 'crypto';

export function hashFile(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
```

#### ❌ Deprecated Algorithms
- **MD5**: Broken (collision attacks), only acceptable for non-security use (ETags)
- **SHA-1**: Broken (SHAttered attack 2017), do not use
- **PBKDF2 with < 100k iterations**: Too weak against modern GPUs

### Digital Signatures

#### Ed25519 (Recommended)
- **Use Case**: Code signing, data integrity verification
- **Signature Size**: 64 bytes
- **Public Key Size**: 32 bytes
- **Library**: `@noble/curves` or Node.js `crypto.sign`

**Why Ed25519?**
- Fast signature generation and verification
- Small signatures and keys
- Deterministic (same message + key = same signature)
- Used by SSH, Git commit signing

#### RSA-PSS with SHA-256 (Alternative)
- **Use Case**: When Ed25519 not supported by legacy systems
- **Key Size**: 4096 bits
- **Padding**: PSS (Probabilistic Signature Scheme)
- **Hash**: SHA-256

### Message Authentication Codes (MAC)

#### HMAC-SHA256
- **Use Case**: API request signing, webhook verification, data integrity
- **Key Size**: 256 bits (32 bytes)
- **Output Size**: 256 bits (32 bytes)

**Implementation**:
```typescript
import crypto from 'crypto';

export function hmac(message: string, key: Buffer): string {
  return crypto.createHmac('sha256', key).update(message).digest('hex');
}

export function verifyHmac(message: string, key: Buffer, expectedMac: string): boolean {
  const actualMac = hmac(message, key);
  return crypto.timingSafeEqual(
    Buffer.from(actualMac, 'hex'),
    Buffer.from(expectedMac, 'hex')
  );
}
```

**Critical**: Always use `crypto.timingSafeEqual()` to prevent timing attacks.

---

## Key Management

### Key Generation

**Requirements**:
- ✅ Use cryptographically secure random number generator (CSRNG)
  - Node.js: `crypto.randomBytes()`
  - React Native: `expo-crypto.getRandomBytes()`
- ✅ Generate keys on secure server, not client (for symmetric keys)
- ✅ Use sufficient key length (see algorithm specs above)
- ❌ Do NOT derive keys from weak sources (timestamps, Math.random(), user input directly)

**Key Derivation (from password)**:
```typescript
// Derive encryption key from user password (future - for client-side encryption)
import { pbkdf2Sync } from 'crypto';

export function deriveKeyFromPassword(password: string, salt: Buffer): Buffer {
  return pbkdf2Sync(
    password,
    salt,
    100000,  // 100k iterations (minimum for PBKDF2-SHA256)
    32,      // 32 bytes = 256 bits
    'sha256'
  );
}
```

**Note**: PBKDF2 for key derivation, Argon2 for password hashing. Different use cases.

### Key Storage

#### Server-Side Keys

**Environment Variables** (Current State):
- Store in `.env` file (local development)
- Use Replit Secrets (production on Replit)
- Use AWS Secrets Manager, HashiCorp Vault, or equivalent (cloud deployment)

**Example**:
```bash
# .env (DO NOT COMMIT)
JWT_ACCESS_SECRET=<64-character-hex-string>
JWT_REFRESH_SECRET=<64-character-hex-string>
DATABASE_ENCRYPTION_KEY=<64-character-hex-string>
```

**Generation**:
```bash
# Generate secure random key (32 bytes = 256 bits)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Rules**:
- ✅ Generate keys with CSRNG
- ✅ Minimum 256 bits (32 bytes) for symmetric keys
- ✅ Different keys for different purposes (JWT access vs refresh vs encryption)
- ❌ **NEVER commit keys to Git** - Add `.env` to `.gitignore`
- ❌ **NEVER log keys** - Sanitize logs before writing

**Evidence**: 
- [.gitignore](../../.gitignore) - Should include `.env`
- [server/index.ts](../../server/index.ts) - Uses `process.env` for config

#### Client-Side Keys (Mobile)

**iOS Keychain**:
```typescript
// client/lib/secure-storage.ts (future)
import * as SecureStore from 'expo-secure-store';

export async function saveEncryptionKey(key: string): Promise<void> {
  await SecureStore.setItemAsync('userEncryptionKey', key, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED,
    requireAuthentication: true  // Biometric/PIN required to read
  });
}
```

**Android Keystore**:
- Keys stored in hardware-backed Keystore (on modern devices)
- Protected by device lock screen
- Keys never leave secure hardware

**Rules**:
- ✅ Use `expo-secure-store` or native Keychain/Keystore APIs
- ✅ Require biometric/PIN for sensitive key access
- ❌ Do NOT store keys in AsyncStorage (not encrypted)
- ❌ Do NOT store keys in app code (can be reverse-engineered)

### Key Rotation

**Policy**: Rotate cryptographic keys periodically to limit exposure from compromise.

| Key Type | Rotation Frequency | Trigger |
|----------|-------------------|---------|
| JWT Access Secret | Annually | Key compromise suspected |
| JWT Refresh Secret | Annually | Key compromise suspected |
| Database Encryption Key | Every 2 years | Key compromise, compliance requirement |
| User Password | User-initiated | Password breach detected, every 90 days (optional) |
| TLS Certificate | Annually (before expiration) | Certificate revocation |

**Rotation Process**:
1. Generate new key
2. Deploy new key alongside old key (dual-key period)
3. Configure system to encrypt with new key, decrypt with both keys
4. After grace period (e.g., 7 days for JWT), remove old key
5. Re-encrypt data encrypted with old key (for data-at-rest)

**Implementation Strategy**:
```typescript
// Support multiple JWT signing keys for rotation
const JWT_SECRETS = [
  process.env.JWT_SECRET_CURRENT!,  // Use this for signing
  process.env.JWT_SECRET_PREVIOUS   // Accept this for verification during rotation
].filter(Boolean);

export function verifyAccessToken(token: string): TokenPayload | null {
  for (const secret of JWT_SECRETS) {
    try {
      return jwt.verify(token, secret, { algorithms: ['HS256'] }) as TokenPayload;
    } catch {
      // Try next key
    }
  }
  return null;  // All keys failed
}
```

---

## TLS Requirements

### Protocol Version

**Minimum**: TLS 1.2  
**Recommended**: TLS 1.3

**Rationale**:
- TLS 1.0 and 1.1 deprecated by major browsers (2020)
- TLS 1.2 is industry baseline
- TLS 1.3 removes legacy crypto, faster handshake, forward secrecy by default

**Evidence**:
- React Native enforces TLS 1.2+ by default on iOS/Android
- Express server relies on Node.js TLS implementation (supports 1.2 and 1.3)

**Configuration**:
```typescript
// server/https-server.ts (future - if running HTTPS directly)
import https from 'https';
import fs from 'fs';

const server = https.createServer({
  key: fs.readFileSync('server-key.pem'),
  cert: fs.readFileSync('server-cert.pem'),
  minVersion: 'TLSv1.2',  // Enforce minimum TLS 1.2
  ciphers: [
    'TLS_AES_256_GCM_SHA384',         // TLS 1.3
    'TLS_CHACHA20_POLY1305_SHA256',   // TLS 1.3
    'TLS_AES_128_GCM_SHA256',         // TLS 1.3
    'ECDHE-RSA-AES256-GCM-SHA384',    // TLS 1.2
    'ECDHE-RSA-AES128-GCM-SHA256'     // TLS 1.2
  ].join(':'),
  honorCipherOrder: true  // Server's cipher preference
}, app);
```

**Note**: In production, TLS termination usually handled by reverse proxy (Nginx, Cloudflare, AWS ALB).

### Certificate Validation

**Client (React Native)**:
- ✅ Validate server certificates by default (React Native does this)
- ✅ Check certificate chain against trusted CA list
- ✅ Verify hostname matches certificate Common Name (CN) or SAN
- ❌ **NEVER use trust-all-certs mode** (even in development)
- ❌ **NEVER disable certificate validation**

**Anti-Pattern** (DO NOT DO):
```typescript
// ❌ DANGEROUS - Disables certificate validation
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';  // NEVER DO THIS
```

**Certificate Pinning** (Future Enhancement):
- Pin expected certificate or public key in mobile app
- Prevents MITM even if CA compromised
- Requires app update to change certificates (high maintenance)
- Recommended for high-security apps, optional for Cloud Gallery MVP

### HTTPS Enforcement

**Policy**: All network traffic MUST use HTTPS (no HTTP).

**Server Configuration**:
```typescript
// server/middleware/https-redirect.ts (future)
export function enforceHTTPS(req: Request, res: Response, next: NextFunction) {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
}
```

**HSTS Header** (HTTP Strict Transport Security):
```typescript
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  next();
});
```

**Effect**: Browsers will refuse to connect over HTTP after first HTTPS visit.

---

## Data Encryption

### Current State: No Encryption at Rest

**Evidence**: 
- [client/lib/storage.ts](../../client/lib/storage.ts) - AsyncStorage stores plaintext JSON
- No encryption in server storage layer

**Risk**: Photos and metadata stored unencrypted on device.

**Mitigation**: Rely on OS-level device encryption (FileVault on iOS, FDE on Android).

### Future: Selective Encryption

**Candidates for Encryption**:
1. **User profile (email, name)** - PII
2. **Photo metadata (location, tags)** - Privacy-sensitive
3. **Session tokens** - Confidentiality-critical (use secure storage APIs)

**Not Encrypted**:
- Photo image files (too large, performance cost, OS encryption sufficient)
- Album names (user-controlled, low sensitivity)
- Photo URIs (local file paths, not sensitive)

**Implementation Strategy** (Future):
```typescript
// client/lib/secure-data.ts (future)
import { encrypt, decrypt } from './crypto';
import * as SecureStore from 'expo-secure-store';

async function getDataEncryptionKey(): Promise<Buffer> {
  let key = await SecureStore.getItemAsync('dataEncryptionKey');
  if (!key) {
    // Generate on first use
    key = crypto.randomBytes(32).toString('hex');
    await SecureStore.setItemAsync('dataEncryptionKey', key);
  }
  return Buffer.from(key, 'hex');
}

export async function saveEncryptedProfile(profile: UserProfile): Promise<void> {
  const key = await getDataEncryptionKey();
  const plaintext = JSON.stringify(profile);
  const { ciphertext, iv, authTag } = encrypt(plaintext, key);
  
  await AsyncStorage.setItem('@photo_vault_user_encrypted', JSON.stringify({
    ciphertext,
    iv,
    authTag
  }));
}

export async function getEncryptedProfile(): Promise<UserProfile | null> {
  const key = await getDataEncryptionKey();
  const data = await AsyncStorage.getItem('@photo_vault_user_encrypted');
  if (!data) return null;
  
  const { ciphertext, iv, authTag } = JSON.parse(data);
  const plaintext = decrypt(ciphertext, key, iv, authTag);
  return JSON.parse(plaintext);
}
```

**Key Points**:
- Data encryption key stored in iOS Keychain / Android Keystore
- Key protected by device lock screen
- If device locked, app cannot decrypt data
- If device stolen and unlocked, OS encryption protects Keychain/Keystore

### End-to-End Encryption (E2EE) - Future

For cloud sync, consider E2EE to prevent server from reading photos:

**Architecture**:
1. User enters password → derive encryption key via Argon2
2. Encrypt photos client-side with AES-256-GCM
3. Upload encrypted photos to server
4. Server stores encrypted data (cannot decrypt without user password)
5. Other devices: User enters password → derive same key → decrypt photos

**Trade-offs**:
- ✅ Maximum privacy (server cannot read data)
- ✅ Protection against server breach
- ❌ Password reset = data loss (no password recovery possible)
- ❌ No server-side features (search, AI tagging require plaintext)
- ❌ Performance overhead (encrypt/decrypt on device)

**Examples**: Signal, Apple iCloud with Advanced Data Protection

---

## Secure Storage

### Mobile (Current Focus)

#### iOS Keychain
- **Use For**: Refresh tokens, encryption keys, user credentials
- **Protection**: Hardware-backed (Secure Enclave on A7+ chips)
- **Access Control**: Biometric/PIN required
- **Library**: `expo-secure-store`

**Evidence**: [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md#mobile-token-storage)

#### Android Keystore
- **Use For**: Same as iOS Keychain
- **Protection**: Hardware-backed on devices with TEE (Trusted Execution Environment)
- **Access Control**: Lock screen pattern/PIN/biometric
- **Library**: `expo-secure-store`

#### AsyncStorage
- **Use For**: Non-sensitive data only (photo metadata, album structure)
- **Protection**: App sandboxing (OS-level)
- **NOT For**: Passwords, tokens, encryption keys (not encrypted)

**Evidence**: [client/lib/storage.ts](../../client/lib/storage.ts)

### Server (Future)

#### Environment Variables
- **Use For**: Configuration, non-secret settings
- **Protection**: File permissions (chmod 600)
- **NOT For**: Production secrets (use secrets manager)

#### Secrets Manager
- **Options**: AWS Secrets Manager, Azure Key Vault, HashiCorp Vault, Replit Secrets
- **Use For**: Database passwords, API keys, encryption keys
- **Benefits**: Centralized management, audit logs, automatic rotation

---

## Validation

### Manual Checks

```bash
# 1. Check no custom crypto implementations
grep -rn "function encrypt\|function hash\|function sign" server/ client/ | grep -v node_modules
# Expected: Only library usage, no custom crypto

# 2. Verify secure random number generation
grep -rn "Math.random\|Date.now" server/ client/ | grep -v node_modules | grep -i "key\|token\|salt\|iv"
# Expected: No results (these are not cryptographically secure)

# 3. Check for weak algorithms
grep -rn "md5\|sha1\|des\|rc4" server/ client/ | grep -v node_modules
# Expected: No results (these algorithms are deprecated)

# 4. Verify TLS enforcement
grep -rn "NODE_TLS_REJECT_UNAUTHORIZED" server/ client/
# Expected: No results (never disable TLS validation)

# 5. Check for hardcoded secrets
grep -rn "password.*=.*['\"].*['\"]" server/ client/ shared/ | grep -v "placeholder\|example"
# Expected: No hardcoded passwords

# 6. Verify key storage (future)
grep -rn "localStorage.*token\|sessionStorage.*token" client/
# Expected: No results (never store tokens in web storage)
```

### Automated Tests (Future)

```typescript
// tests/crypto.test.ts (future)
describe('Cryptography', () => {
  it('generates unique IVs for each encryption', () => {
    const key = crypto.randomBytes(32);
    const plaintext = 'test message';
    
    const result1 = encrypt(plaintext, key);
    const result2 = encrypt(plaintext, key);
    
    expect(result1.iv).not.toBe(result2.iv);  // IVs must differ
  });
  
  it('verifies auth tag on decryption', () => {
    const key = crypto.randomBytes(32);
    const { ciphertext, iv, authTag } = encrypt('test', key);
    
    const tamperedAuthTag = Buffer.from(authTag, 'hex');
    tamperedAuthTag[0] ^= 1;  // Flip one bit
    
    expect(() => {
      decrypt(ciphertext, key, iv, tamperedAuthTag.toString('hex'));
    }).toThrow();  // Must reject tampered data
  });
  
  it('uses timing-safe comparison for MACs', () => {
    const key = crypto.randomBytes(32);
    const message = 'test message';
    const mac1 = hmac(message, key);
    const mac2 = hmac(message + 'x', key);
    
    // verifyHmac must use crypto.timingSafeEqual internally
    expect(verifyHmac(message, key, mac1)).toBe(true);
    expect(verifyHmac(message, key, mac2)).toBe(false);
  });
});
```

### External Audits

**Pre-Launch Security Audit** (Cloud Sync Launch):
- Third-party cryptography review
- Penetration testing focusing on crypto implementation
- Verify key management practices
- Test for common crypto vulnerabilities (IV reuse, weak keys, timing attacks)

---

## Related Documentation

- [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md) - Password hashing, JWT signing
- [10_THREAT_MODEL.md](./10_THREAT_MODEL.md) - Crypto-related threats (T2, T8, T10, T14)
- [13_APPSEC_BOUNDARIES.md](./13_APPSEC_BOUNDARIES.md) - Input validation before crypto operations

---

## Deprecation Timeline

| Algorithm | Status | Action Required | Deadline |
|-----------|--------|-----------------|----------|
| TLS 1.0/1.1 | ❌ Deprecated | Disable support | Already done |
| SHA-1 | ❌ Deprecated | Replace with SHA-256 | Already done |
| RSA-1024 | ❌ Deprecated | Replace with RSA-2048+ | Already done |
| RSA-2048 | ⚠️ Deprecating | Plan migration to RSA-4096 or ECC | 2030 |
| 3DES | ❌ Deprecated | Replace with AES | Already done |
| MD5 | ❌ Deprecated | Never use for security | Already done |

**Stay Updated**: Monitor NIST, OWASP, and IETF for algorithm recommendations.

---

**Last Updated**: 2026-02-04  
**Next Review**: Annually (Feb 2027) or before implementing encryption features
