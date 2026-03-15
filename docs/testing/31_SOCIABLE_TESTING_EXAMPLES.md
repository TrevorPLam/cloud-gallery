# Sociable Testing Examples and Guidelines

This document provides practical examples and guidelines for implementing sociable testing patterns in Cloud Gallery.

## Before vs After Examples

### Example 1: Database Testing

#### ❌ Before: Solitary Testing with Mocks
```typescript
// Old approach - complex chain mocks
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

it("should get user photos", async () => {
  const mockSelect = vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([mockPhoto]),
      }),
    }),
  });
  
  db.select = mockSelect;
  
  const photos = await getUserPhotos("user-123");
  expect(photos).toEqual([mockPhoto]);
  expect(mockSelect).toHaveBeenCalled(); // Testing implementation
});
```

#### ✅ After: Sociable Testing with Real Database
```typescript
// New approach - real in-memory database
import { setupTestDatabase, createTestUser, createTestPhotos } from "../test-utils/test-database";

it("should get user photos", async () => {
  const db = await setupTestDatabase();
  const user = createTestUser();
  const photos = createTestPhotos(user.id, 3);
  
  await seedTestData(db, { user, photos, albums: [] });
  
  const result = await getUserPhotos(db, user.id);
  
  expect(result).toHaveLength(3);
  expect(result[0].userId).toBe(user.id); // Testing behavior
});
```

### Example 2: Service Testing

#### ❌ Before: Mocking Internal Services
```typescript
// Old approach - mocking internal business logic
vi.mock("./services/security", () => ({
  hashPassword: vi.fn().mockResolvedValue("$argon2id$v=19$m=65536,t=3,p=4$hash"),
  verifyPassword: vi.fn().mockResolvedValue(true),
}));

it("should authenticate user", async () => {
  const mockHashPassword = vi.fn().mockResolvedValue("hashed_password");
  hashPassword = mockHashPassword;
  
  const result = await authService.register(userData);
  
  expect(result).toBeDefined();
  expect(mockHashPassword).toHaveBeenCalledWith(userData.password); // Implementation detail
});
```

#### ✅ After: Using Real Services
```typescript
// New approach - real security implementation
it("should authenticate user", async () => {
  const db = await setupTestDatabase();
  const userData = createTestUser();
  
  const result = await authService.register(db, userData);
  
  expect(result).toBeDefined();
  expect(result.passwordHash).toMatch(/^\$argon2id/); // Real behavior
  expect(result.passwordHash).not.toBe(userData.password); // Password was hashed
  
  // Verify password can be verified with real implementation
  const isValid = await verifyPassword(userData.password, result.passwordHash);
  expect(isValid).toBe(true);
});
```

### Example 3: Route Testing

#### ❌ Before: Mocking Everything
```typescript
// Old approach - mocking all dependencies
vi.mock("./auth", () => ({
  authenticateToken: vi.fn((req, res, next) => {
    req.user = { id: "test-user" };
    next();
  }),
}));

vi.mock("./services/photos", () => ({
  photoService: {
    getPhotos: vi.fn().mockResolvedValue([mockPhoto]),
  },
}));

it("should get photos endpoint", async () => {
  const response = await request(app)
    .get("/api/photos")
    .expect(200);
    
  expect(photoService.getPhotos).toHaveBeenCalled(); // Testing implementation
});
```

#### ✅ After: Real Services, Mock Boundaries Only
```typescript
// New approach - real services, mock only external boundaries
vi.mock("jsonwebtoken", () => ({
  verify: vi.fn((token) => ({ id: "test-user" })), // External boundary
}));

it("should get photos endpoint", async () => {
  const db = await setupTestDatabase();
  const user = createTestUser();
  const photos = createTestPhotos(user.id, 5);
  
  await seedTestData(db, { user, photos, albums: [] });
  
  const token = generateTestToken(user.id);
  const response = await request(app)
    .get("/api/photos")
    .set("Authorization", `Bearer ${token}`)
    .expect(200);
    
  expect(response.body.photos).toHaveLength(5); // Testing behavior
  expect(response.body.photos[0].userId).toBe(user.id);
});
```

## Boundary Identification Guidelines

### ✅ Always Mock (True Boundaries)
- **External APIs**: fetch, HTTP clients, third-party services
- **Database Servers**: PostgreSQL, MySQL (use in-memory for tests)
- **File System**: fs operations, file uploads
- **Time/Date**: Date.now, setTimeout, setInterval
- **Randomness**: Math.random, crypto operations
- **Platform APIs**: React Native modules, native code
- **Third-party SDKs**: AWS SDK, Sentry, analytics

### ❌ Never Mock (Internal Dependencies)
- **Business Logic**: Services, domain logic
- **Security Utilities**: Hashing, validation, encryption
- **Data Models**: Schema definitions, domain objects
- **Internal Utilities**: Formatters, validators, helpers
- **State Management**: Stores, context providers
- **Configuration**: Internal config objects

