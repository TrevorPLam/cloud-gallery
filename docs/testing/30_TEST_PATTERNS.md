# Test Patterns and Best Practices

Standard patterns and practices used in Cloud Gallery tests.

## Test Structure

### Basic Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("MyComponent/MyFunction", () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  it("should do something specific", () => {
    // Arrange: Set up test data
    const input = createTestData();

    // Act: Execute the code
    const result = myFunction(input);

    // Assert: Verify expectations
    expect(result).toBe(expected);
  });
});
```

### Nested Describes

Group related tests:

```typescript
describe("UserStorage", () => {
  describe("createUser", () => {
    it("should create user with valid data", () => {});
    it("should reject invalid email", () => {});
    it("should hash password", () => {});
  });

  describe("getUser", () => {
    it("should return user by id", () => {});
    it("should return null for missing user", () => {});
  });
});
```

## Test Data Factories

### Using Test Factories

Use the centralized test factories for consistent test data:

```typescript
import { createTestPhoto, createTestAlbum, createTestData } from "../../tests/factories";

describe("Photo Operations", () => {
  it("should handle photo creation", () => {
    // Arrange: Use factory for test data
    const photo = createTestPhoto({
      width: 1920,
      height: 1080,
      isFavorite: true,
    });

    // Act & Assert
    expect(photo.width).toBe(1920);
    expect(photo.isFavorite).toBe(true);
  });

  it("should handle large datasets", () => {
    // Arrange: Use factory for bulk data
    const { photos, albums } = createTestData(100, 10);

    // Act & Assert
    expect(photos).toHaveLength(100);
    expect(albums).toHaveLength(10);
  });
});
```

### Edge Case Testing

Use boundary test data for edge cases:

```typescript
import { boundaryTestData } from "../../tests/factories";

describe("Edge Cases", () => {
  it("should handle extreme photo dimensions", () => {
    const extremePhotos = boundaryTestData.extremePhotos();
    
    extremePhotos.forEach(photo => {
      expect(photo.width).toBeGreaterThan(0);
      expect(photo.height).toBeGreaterThan(0);
    });
  });

  it("should handle special characters in album titles", () => {
    const edgeAlbums = boundaryTestData.extremeAlbums();
    
    edgeAlbums.forEach(album => {
      expect(album.title).toBeDefined();
      // Test Unicode, empty strings, long strings
    });
  });
});
```

## Performance Testing

### Performance Test Structure

```typescript
describe("Performance Tests", () => {
  it("should handle large datasets efficiently", async () => {
    const largeDataset = performanceTestData.largeDataset(1000, 50);
    const startTime = performance.now();

    // Act: Perform operation
    await savePhotos(largeDataset.photos);
    
    const endTime = performance.now();
    const duration = endTime - startTime;

    // Assert: Performance threshold
    expect(duration).toBeLessThan(1000); // Under 1 second
  });
});
```

### Memory Usage Testing

```typescript
it("should not cause memory leaks", async () => {
  const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
  
  // Perform repeated operations
  for (let i = 0; i < 100; i++) {
    const testData = performanceTestData.largeDataset(100, 5);
    await processPhotos(testData.photos);
  }

  // Force garbage collection if available
  if (global.gc) global.gc();
  
  const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
  const memoryIncrease = finalMemory - initialMemory;

  expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
});
```

## Mocking Patterns

### AsyncStorage Mock

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

// In tests:
beforeEach(() => {
  vi.clearAllMocks();
});

it("should save data", async () => {
  await saveData({ key: "value" });

  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    "storage_key",
    JSON.stringify({ key: "value" })
  );
});

it("should load data", async () => {
  vi.mocked(AsyncStorage.getItem).mockResolvedValue(
    JSON.stringify({ key: "value" })
  );

  const data = await loadData();

  expect(data).toEqual({ key: "value" });
});
```

### Fetch Mock

```typescript
// Mock fetch globally
global.fetch = vi.fn();

it("should fetch data", async () => {
  const mockResponse = new Response(JSON.stringify({ id: 1 }), {
    status: 200,
  });
  vi.mocked(global.fetch).mockResolvedValue(mockResponse);

  const data = await fetchUser(1);

  expect(data).toEqual({ id: 1 });
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining("/api/users/1"),
    expect.any(Object)
  );
});
```

