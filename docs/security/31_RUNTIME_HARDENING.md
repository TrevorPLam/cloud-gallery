# Runtime Security Hardening

**Status**: 🟡 Partial  
**Owner**: DevOps/Security Team  
**Last Updated**: 2024-01-10

## Overview

Runtime hardening establishes defense-in-depth protections for Cloud Gallery's server and mobile application environments. This document covers server process isolation, HTTP security headers, mobile platform security features, and React Native specific hardening measures.

## Server Hardening

### Non-Root User Execution

**Current Status**: ⚠️ Not Implemented

**Risk**: Running Node.js process as root increases blast radius if compromised.

**Implementation**:
```dockerfile
# Dockerfile
FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install dependencies as root
COPY package*.json ./
RUN npm ci --only=production

# Switch to non-root user
USER nodejs

# Copy application
COPY --chown=nodejs:nodejs . .

EXPOSE 5000
CMD ["node", "server/index.ts"]
```

**Validation**:
```bash
# Verify process user
docker exec <container> whoami
# Expected: nodejs (not root)

# Verify file ownership
docker exec <container> ls -la /app
# Expected: nodejs:nodejs
```

### Linux Capabilities Dropping

**Current Status**: ⚠️ Not Implemented

**Risk**: Unnecessary kernel capabilities increase attack surface.

**Implementation**:
```dockerfile
# Drop all capabilities, add only necessary ones
FROM node:20-alpine

# If binding to port 80/443 needed:
RUN apk add --no-cache libcap && \
    setcap 'cap_net_bind_service=+ep' /usr/local/bin/node

USER nodejs
```

**Docker Compose**:
```yaml
services:
  server:
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE  # Only if binding to privileged ports
    security_opt:
      - no-new-privileges:true
```

**Validation**:
```bash
# Check capabilities
docker exec <container> grep Cap /proc/1/status
```

### Read-Only Filesystem

**Current Status**: ⚠️ Not Implemented

**Risk**: Writable filesystem allows attacker persistence and malicious file modification.

**Implementation**:
```yaml
# docker-compose.yml
services:
  server:
    read_only: true
    tmpfs:
      - /tmp
      - /var/run
      - /home/nodejs/.npm  # npm cache
    volumes:
      - ./uploads:/app/uploads  # Writable mount for user uploads
```

**Code Considerations**:
```typescript
// server/index.ts - Ensure temp files use /tmp
import os from 'os';
const tmpDir = os.tmpdir(); // Uses /tmp in container
```

**Validation**:
```bash
# Attempt to write outside tmpfs
docker exec <container> touch /app/test.txt
# Expected: Read-only file system error
```

### Network Egress Controls

**Current Status**: ⚠️ Not Implemented

**Risk**: Compromised server can exfiltrate data or download malicious payloads.

**Implementation**:
```yaml
# docker-compose.yml
services:
  server:
    networks:
      - internal
    # No direct internet access
  
  # Proxy for controlled egress
  egress-proxy:
    image: squid:latest
    networks:
      - internal
      - external
    volumes:
      - ./squid.conf:/etc/squid/squid.conf:ro

networks:
  internal:
    internal: true
  external:
```

**Squid Config** (allowlist approach):
```conf
# squid.conf
# Allow only necessary external services
acl allowed_domains dstdomain .npmjs.org .github.com
http_access allow allowed_domains
http_access deny all
```

### Secure HTTP Headers

**Current Status**: 🔴 Missing

**Evidence**: `/server/index.ts` has no security headers

**Risk**: Missing security headers enable XSS, clickjacking, MIME sniffing attacks.

