# Testing Infrastructure Remediation Gameplan

**Goal:** Achieve 100% test pass rate (currently 131 failures)  
**Estimated Effort:** 2-3 days  
**Phases:** 4 sequential phases with verification gates

---

## Phase 1: Fix Server Route Database Mocks (Days 1-2)
**Priority: CRITICAL** - 65+ failing tests

### Problem
Server route tests fail with 404 Not Found because database mocks return empty arrays. The mocks in `server/__mocks__/db.ts` don't maintain state between operations.

### Solution
Replace static mocks with stateful mock database that:
- Maintains in-memory data store
- Supports query chaining (select().from().where())
- Returns inserted data on subsequent selects
- Handles foreign key relationships

### Files to Modify
1. `server/__mocks__/db.ts` - Complete rewrite with stateful mocks
2. `server/test-utils/drizzle-mock.ts` - Ensure createSelectChain supports conditional returns

### Implementation Details

```typescript
// New stateful mock architecture
const mockDataStore = {
  albums: new Map(),
  photos: new Map(),
  users: new Map(),
  // ... other tables
};

// Mock factory that reads/writes to store
export const createStatefulMockDb = () => {
  return {
    select: () => ({
      from: (table: string) => ({
        where: (condition: any) => ({
          execute: () => Promise.resolve(
            Array.from(mockDataStore[table].values())
              .filter(item => matchesCondition(item, condition))
          ),
        }),
      }),
    }),
    insert: (table: string) => ({
      values: (data: any) => ({
        returning: () => ({
          execute: () => {
            const id = data.id || `test-${Date.now()}`;
            mockDataStore[table].set(id, { ...data, id });
            return Promise.resolve([{ ...data, id }]);
          },
        }),
      }),
    }),
    // ... update, delete
  };
};
```

### Verification
```bash
npm run test -- --run server/album-routes.test.ts
npm run test -- --run server/photo-routes.test.ts
# Should show all tests passing
```

---

## Phase 2: Fix Property-Based Test Data (Day 2)
**Priority: HIGH** - 50+ failing tests

### Problem
Property tests use undefined variables: `sampleEmbeddings`, `sample`, `arb` not properly defined.

### Solution
1. Define test data factories in each service test file
2. Create proper fast-check arbitraries
3. Ensure all referenced variables are defined

### Files to Modify
1. `server/services/public-links.test.ts`
2. `server/services/partner-sharing.test.ts`
3. `server/services/memories.test.ts`
4. `server/services/smart-albums.test.ts`
5. `server/services/sync.test.ts`
6. `server/services/face-recognition.test.ts`

### Implementation Pattern
```typescript
// Define missing test data at top of each file
const sampleEmbeddings = {
  face1: new Array(128).fill(0).map((_, i) => Math.sin(i)),
  face2: new Array(128).fill(0).map((_, i) => Math.cos(i)),
};

// Define arbitraries for property tests
const arbUserId = fc.string({ minLength: 8, maxLength: 32 });
const arbDate = fc.date({ min: new Date('2020-01-01'), max: new Date() });
```

### Verification
```bash
npm run test -- --run server/services/public-links.test.ts
npm run test -- --run server/services/partner-sharing.test.ts
```

---

## Phase 3: Fix Client ML & Component Mocks (Day 2-3)
**Priority: MEDIUM** - 20+ failing tests

### Problem
Client tests fail due to:
- `tfliteManager` undefined in ML tests
- Missing expo-sharing mock
- Incomplete React Navigation mocks

### Solution
1. Complete ML module mocks in `vitest.setup.ts`
2. Add missing Expo/React Native mocks
3. Fix photo-editor test utilities

### Files to Modify
1. `vitest.setup.ts` - Complete ML mocks
2. Create `client/__mocks__/expo-sharing.ts`
3. Create `client/__mocks__/react-native-share.ts`

### Implementation
```typescript
// vitest.setup.ts additions
vi.mock('react-native-fast-tflite', () => ({
  TFLiteManager: {
    getInstance: vi.fn().mockReturnValue({
      getDeviceCapabilities: vi.fn().mockResolvedValue({
        hasGPU: true,
        hasNPU: false,
        maxMemory: 4 * 1024 * 1024 * 1024,
      }),
      loadModel: vi.fn().mockResolvedValue({ modelId: 'test-model' }),
      runInference: vi.fn().mockResolvedValue({ outputs: [[0.1, 0.2, 0.3]] }),
    }),
  },
}));

// New file: client/__mocks__/expo-sharing.ts
export const shareAsync = vi.fn().mockResolvedValue(undefined);
export const isAvailableAsync = vi.fn().mockResolvedValue(true);
```

### Verification
```bash
npm run test -- --run client/lib/photo-editor.test.ts
npm run test -- --run client/lib/native-share.test.ts
```

---

## Phase 4: Integration & Verification (Day 3)
**Priority: HIGH**

### Tasks
1. Run full test suite
2. Fix any remaining edge cases
3. Verify coverage thresholds still met
4. Document any flaky tests

### Verification
```bash
# Full test run
npm run test -- --run

# Check coverage
npm run test:coverage

# Should show:
# - 0 failures
# - 100% coverage maintained
```

---

## Key Files to Create/Modify

### New Files
- `server/__mocks__/stateful-db.ts` - State management for mocks
- `server/test-utils/mock-factories.ts` - Test data factories
- `client/__mocks__/expo-sharing.ts`
- `client/__mocks__/react-native-share.ts`

### Modified Files
1. `server/__mocks__/db.ts` - Complete rewrite
2. `vitest.setup.ts` - Additional mocks
3. `server/services/*.test.ts` - Define test data

---

## Success Metrics

- **0 test failures** across entire suite
- **100% code coverage** maintained (lines, functions, branches, statements)
- **<10s** test execution time
- **No flaky tests** (consistent results across 3 consecutive runs)

---

## Risk Mitigation

1. **Incremental Changes**: Fix one test category at a time
2. **Backup Originals**: Keep original files until phase verified
3. **Test Isolation**: Ensure mocks don't leak between test files
4. **Documentation**: Comment all mock behaviors for future maintenance

---

## Post-Implementation Monitoring

- Run `npm run test` daily to catch regressions
- Monitor CI/CD test results
- Track test execution time trends
- Document any new mock requirements for future features