## Implementation Patterns

### 1. Test Database Setup
```typescript
// test-utils/test-database.ts
export async function setupTestDatabase() {
  const sqlite = new Database(":memory:");
  const db = drizzle(sqlite, { schema });
  await runMigrations(db);
  return db;
}

// In tests
beforeEach(async () => {
  db = await setupTestDatabase();
});
```

### 2. Test Data Factories
```typescript
// test-utils/test-factories.ts
export function createTestUser(overrides = {}) {
  return {
    id: `user-${randomId()}`,
    email: `test-${randomId()}@example.com`,
    ...overrides,
  };
}

// In tests
const user = createTestUser({ email: "specific@example.com" });
```

### 3. Behavior-Focused Assertions
```typescript
// ❌ Testing implementation
expect(mockService.method).toHaveBeenCalledWith(args);

// ✅ Testing behavior
expect(result.photos).toHaveLength(expectedCount);
expect(result.user.email).toBe(userEmail);
```

## Migration Strategy

### Phase 1: Infrastructure (Week 1)
1. Set up test database utilities
2. Create test data factories
3. Identify high-impact test files

### Phase 2: Core Services (Week 2)
1. Convert sync service tests
2. Convert auth service tests
3. Convert backup service tests

### Phase 3: Route Tests (Week 3)
1. Convert auth route tests
2. Convert photo route tests
3. Convert album route tests

### Phase 4: Validation (Week 4)
1. Run full test suite
2. Update documentation
3. Train team on new patterns

## Common Pitfalls and Solutions

### Pitfall 1: Test Data Leaks
```typescript
// ❌ Shared state causes test interference
let sharedUser;

it("test 1", () => {
  sharedUser = createUser();
  // Modify sharedUser
});

it("test 2", () => {
  // sharedUser is modified from previous test!
});

// ✅ Fresh state per test
it("test 1", () => {
  const user = createUser();
  // Test with fresh user
});

it("test 2", () => {
  const user = createUser(); // Fresh instance
});
```

### Pitfall 2: Over-Complex Test Setup
```typescript
// ❌ Too much setup
beforeEach(async () => {
  db = await setupTestDatabase();
  await seedComplexTestData(db);
  await setupMockServices();
  await configureExternalMocks();
});

// ✅ Minimal, focused setup
beforeEach(async () => {
  db = await setupTestDatabase();
});

it("should do specific thing", async () => {
  const user = createTestUser();
  await db.insert(schema.users).values(user);
  // Only what's needed for this test
});
```

### Pitfall 3: Testing Implementation Details
```typescript
// ❌ Testing how it works
expect(mockDb.select).toHaveBeenCalled();
expect(mockHashPassword).toHaveBeenCalledWith(password);

// ✅ Testing what it does
expect(result.user.email).toBe(expectedEmail);
expect(result.passwordHash).toMatch(/^\$argon2id/);
```

## Performance Considerations

### Database Operations
- Use in-memory SQLite for speed
- Clean up data between tests
- Run tests in parallel when possible

### Test Data
- Create minimal test data
- Use factories for consistency
- Avoid unnecessary relationships

### External Mocks
- Keep external mocks simple
- Mock only what's necessary
- Use consistent mock responses

## Success Metrics

### Quantitative Metrics
- **Mock Reduction**: Target 70% reduction in internal mocks
- **Test Coverage**: Maintain 100% coverage
- **Test Execution**: Keep under 60 seconds
- **Flaky Tests**: Target <1% flaky rate

### Qualitative Metrics
- **Test Readability**: Tests should read like documentation
- **Maintenance**: Tests should survive refactoring
- **Confidence**: Tests should catch real bugs
- **Speed**: Tests should provide fast feedback

## Tools and Utilities

### Test Database
- `better-sqlite3` for in-memory database
- `drizzle-orm` for type-safe database operations
- Custom migration runner for test schema

### Test Data
- Factory functions for consistent test data
- Boundary test data for edge cases
- Performance test data for load testing

### Mock Management
- External boundary mocks only
- Consistent mock interfaces
- Mock validation utilities

## Resources

### Internal Documentation
- [Test Patterns Guide](./30_TEST_PATTERNS.md)
- [Coverage Requirements](./20_COVERAGE.md)
- [Exception List](./99_EXCEPTIONS.md)

### External References
- [Sociable vs Solitary Testing](https://testrigor.com/blog/what-are-solitary-and-sociable-unit-testing/)
- [Testing Library Guidelines](https://testing-library.com/)
- [Vitest Documentation](https://vitest.dev/)

## Next Steps

1. **Review Examples**: Study the before/after examples
2. **Try Pattern**: Convert one small test file
3. **Get Feedback**: Review with team members
4. **Scale Up**: Apply to larger test files
5. **Refine**: Adjust patterns based on experience

Remember: The goal is to test **behavior**, not **implementation**. Focus on what the code does, not how it does it.