**Implementation**:
```typescript
// server/middleware/security-headers.ts
import type { Request, Response, NextFunction } from "express";

export function securityHeadersMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Content Security Policy - Prevents XSS attacks
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: https:",
      "script-src 'self' 'unsafe-inline'", // Expo requires unsafe-inline
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  // Strict-Transport-Security - Enforce HTTPS
  if (req.secure || req.header("x-forwarded-proto") === "https") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }

  // X-Content-Type-Options - Prevent MIME sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");

  // X-Frame-Options - Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");

  // X-XSS-Protection - Legacy browsers
  res.setHeader("X-XSS-Protection", "1; mode=block");

  // Referrer-Policy - Control referrer information
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");

  // Permissions-Policy - Restrict browser features
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  next();
}
```

**Integration**:
```typescript
// server/index.ts
import { securityHeadersMiddleware } from "./middleware/security-headers";

(async () => {
  setupCors(app);
  app.use(securityHeadersMiddleware); // Add before other middleware
  setupBodyParsing(app);
  // ...
})();
```

**Validation**:
```bash
# Test security headers
curl -I https://your-domain.com/

# Expected headers:
# Content-Security-Policy: ...
# Strict-Transport-Security: ...
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
```

**Security Tool Check**:
```bash
# Mozilla Observatory scan
curl -X POST https://http-observatory.security.mozilla.org/api/v1/analyze?host=your-domain.com
```

### CORS Policy Analysis

**Current Implementation**: `/server/index.ts:27-65`

```typescript
function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}
```

**Security Assessment**:

✅ **Strengths**:
- Dynamic origin validation (not wildcard)
- Environment-based allowlist
- Reflects origin only if validated

⚠️ **Weaknesses**:
1. **Localhost wildcard in production** - Lines 44-46 allow any localhost port in all environments
2. **Missing origin validation** - No validation of origin format (e.g., could allow `http://localhost:8080.attacker.com`)
3. **Credentials enabled globally** - Should be opt-in per endpoint

**Hardened Implementation**:
```typescript
function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    // Only allow environment-specified origins
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    // Allow localhost ONLY in development
    if (process.env.NODE_ENV === "development") {
      // Validate localhost format to prevent subdomain attacks
      const origin = req.header("origin");
      const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/;
      
      if (origin && localhostRegex.test(origin)) {
        origins.add(origin);
      }
    }

    const origin = req.header("origin");

    if (origin && origins.has(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      
      // Only enable credentials for authenticated endpoints
      if (req.path.startsWith("/api/auth")) {
        res.header("Access-Control-Allow-Credentials", "true");
      }
    } else if (origin) {
      // Log rejected origins for monitoring
      console.warn(`CORS: Rejected origin: ${origin}`);
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}
```

**Testing**:
```bash
# Test valid origin
curl -H "Origin: https://your-domain.com" http://localhost:5000/api/test

# Test invalid origin
curl -H "Origin: https://evil.com" http://localhost:5000/api/test
# Expected: No CORS headers

# Test localhost in production
NODE_ENV=production curl -H "Origin: http://localhost:3000" http://localhost:5000/api/test
# Expected: No CORS headers
```

### Rate Limiting Strategy

**Current Status**: 🔴 Missing

**Risk**: No rate limiting enables brute force, DoS, and credential stuffing attacks.

**Implementation**:
```typescript
// server/middleware/rate-limit.ts
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import { Redis } from "ioredis";

const redis = new Redis(process.env.REDIS_URL);

// Global rate limit
export const globalLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: "rl:global:",
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth endpoints - stricter
export const authLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: "rl:auth:",
  }),
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 minutes
  skipSuccessfulRequests: true, // Only count failed attempts
});

// Upload endpoints
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 uploads per hour
  skipFailedRequests: true,
});
```

**Integration**:
```typescript
// server/index.ts
import { globalLimiter, authLimiter, uploadLimiter } from "./middleware/rate-limit";

app.use("/api", globalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/photos/upload", uploadLimiter);
```

**Validation**:
```bash
# Test rate limit
for i in {1..10}; do
  curl http://localhost:5000/api/test
done
# Expected: 429 after limit reached
```

## Mobile Hardening

### iOS Keychain Usage for Secrets

**Current Status**: ⚠️ Using AsyncStorage for sensitive data