### Time Mocking

```typescript
it("should use current timestamp", () => {
  const mockTime = 123456789;
  const dateSpy = vi.spyOn(Date, "now").mockReturnValue(mockTime);

  const result = createWithTimestamp();

  expect(result.createdAt).toBe(mockTime);

  dateSpy.mockRestore();
});
```

## Testing Async Code

### Promises

```typescript
it("should resolve successfully", async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});

it("should reject on error", async () => {
  await expect(failingAsyncFunction()).rejects.toThrow("Error message");
});
```

### Multiple Async Operations

```typescript
it("should handle multiple operations", async () => {
  const [result1, result2] = await Promise.all([
    operation1(),
    operation2(),
  ]);

  expect(result1).toBe(expected1);
  expect(result2).toBe(expected2);
});
```

## Testing Error Conditions

### Try-Catch Blocks

```typescript
async function loadData() {
  try {
    return await fetch("/api/data");
  } catch {
    return null;
  }
}

// ✅ Test both paths:
it("should return data on success", async () => {
  vi.mocked(fetch).mockResolvedValue(mockResponse);
  const result = await loadData();
  expect(result).toEqual(mockData);
});

it("should return null on error", async () => {
  vi.mocked(fetch).mockRejectedValue(new Error("Network error"));
  const result = await loadData();
  expect(result).toBe(null);
});
```

### Thrown Errors

```typescript
it("should throw on invalid input", () => {
  expect(() => divide(10, 0)).toThrow("Division by zero");
});

it("should throw specific error", async () => {
  await expect(asyncFunction()).rejects.toThrow(CustomError);
});
```

## Testing Edge Cases

### Empty Data

```typescript
it("should handle empty array", () => {
  expect(processItems([])).toEqual([]);
});

it("should handle empty string", () => {
  expect(validateInput("")).toBe(false);
});

it("should handle null", () => {
  expect(getDefault(null)).toBe(defaultValue);
});

it("should handle undefined", () => {
  expect(getDefault(undefined)).toBe(defaultValue);
});
```

### Boundary Values

```typescript
describe("clamp", () => {
  it("should handle min boundary", () => {
    expect(clamp(0, 0, 10)).toBe(0);
  });

  it("should handle max boundary", () => {
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it("should handle below min", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it("should handle above max", () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});
```

### Large Datasets

```typescript
it("should handle very long strings", () => {
  const longString = "a".repeat(10000);
  expect(processString(longString)).toBeDefined();
});

it("should handle many items", () => {
  const manyItems = Array.from({ length: 1000 }, (_, i) => i);
  expect(processArray(manyItems)).toHaveLength(1000);
});
```

## Data Builders / Factories

### Creating Test Data

```typescript
// Test data factory
function createTestPhoto(overrides = {}): Photo {
  return {
    id: "test-id",
    uri: "test.jpg",
    width: 100,
    height: 100,
    createdAt: Date.now(),
    isFavorite: false,
    albumIds: [],
    ...overrides,
  };
}

// Usage:
it("should process photo", () => {
  const photo = createTestPhoto({ isFavorite: true });
  expect(processPhoto(photo)).toBeDefined();
});
```

### Complex Data Structures

```typescript
function createTestAlbum(photoCount = 3): Album {
  const photos = Array.from({ length: photoCount }, (_, i) =>
    createTestPhoto({ id: `photo-${i}` })
  );

  return {
    id: "album-1",
    title: "Test Album",
    photoIds: photos.map((p) => p.id),
    coverPhotoUri: photos[0]?.uri || null,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
}
```

## Assertion Patterns

### Exact Matching

```typescript
expect(result).toBe(42);                // Primitive equality
expect(result).toEqual({ key: "value" }); // Deep equality
expect(result).toStrictEqual(expected);   // Strict deep equality
```

### Partial Matching

```typescript
expect(result).toMatchObject({
  id: expect.any(String),
  createdAt: expect.any(Number),
});

expect(result).toHaveProperty("id");
expect(result).toHaveProperty("user.name", "John");
```

### Array Assertions

```typescript
expect(array).toHaveLength(3);
expect(array).toContain(item);
expect(array).toEqual(expect.arrayContaining([item1, item2]));
```

