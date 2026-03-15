# TASK-002-1: Mock Audit Report

## Overview
This report catalogs all mocks in the Cloud Gallery test suite and categorizes them into **Boundaries (keep)** vs **Internal Dependencies (remove)** for implementing sociable testing patterns.

## Mock Categories

### ✅ TRUE BOUNDARIES (Should Keep Mocking)
These are external dependencies that should always be mocked:
- **Network Requests**: fetch, HTTP clients
- **Database Connections**: External database servers
- **File System**: fs, path operations
- **Time/Date**: Date.now, performance.now
- **Randomness**: Math.random, crypto
- **Third-party SDKs**: AWS S3, Sentry, JWT libraries
- **Platform APIs**: React Native modules, Expo modules

### ❌ INTERNAL DEPENDENCIES (Should Remove Mocking)
These are internal modules that should use real implementations:
- **Business Logic Services**: sync, backup, sharing, search
- **Security Utilities**: security, auth, encryption modules
- **Domain Objects**: schema definitions, domain models
- **Internal Utilities**: validators, formatters, helpers
- **State Management**: stores, context providers

## Detailed Mock Inventory

### 1. Database Mocks (❌ INTERNAL - Remove)
**Files affected**: 25+ test files
**Current pattern**: Complex chain mocks
```typescript
vi.mock("../db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
  },
}));
```
**Issue**: Over-mocked internal database layer
**Solution**: Use in-memory SQLite or test database

### 2. Security Module Mocks (❌ INTERNAL - Remove)
**Files affected**: `auth-routes.test.ts`, `album-routes.test.ts`, `duplicate-routes.test.ts`
**Current pattern**:
```typescript
vi.mock("./security", () => ({
  hashPassword: vi.fn().mockResolvedValue("$argon2id$v=19$m=65536,t=3,p=4$hash"),
  verifyPassword: vi.fn().mockResolvedValue(true),
  generateAccessToken: vi.fn().mockReturnValue("mock-access-token"),
}));
```
**Issue**: Mocking internal security logic
**Solution**: Use real security implementations

### 3. Authentication Middleware Mocks (❌ INTERNAL - Remove)
**Files affected**: 15+ route test files
**Current pattern**:
```typescript
vi.mock("./auth", () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: "user123", email: "test@example.com" };
    next();
  }),
}));
```
**Issue**: Mocking internal authentication logic
**Solution**: Use real auth middleware with test tokens

### 4. Business Service Mocks (❌ INTERNAL - Remove)
**Files affected**: Multiple service test files
**Examples**:
- `sync.test.ts`: Mocks SyncService
- `backup.test.ts`: Mocks BackupService  
- `sharing.test.ts`: Mocks sharingService
- `search-routes.test.ts`: Mocks SearchService

**Issue**: Mocking internal business logic
**Solution**: Use real service implementations

### 5. External SDK Mocks (✅ BOUNDARY - Keep)
**Files affected**: `backup.test.ts`, `siem.test.ts`
**Examples**:
```typescript
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn().mockResolvedValue({}),
  })),
}));
```
**Status**: ✅ Correct - These are true external boundaries

### 6. React Native/Expo Mocks (✅ BOUNDARY - Keep)
**Files affected**: `vitest.setup.ts`, client test files
**Examples**:
```typescript
vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: any) => obj.ios || obj.default },
  StyleSheet: { create: (styles: any) => styles },
}));
```
**Status**: ✅ Correct - These are platform boundaries

### 7. Network/Fetch Mocks (✅ BOUNDARY - Keep)
**Files affected**: `siem.test.ts`, various integration tests
**Examples**:
```typescript
const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal("fetch", fetchSpy);
```
**Status**: ✅ Correct - Network calls should be mocked

## High-Priority Files for Conversion

### Phase 1 (High Impact)
1. `server/services/sync.test.ts` - Remove complex DB mocks, use in-memory DB
2. `server/services/backup.test.ts` - Remove internal service mocks
3. `server/auth-routes.test.ts` - Remove security module mocks
4. `server/album-routes.test.ts` - Remove DB and security mocks

### Phase 2 (Medium Impact)
5. `server/search-routes.test.ts` - Remove service mocks
6. `server/sharing-routes.test.ts` - Remove service and DB mocks
7. `server/storage-routes.test.ts` - Remove service mocks
8. `server/sync-routes.test.ts` - Remove service mocks

### Phase 3 (Lower Impact)
9. All other route test files with similar patterns
10. Client-side tests with internal dependency mocks

## Implementation Strategy

### Step 1: Database Infrastructure
- Set up in-memory SQLite for tests
- Create test data factories
- Migrate from chain mocks to real DB operations

### Step 2: Service Layer
- Remove internal service mocks
- Use real implementations with test data
- Focus on behavior testing over implementation

### Step 3: Authentication & Security
- Use real security implementations
- Create test JWT tokens
- Remove security module mocks

### Step 4: Validation
- Ensure tests focus on outcomes
- Replace interaction assertions with state assertions
- Verify behavior rather than implementation

## Success Metrics

- **Target**: 90% of unit tests use real implementations for internal collaborators
- **Current**: ~30% (extensive internal mocking)
- **Goal**: Reduce mock maintenance burden
- **Benefit**: More realistic testing, less brittle tests

## Next Steps

1. Set up in-memory database infrastructure
2. Convert highest-priority test files
3. Create sociable testing examples
4. Update documentation with new patterns