**Evidence**: `/client/lib/storage.ts` stores user data in AsyncStorage without encryption

**Risk**: AsyncStorage is not encrypted on iOS, sensitive data readable if device compromised.

**Implementation**:
```typescript
// client/lib/secure-storage.ts
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export class SecureStorage {
  /**
   * Store sensitive data in iOS Keychain or Android Keystore
   * Falls back to encrypted AsyncStorage on web
   */
  static async setSecureItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      // Web fallback - use crypto API
      return this.setWebSecureItem(key, value);
    }
    
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }

  static async getSecureItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return this.getWebSecureItem(key);
    }
    
    return await SecureStore.getItemAsync(key);
  }

  static async deleteSecureItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      return this.deleteWebSecureItem(key);
    }
    
    await SecureStore.deleteItemAsync(key);
  }

  // Web fallback using Web Crypto API
  private static async setWebSecureItem(key: string, value: string): Promise<void> {
    // Implementation using IndexedDB + Web Crypto API
    // See: https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
  }
}
```

**Migration** from AsyncStorage:
```typescript
// client/lib/storage.ts - Update for sensitive data
import { SecureStorage } from './secure-storage';

export async function saveAuthToken(token: string): Promise<void> {
  // Use SecureStore instead of AsyncStorage
  await SecureStorage.setSecureItem('@auth_token', token);
}

export async function getUserProfile(): Promise<UserProfile> {
  // Email might be sensitive - use secure storage
  const email = await SecureStorage.getSecureItem('@user_email');
  
  // Non-sensitive data can remain in AsyncStorage
  const data = await AsyncStorage.getItem(USER_KEY);
  // ...
}
```

**Validation**:
```bash
# iOS: Verify keychain usage
xcrun simctl spawn booted log stream --predicate 'processImagePath contains "Cloud-Gallery"' | grep -i keychain

# Check for keychain access groups
plutil -p Cloud-Gallery.app/Info.plist | grep -i keychain
```

### Android Keystore Usage

**Current Status**: ⚠️ Using AsyncStorage

**Implementation**: Expo SecureStore automatically uses Android Keystore on Android:

```typescript
// Already secure with SecureStore implementation above
// Android-specific configuration in app.json:
{
  "expo": {
    "android": {
      "permissions": [
        // No special permissions needed for Keystore
      ]
    }
  }
}
```

**Keystore Features**:
- Hardware-backed on devices with TEE/Secure Element
- Keys never leave secure hardware
- Biometric authentication support

**Validation**:
```bash
# Check Keystore usage
adb logcat | grep -i keystore

# Verify hardware-backed
adb shell getprop ro.hardware.keystore
# Expected: Hardware name or "true"
```

### AsyncStorage Security Considerations

**Current Implementation**: `/client/lib/storage.ts:11-216`

**Security Analysis**:

⚠️ **Current Issues**:
1. **No encryption** - Data stored in plain text
2. **No data validation** - Lines 28, 74 - Direct JSON.parse without schema validation
3. **No integrity checking** - Data can be modified without detection
4. **Excessive error suppression** - Lines 29-31, 75-77 - Silently returns empty arrays on errors

**Data Classification**:
```typescript
// Current storage keys from /client/lib/storage.ts:15-17
const PHOTOS_KEY = "@photo_vault_photos";      // 🟡 Semi-sensitive (metadata)
const ALBUMS_KEY = "@photo_vault_albums";      // 🟢 Non-sensitive
const USER_KEY = "@photo_vault_user";          // 🔴 Sensitive (email)
```

