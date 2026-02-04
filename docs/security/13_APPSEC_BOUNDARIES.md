# Application Security Boundaries

[← Back to Security Index](./00_INDEX.md)

**Purpose**: Define secure coding practices and input validation requirements for Cloud Gallery. Prevents injection attacks, data leakage, and other application-layer vulnerabilities.

**Last Updated**: 2026-02-04  
**Next Review**: Per major feature addition or framework upgrade

---

## Table of Contents
- [Input Validation](#input-validation)
- [Output Encoding](#output-encoding)
- [SQL Injection Prevention](#sql-injection-prevention)
- [NoSQL Injection Prevention](#nosql-injection-prevention)
- [Command Injection Prevention](#command-injection-prevention)
- [Path Traversal Protection](#path-traversal-protection)
- [SSRF Mitigation](#ssrf-mitigation)
- [XSS Prevention](#xss-prevention)
- [Insecure Deserialization](#insecure-deserialization)
- [Error Handling](#error-handling)

---

## Input Validation

**Golden Rule**: **Never trust user input. Validate at every trust boundary.**

### Trust Boundaries

Where validation is MANDATORY:
1. **Client → Server**: HTTP requests (body, query params, headers)
2. **User → Client**: Text inputs, file uploads, deep links
3. **AsyncStorage → App**: Data read from device storage
4. **External API → Server**: Third-party API responses (future)

**Evidence**: [10_THREAT_MODEL.md](./10_THREAT_MODEL.md#trust-boundaries)

### Validation Strategy

**Principle**: **Allowlist > Denylist**

✅ **Allowlist (Recommended)**:
```typescript
// Define what IS allowed
const ALLOWED_ALBUM_TITLE_REGEX = /^[a-zA-Z0-9\s\-_]{1,50}$/;

function validateAlbumTitle(title: string): boolean {
  return ALLOWED_ALBUM_TITLE_REGEX.test(title);
}
```

❌ **Denylist (Avoid)**:
```typescript
// Define what is NOT allowed (easy to bypass)
const BANNED_CHARS = /<script>|javascript:|onerror=/i;

function validateInput(input: string): boolean {
  return !BANNED_CHARS.test(input);  // Incomplete - can be bypassed
}
```

**Why allowlist?** Attacker must work within your rules, not just avoid your rules.

### Input Validation Rules

#### Text Input (Album Names, Search Queries)

**Requirements**:
- Length: 1-100 characters
- Charset: Alphanumeric + spaces + common punctuation
- No control characters (0x00-0x1F except \n, \t)
- No HTML tags (even though React Native is safe from XSS)

**Implementation**:
```typescript
// shared/validation.ts (future)
import { z } from 'zod';

export const albumTitleSchema = z.string()
  .min(1, 'Title cannot be empty')
  .max(100, 'Title too long')
  .regex(/^[a-zA-Z0-9\s\-_'",.:!?]+$/, 'Invalid characters in title')
  .transform(s => s.trim());

export const searchQuerySchema = z.string()
  .max(200, 'Search query too long')
  .regex(/^[a-zA-Z0-9\s\-_]+$/, 'Invalid search query');

// Usage
function createAlbum(userInput: string): Album {
  const title = albumTitleSchema.parse(userInput);  // Throws if invalid
  // ... create album
}
```

**Evidence**: [client/lib/storage.ts:85-98](../../client/lib/storage.ts) - Album creation (needs validation)

#### User Credentials (Future)

**Username**:
```typescript
export const usernameSchema = z.string()
  .min(3, 'Username too short')
  .max(30, 'Username too long')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscore, and hyphen')
  .toLowerCase();
```

**Password**:
```typescript
export const passwordSchema = z.string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password too long')
  .refine(p => /[a-z]/.test(p), 'Password must contain lowercase letter')
  .refine(p => /[A-Z]/.test(p), 'Password must contain uppercase letter')
  .refine(p => /[0-9]/.test(p), 'Password must contain number')
  .refine(p => /[^a-zA-Z0-9]/.test(p), 'Password must contain special character');
```

**Evidence**: [shared/schema.ts:17-23](../../shared/schema.ts), [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md#primary-username--password)

#### File Uploads (Future)

**Image Files**:
```typescript
export const imageUploadSchema = z.object({
  filename: z.string().regex(/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|heic)$/i),
  size: z.number().max(50 * 1024 * 1024, 'File too large (max 50 MB)'),
  mimetype: z.enum(['image/jpeg', 'image/png', 'image/heic'])
});

function validateImageUpload(file: Express.Multer.File): void {
  imageUploadSchema.parse({
    filename: file.originalname,
    size: file.size,
    mimetype: file.mimetype
  });
  
  // Additional: Verify magic bytes (file signature)
  const buffer = fs.readFileSync(file.path);
  if (!isValidImageFile(buffer)) {
    throw new Error('Invalid image file');
  }
}

function isValidImageFile(buffer: Buffer): boolean {
  // Check magic bytes
  const jpegMagic = buffer.slice(0, 3).toString('hex');
  const pngMagic = buffer.slice(0, 8).toString('hex');
  
  return jpegMagic === 'ffd8ff' ||  // JPEG
         pngMagic === '89504e470d0a1a0a';  // PNG
}
```

**Rules**:
- ✅ Validate file extension AND MIME type AND magic bytes
- ✅ Limit file size (prevent DoS)
- ✅ Scan for malware (future: ClamAV integration)
- ❌ Do NOT trust user-provided filename (can be `../../etc/passwd`)
- ❌ Do NOT execute uploaded files

#### Numeric Input (IDs, Counts)

**Rules**:
```typescript
export const photoIdSchema = z.string()
  .regex(/^[0-9]+$/, 'Invalid photo ID')
  .transform(Number)
  .refine(n => n > 0, 'ID must be positive');

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20)
});
```

#### URL Input (Future - Import Photo from URL)

**Rules**:
```typescript
export const urlSchema = z.string()
  .url('Invalid URL')
  .regex(/^https:\/\//, 'Only HTTPS URLs allowed')  // No HTTP
  .refine(url => {
    const hostname = new URL(url).hostname;
    // Blocklist internal/private IPs
    return !isPrivateIP(hostname);
  }, 'Private IP addresses not allowed');

function isPrivateIP(hostname: string): boolean {
  // Block localhost, loopback, link-local, RFC1918 private ranges
  const privateRanges = [
    /^localhost$/i,
    /^127\./,                     // Loopback
    /^10\./,                      // RFC1918 Class A
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // RFC1918 Class B
    /^192\.168\./,                // RFC1918 Class C
    /^169\.254\./,                // Link-local
    /^::1$/,                      // IPv6 loopback
    /^fe80:/i,                    // IPv6 link-local
    /^fc00:/i                     // IPv6 private
  ];
  
  return privateRanges.some(regex => regex.test(hostname));
}
```

**See Also**: [SSRF Mitigation](#ssrf-mitigation)

### Validation Placement

**Client-Side Validation**:
- ✅ Provide immediate user feedback
- ✅ Reduce unnecessary server requests
- ❌ NOT a security control (can be bypassed)

**Server-Side Validation**:
- ✅ **MANDATORY** security control
- ✅ Cannot be bypassed by attacker
- ✅ Validate even if client validated

**Example Flow**:
```
User enters album title
  ↓
Client validates → Show error if invalid (UX)
  ↓
Send to server
  ↓
Server validates → Reject if invalid (Security)
  ↓
Store in database
```

---

## Output Encoding

**Purpose**: Prevent injection attacks when outputting data to different contexts.

### Context-Specific Encoding

#### HTML Context (Web Only)
Cloud Gallery uses React Native (not web rendering), so HTML encoding not needed for MVP.

**Future (if adding web dashboard)**:
```typescript
// Use DOMPurify or React's built-in escaping
import DOMPurify from 'dompurify';

function renderUserContent(html: string): string {
  return DOMPurify.sanitize(html);  // Remove malicious HTML
}
```

**React (JSX) is safe by default**:
```tsx
// Safe - React escapes by default
<Text>{userProvidedText}</Text>

// Unsafe - bypass escaping
<Text dangerouslySetInnerHTML={{__html: userProvidedHTML}} />  // ❌ Avoid
```

#### JSON Context (API Responses)

**Current Implementation**: Express.js `res.json()` automatically escapes.

**Evidence**: [server/index.ts:87-89](../../server/index.ts)

```typescript
// Safe - Express escapes special characters
res.json({ message: userInput });  // ✅ Safe

// Unsafe - manual JSON stringification
res.send(JSON.stringify({ message: userInput }));  // ⚠️ Use res.json() instead
```

#### SQL Context (Future)

**Do NOT manually escape**. Use parameterized queries via Drizzle ORM.

**See**: [SQL Injection Prevention](#sql-injection-prevention)

#### Logs Context

**Problem**: User input in logs can break log parsing or inject fake log entries.

**Solution**: Sanitize before logging.

```typescript
// server/utils/logger.ts (future)
function sanitizeForLog(input: string): string {
  return input
    .replace(/\n/g, '\\n')      // Escape newlines (prevent log injection)
    .replace(/\r/g, '\\r')      // Escape carriage returns
    .replace(/\t/g, '\\t')      // Escape tabs
    .slice(0, 1000);            // Truncate long inputs
}

// Usage
console.log(`User ${userId} uploaded photo: ${sanitizeForLog(filename)}`);
```

**Evidence**: [server/index.ts:97-100](../../server/index.ts) - Logging truncates output

**Critical Rules**:
- ❌ **NEVER log sensitive data** (passwords, tokens, PII)
- ✅ Sanitize user input before logging
- ✅ Truncate long inputs (prevent log flooding)

---

## SQL Injection Prevention

**Threat**: Attacker injects SQL commands via user input to manipulate database queries.

**Example Attack**:
```sql
-- Vulnerable code (DO NOT DO THIS)
const query = `SELECT * FROM users WHERE username = '${userInput}'`;

-- If userInput = "admin' OR '1'='1"
-- Result: SELECT * FROM users WHERE username = 'admin' OR '1'='1'
-- Effect: Returns all users (bypasses WHERE clause)
```

### Mitigation: Use Drizzle ORM

**Cloud Gallery uses Drizzle ORM** which automatically uses parameterized queries.

**Evidence**: [shared/schema.ts](../../shared/schema.ts), [package.json:33](../../package.json)

✅ **Safe (Parameterized Queries)**:
```typescript
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from '@/shared/schema';

// Drizzle automatically parameterizes
const user = await db.query.users.findFirst({
  where: eq(users.username, userInput)  // ✅ Safe - parameterized
});

// Generated SQL: SELECT * FROM users WHERE username = $1
// Parameters: [userInput]
```

❌ **Unsafe (String Concatenation)**:
```typescript
// DO NOT DO THIS
const query = `SELECT * FROM users WHERE username = '${userInput}'`;
const result = await db.execute(query);  // ❌ VULNERABLE
```

### Raw SQL Queries

**Policy**: **Avoid raw SQL**. If absolutely necessary, use parameterized queries.

```typescript
import { sql } from 'drizzle-orm';

// ✅ Safe - Parameterized
const result = await db.execute(
  sql`SELECT * FROM users WHERE username = ${userInput}`
);

// ❌ Unsafe - String concatenation
const result = await db.execute(
  sql.raw(`SELECT * FROM users WHERE username = '${userInput}'`)
);
```

### Validation Checklist

```bash
# Search for unsafe SQL patterns
grep -rn "sql\.raw\|execute.*\`.*\${" server/
# Expected: No results

# Verify Drizzle ORM usage
grep -rn "db\.query\|db\.select\|db\.insert" server/
# Expected: All queries use Drizzle methods

# Check for string concatenation in SQL
grep -rn "SELECT.*+\|INSERT.*+\|UPDATE.*+\|DELETE.*+" server/ | grep -v node_modules
# Expected: No results
```

---

## NoSQL Injection Prevention

**Threat**: Attacker injects operators in JSON payloads to manipulate queries (relevant if using MongoDB in future).

**Example Attack**:
```typescript
// Vulnerable code (if using MongoDB)
db.users.findOne({ username: userInput });

// If userInput = { $ne: null }
// Result: Returns first user where username != null (any user)
```

### Mitigation (If Adding MongoDB)

1. **Validate input types**:
```typescript
const usernameSchema = z.string();  // Reject objects

const username = usernameSchema.parse(req.body.username);  // Throws if not string
```

2. **Use ODM/ORM** (Mongoose with strict mode):
```typescript
const userSchema = new Schema({
  username: { type: String, required: true }
}, { strict: true });  // Reject unknown fields
```

3. **Sanitize operators**:
```typescript
function sanitizeQuery(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  const sanitized: any = {};
  for (const key in obj) {
    if (key.startsWith('$')) continue;  // Remove MongoDB operators
    sanitized[key] = sanitizeQuery(obj[key]);
  }
  return sanitized;
}
```

**Current State**: Not using MongoDB, so not applicable. Future consideration.

---

## Command Injection Prevention

**Threat**: Attacker injects shell commands via user input executed by `child_process.exec()` or similar.

**Example Attack**:
```typescript
// Vulnerable code (DO NOT DO THIS)
const filename = req.body.filename;
exec(`convert ${filename} output.jpg`, (err, stdout) => {
  // If filename = "input.jpg; rm -rf /"
  // Executed: convert input.jpg; rm -rf / output.jpg
});
```

### Mitigation

1. **Avoid shell execution entirely**:
```typescript
// ✅ Use libraries instead of shell commands
import sharp from 'sharp';  // Image processing library

await sharp(inputPath).resize(800, 600).toFile(outputPath);  // No shell involved
```

2. **If shell required, use safe APIs**:
```typescript
import { execFile } from 'child_process';

// ✅ Safe - Arguments passed separately (not interpolated into shell)
execFile('convert', [filename, 'output.jpg'], (err, stdout) => {
  // No shell injection possible
});

// ❌ Unsafe - Arguments in string
exec(`convert ${filename} output.jpg`);  // Vulnerable
```

3. **Validate and sanitize input**:
```typescript
const filenameSchema = z.string().regex(/^[a-zA-Z0-9_-]+\.[a-z]{3,4}$/);

const filename = filenameSchema.parse(userInput);  // Rejects malicious input
```

### Validation

```bash
# Search for dangerous shell execution patterns
grep -rn "exec\|spawn\|execSync" server/ | grep -v node_modules | grep -v "execFile"
# Expected: No exec() or spawn() calls with user input

# Verify using safe alternatives
grep -rn "execFile\|spawnFile" server/
# Expected: Only safe APIs used
```

**Current State**: No shell command execution in codebase.

---

## Path Traversal Protection

**Threat**: Attacker manipulates file paths to access files outside intended directory.

**Example Attack**:
```typescript
// Vulnerable code (DO NOT DO THIS)
const filename = req.query.file;
const filePath = path.join(__dirname, 'uploads', filename);
res.sendFile(filePath);

// If filename = "../../../../etc/passwd"
// Resolved path: /etc/passwd (outside uploads directory)
```

### Mitigation

1. **Never use user input directly in file paths**:
```typescript
// ❌ VULNERABLE
const filePath = path.join(uploadsDir, req.query.filename);

// ✅ Safe - Use UUID/hash for filenames
const fileId = req.params.id;  // UUID from database
const file = await db.query.files.findFirst({ where: eq(files.id, fileId) });
const filePath = path.join(uploadsDir, file.storedFilename);  // Controlled filename
```

2. **Validate path stays within allowed directory**:
```typescript
import path from 'path';

function safePath(userInput: string, baseDir: string): string | null {
  // Resolve to absolute path
  const resolved = path.resolve(baseDir, userInput);
  
  // Check it's still under baseDir
  if (!resolved.startsWith(path.resolve(baseDir))) {
    return null;  // Path traversal attempt
  }
  
  return resolved;
}

// Usage
const safeFilePath = safePath(req.query.file, uploadsDir);
if (!safeFilePath) {
  return res.status(400).json({ error: 'Invalid file path' });
}
```

3. **Use allowlist for filenames**:
```typescript
const filenameSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,64}\.(jpg|png)$/);

const filename = filenameSchema.parse(req.query.file);  // Rejects "..", "/", etc.
```

4. **Rely on express.static() safe path resolution**:
```typescript
// Express.static() has built-in path traversal protection
app.use('/assets', express.static(path.join(__dirname, '../assets')));
// Requests to /assets/../../etc/passwd are blocked automatically
```

**Evidence**: [server/index.ts:215-216](../../server/index.ts) - Uses express.static()

### Validation

```bash
# Search for unsafe path operations
grep -rn "path\.join.*req\.\|path\.resolve.*req\." server/ | grep -v node_modules
# Expected: All paths validated before use

# Check for direct file access with user input
grep -rn "fs\.readFile.*req\.\|sendFile.*req\." server/
# Expected: No direct user input in file paths
```

---

## SSRF Mitigation

**SSRF (Server-Side Request Forgery)**: Attacker tricks server into making requests to internal services.

**Example Attack**:
```typescript
// Vulnerable code (DO NOT DO THIS)
const imageUrl = req.body.url;  // User-provided URL
const response = await fetch(imageUrl);  // Fetch arbitrary URL

// If imageUrl = "http://169.254.169.254/latest/meta-data/iam/security-credentials/"
// Server fetches AWS metadata API → leaks credentials
```

### Mitigation

1. **Validate URL scheme** (HTTPS only):
```typescript
const urlSchema = z.string()
  .url()
  .regex(/^https:\/\//, 'Only HTTPS URLs allowed');  // No HTTP, file://, gopher://, etc.
```

2. **Blocklist private IP ranges**:
```typescript
function isPrivateIP(hostname: string): boolean {
  const privateRanges = [
    /^localhost$/i,
    /^127\./,                     // Loopback
    /^10\./,                      // RFC1918 Class A
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // RFC1918 Class B
    /^192\.168\./,                // RFC1918 Class C
    /^169\.254\./,                // Link-local (AWS metadata)
    /^::1$/,                      // IPv6 loopback
    /^fe80:/i,                    // IPv6 link-local
    /^fc00:/i                     // IPv6 private
  ];
  
  return privateRanges.some(regex => regex.test(hostname));
}

// Validate before fetching
const url = new URL(req.body.url);
if (isPrivateIP(url.hostname)) {
  return res.status(400).json({ error: 'Private IP addresses not allowed' });
}
```

3. **Prevent DNS rebinding** (resolve after redirect):
```typescript
async function safeFetch(url: string): Promise<Response> {
  // Validate initial URL
  const parsedUrl = new URL(url);
  if (isPrivateIP(parsedUrl.hostname)) {
    throw new Error('Private IP blocked');
  }
  
  // Fetch with redirect handling
  const response = await fetch(url, { redirect: 'manual' });
  
  // If redirected, validate redirect target
  if (response.status >= 300 && response.status < 400) {
    const redirectUrl = response.headers.get('location');
    if (redirectUrl) {
      const redirectParsed = new URL(redirectUrl, url);
      if (isPrivateIP(redirectParsed.hostname)) {
        throw new Error('Redirect to private IP blocked');
      }
    }
  }
  
  return response;
}
```

4. **Use allowlist** (if possible):
```typescript
const ALLOWED_DOMAINS = ['imgur.com', 'i.imgur.com', 'images.unsplash.com'];

function isAllowedDomain(url: string): boolean {
  const hostname = new URL(url).hostname;
  return ALLOWED_DOMAINS.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
}
```

5. **Set timeout** (prevent DoS):
```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);  // 5 sec timeout

try {
  const response = await fetch(url, { signal: controller.signal });
} catch (err) {
  if (err.name === 'AbortError') {
    throw new Error('Request timeout');
  }
  throw err;
} finally {
  clearTimeout(timeoutId);
}
```

**Evidence**: [10_THREAT_MODEL.md](./10_THREAT_MODEL.md#ac3-server-side-request-forgery-ssrf)

**Current State**: No URL fetching feature, so not applicable. Implement when adding photo import from URL.

---

## XSS Prevention

**XSS (Cross-Site Scripting)**: Attacker injects malicious JavaScript into pages viewed by other users.

**Cloud Gallery Status**: **Not Vulnerable (React Native)**

React Native renders natively (iOS UIKit, Android Views), not HTML. There is no DOM or JavaScript execution in rendered content.

**Evidence**: [client/](../../client/) - Pure React Native components

### If Adding Web Dashboard (Future)

React (web) is safe by default:

```tsx
// ✅ Safe - React escapes by default
<div>{userInput}</div>

// ✅ Safe - Attribute escaping
<input value={userInput} />

// ❌ Unsafe - Bypasses escaping
<div dangerouslySetInnerHTML={{__html: userInput}} />  // NEVER use with user input

// ❌ Unsafe - Inline event handlers with user data
<button onclick={userInput}>Click</button>  // Use onClick={handler} instead
```

**Additional Protections**:
1. Content Security Policy (CSP) header:
```typescript
res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';");
```

2. HTTPOnly cookies (prevent cookie theft via XSS):
```typescript
res.cookie('session', token, { httpOnly: true });  // JavaScript cannot read
```

**Evidence**: [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md#cookie-security)

---

## Insecure Deserialization

**Threat**: Attacker provides malicious serialized objects that execute code when deserialized.

### JSON Deserialization

**JavaScript's JSON.parse() is generally safe** (no code execution), but watch for:

1. **Prototype pollution**:
```typescript
// ❌ Vulnerable
const userInput = JSON.parse(req.body);
Object.assign(target, userInput);  // Can pollute Object.prototype if userInput = {"__proto__":{"isAdmin":true}}

// ✅ Safe - Use Map or validate keys
const userInput = JSON.parse(req.body);
if (userInput.__proto__ || userInput.constructor || userInput.prototype) {
  throw new Error('Invalid input');
}
```

2. **Large payloads (DoS)**:
```typescript
// ✅ Limit request body size
app.use(express.json({ limit: '1mb' }));  // Default 100kb
```

**Evidence**: [server/index.ts:67-77](../../server/index.ts)

3. **Unexpected data types**:
```typescript
// ✅ Validate with Zod
const schema = z.object({
  title: z.string(),
  count: z.number()
});

const data = schema.parse(JSON.parse(req.body));  // Throws if wrong type
```

### Other Serialization Formats

❌ **Never use**:
- `eval()` - Executes arbitrary code
- `new Function()` - Executes arbitrary code
- `vm.runInNewContext()` - Can escape sandbox

✅ **Safe alternatives**:
- `JSON.parse()` for JSON
- `yaml` library for YAML (set `safe` mode)
- MessagePack, Protocol Buffers for binary

---

## Error Handling

**Principle**: Fail securely. Never leak sensitive information in error messages.

### Error Information Disclosure

❌ **Bad (Leaks Internal Details)**:
```typescript
// DO NOT DO THIS
app.use((err, req, res, next) => {
  res.status(500).json({
    error: err.message,         // May contain SQL query, file paths
    stack: err.stack,           // Leaks code structure
    query: req.query,           // May contain sensitive params
    env: process.env            // Leaks secrets
  });
});
```

✅ **Good (Safe Error Handling)**:
```typescript
// Current implementation
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // Log full error internally (for debugging)
  console.error('Internal Server Error:', err);
  
  // Return sanitized error to client
  if (res.headersSent) {
    return next(err);
  }
  
  return res.status(status).json({ message });  // Generic message only
});
```

**Evidence**: [server/index.ts:221-240](../../server/index.ts)

### User-Facing Error Messages

**Guidelines**:
- ✅ Generic errors: "Something went wrong", "Invalid input"
- ✅ Actionable feedback: "Username already exists", "Password too short"
- ❌ Internal details: "Database connection failed to pg://localhost:5432/cloudgallery"
- ❌ Stack traces: "at Function.Module._load (internal/modules/cjs/loader.js:718:10)"

**Examples**:

```typescript
// ✅ Good error messages
- "Invalid username or password" (don't reveal which is wrong)
- "Album title must be 1-100 characters"
- "Image file too large (max 50 MB)"
- "Rate limit exceeded. Try again in 5 minutes."

// ❌ Bad error messages
- "User 'admin' not found in database 'cloudgallery'"  // Leaks DB info
- "File not found: /var/www/uploads/secret_doc.pdf"   // Leaks file paths
- "Cannot read property 'id' of undefined"            // Leaks code structure
- "PostgreSQL error: duplicate key value violates unique constraint 'users_email_key'" // Leaks schema
```

### Error Logging

**Internal Logs** (for developers):
```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Log full error details
logger.error('Database query failed', {
  error: err.message,
  stack: err.stack,
  query: sanitizeQuery(query),  // Sanitize sensitive data
  userId: req.user?.id
});
```

**Rules**:
- ✅ Log full details internally (for debugging)
- ✅ Sanitize sensitive data before logging (passwords, tokens, PII)
- ✅ Include context (user ID, request ID, timestamp)
- ❌ Never log passwords, tokens, or credit card numbers
- ❌ Never expose logs to users or attackers

**Sensitive Data Sanitization**:
```typescript
function sanitizeForLog(data: any): any {
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'creditCard'];
  
  if (typeof data !== 'object' || data === null) return data;
  
  const sanitized: any = Array.isArray(data) ? [] : {};
  
  for (const key in data) {
    if (sensitiveKeys.some(k => key.toLowerCase().includes(k))) {
      sanitized[key] = '[REDACTED]';
    } else {
      sanitized[key] = sanitizeForLog(data[key]);
    }
  }
  
  return sanitized;
}

// Usage
console.log('Request received:', sanitizeForLog(req.body));
// Output: { username: 'alice', password: '[REDACTED]' }
```

### Try-Catch Best Practices

```typescript
// ✅ Specific error handling
try {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
} catch (err) {
  logger.error('Database error', { error: err, userId });
  return res.status(500).json({ error: 'Database error' });  // Generic message
}

// ❌ Swallowing errors
try {
  await riskyOperation();
} catch {
  // Error ignored - potential security issue hidden
}

// ❌ Exposing errors
try {
  await operation();
} catch (err) {
  res.status(500).json({ error: err.toString() });  // Leaks details
}
```

---

## Validation Commands

```bash
# 1. Check for unsafe SQL patterns
grep -rn "sql\.raw\|SELECT.*\${" server/ | grep -v node_modules
# Expected: No raw SQL with string interpolation

# 2. Check for command injection risks
grep -rn "exec\|spawn\(" server/ | grep -v "execFile\|spawnFile" | grep -v node_modules
# Expected: No exec() with user input

# 3. Verify input validation
grep -rn "req\.body\|req\.query\|req\.params" server/ | grep -v "\.parse\|\.safeParse"
# Review: Ensure all user inputs are validated

# 4. Check error handling doesn't leak info
grep -rn "err\.stack\|error\.stack" server/
# Expected: Only in internal logs, not in responses

# 5. Look for dangerous functions
grep -rn "eval\(|new Function\(|dangerouslySetInnerHTML" server/ client/
# Expected: No results

# 6. Verify no hardcoded secrets
grep -rn "password.*=.*['\"][^$]" server/ client/ | grep -v "placeholder\|example"
# Expected: No hardcoded passwords

# 7. Check for path traversal vulnerabilities
grep -rn "\.\./" server/ | grep -v node_modules | grep -v "import\|require"
# Expected: No ../ in file operations with user input
```

---

## Testing Security Controls

```typescript
// tests/security/injection.test.ts (future)
describe('SQL Injection Prevention', () => {
  it('rejects malicious SQL in username', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ username: "admin' OR '1'='1", password: 'password' });
    
    expect(response.status).toBe(401);  // Should fail login, not succeed
  });
});

describe('Path Traversal Prevention', () => {
  it('blocks directory traversal attempts', async () => {
    const response = await request(app)
      .get('/api/files/../../../../etc/passwd');
    
    expect(response.status).toBe(400);
  });
});

describe('SSRF Prevention', () => {
  it('blocks requests to private IPs', async () => {
    const response = await request(app)
      .post('/api/import-photo')
      .send({ url: 'http://169.254.169.254/latest/meta-data/' });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Private IP');
  });
});
```

---

## Related Documentation

- [10_THREAT_MODEL.md](./10_THREAT_MODEL.md) - Threats (T1-T17) and abuse cases
- [11_IDENTITY_AND_ACCESS.md](./11_IDENTITY_AND_ACCESS.md) - Authentication input validation
- [12_CRYPTO_POLICY.md](./12_CRYPTO_POLICY.md) - Cryptographic input/output handling
- [Testing Guide](../testing/00_INDEX.md) - Security testing practices

---

## Security Review Checklist

Before deploying new features:

- [ ] All user inputs validated at trust boundaries
- [ ] Database queries use parameterized queries (Drizzle ORM)
- [ ] No shell command execution with user input
- [ ] File paths validated against traversal attacks
- [ ] No URL fetching without SSRF protections
- [ ] Error messages don't leak internal details
- [ ] Sensitive data sanitized in logs
- [ ] Input length limits enforced (prevent DoS)
- [ ] Content-Type validated for uploads
- [ ] Rate limiting applied to endpoints

**Next Review**: Before cloud sync / authentication implementation

---

**Last Updated**: 2026-02-04  
**Maintained By**: Development Team
