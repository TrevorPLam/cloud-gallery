# Threat Model

[← Back to Security Index](./00_INDEX.md)

**Purpose**: Identify and assess security threats to Cloud Gallery using structured threat modeling (STRIDE). Guides security control implementation and testing priorities.

**Last Updated**: 2026-02-04  
**Next Review**: Before cloud sync feature launch

## Table of Contents
- [Assets](#assets)
- [Actors](#actors)
- [Entry Points](#entry-points)
- [Trust Boundaries](#trust-boundaries)
- [STRIDE Threat Analysis](#stride-threat-analysis)
- [Abuse Cases](#abuse-cases)
- [Risk Register](#risk-register)

---

## Assets

Assets requiring protection, ranked by sensitivity:

### Critical Assets (P0)
1. **User Photos** (Confidentiality, Integrity)
   - Location: Device AsyncStorage (`@photo_vault_photos` key)
   - Risk: Personal/private images exposed or tampered
   - Evidence: [client/lib/storage.ts:15](../../client/lib/storage.ts)

2. **User Credentials** (Confidentiality) - *Future*
   - Location: Will be in iOS Keychain / Android Keystore
   - Risk: Account takeover if leaked
   - Current State: Not implemented (no auth yet)

### High Assets (P1)
3. **Photo Metadata** (Integrity)
   - Location: AsyncStorage with photo objects
   - Risk: Loss of organization, incorrect display
   - Evidence: [client/lib/storage.ts:25-32](../../client/lib/storage.ts)

4. **Album Relationships** (Integrity, Availability)
   - Location: AsyncStorage (`@photo_vault_albums` key)
   - Risk: Broken references, data corruption
   - Evidence: [client/lib/storage.ts:72-79](../../client/lib/storage.ts)

5. **Session Tokens** (Confidentiality) - *Future*
   - Location: Will be in secure storage or httpOnly cookies
   - Risk: Session hijacking, unauthorized access

### Medium Assets (P2)
6. **User Profile** (Confidentiality, Integrity)
   - Location: AsyncStorage (`@photo_vault_user` key)
   - Risk: Profile tampering (low impact currently)
   - Evidence: [client/lib/storage.ts:199-208](../../client/lib/storage.ts)

7. **API Endpoints** (Availability)
   - Location: Express server (future routes)
   - Risk: DoS, service disruption
   - Evidence: [server/routes.ts:15-22](../../server/routes.ts)

---

## Actors

### Legitimate Actors

#### 1. Mobile App User
- **Intent**: Store and organize photos
- **Access**: Full access to own data via app UI
- **Trust Level**: Trusted for own data
- **Authentication**: None currently (device physical access = auth)

#### 2. System Administrator - *Future*
- **Intent**: Manage infrastructure, debug issues
- **Access**: Backend systems, logs, database (when deployed)
- **Trust Level**: Highly trusted
- **Authentication**: SSH keys, admin credentials

### Threat Actors

#### 3. External Attacker (Remote)
- **Intent**: Steal photos, compromise accounts, deface app
- **Access**: Network requests to Express server
- **Capabilities**: OWASP Top 10 attacks, credential stuffing, DDoS
- **Motivation**: Data theft, financial gain, reputation damage

#### 4. Malicious App on Device
- **Intent**: Access AsyncStorage data from other apps
- **Access**: Device filesystem (limited by OS sandboxing)
- **Capabilities**: Read AsyncStorage if app sandbox compromised
- **Motivation**: Data exfiltration

#### 5. Malicious Insider - *Future*
- **Intent**: Abuse admin access to view user data
- **Access**: Database, logs, infrastructure
- **Capabilities**: Direct data access, log manipulation
- **Motivation**: Curiosity, financial gain, espionage

#### 6. Supply Chain Attacker
- **Intent**: Inject malicious code via npm dependencies
- **Access**: Package registry, build pipeline
- **Capabilities**: Arbitrary code execution, data exfiltration
- **Motivation**: Mass compromise, backdoor installation

---

## Entry Points

Where external input enters the system:

### Client Entry Points

#### EP1: Photo Selection (expo-image-picker)
- **Input**: Photo file from device media library
- **Data Type**: Image file (JPEG, PNG, HEIC)
- **Trust Level**: Low (file could be malicious)
- **Controls**: 
  - OS-level image parsing (iOS/Android image libraries)
  - File size validation (implicit via AsyncStorage limits)
- **Evidence**: [client/lib/storage.ts:38-42](../../client/lib/storage.ts)

#### EP2: AsyncStorage Read
- **Input**: JSON strings from device storage
- **Data Type**: JSON-serialized Photo/Album objects
- **Trust Level**: Medium (could be corrupted or tampered)
- **Controls**: 
  - JSON.parse error handling
  - Default fallback values
- **Evidence**: [client/lib/storage.ts:27-31](../../client/lib/storage.ts)

#### EP3: User Text Input (Album names, search)
- **Input**: User-typed strings
- **Data Type**: Text (album titles, search queries)
- **Trust Level**: Medium (trusted user but validate for display)
- **Controls**: 
  - React Native TextInput sanitization
  - No XSS risk (React Native renders natively, not HTML)
- **Evidence**: [client/lib/storage.ts:85-98](../../client/lib/storage.ts)

### Server Entry Points

#### EP4: HTTP Requests to Express Server
- **Input**: HTTP requests (headers, body, query params)
- **Data Type**: JSON, form data, multipart uploads (future)
- **Trust Level**: Low (untrusted external input)
- **Controls**:
  - CORS validation
  - express.json() parsing with size limits
  - Request logging (captures suspicious activity)
- **Evidence**: [server/index.ts:27-65](../../server/index.ts) (CORS), [server/index.ts:67-77](../../server/index.ts) (body parsing)

#### EP5: CORS Origin Header
- **Input**: HTTP Origin header
- **Data Type**: URL string
- **Trust Level**: Zero (attacker-controlled)
- **Controls**:
  - Allowlist of Replit domains + localhost
  - Dynamic validation per request
- **Evidence**: [server/index.ts:41-50](../../server/index.ts)

#### EP6: Expo Platform Header
- **Input**: expo-platform HTTP header
- **Data Type**: String ("ios", "android", or missing)
- **Trust Level**: Low (can be spoofed)
- **Controls**:
  - Validation against allowed values
  - Fallback to safe default (landing page)
- **Evidence**: [server/index.ts:198-201](../../server/index.ts)

### Future Entry Points (Cloud Sync)

#### EP7: User Authentication Credentials
- **Input**: Username/password, OAuth tokens
- **Data Type**: Credentials
- **Trust Level**: Zero (must validate)
- **Controls**: 
  - Password hashing (bcrypt/argon2)
  - Rate limiting on login
  - MFA (future)
- **Evidence**: [shared/schema.ts:17-23](../../shared/schema.ts) (schema ready)

---

## Trust Boundaries

Where trust level changes and validation is critical:

### TB1: Mobile App ↔ Operating System
- **Description**: React Native app accesses device APIs
- **Trust Concern**: OS enforces app sandboxing, but can be bypassed by jailbreak/root
- **Controls**:
  - Rely on OS permission system (camera, media library)
  - Detect jailbreak/root (future enhancement)
  - Secure storage via iOS Keychain, Android Keystore (future)

### TB2: Client App ↔ Network
- **Description**: HTTPS connections from mobile app to Express server
- **Trust Concern**: Network is hostile (MITM, eavesdropping)
- **Controls**:
  - TLS 1.2+ required (enforced by React Native)
  - Certificate pinning (future enhancement)
  - No sensitive data in URL params
- **Evidence**: [12_CRYPTO_POLICY.md](./12_CRYPTO_POLICY.md#tls-requirements)

### TB3: Express Server ↔ Database (Future)
- **Description**: Server queries Postgres via Drizzle ORM
- **Trust Concern**: SQL injection if queries improperly constructed
- **Controls**:
  - Drizzle ORM uses parameterized queries
  - No raw SQL with string concatenation
  - Principle of least privilege (DB user has minimal perms)
- **Evidence**: [13_APPSEC_BOUNDARIES.md](./13_APPSEC_BOUNDARIES.md#sql-injection-prevention)

### TB4: Express Server ↔ npm Dependencies
- **Description**: Server code imports third-party packages
- **Trust Concern**: Malicious or vulnerable dependencies
- **Controls**:
  - package-lock.json pins versions
  - npm audit before deployment
  - Dependabot automated updates (planned)
  - Review dependency changes in PRs
- **Evidence**: [package.json](../../package.json), [package-lock.json](../../package-lock.json)

### TB5: AsyncStorage ↔ App Code
- **Description**: App reads/writes JSON to AsyncStorage
- **Trust Concern**: Data could be corrupted or manipulated by other apps (if sandboxing broken)
- **Controls**:
  - JSON.parse try-catch with safe defaults
  - Schema validation (future: Zod validation)
  - Data integrity checks (future: HMAC signatures)
- **Evidence**: [client/lib/storage.ts:27-31](../../client/lib/storage.ts)

---

## STRIDE Threat Analysis

Systematic threat identification using Microsoft STRIDE model.

### Component: Mobile App (React Native)

#### Spoofing Identity
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T1.1**: Malicious app impersonates Cloud Gallery to trick users | Medium | Low | OS app signature verification; unique bundle ID |
| **T1.2**: No authentication - anyone with device access can view photos | High | Medium | Device lock screen (OS control); app-level PIN (future) |

#### Tampering with Data
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T2.1**: Attacker modifies AsyncStorage data via root/jailbreak | High | Low | OS sandboxing; root detection (future); data integrity checks (future) |
| **T2.2**: Corrupted AsyncStorage due to app crash or storage issues | Medium | Medium | Try-catch on JSON.parse; safe defaults; backup/restore (future) |

#### Repudiation
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T3.1**: User denies deleting photos (no audit log) | Low | Low | Not critical for local-only app; audit log when cloud added |

#### Information Disclosure
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T4.1**: Photos leaked via device backup (iCloud, Google Drive) | High | Medium | Exclude sensitive data from backups (future); encrypt backups (OS) |
| **T4.2**: Photos accessible if device stolen and not locked | High | Medium | OS encryption (FileVault, FDE); device lock screen |
| **T4.3**: Error messages leak sensitive paths or data | Low | Low | [server/index.ts:221-240](../../server/index.ts) sanitizes errors |

#### Denial of Service
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T5.1**: AsyncStorage full, app cannot save photos | Medium | Low | Storage quota UI warning; graceful handling |
| **T5.2**: Corrupted data structure causes app crash | Medium | Low | Try-catch in storage layer; error boundaries in React |

#### Elevation of Privilege
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T6.1**: Exploit React Native CVE to escape sandbox | Critical | Very Low | Keep React Native + Expo SDK updated; monitor security advisories |
| **T6.2**: Malicious photo file exploits image parser | High | Very Low | OS-level image parsing; file type validation |

### Component: Express Server

#### Spoofing Identity
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T7.1**: Attacker spoofs Origin header to bypass CORS | Medium | Medium | [server/index.ts:27-65](../../server/index.ts) validates Origin against allowlist |
| **T7.2**: No user authentication (future risk) | High | N/A | JWT auth + session management (future) per [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md) |

#### Tampering with Data
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T8.1**: SQL injection via API input (future) | Critical | Low | Drizzle ORM parameterized queries per [13_APPSEC_BOUNDARIES.md](./13_APPSEC_BOUNDARIES.md#sql-injection-prevention) |
| **T8.2**: MITM modifies requests/responses | High | Low | TLS 1.2+ required per [12_CRYPTO_POLICY.md](./12_CRYPTO_POLICY.md#tls-requirements) |

#### Repudiation
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T9.1**: No audit logs for API requests (future) | Medium | N/A | Structured logging + audit trail (future) |

#### Information Disclosure
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T10.1**: Stack traces in error responses leak internals | Medium | Low | [server/index.ts:222-239](../../server/index.ts) sanitizes errors; logs internally |
| **T10.2**: Request logs capture sensitive data | Medium | Medium | [server/index.ts:80-111](../../server/index.ts) limits log verbosity; review for PII |
| **T10.3**: TLS downgrade attack (weak ciphers) | High | Low | TLS 1.2+ only; strong cipher suites per [12_CRYPTO_POLICY.md](./12_CRYPTO_POLICY.md) |

#### Denial of Service
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T11.1**: No rate limiting on API routes (future) | High | High | Rate limiting per [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md#rate-limiting) |
| **T11.2**: Large request bodies exhaust memory | Medium | Medium | express.json size limit (default 100kb); monitor memory usage |
| **T11.3**: ReDoS via malicious regex in input | Medium | Low | Avoid complex regex; use timeouts; validate input length |

#### Elevation of Privilege
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T12.1**: Prototype pollution via JSON parsing | High | Low | express.json uses JSON.parse (safe); avoid `Object.assign` with user input |
| **T12.2**: Path traversal in static file serving | High | Low | express.static uses safe path resolution; validate file paths |

### Component: Database (Postgres - Future)

#### Spoofing Identity
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T13.1**: Compromised DB credentials | Critical | Low | Store in env vars; rotate regularly; use IAM auth (cloud) |

#### Tampering with Data
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T14.1**: Direct database access by attacker | Critical | Very Low | Network isolation; firewall rules; no public DB access |
| **T14.2**: SQL injection | Critical | Low | Drizzle ORM parameterized queries; no raw SQL |

#### Information Disclosure
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T15.1**: Database backup leaked | Critical | Low | Encrypt backups; access controls; secure storage |
| **T15.2**: Connection string in logs | High | Medium | Never log connection strings; mask sensitive env vars |

#### Denial of Service
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T16.1**: Connection pool exhaustion | High | Medium | Configure max connections; timeouts; connection pooling |

#### Elevation of Privilege
| Threat | Impact | Likelihood | Mitigation |
|--------|--------|------------|------------|
| **T17.1**: DB user has excessive permissions | High | Low | Principle of least privilege; app uses non-admin user |

---

## Abuse Cases

Concrete attack scenarios to guide security testing:

### AC1: Credential Stuffing Attack (Future)
**Scenario**: Attacker uses leaked credentials from other breaches to attempt logins.

**Prerequisites**:
- Cloud sync with authentication launched
- Attacker has list of email/password pairs

**Attack Steps**:
1. Attacker scripts login requests with credential list
2. Attempts 1000s of logins in short time
3. Identifies valid accounts by success response
4. Accesses victim's cloud-synced photos

**Impact**: High (account takeover, privacy breach)

**Current State**: Not applicable (no auth yet)

**Mitigations**:
- ✅ Rate limiting per IP (5 attempts/minute) - [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md#rate-limiting)
- ✅ Account lockout after 5 failed attempts
- ✅ CAPTCHA after 3 failed attempts
- ✅ Email notification on login from new device
- 🔄 MFA as optional defense layer

**Testing**:
```bash
# Simulate credential stuffing
for i in {1..10}; do
  curl -X POST https://api.cloudgallery.example/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"victim@email.com","password":"leaked_pass_'$i'"}'
done
# Expected: 429 Too Many Requests after 5 attempts
```

### AC2: Session Token Replay Attack (Future)
**Scenario**: Attacker intercepts session token and replays it to access victim's account.

**Prerequisites**:
- Authentication implemented with JWT tokens
- Token transmitted over network

**Attack Steps**:
1. Attacker MITMs network (public WiFi) or steals token from logs
2. Replays Authorization header in API requests
3. Accesses victim's data until token expires

**Impact**: High (unauthorized data access)

**Mitigations**:
- ✅ TLS 1.2+ prevents MITM - [12_CRYPTO_POLICY.md](./12_CRYPTO_POLICY.md#tls-requirements)
- ✅ Short-lived access tokens (15 min) - [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md#session-management)
- ✅ HttpOnly, Secure cookies prevent JS access - [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md#cookie-security)
- ✅ Refresh token rotation on each use
- ✅ No tokens in URL params or logs
- 🔄 IP-based token binding (consider UX impact)

**Testing**:
```bash
# Capture token
TOKEN=$(curl -X POST .../auth/login -d '...' | jq -r .accessToken)

# Replay after logout
curl -H "Authorization: Bearer $TOKEN" .../api/photos
# Expected: 401 Unauthorized if token invalidated on logout

# Replay after expiration (wait 16 min)
sleep 960 && curl -H "Authorization: Bearer $TOKEN" .../api/photos
# Expected: 401 Unauthorized
```

### AC3: Server-Side Request Forgery (SSRF)
**Scenario**: Attacker tricks server into making requests to internal services.

**Prerequisites**:
- Server accepts URLs as input (e.g., photo import from URL)
- Server fetches content from user-provided URL

**Attack Steps**:
1. Attacker provides URL to internal service: `http://169.254.169.254/latest/meta-data/iam/security-credentials/`
2. Server fetches URL and returns response
3. Attacker reads AWS credentials or internal data

**Impact**: Critical (cloud credentials leaked, internal network access)

**Current State**: Not applicable (no URL fetch feature)

**Mitigations**:
- ✅ Validate URL scheme (https:// only) - [13_APPSEC_BOUNDARIES.md](./13_APPSEC_BOUNDARIES.md#ssrf-mitigation)
- ✅ Blocklist internal IP ranges (RFC1918, link-local, localhost)
- ✅ DNS rebinding protection (re-resolve after redirect)
- ✅ Timeout on requests (5 sec max)
- ✅ Allowlist domains if possible
- ❌ Do not follow redirects blindly

**Testing**:
```bash
# Test SSRF protection
curl -X POST .../api/import-photo \
  -d '{"url":"http://169.254.169.254/latest/meta-data/"}'
# Expected: 400 Bad Request - "Invalid URL: internal IP blocked"

curl -X POST .../api/import-photo \
  -d '{"url":"http://localhost:5432/"}'
# Expected: 400 Bad Request - "Invalid URL: localhost blocked"
```

### AC4: Path Traversal in File Operations (Future)
**Scenario**: Attacker manipulates file paths to access files outside intended directory.

**Prerequisites**:
- Server allows file downloads with user-controlled path
- Insufficient path validation

**Attack Steps**:
1. Attacker provides path: `../../../../etc/passwd`
2. Server resolves path and reads file
3. Attacker reads sensitive system files

**Impact**: Critical (arbitrary file read)

**Current State**: Not applicable (no file operations yet)

**Mitigations**:
- ✅ Never concatenate user input into file paths - [13_APPSEC_BOUNDARIES.md](./13_APPSEC_BOUNDARIES.md#path-traversal-protection)
- ✅ Use allowlist of allowed directories
- ✅ Validate filename against regex: `^[a-zA-Z0-9_-]+\.[a-z]{3,4}$`
- ✅ Resolve path and check it's within allowed directory
- ✅ Use UUIDs for file names instead of user input

**Testing**:
```bash
# Test path traversal
curl ".../api/download?file=../../../../etc/passwd"
# Expected: 400 Bad Request or 404 Not Found

curl ".../api/download?file=../../package.json"
# Expected: 400 Bad Request or 404 Not Found
```

### AC5: Malicious Dependency Injection (Supply Chain)
**Scenario**: Attacker publishes malicious package with typosquatted name or compromises legitimate package.

**Prerequisites**:
- Developer adds new dependency without verification
- Malicious package added to package.json

**Attack Steps**:
1. Attacker publishes `recat` package (typo of `react`)
2. Developer accidentally runs `npm install recat`
3. Malicious postinstall script exfiltrates env vars
4. Attacker gains access to secrets, source code

**Impact**: Critical (full compromise)

**Mitigations**:
- ✅ Use package-lock.json to pin versions - [package-lock.json](../../package-lock.json)
- ✅ Review dependency changes in PRs
- ✅ npm audit before merging - [.github/workflows/test-coverage.yml](../../.github/workflows/test-coverage.yml)
- 🔄 Dependabot for automated updates with review
- 🔄 Verify package signatures (future npm feature)
- ✅ Principle of least privilege (no secrets in env during build)

**Detection**:
```bash
# Check for suspicious dependencies
npm audit
npm audit signatures  # future feature

# Review dependency tree
npm ls

# Check for unexpected network activity during install
# (requires network monitoring)
```

### AC6: Compromised Build Pipeline
**Scenario**: Attacker gains access to CI/CD and injects malicious code into build artifacts.

**Prerequisites**:
- CI/CD secrets compromised (GitHub Actions token)
- Attacker pushes malicious workflow

**Attack Steps**:
1. Attacker compromises developer account or CI secret
2. Modifies `.github/workflows/` to inject backdoor
3. Backdoored build deployed to production
4. Attacker gains persistent access

**Impact**: Critical (supply chain compromise)

**Mitigations**:
- ✅ Protected branches requiring reviews
- ✅ Workflow approval required for PRs from forks
- ✅ Minimal CI secrets (only what's needed)
- ✅ Audit logs for workflow changes
- 🔄 Code signing for build artifacts (future)
- 🔄 Reproducible builds to verify integrity

**Detection**:
```bash
# Review GitHub Actions audit log
gh api /repos/OWNER/REPO/actions/runs | jq '.workflow_runs[] | {name: .name, actor: .actor.login, created_at: .created_at}'

# Verify workflow file integrity
git log -p .github/workflows/
```

---

## Risk Register

Prioritized security risks with ownership and mitigation status.

| ID | Risk | Category | Impact | Likelihood | Severity | Mitigation Status | Owner | Due Date |
|----|------|----------|---------|------------|----------|-------------------|-------|----------|
| **R1** | Photos leaked via unencrypted AsyncStorage | Info Disclosure | High | Medium | **High** | 🔄 Planned (encrypt sensitive metadata) | Dev Team | Cloud launch |
| **R2** | No authentication - device access = full access | Spoofing | High | Medium | **High** | ✅ Acceptable (rely on device lock) | Product | MVP |
| **R3** | Credential stuffing on cloud sync | Spoofing | High | High | **Critical** | 🔄 Planned (rate limit + MFA) | Dev Team | Cloud launch |
| **R4** | Session token replay attack | Info Disclosure | High | Medium | **High** | 🔄 Planned (short-lived tokens) | Dev Team | Cloud launch |
| **R5** | SQL injection in future API | Tampering | Critical | Low | **High** | ✅ Mitigated (Drizzle ORM) | Dev Team | N/A |
| **R6** | SSRF via URL import feature | Info Disclosure | Critical | Low | **High** | 🔄 Planned (URL validation) | Dev Team | If feature added |
| **R7** | Path traversal in file downloads | Info Disclosure | Critical | Low | **High** | 🔄 Planned (path validation) | Dev Team | Cloud launch |
| **R8** | Malicious npm dependency | Tampering | Critical | Low | **High** | 🔄 Partial (audit, but no Dependabot) | Dev Team | Q1 2026 |
| **R9** | Compromised CI/CD pipeline | Tampering | Critical | Very Low | **High** | ✅ Mitigated (protected branches, reviews) | DevOps | N/A |
| **R10** | Unencrypted HTTP traffic | Info Disclosure | High | Very Low | **Medium** | ✅ Mitigated (TLS 1.2+ only) | Dev Team | N/A |
| **R11** | No rate limiting on API | DoS | High | High | **High** | 🔄 Planned (express-rate-limit) | Dev Team | Cloud launch |
| **R12** | Stack traces in error responses | Info Disclosure | Medium | Low | **Low** | ✅ Mitigated (sanitized errors) | Dev Team | N/A |
| **R13** | No audit logs for sensitive operations | Repudiation | Medium | N/A | **Low** | 🔄 Planned (structured logging) | Dev Team | Post-cloud |
| **R14** | AsyncStorage data corruption | DoS | Medium | Medium | **Medium** | 🔄 Partial (error handling, need backup) | Dev Team | Q2 2026 |
| **R15** | Root/jailbreak detection missing | Info Disclosure | Medium | Low | **Low** | 🔄 Planned (detection only, not blocking) | Dev Team | Post-cloud |

**Legend**:
- ✅ Mitigated: Control implemented and verified
- 🔄 Planned: Mitigation designed, not yet implemented
- ❌ Accepted: Risk accepted, no mitigation planned

**Risk Severity Formula**: Impact × Likelihood
- Critical: Impact=Critical OR (Impact=High AND Likelihood=High)
- High: Impact=High OR Likelihood=High
- Medium: Impact=Medium OR Likelihood=Medium
- Low: All others

---

## Validation & Testing

### Threat Model Validation
```bash
# 1. Type safety prevents type confusion vulnerabilities
npm run check:types

# 2. Dependency vulnerability scan
npm audit
npm audit fix

# 3. Run security-focused unit tests (future)
npm test -- --grep "security"

# 4. Manual security testing
# - Test all abuse cases in AC1-AC6
# - Verify STRIDE threats T1-T17 mitigations
# - Penetration test before cloud launch
```

### Continuous Validation
- **Every PR**: Type check, tests, dependency audit
- **Weekly**: Review npm audit for new CVEs
- **Per feature**: Update threat model, identify new threats
- **Quarterly**: Full security review, penetration test (post-production)

---

## Related Documentation

- [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md) - Authentication and authorization controls
- [12_CRYPTO_POLICY.md](./12_CRYPTO_POLICY.md) - Cryptographic requirements
- [13_APPSEC_BOUNDARIES.md](./13_APPSEC_BOUNDARIES.md) - Input validation and secure coding
- [Architecture Overview](../architecture/10_OVERVIEW.md) - System components
- [Key Flows](../architecture/40_KEY_FLOWS.md) - Data flow diagrams

---

**Threat Model Review Triggers**:
1. ✅ Before adding cloud sync / authentication
2. ✅ Before accepting file uploads from external URLs
3. ✅ Before adding user-generated content features
4. ✅ After security incident or near-miss
5. ✅ Annually (minimum)

**Next Review**: Before cloud sync feature kickoff