**Hardened Implementation**:
```typescript
// client/lib/storage.ts - Add validation layer
import { z } from 'zod';
import { SecureStorage } from './secure-storage';

// Schema validation
const PhotoSchema = z.object({
  id: z.string(),
  uri: z.string().url(),
  width: z.number().positive(),
  height: z.number().positive(),
  createdAt: z.number(),
  isFavorite: z.boolean(),
  albumIds: z.array(z.string()),
});

const PhotoArraySchema = z.array(PhotoSchema);

export async function getPhotos(): Promise<Photo[]> {
  try {
    const data = await AsyncStorage.getItem(PHOTOS_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    
    // Validate data integrity
    const result = PhotoArraySchema.safeParse(parsed);
    if (!result.success) {
      console.error('Photo data validation failed:', result.error);
      // Alert user of data corruption
      return [];
    }
    
    return result.data;
  } catch (error) {
    // Log specific error instead of suppressing
    console.error('Failed to load photos:', error);
    return [];
  }
}

// Store sensitive user data securely
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  // Email in secure storage
  if (profile.email) {
    await SecureStorage.setSecureItem('@user_email', profile.email);
  }
  
  // Non-sensitive data in AsyncStorage
  const publicProfile = {
    name: profile.name,
    avatarUri: profile.avatarUri,
  };
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(publicProfile));
}
```

### Deep Link Security

**Current Status**: ⚠️ Needs Implementation

**Risk**: Unvalidated deep links can trigger unintended actions or leak data.

**Implementation**:
```typescript
// app.json - Define URL schemes
{
  "expo": {
    "scheme": "cloudgallery",
    "ios": {
      "associatedDomains": ["applinks:cloudgallery.app"]
    },
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "cloudgallery.app",
              "pathPrefix": "/share"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

**Validation Middleware**:
```typescript
// client/lib/deep-links.ts
import * as Linking from 'expo-linking';
import { z } from 'zod';

const DeepLinkSchema = z.object({
  path: z.enum(['/share', '/album', '/photo']),
  queryParams: z.object({
    id: z.string().uuid().optional(),
    token: z.string().min(32).optional(),
  }),
});

export function useDeepLinkHandler() {
  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      const { path, queryParams } = Linking.parse(event.url);
      
      // Validate deep link structure
      const result = DeepLinkSchema.safeParse({ path, queryParams });
      if (!result.success) {
        console.warn('Invalid deep link:', event.url);
        return;
      }
      
      // Require user confirmation for sensitive actions
      if (path === '/share') {
        Alert.alert(
          'Open Shared Album?',
          'This will load shared content',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open', onPress: () => handleShare(queryParams) },
          ]
        );
      }
    });
    
    return () => subscription.remove();
  }, []);
}
```

**Testing**:
```bash
# iOS
xcrun simctl openurl booted "cloudgallery://share?id=malicious"

# Android
adb shell am start -W -a android.intent.action.VIEW -d "cloudgallery://share?id=malicious"
```

### Intent Filter Hardening (Android)

**Implementation**:
```xml
<!-- android/app/src/main/AndroidManifest.xml -->
<manifest>
  <application>
    <activity android:name=".MainActivity">
      <!-- HTTPS deep links only -->
      <intent-filter android:autoVerify="true">
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        
        <!-- Specific host and path only -->
        <data 
          android:scheme="https"
          android:host="cloudgallery.app"
          android:pathPrefix="/share" />
      </intent-filter>
      
      <!-- Custom scheme with specific paths -->
      <intent-filter>
        <action android:name="android.intent.action.VIEW" />
        <category android:name="android.intent.category.DEFAULT" />
        <category android:name="android.intent.category.BROWSABLE" />
        
        <data 
          android:scheme="cloudgallery"
          android:host="share" />
      </intent-filter>
      
      <!-- Prevent intent injection -->
      <meta-data 
        android:name="android.intent.action.VIEW"
        android:value="restricted" />
    </activity>
  </application>
