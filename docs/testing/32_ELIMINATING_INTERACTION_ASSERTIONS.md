# Eliminating Interaction-Only Assertions: A Guide

This guide shows how to replace interaction-only assertions with state assertions and outcome testing, following sociable testing principles.

## The Problem with Interaction-Only Assertions

### ❌ What's Wrong with This Pattern?
```typescript
// Testing implementation details
expect(mockService.method).toHaveBeenCalledWith(args);
expect(mockService.method).toHaveBeenCalledTimes(1);
expect(mockDb.select).toHaveBeenCalled();
```

**Issues:**
1. **Brittle Tests**: Break on refactoring even if behavior is unchanged
2. **Implementation Coupling**: Tests are tied to "how" not "what"
3. **False Confidence**: Mocks can lie - tests pass but real code fails
4. **Maintenance Burden**: Every internal change requires test updates

## Before vs After Examples

### Example 1: Service Layer Testing

#### ❌ Before: Interaction-Only Testing
```typescript
// Old approach - testing implementation
vi.mock("./services/user", () => ({
  userService: {
    create: vi.fn().mockResolvedValue(mockUser),
  },
}));

it("should create user", async () => {
  const userData = { email: "test@example.com", password: "password123" };
  
  await createUser(userData);
  
  // Testing implementation details
  expect(userService.create).toHaveBeenCalledWith(userData);
  expect(userService.create).toHaveBeenCalledTimes(1);
});
```

#### ✅ After: State and Outcome Testing
```typescript
// New approach - testing behavior
it("should create user successfully", async () => {
  const db = await setupTestDatabase();
  const userData = createTestUser();
  
  const result = await userService.create(db, userData);
  
  // Testing outcomes and state
  expect(result.email).toBe(userData.email);
  expect(result.id).toBeDefined();
  expect(result.passwordHash).toMatch(/^\$argon2id/); // Real behavior
  
  // Verify state change in database
  const savedUser = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.email, userData.email),
  });
  expect(savedUser).toBeDefined();
  expect(savedUser?.email).toBe(userData.email);
});
```

### Example 2: Route Testing

#### ❌ Before: Testing Service Calls
```typescript
// Old approach - testing service interactions
vi.mock("./services/photos", () => ({
  photoService: {
    getPhotos: vi.fn().mockResolvedValue([mockPhoto]),
  },
}));

it("should get photos endpoint", async () => {
  const response = await request(app)
    .get("/api/photos")
    .expect(200);
    
  // Testing implementation details
  expect(photoService.getPhotos).toHaveBeenCalledWith("user-123");
  expect(photoService.getPhotos).toHaveBeenCalledTimes(1);
});
```

#### ✅ After: Testing API Response and State
```typescript
// New approach - testing API behavior
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
    
  // Testing API response structure and content
  expect(response.body).toHaveProperty("photos");
  expect(response.body.photos).toHaveLength(5);
  expect(response.body.photos[0]).toMatchObject({
    id: expect.any(String),
    uri: expect.any(String),
    userId: user.id,
  });
  
  // Verify data consistency
  expect(response.body.photos.every(p => p.userId === user.id)).toBe(true);
});
```

### Example 3: Database Operations

#### ❌ Before: Testing Query Construction
```typescript
// Old approach - testing database interactions
it("should save photo to database", async () => {
  const photoData = createTestPhoto();
  
  await savePhoto(photoData);
  
  // Testing implementation details
  expect(mockDb.insert).toHaveBeenCalledWith(schema.photos);
  expect(mockDb.values).toHaveBeenCalledWith(photoData);
  expect(mockDb.returning).toHaveBeenCalled();
});
```

#### ✅ After: Testing Data Persistence
```typescript
// New approach - testing data persistence
it("should save photo to database", async () => {
  const db = await setupTestDatabase();
  const photoData = createTestPhoto();
  
  const result = await savePhoto(db, photoData);
  
  // Testing outcome
  expect(result.id).toBeDefined();
  expect(result.uri).toBe(photoData.uri);
  
  // Verify state in database
  const savedPhoto = await db.query.photos.findFirst({
    where: (photos, { eq }) => eq(photos.id, result.id),
  });
  expect(savedPhoto).toBeDefined();
  expect(savedPhoto?.uri).toBe(photoData.uri);
  expect(savedPhoto?.userId).toBe(photoData.userId);
});
```

## Migration Patterns

### Pattern 1: From Mock Verification to State Verification

```typescript
// ❌ Before
expect(mockService.method).toHaveBeenCalledWith(expectedArgs);

// ✅ After
const result = await service.method(args);
expect(result).toEqual(expectedResult);
// Or verify database state
const dbState = await getDbState();
expect(dbState).toMatchObject(expectedState);
```

### Pattern 2: From Call Count to Business Outcome

```typescript
// ❌ Before
expect(mockEmailService.send).toHaveBeenCalledTimes(1);

// ✅ After
// Test that the email was actually queued/sent
const emailQueue = await getEmailQueue();
expect(emailQueue).toHaveLength(1);
expect(emailQueue[0].to).toBe(expectedEmail);
```

### Pattern 3: From Argument Verification to Result Verification

```typescript
// ❌ Before
expect(mockProcessor.process).toHaveBeenCalledWith(rawData, options);

// ✅ After
const result = await processor.process(rawData, options);
expect(result.processedData).toBeDefined();
expect(result.metadata).toMatchObject(expectedMetadata);
```

## Specific Examples from Cloud Gallery

### Sync Service Example

#### ❌ Before: Testing Sync Method Calls
```typescript
it("should register device", async () => {
  const deviceData = { deviceId: "device-123", deviceType: "mobile" };
  
  await registerDevice("user-123", deviceData);
  
  // Implementation testing
  expect(mockSync.registerDevice).toHaveBeenCalledWith("user-123", "device-123", "mobile");
});
```

