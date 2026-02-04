# Integrations Documentation

[← Back to Architecture Index](../architecture/00_INDEX.md)

## Overview

Cloud Gallery MVP uses several third-party services and native integrations for its functionality. This document catalogs all external integrations, their purposes, and how to manage their configurations.

---

## Current Integrations

### 1. Expo Platform

**Purpose**: Mobile development platform providing native modules and development tools

**Type**: Development Platform  
**Required**: Yes (core dependency)  
**SDK Version**: 54.x

**Services Used**:
- Expo Go app for development testing
- Metro bundler for JavaScript bundling
- Native module access (camera, media library, etc.)

**Configuration**:
- `/app.json` - Expo app configuration
  - App name, slug, version
  - Platform settings (iOS, Android, Web)
  - Asset management
  - Splash screen and icon

**Environment Variables**:
```bash
EXPO_PACKAGER_PROXY_URL=https://$REPLIT_DEV_DOMAIN
REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN
EXPO_PUBLIC_DOMAIN=$REPLIT_DEV_DOMAIN:5000
```

**Evidence**: `/app.json`, `/package.json` expo dependencies

---

### 2. Device Media Library (Native)

**Purpose**: Access device photos and camera roll

**Type**: Native API (via Expo modules)  
**Required**: Yes (core functionality)  
**Packages**: 
- `expo-image-picker@17.0.10` - Photo selection
- `expo-media-library@18.2.1` - Media access

**Permissions Required**:
- iOS: `NSPhotoLibraryUsageDescription` in Info.plist
- Android: `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`

**Usage Flow**:
1. Request permission via `ImagePicker.requestMediaLibraryPermissionsAsync()`
2. If granted, launch picker with `ImagePicker.launchImageLibraryAsync()`
3. User selects photos
4. Returns photo URIs and metadata

**Configuration**: None (uses Expo defaults)

**Evidence**: Used in photo upload flows (screens import `expo-image-picker`)

---

### 3. Device Storage (Native)

**Purpose**: Persistent local storage for app data

**Type**: Native API (via React Native)  
**Required**: Yes (core data layer)  
**Package**: `@react-native-async-storage/async-storage@2.2.0`

**Data Stored**:
- Photos metadata
- Albums
- User profile

**No external service**: Data stays on device only

**Evidence**: `/client/lib/storage.ts` (all data operations)

---

### 4. Expo Haptics

**Purpose**: Tactile feedback for user interactions

**Type**: Native API  
**Required**: No (UX enhancement)  
**Package**: `expo-haptics@15.0.7`

**Usage**:
- Button taps
- Success confirmations
- Error alerts

**Configuration**: None (works out of box)

**Evidence**: Used in interactive components

---

### 5. Expo Sharing

**Purpose**: Share photos to other apps

**Type**: Native API  
**Required**: No (optional feature)  
**Package**: `expo-sharing@14.0.8`

**Usage Flow**:
1. User taps share button in photo detail
2. `Sharing.shareAsync(photoUri)` opens native share sheet
3. User selects destination app

**Configuration**: None

**Evidence**: Used in PhotoDetailScreen

---

### 6. Google Fonts

**Purpose**: Custom typography (Nunito font family)

**Type**: External Asset  
**Required**: No (fallback to system font)  
**Package**: `@expo-google-fonts/nunito@0.4.2`

**Fonts Loaded**:
- Nunito Regular
- Nunito SemiBold
- Nunito Bold

**Configuration**: Loaded in App.tsx via `useFonts()` hook

**Evidence**: `/client/App.tsx`, design_guidelines.md specifies Nunito

---

## Future Integrations (Planned)

### 1. Object Storage (S3/CloudFlare R2)

**Purpose**: Cloud storage for photo files

**Type**: Object Storage  
**Required**: Yes (when backend is live)  
**Provider Options**: AWS S3, CloudFlare R2, Backblaze B2

**Configuration Needed**:
```bash
# Environment variables
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_BUCKET_NAME=cloud-gallery-photos
```

**Usage**:
- Photo upload: Client → Server → S3
- Photo retrieval: Signed URLs from S3
- Thumbnails: Generated and stored in S3

**SDK**: `@aws-sdk/client-s3` (not yet added)

---

### 2. PostgreSQL Database

**Purpose**: Persistent storage for user data, photos metadata, albums

**Type**: Relational Database  
**Required**: Yes (when backend is live)  
**Provider Options**: Railway, Neon, Supabase, self-hosted

**Configuration**:
```bash
# Environment variables
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

**Schema**: Defined in `/shared/schema.ts` (Drizzle ORM)

**Migrations**: Via `drizzle-kit` (configured in `/drizzle.config.ts`)

**Evidence**: `/shared/schema.ts`, `/drizzle.config.ts`

---

### 3. Authentication Service (Optional)

**Purpose**: User authentication and authorization

**Type**: Auth Service  
**Required**: No (can implement JWT directly)  
**Options**: 
- Self-hosted JWT (planned approach)
- Firebase Auth
- Clerk
- Auth0

**Current Plan**: Self-hosted JWT with PostgreSQL users table

**Configuration** (self-hosted):
```bash
JWT_SECRET=random-secret-key-here
JWT_EXPIRY=24h
```

**Evidence**: Users table in `/shared/schema.ts`

---

### 4. CDN (Content Delivery Network)

**Purpose**: Fast photo delivery worldwide

**Type**: CDN  
**Required**: No (optimization)  
**Options**: CloudFlare CDN, AWS CloudFront

**Configuration**:
- Point CDN to S3 bucket
- Configure caching rules
- Use CDN URLs instead of direct S3 URLs

---

### 5. Email Service (Optional)

**Purpose**: Password reset, notifications

**Type**: Transactional Email  
**Required**: No (future feature)  
**Options**: SendGrid, AWS SES, Postmark

**Configuration**:
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=xxx
FROM_EMAIL=noreply@cloud-gallery.com
```

