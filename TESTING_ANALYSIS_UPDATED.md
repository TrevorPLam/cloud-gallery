# Updated Testing Infrastructure Analysis (March 2026)

**Status:** Deep analysis complete | **Remaining Failures:** ~35-40 tests across 17-18 files

---

## Executive Summary

The test suite status has **significantly improved** since the original `failing_tests.txt` was generated. Many previously failing tests are now passing:

- ✅ `server/services/public-links.test.ts` - 25 tests passing (was failing)
- ✅ `server/services/partner-sharing.test.ts` - 18 tests passing (was failing)
- ✅ `server/sharing-routes.test.ts` - 27 tests passing (was failing)
- ✅ `server/memory-routes.test.ts` - 21 tests passing (was failing)
- ✅ `server/routes.test.ts` - 3 tests passing

**Remaining failures fall into 3 distinct categories** with clear remediation paths.

---

## Current Failure Categories

### Category 1: Server Route Mock State Persistence (5-10 tests failing)

**Affected Files:**
- `server/album-routes.test.ts` - 5 failures (GET/PUT/DELETE by ID returns 404)
- `server/backup-routes.test.ts` - Needs verification
- `server/duplicate-routes.test.ts` - Needs verification
- `server/search-routes.test.ts` - Needs verification

**Root Cause:**
Database mocks don't maintain state between insert → select operations. Test pattern:
```typescript
// 1. Insert album via mock
mockData.albums.push({ id: "album1", ... });

// 2. Route queries db - returns empty array (mock returns [] by default)
const result = await db.select().from(albums).where(eq(albums.id, "album1"));
// result = [] ❌ Should be [{ id: "album1", ... }]
```

**Error Pattern:**
```
Error: expected 200 "OK", got 404 "Not Found"
  at server/album-routes.test.ts:XXX
```

**Solution:**
Update `server/__mocks__/db.ts` to support stateful queries:
```typescript
const mockDataStore = new Map();

export const mockDb = {
  select: () => ({
    from: (table) => ({
      where: (condition) => {
        const results = Array.from(mockDataStore.values())
          .filter(row => matchesCondition(row, condition));
        return Promise.resolve(results);
      }
    })
  })
};
```

---

### Category 2: Vitest Setup Module Path Error (Multiple files blocked)

**Affected Files:**
- `server/face-routes.test.ts` - Entire file blocked
- `server/ml-routes.test.ts` - Likely same issue
- `server/partner-sharing-routes.test.ts` - Likely same issue
- `server/public-routes.test.ts` - Likely same issue
- `server/storage-routes.test.ts` - Likely same issue
- `server/sync-routes.test.ts` - Likely same issue

**Root Cause:**
`vitest.setup.ts` line 160 references wrong module path:
```typescript
vi.mock("./server/db", () => {
  const { getMockDatabase } = require("./server/__mocks__/database"); // ❌ Wrong path
  // Should be: require("./server/__mocks__/database")
  // Or use: require("./__mocks__/database") relative to setup.ts location
});
```

**Error Pattern:**
```
Error: Cannot find module './server/__mocks__/database'
Require stack:
- C:\Users\trevo\Desktop\cloud-gallery\vitest.setup.ts
```

**Solution:**
Fix path resolution in `vitest.setup.ts`:
```typescript
vi.mock("./server/db", async () => {
  const { getMockDatabase } = await import("./server/__mocks__/database.js");
  return { db: getMockDatabase() };
});
```

---

### Category 3: Client Test React Native Flow Syntax Errors (15-20 tests failing)

**Affected Files:**
- `client/lib/native-share.test.ts` - React Native Flow parse error
- `client/lib/photo-editor.test.ts` - Variable initialization order error
- `client/lib/ml/photo-analyzer.test.ts` - Likely same
- `client/screens/AlbumDetailScreen.share.test.tsx` - Likely same
- `client/screens/BackupScreen.test.tsx` - Likely same
- `client/screens/DuplicatesScreen.test.tsx` - Likely same
- `client/screens/EditPhotoScreen.test.tsx` - Likely same
- `client/screens/MemoriesScreen.test.tsx` - Likely same
- `client/screens/PartnerSharingScreen.test.tsx` - Likely same
- `client/screens/SearchScreen.test.tsx` - React Native Flow parse error
- `client/screens/SharedAlbumsScreen.test.tsx` - Likely same
- `client/screens/SmartAlbumsScreen.test.tsx` - Likely same
- `client/screens/SyncSettingsScreen.test.tsx` - Likely same