### Function Calls

```typescript
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledTimes(2);
expect(mockFn).toHaveBeenCalledWith(arg1, arg2);
expect(mockFn).toHaveBeenLastCalledWith(arg);
```

## Anti-Patterns to Avoid

### ❌ Don't Test Implementation Details

```typescript
// ❌ Bad: Testing internal state
it("should set internal flag", () => {
  const instance = new MyClass();
  instance.doSomething();
  expect(instance._internalFlag).toBe(true); // Private detail
});

// ✅ Good: Testing public behavior
it("should complete operation", () => {
  const instance = new MyClass();
  const result = instance.doSomething();
  expect(result.isComplete).toBe(true);
});
```

### ❌ Don't Over-Mock

```typescript
// ❌ Bad: Mocking everything
vi.mock("./storage");
vi.mock("./validator");
vi.mock("./formatter");

// ✅ Good: Only mock external dependencies
vi.mock("@react-native-async-storage/async-storage");
// Use real storage, validator, formatter
```

### ❌ Don't Use Magic Sleeps

```typescript
// ❌ Bad: Arbitrary delays
it("should process async", async () => {
  startAsync();
  await new Promise(resolve => setTimeout(resolve, 1000));
  expect(result).toBeDefined();
});

// ✅ Good: Proper async handling
it("should process async", async () => {
  const result = await processAsync();
  expect(result).toBeDefined();
});
```

### ❌ Don't Share State Between Tests

```typescript
// ❌ Bad: Shared mutable state
let sharedUser;

it("test 1", () => {
  sharedUser = createUser();
  // Modify sharedUser
});

it("test 2", () => {
  // sharedUser is already modified!
  expect(sharedUser.name).toBe("original"); // Fails!
});

// ✅ Good: Fresh state per test
it("test 1", () => {
  const user = createUser();
  // Modify user
});

it("test 2", () => {
  const user = createUser(); // Fresh instance
  expect(user.name).toBe("original"); // Works!
});
```

### ❌ Don't Write Brittle Tests

```typescript
// ❌ Bad: Depends on exact error message
it("should throw", () => {
  expect(() => fn()).toThrow("An error occurred at line 42");
});

// ✅ Good: Tests behavior
it("should throw", () => {
  expect(() => fn()).toThrow(ValidationError);
});
```

## Test Organization

### File Structure

```
client/
├── lib/
│   ├── storage.ts
│   └── storage.test.ts      # ✅ Next to source file
├── components/
│   └── Button/
│       ├── Button.tsx
│       └── Button.test.tsx  # ✅ Next to component
```

### Test Naming

```typescript
// ✅ Good: Descriptive names
it("should create user with generated ID", () => {});
it("should throw on missing username", () => {});
it("should return null for non-existent photo", () => {});

// ❌ Bad: Vague names
it("works", () => {});
it("test 1", () => {});
it("should be ok", () => {});
```

## Performance Considerations

### Avoid Expensive Setup

```typescript
// ❌ Slow: Expensive setup in each test
it("test 1", () => {
  const data = generateHugeDataset(); // Slow!
  // test
});

// ✅ Fast: Shared setup
let data;
beforeAll(() => {
  data = generateHugeDataset(); // Once
});

it("test 1", () => {
  // Use data
});
```

### Parallel-Safe Tests

```typescript
// ✅ Each test is independent
it("test 1", () => {
  const user = createUser();
  expect(user).toBeDefined();
});

it("test 2", () => {
  const user = createUser();
  expect(user).toBeDefined();
});
```

## Summary

**Golden Rules:**
1. **Test behavior**, not implementation
2. **Mock external dependencies**, use real code
3. **Test all branches**, including errors
4. **Keep tests independent** and parallel-safe
5. **Use descriptive names** for tests
6. **Prefer simple assertions** over complex logic
7. **Cover edge cases** and boundaries
8. **Clean up mocks** between tests

## Resources

- **Vitest Docs**: https://vitest.dev/
- **Testing Library**: https://testing-library.com/
- **Jest Mock Functions**: https://jestjs.io/docs/mock-functions

## Next Steps

- Review [coverage requirements](./20_COVERAGE.md)
- Check [exceptions list](./99_EXCEPTIONS.md)
- Study existing tests for examples