#### ✅ After: Testing Device Registration Outcome
```typescript
it("should register device successfully", async () => {
  const db = await setupTestDatabase();
  const user = createTestUser();
  await seedTestData(db, { user, photos: [], albums: [] });
  
  const deviceData = { deviceId: "device-123", type: "mobile", os: "iOS" };
  
  const result = await syncService.registerDevice(user.id, deviceData.deviceId, deviceData);
  
  // Test behavior outcome
  expect(result.deviceId).toBe(deviceData.deviceId);
  expect(result.userId).toBe(user.id);
  expect(result.isActive).toBe(true);
  
  // Verify state in database
  const savedDevice = await db.query.devices.findFirst({
    where: (devices, { eq }) => eq(devices.id, deviceData.deviceId),
  });
  expect(savedDevice).toBeDefined();
  expect(savedDevice?.userId).toBe(user.id);
});
```

### Storage Service Example

#### ❌ Before: Testing Storage Method Calls
```typescript
it("should get storage breakdown", async () => {
  await getStorageBreakdown("user-123");
  
  expect(mockStorageService.getStorageBreakdown).toHaveBeenCalledWith("user-123");
});
```

#### ✅ After: Testing Storage Calculation Outcome
```typescript
it("should calculate storage breakdown correctly", async () => {
  const db = await setupTestDatabase();
  const user = createTestUser();
  const photos = createTestPhotos(user.id, 10, { fileSize: 1000000 }); // 1MB each
  
  await seedTestData(db, { user, photos, albums: [] });
  
  const result = await storageService.getStorageBreakdown(db, user.id);
  
  // Test business logic outcome
  expect(result.totalSize).toBe(10000000); // 10MB
  expect(result.photoCount).toBe(10);
  expect(result.breakdown.photos.size).toBe(10000000);
  expect(result.breakdown.photos.count).toBe(10);
});
```

## When Are Interaction Assertions OK?

### ✅ Acceptable Uses
1. **External Boundary Verification**: Testing that external APIs are called correctly
   ```typescript
   // OK - Testing external API call
   expect(fetchSpy).toHaveBeenCalledWith("https://api.example.com", {
     method: "POST",
     body: JSON.stringify(expectedData),
   });
   ```

2. **Event Emission**: Testing that events are published
   ```typescript
   // OK - Testing event publishing
   expect(eventEmitter.emit).toHaveBeenCalledWith("user.created", expectedUser);
   ```

3. **Queue Operations**: Testing that jobs are queued correctly
   ```typescript
   // OK - Testing job queue
   expect(mockQueue.add).toHaveBeenCalledWith("process-photo", {
     photoId: expectedPhotoId,
     userId: expectedUserId,
   });
   ```

### ❌ Unacceptable Uses
1. **Internal Service Calls**: Don't test how internal services call each other
2. **Database Query Construction**: Don't test exact SQL or query structure
3. **Internal Method Calls**: Don't test private method invocation
4. **Implementation Details**: Don't test internal algorithms or data structures

## Implementation Checklist

### For Each Test
- [ ] Are you testing **what** the code does, not **how** it does it?
- [ ] Are assertions focused on **outcomes** and **state**?
- [ ] Would the test still pass if the implementation was refactored?
- [ ] Are you verifying **real behavior** rather than mock behavior?

### Red Flags to Watch For
- `expect(mock.*).toHaveBeenCalled()`
- `expect(mock.*).toHaveBeenCalledWith()`
- `expect(mock.*).toHaveBeenCalledTimes()`
- Tests that pass even when the real implementation is broken
- Tests that break when implementation changes but behavior doesn't

### Green Flags
- Assertions on return values
- Database state verification
- API response structure validation
- Business rule outcome testing
- Integration-style testing with real components

## Tools and Techniques

### 1. Database State Verification
```typescript
// Verify what was actually saved
const saved = await db.query.table.findFirst({
  where: (table, { eq }) => eq(table.id, result.id),
});
expect(saved).toMatchObject(expectedData);
```

### 2. Response Structure Validation
```typescript
// Test API contract
expect(response.body).toMatchObject({
  success: true,
  data: {
    id: expect.any(String),
    createdAt: expect.any(Number),
  },
});
```

### 3. Business Rule Testing
```typescript
// Test actual business logic
const result = await calculateDiscount(user, order);
expect(result.discountPercentage).toBeGreaterThan(0);
expect(result.discountReason).toBe("loyalty_program");
```

## Migration Strategy

### Phase 1: Identify Problematic Tests
1. Search for interaction-only assertions
2. Tag tests that need conversion
3. Prioritize high-value tests

### Phase 2: Convert Tests
1. Set up real test data
2. Replace mock assertions with state assertions
3. Verify tests still catch real bugs

### Phase 3: Validate
1. Run converted tests alongside original tests
2. Ensure both catch the same issues
3. Remove old interaction-only tests

### Phase 4: Refine
1. Review test coverage
2. Add missing state assertions
3. Update team guidelines

## Success Metrics

### Quantitative
- **Reduction** in interaction-only assertions: Target 80% reduction
- **Increase** in state assertions: Target 90% of tests have state assertions
- **Test Stability**: Fewer tests break on refactoring
- **Bug Detection**: Tests still catch real implementation bugs

### Qualitative
- **Test Readability**: Tests clearly document behavior
- **Maintenance**: Less test maintenance overhead
- **Confidence**: Higher confidence in test suite
- **Documentation**: Tests serve as living documentation

## Conclusion

The goal is to test **behavior**, not **implementation**. Focus on what the code accomplishes rather than how it accomplishes it. This leads to more maintainable, reliable, and meaningful tests that survive refactoring and provide genuine confidence in your codebase.