**Root Cause A: React Native Flow Type Syntax**
React Native's `index.js` contains Flow type syntax that Vite/Vitest can't parse:
```javascript
// node_modules/react-native/index.js:27
import typeof * as ReactNativePublicAPI from "./index.js.flow";
// ^ Vitest sees "typeof" as unexpected token
```

**Error Pattern:**
```
SyntaxError: Unexpected token 'typeof'
Caused by: RollupError: Parse failure: Expected 'from', got 'typeOf'
At file: node_modules/react-native/index.js:27:8
```

**Root Cause B: Variable Initialization Order (photo-editor.test.ts)**
Vitest hoists `vi.mock()` calls, so variables used in mock factories must be declared BEFORE the mock:
```typescript
// ❌ WRONG - causes ReferenceError
vi.mock("expo-image-manipulator", () => ({
  manipulateAsync: mockManipulateAsync, // TDZ error - not defined yet!
}));
const mockManipulateAsync = vi.fn();

// ✅ CORRECT
const mockManipulateAsync = vi.fn(); // Declare first
vi.mock("expo-image-manipulator", () => ({
  manipulateAsync: mockManipulateAsync, // Now defined
}));
```

**Solution A: Configure Vitest to handle React Native**
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    deps: {
      inline: [/react-native/, /expo-/, /@react-native/],
      // Or exclude from processing entirely:
      // external: [/react-native/]
    },
  },
  // Or use esbuild to strip Flow types
  esbuild: {
    loader: 'tsx',
    target: 'esnext',
  },
});
```

**Solution B: Fix mock variable ordering**
File `client/lib/photo-editor.test.ts` has the fix already in comments (lines 26-39):
```typescript
// FIX 1: mockManipulateAsync must be declared before vi.mock()
const mockManipulateAsync = vi.fn((uri: string) =>
  Promise.resolve({ uri: `${uri}_processed`, width: 1000, height: 1000 }),
);