</manifest>
```

### Network Security Config (Android)

**Implementation**:
```xml
<!-- android/app/src/main/res/xml/network_security_config.xml -->
<network-security-config>
  <!-- Require certificate pinning for API -->
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="true">api.cloudgallery.app</domain>
    <pin-set expiration="2025-01-01">
      <!-- Replace with your certificate pins -->
      <pin digest="SHA-256">AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin>
      <pin digest="SHA-256">BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=</pin>
    </pin-set>
  </domain-config>
  
  <!-- Block cleartext traffic globally -->
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
  
  <!-- Debug builds can use localhost -->
  <debug-overrides>
    <domain-config cleartextTrafficPermitted="true">
      <domain includeSubdomains="false">localhost</domain>
      <domain includeSubdomains="false">10.0.2.2</domain>
    </domain-config>
  </debug-overrides>
</network-security-config>
```

**AndroidManifest.xml**:
```xml
<application
  android:networkSecurityConfig="@xml/network_security_config">
</application>
```

**Certificate Pinning Extraction**:
```bash
# Extract certificate pins
openssl s_client -connect api.cloudgallery.app:443 | openssl x509 -pubkey -noout | \
  openssl pkey -pubin -outform der | openssl dgst -sha256 -binary | base64
```

### App Transport Security (iOS)

**Implementation**:
```xml
<!-- ios/CloudGallery/Info.plist -->
<key>NSAppTransportSecurity</key>
<dict>
  <!-- Require HTTPS globally -->
  <key>NSAllowsArbitraryLoads</key>
  <false/>
  
  <!-- Exception only for development -->
  <key>NSExceptionDomains</key>
  <dict>
    <key>localhost</key>
    <dict>
      <key>NSExceptionAllowsInsecureHTTPLoads</key>
      <true/>
      <key>NSIncludesSubdomains</key>
      <false/>
    </dict>
  </dict>
  
  <!-- Require TLS 1.3 -->
  <key>NSAllowsLocalNetworking</key>
  <false/>
</dict>

<!-- Photo library access description -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Cloud Gallery needs access to save and load your photos</string>

<key>NSPhotoLibraryAddUsageDescription</key>
<string>Cloud Gallery needs permission to save photos to your library</string>
```

**Testing**:
```bash
# Verify ATS enforcement
xcrun simctl spawn booted log stream --predicate 'subsystem == "com.apple.network"' | grep -i "ATS"
```

### Jailbreak/Root Detection Policy

**Status**: ⚠️ Advisory Only (Not Blocking)

**Rationale**: Blocking jailbroken/rooted devices reduces legitimate user access while determined attackers bypass detection. Adopt detection + warning approach.

**Implementation**:
```typescript
// client/lib/device-integrity.ts
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export async function checkDeviceIntegrity(): Promise<{
  isCompromised: boolean;
  reasons: string[];
}> {
  const reasons: string[] = [];
  
  if (Platform.OS === 'ios') {
    // Check for common jailbreak indicators
    const jailbreakPaths = [
      '/Applications/Cydia.app',
      '/Library/MobileSubstrate/MobileSubstrate.dylib',
      '/bin/bash',
      '/usr/sbin/sshd',
      '/etc/apt',
      '/private/var/lib/apt/',
    ];
    
    // Note: File existence checks are limited in React Native
    // This is detection, not prevention
    if (__DEV__) {
      console.log('Skipping jailbreak detection in development');
    }
  }
  
  if (Platform.OS === 'android') {
    // Check for root indicators
    // Note: Magisk and modern root tools bypass these checks
    if (__DEV__) {
      console.log('Skipping root detection in development');
    }
  }
  
  return {
    isCompromised: reasons.length > 0,
    reasons,
  };
}

// Usage in app
export function useDeviceIntegrityWarning() {
  useEffect(() => {
    checkDeviceIntegrity().then(({ isCompromised, reasons }) => {
      if (isCompromised) {
        Alert.alert(
          'Security Warning',
          'Your device may be jailbroken/rooted. This could compromise your data security.',
          [{ text: 'I Understand' }]
        );
        
        // Log for analytics/fraud detection
        console.warn('Compromised device detected:', reasons);
      }
    });
  }, []);
}
```

**Policy**:
- ✅ Detect and warn users
- ✅ Log events for analytics
- ❌ Do not block access
- ✅ Consider restricting sensitive features (e.g., payment)

## React Native Security Best Practices

### 1. JavaScript Execution Context

**Risk**: React Native executes JavaScript in same context as app, no browser sandbox.

**Mitigations**:
```typescript
// Avoid eval and Function constructor
// ❌ NEVER DO THIS
const userCode = await fetchUserCode();
eval(userCode); // Arbitrary code execution