---

## Webhook Patterns (Not Used)

**Current State**: No webhooks implemented

**Future Possibilities**:
- S3 upload notifications
- Database change events (Postgres triggers)
- Third-party integrations

---

## Secrets & Keys Handling

### Current State: No Secrets

**Why**: MVP is local-only, no API keys or sensitive data needed

### Future Secrets Management

**Environment Variables** (production):
- Never commit secrets to git
- Use `.env` files locally (add to `.gitignore`)
- Use hosting provider's secrets manager (Railway, Vercel, etc.)

**Required Secrets** (future):
```bash
# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=...

# Object Storage
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...

# Email (optional)
SENDGRID_API_KEY=...
```

**Access Pattern**:
```typescript
// server/index.ts
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL not configured');
}
```

**Validation**: Check all required env vars on server startup

---

## API Keys Location

### Current (Development)

No API keys required for local development.

### Future (Production)

**Server Environment Variables**:
- Stored in hosting provider (Railway, Vercel, etc.)
- Not stored in codebase
- Rotated periodically

**Client Environment Variables**:
- Expo supports `EXPO_PUBLIC_*` prefix for client-side vars
- Example: `EXPO_PUBLIC_API_URL`
- Never store secrets in client (can be extracted from bundle)

**Configuration**: `.env` file (gitignored)
```bash
# .env.example (committed)
DATABASE_URL=your-database-url-here
JWT_SECRET=your-jwt-secret-here

# .env (gitignored - actual values)
DATABASE_URL=postgresql://...
JWT_SECRET=actual-secret-here
```

---

## Third-Party Service Limits

### Expo Platform
- **Free Tier**: Unlimited for development
- **Paid**: EAS Build and Submit ($29/month for production)

### AsyncStorage
- **iOS**: ~6MB storage limit
- **Android**: ~10MB storage limit
- **Web**: 5-10MB (browser dependent)

### Future Services

**PostgreSQL** (typical free tiers):
- Railway: 500 hours/month, 1GB storage
- Neon: 3GB storage, unlimited compute
- Supabase: 500MB database, 1GB bandwidth

**Object Storage** (typical):
- AWS S3: 5GB free for 12 months, then pay-per-use
- CloudFlare R2: 10GB storage free, no egress fees

---

## Integration Testing

### Current Testing

No integration tests yet (all manual)

### Future Integration Tests

```typescript
// Test S3 upload
describe('S3 Integration', () => {
  it('uploads photo to S3', async () => {
    const file = Buffer.from('fake-image-data');
    const url = await uploadToS3(file, 'test.jpg');
    expect(url).toMatch(/https:\/\/.*\.amazonaws\.com/);
  });
});

// Test database connection
describe('Database Integration', () => {
  it('connects to PostgreSQL', async () => {
    const result = await db.execute(sql`SELECT 1`);
    expect(result.rows).toHaveLength(1);
  });
});
```

---

## Monitoring & Logging (Not Implemented)

### Future Monitoring

**Application Monitoring**:
- Error tracking: Sentry
- Performance: Expo Application Services (EAS)
- Uptime: UptimeRobot

**Log Aggregation**:
- Server logs: Papertrail, Loggly
- Client errors: Sentry, Bugsnag

**Configuration**:
```bash
SENTRY_DSN=https://...
LOG_LEVEL=info
```

---

## Dependency Management

### Keeping Integrations Updated

**Check for Updates**:
```bash
npm outdated
```

**Update Strategy**:
- Minor updates: Safe to apply
- Major updates: Check breaking changes
- Expo SDK: Update all expo packages together

**Evidence**: `/package.json` dependencies section

---

## Evidence Files

**Current Integrations**:
- `/app.json` - Expo configuration
- `/package.json` - Dependencies list
- `/client/lib/storage.ts` - AsyncStorage usage

**Future Integration Config**:
- `/drizzle.config.ts` - Database ORM config
- `/shared/schema.ts` - Database schema

**Environment Setup**:
- `/package.json` scripts section (Replit-specific env vars)

---

## Troubleshooting Integrations

### "Expo modules not found"
```bash
npm install
npx expo prebuild --clean
```

### "Permission denied for media library"
```bash
# iOS: Check Info.plist has NSPhotoLibraryUsageDescription
# Android: Check AndroidManifest.xml has storage permissions
```

### "AsyncStorage quota exceeded"
```bash
# Clear app data or migrate to SQLite for larger storage
await AsyncStorage.clear();
```

---

[← Back to Architecture Index](../architecture/00_INDEX.md)