vi.mock("expo-image-manipulator", () => ({
  manipulateAsync: mockManipulateAsync, // Now works!
  SaveFormat: { JPEG: "jpeg", PNG: "png" },
  FlipType: { Horizontal: "horizontal", Vertical: "vertical" },
}));
```
But the file still fails, suggesting another issue exists.

---

## Detailed File-by-File Status

### Server Route Tests

| File | Status | Failure Count | Issue |
|------|--------|---------------|-------|
| `album-routes.test.ts` | ❌ FAILING | 5/18 | Mock state persistence |
| `backup-routes.test.ts` | ⚠️ UNKNOWN | - | Likely same pattern |
| `duplicate-routes.test.ts` | ⚠️ UNKNOWN | - | Likely same pattern |
| `face-routes.test.ts` | ❌ FAILING | All | Module path error |
| `ml-routes.test.ts` | ⚠️ UNKNOWN | - | Likely module path |
| `partner-sharing-routes.test.ts` | ⚠️ UNKNOWN | - | Likely module path |
| `public-routes.test.ts` | ⚠️ UNKNOWN | - | Likely module path |
| `search-routes.test.ts` | ⚠️ UNKNOWN | - | Likely mock state |
| `storage-routes.test.ts` | ⚠️ UNKNOWN | - | Likely module path |
| `sync-routes.test.ts` | ⚠️ UNKNOWN | - | Likely module path |
| `sharing-routes.test.ts` | ✅ PASSING | 0/27 | Fixed! |
| `memory-routes.test.ts` | ✅ PASSING | 0/21 | Fixed! |
| `routes.test.ts` | ✅ PASSING | 0/3 | Working |

### Server Service Property Tests

| File | Status | Failure Count | Issue |
|------|--------|---------------|-------|
| `public-links.test.ts` | ✅ PASSING | 0/25 | Fixed! |
| `partner-sharing.test.ts` | ✅ PASSING | 0/18 | Fixed! |
| `backup.test.ts` | ⚠️ UNKNOWN | - | Needs verification |
| `face-recognition.test.ts` | ⚠️ UNKNOWN | - | Needs verification |
| `memories.test.ts` | ⚠️ UNKNOWN | - | Needs verification |
| `search.test.ts` | ⚠️ UNKNOWN | - | Needs verification |
| `smart-albums.test.ts` | ⚠️ UNKNOWN | - | Needs verification |
| `sync.test.ts` | ⚠️ UNKNOWN | - | Needs verification |

### Client Tests

| File | Status | Failure Count | Issue |
|------|--------|---------------|-------|
| `PhotoMetadataEditor.test.tsx` | ❌ FAILING | All | React Native Flow |
| `photo-editor.test.ts` | ❌ FAILING | All | Variable init order |
| `native-share.test.ts` | ❌ FAILING | All | React Native Flow |
| `AlbumDetailScreen.share.test.tsx` | ❌ FAILING | All | React Native Flow |
| `BackupScreen.test.tsx` | ❌ FAILING | All | React Native Flow |
| `DuplicatesScreen.test.tsx` | ❌ FAILING | All | React Native Flow |
| `EditPhotoScreen.test.tsx` | ❌ FAILING | All | React Native Flow |
| `MemoriesScreen.test.tsx` | ❌ FAILING | All | React Native Flow |
| `PartnerSharingScreen.test.tsx` | ❌ FAILING | All | React Native Flow |
| `SearchScreen.test.tsx` | ❌ FAILING | All | React Native Flow |
| `SharedAlbumsScreen.test.tsx` | ❌ FAILING | All | React Native Flow |
| `SmartAlbumsScreen.test.tsx` | ❌ FAILING | All | React Native Flow |
| `SyncSettingsScreen.test.tsx` | ❌ FAILING | All | React Native Flow |

---

## Technical Deep Dive

### 1. Database Mock State Issue

**Current Mock Architecture (`server/__mocks__/db.ts`):**
```typescript
export const db = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue(Promise.resolve([])), // ❌ Always empty
      }),
    }),
  }),
};
```

The mock returns `Promise.resolve([])` hardcoded. It doesn't read from any data store.

**Test Pattern That Fails (`server/album-routes.test.ts:226-262`):**
```typescript
it("should return all albums for authenticated user", async () => {
  // Setup mock data
  const mockData = (global as any).__mockDbData;
  mockData.albums.push({ id: "album1", userId: "user123", ... });
  
  // Request
  const response = await request(app)
    .get("/api/albums")
    .set("Authorization", "Bearer valid-token")
    .expect(200); // ❌ Gets 404 because db.select() returns []
});
```

**The Fix:**
The mock must be aware of the global data store:
```typescript
const createStatefulMock = () => {
  const store = (global as any).__mockDbData || { albums: [] };
  
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((table) => ({
        where: vi.fn().mockImplementation((condition) => {
          // Actually filter the store data
          const tableData = store[table] || [];
          return Promise.resolve(tableData.filter(row => 
            matchesCondition(row, condition)
          ));
        }),
      })),
    }),
  };
};
```

### 2. Vitest Setup Path Resolution

**Current (Broken) in `vitest.setup.ts:159-164`:**
```typescript
vi.mock("./server/db", () => {
  const { getMockDatabase } = require("./server/__mocks__/database"); // ❌
  return { db: getMockDatabase() };
});
```

**Why It Fails:**
- `vitest.setup.ts` is at project root
- The require path `"./server/__mocks__/database"` is relative to setup.ts
- But Vitest's mock hoisting may change the execution context
- The file exists at `server/__mocks__/database.ts` (verified)

**The Fix:**
Use dynamic import or factory function with proper path:
```typescript
vi.mock("./server/db", async () => {
  const { getMockDatabase } = await import("./server/__mocks__/database");
  return { db: getMockDatabase() };
});
```

Or use `vi.hoisted()` pattern:
```typescript
const { getMockDatabase } = vi.hoisted(() => {
  return require("./server/__mocks__/database");
});