// ✅ Use safe alternatives
// If dynamic execution needed, use isolated WebView
<WebView 
  source={{ html: userContent }}
  javaScriptEnabled={false}  // Disable unless required
  originWhitelist={['https://*']}
  onMessage={(event) => {
    // Validate messages from WebView
  }}
/>
```

### 2. Native Module Security

```typescript
// Validate all inputs to native modules
import { NativeModules } from 'react-native';

const { SecureModule } = NativeModules;

// ❌ Unsafe
SecureModule.processData(userInput);

// ✅ Safe
import { z } from 'zod';
const InputSchema = z.string().max(1000);
const validated = InputSchema.parse(userInput);
SecureModule.processData(validated);
```

### 3. Debug Mode Protections

```typescript
// app.json
{
  "expo": {
    "extra": {
      "isDebugBuild": false
    }
  }
}

// App entry point
if (__DEV__) {
  console.warn('Running in development mode - debug features enabled');
}

// Disable debug features in production
if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.error = () => {};
}
```

### 4. Secure Component Patterns

```typescript
// Prevent React Native component injection
// ❌ UNSAFE
const ComponentName = userInput;
return <ComponentName />;

// ✅ SAFE - Use allowlist
const ALLOWED_COMPONENTS = {
  'Gallery': GalleryComponent,
  'Album': AlbumComponent,
} as const;

const componentKey = userInput as keyof typeof ALLOWED_COMPONENTS;
const Component = ALLOWED_COMPONENTS[componentKey];
if (Component) {
  return <Component />;
}
```

## Validation and Testing

### Server Hardening Tests

```bash
# Test non-root execution
docker exec cloud-gallery whoami

# Test read-only filesystem
docker exec cloud-gallery touch /test.txt

# Test security headers
curl -I https://your-domain.com

# Test rate limiting
ab -n 200 -c 10 http://localhost:5000/api/test
```

### Mobile Hardening Tests

```bash
# iOS Keychain test
npm run ios
# Verify SecureStore usage in logs

# Android Keystore test
npm run android
adb logcat | grep -i keystore

# Deep link test
npx uri-scheme open cloudgallery://share?id=test --ios
```

### Security Scanning

```bash
# npm audit for server dependencies
npm audit --audit-level=moderate

# React Native security scan
npx react-native-security-scan

# Android APK security
apkanalyzer security analyze app-release.apk
```

## Remediation Priorities

1. **Critical (P0)** - Implement immediately:
   - Add security headers middleware
   - Fix CORS localhost in production
   - Add rate limiting
   - Migrate sensitive data to SecureStore

2. **High (P1)** - Next sprint:
   - Implement non-root user execution
   - Add AsyncStorage data validation
   - Configure Network Security Config (Android)
   - Configure App Transport Security (iOS)

3. **Medium (P2)** - Within 2 sprints:
   - Add read-only filesystem
   - Implement deep link validation
   - Add device integrity checks
   - Drop Linux capabilities

4. **Low (P3)** - Backlog:
   - Network egress controls
   - Certificate pinning
   - Advanced jailbreak/root detection

## References

- OWASP Mobile Security Testing Guide: https://mobile-security.gitbook.io/
- React Native Security Guide: https://reactnative.dev/docs/security
- Expo SecureStore: https://docs.expo.dev/versions/latest/sdk/securestore/
- OWASP MASVS: https://github.com/OWASP/owasp-masvs
- Docker Security Best Practices: https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html

---
*This document should be reviewed quarterly and after any security incidents.*