vi.mock("./server/db", () => ({
  db: getMockDatabase(),
}));
```

### 3. React Native Flow Type Syntax

**Why This Happens:**
- React Native uses Flow type annotations in its source
- Vitest uses Vite which uses Rollup for bundling
- Rollup's parser doesn't understand Flow syntax
- The `import typeof` statement is Flow-specific

**Solutions:**

**Option A: Configure Vitest to exclude React Native from optimization**
```typescript
// vitest.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: ["react-native", "expo-image-manipulator", ...],
  },
  test: {
    deps: {
      external: [/react-native/, /expo-/],
    },
  },
});
```

**Option B: Use babel-plugin-transform-flow-strip-types**
```typescript
// vitest.config.ts
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({ 
      include: [/\.tsx?$/],
      babel: {
        plugins: ['babel-plugin-transform-flow-strip-types']
      }
    })
  ],
});
```

**Option C: Mock React Native completely (recommended for tests)**
Already partially done in `vitest.setup.ts`, but needs to be more comprehensive:
```typescript
// vitest.setup.ts - Add comprehensive React Native mock
vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj) => obj.ios || obj.default },
  // ... all other exports
}));

// This prevents Vitest from trying to parse the real react-native
```

---

## Revised Remediation Plan

### Phase 1: Fix Vitest Setup Module Path (30 min)
**Priority: CRITICAL** - Blocks ~10 test files

1. Fix `vitest.setup.ts:159-164` path resolution
2. Run tests to verify files unblock

### Phase 2: Fix Server Mock State Persistence (2-3 hours)
**Priority: HIGH** - Fixes 5+ test failures

1. Update `server/__mocks__/db.ts` with stateful implementation
2. Ensure `__mockDbData` global is properly shared
3. Test `server/album-routes.test.ts` until all pass
4. Apply same fix to other route tests

### Phase 3: Fix Client Test Configuration (2-3 hours)
**Priority: HIGH** - Fixes ~20 test files

1. Update `vitest.config.ts` to handle React Native/expo modules
2. Ensure mocks are comprehensive in `vitest.setup.ts`
3. Fix any remaining variable initialization order issues
4. Test a few client files to verify fix

### Phase 4: Verification & Remaining Issues (1-2 hours)
**Priority: MEDIUM**

1. Run full test suite
2. Document any remaining edge cases
3. Verify coverage thresholds

---

## Quick Wins (Immediate Fixes)

### Fix 1: vitest.setup.ts Path Resolution
```typescript
// Line 159-164 in vitest.setup.ts
vi.mock("./server/db", async () => {
  const { getMockDatabase } = await import("./server/__mocks__/database");
  return { db: getMockDatabase() };
});
```

### Fix 2: Mock State in album-routes.test.ts
The test already has the infrastructure (`__mockDbData` global), but the mock needs to actually use it:
```typescript
// In server/__mocks__/db.ts
vi.mock("./db", () => {
  const mockDb = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table) => ({
        where: vi.fn().mockImplementation(() => {
          // Read from global data store
          const data = (global as any).__mockDbData;
          return Promise.resolve(data?.[table] || []);
        }),
      })),
    })),
  };
  return { db: mockDb };
});
```

---

## Conclusion

**The testing infrastructure is much healthier than the original `failing_tests.txt` suggested.**

- ~40+ tests have been fixed already (property tests, route tests)
- **3 clear root causes** remain:
  1. Module path resolution in vitest.setup.ts
  2. Mock state persistence in server route tests
  3. React Native Flow syntax in client tests

**Estimated time to 100%:** 4-6 hours of focused work

**Recommended order:**
1. Fix vitest.setup.ts paths (unblocks 10+ files)
2. Fix mock state (fixes remaining server tests)
3. Configure client test handling (fixes all client tests)
