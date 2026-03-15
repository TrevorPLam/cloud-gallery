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
3. **Use sociable testing patterns** for internal collaborators
4. **Test all branches**, including errors
5. **Keep tests independent** and parallel-safe
6. **Use descriptive names** for tests
7. **Prefer simple assertions** over complex logic
8. **Cover edge cases** and boundaries
9. **Clean up mocks** between tests

## Accessibility-First Testing

### Query Priority Order (Testing Library Recommendation)

When writing tests, follow this priority order for querying elements:

1. **getByRole** - Top preference for everything
   - Use with name option: `getByRole('button', { name: /submit/i })`
   - Examples: buttons, inputs, switches, progress bars
   
2. **getByLabelText** - Form fields
   - Best for form inputs with proper labels
   - Example: `getByLabelText('Email address')`
   
3. **getByPlaceholderText** - Only if no labels available
   - Use sparingly - placeholders are not substitutes for labels
   - Example: `getByPlaceholderText('Enter email')`
   
4. **getByText** - Non-interactive elements
   - Good for headings, paragraphs, static content
   - Example: `getByText('Welcome')`
   
5. **getByDisplayValue** - Form element values
   - Current value of form elements
   - Example: `getByDisplayValue('john@example.com')`
   
6. **getByAltText** - Images with alt text
   - For images, areas, inputs with alt attributes
   - Example: `getByAltText('Profile picture')`
   
7. **getByTitle** - Last resort before test IDs
   - Title attributes (not consistently read by screen readers)
   - Example: `getByTitle('Tooltip text')`
   
8. **getByTestId** - Only when no other option works
   - For dynamic content or when semantic queries aren't possible
   - Always add justification in comments

### React Native Accessibility Patterns

#### Button Components
```typescript
// ✅ Good: Use semantic role
const button = screen.getByRole('button', { name: /submit/i });

// ❌ Avoid: Test ID when semantic query available
const button = screen.getByTestId('submit-button');
```

#### Input Components
```typescript
// ✅ Good: Label-based query
const input = screen.getByLabelText('Email address');

// ✅ Acceptable: Placeholder if no label
const input = screen.getByPlaceholderText('Enter email');

// ❌ Avoid: Test ID for inputs
const input = screen.getByTestId('email-input');
```

#### Loading States
```typescript
// ✅ Good: Progress bar role
const loader = screen.getByRole('progressbar', { name: /loading/i });

// ❌ Avoid: Generic test ID
const loader = screen.getByTestId('activity-indicator');
```

#### Switch Components
```typescript
// ✅ Good: Switch role with name
const toggle = screen.getByRole('switch', { name: /auto-sync/i });

// ❌ Avoid: Test ID for switches
const toggle = screen.getByTestId('auto-sync-switch');
```

#### Empty States
```typescript
// ✅ Good: Separate semantic queries
const title = screen.getByRole('heading', { name: 'No Memories Yet' });
const action = screen.getByRole('button', { name: /Generate Memories/i });

// ❌ Avoid: Generic container test ID
const emptyState = screen.getByTestId('empty-state');
```

### Migration Examples

#### Before (testId approach)
```typescript
it('should select album', async () => {
  const { getByTestId } = render(<AlbumScreen />);
  
  const albumCard = getByTestId('album-card-album-1');
  fireEvent.press(albumCard);
  
  const pinButton = getByTestId('pin-button-album-1');
  fireEvent.press(pinButton);
});
```

#### After (semantic approach)
```typescript
it('should select album', async () => {
  const { getByRole } = render(<AlbumScreen />);
  
  const albumCard = getByRole('button', { name: /John Doe/i });
  fireEvent.press(albumCard);
  
  const pinButton = getByRole('button', { name: /pin/i });
  fireEvent.press(pinButton);
});
```

### Accessibility Testing Utilities

The project provides accessibility testing utilities in `client/test-utils/accessibility.ts`:

```typescript
import { renderWithAccessibility, migrationHelpers } from '../test-utils/accessibility';

// Enhanced render with accessibility helpers
const { getByRole, checkAccessibility } = renderWithAccessibility(<Component />);

// Migration helpers for common patterns
const albumQuery = migrationHelpers.albumCard('Album Name');
const buttonQuery = migrationHelpers.actionButton('Save');
```

### Common React Native Accessibility Props

When writing components, ensure proper accessibility props:

```typescript
// Button component
<TouchableOpacity
  accessible={true}
  accessibilityRole="button"
  accessibilityLabel="Submit Form"
  accessibilityHint="Submits the form and saves data"
  onPress={handleSubmit}
>
  <Text>Submit</Text>
</TouchableOpacity>

// Input component
<TextInput
  accessible={true}
  accessibilityRole="textbox"
  accessibilityLabel="Email address"
  accessibilityHint="Enter your email address"
  value={email}
  onChangeText={setEmail}
/>

// Switch component
<Switch
  accessible={true}
  accessibilityRole="switch"
  accessibilityLabel="Auto-sync"
  accessibilityHint="Enable automatic photo synchronization"
  value={autoSync}
  onValueChange={setAutoSync}
/>
```

### Testing Checklist

When writing or reviewing tests:

- [ ] Prefer semantic queries over test IDs
- [ ] Use `getByRole` for interactive elements
- [ ] Use `getByLabelText` for form fields
- [ ] Reserve `getByTestId` for edge cases with justification
- [ ] Test accessibility structure, not just functionality
- [ ] Include accessibility assertions where appropriate
- [ ] Use migration helpers for common patterns

### Benefits of Accessibility-First Testing

1. **Better User Experience**: Ensures app works for screen reader users
2. **Semantic HTML**: Encourages proper accessibility attributes
3. **Maintainable Tests**: More resilient to UI changes
4. **Real User Behavior**: Tests match how users actually interact
5. **Compliance**: Helps meet WCAG 2.1 AA requirements

For detailed examples and migration patterns, see the [Accessibility Audit Report](../../accessibility-audit-report.md).

## Sociable Testing Principles

Cloud Gallery follows sociable testing patterns to reduce mock maintenance and improve test reliability.

### Key Principles
- **Mock only boundaries**: External APIs, databases, filesystem, time
- **Use real implementations**: Internal services, utilities, business logic
- **Focus on outcomes**: Test what the code does, not how it does it
- **Behavior-focused assertions**: Verify results, not implementation details

### When to Mock
✅ **Always Mock**:
- External APIs (fetch, HTTP clients)
- Database servers (use in-memory for tests)
- File system operations
- Time/date functions
- Platform APIs (React Native, native modules)
- Third-party SDKs (AWS, Sentry)

❌ **Never Mock**:
- Internal business logic
- Security utilities (hashing, validation)
- Domain objects and schemas
- Internal utilities and helpers
- State management

### Example Pattern
```typescript
// ✅ Sociable approach - real database, external mocks only
it("should create user successfully", async () => {
  const db = await setupTestDatabase();
  const userData = createTestUser();
  
  const result = await userService.create(db, userData);
  
  expect(result.email).toBe(userData.email);
  expect(result.passwordHash).toMatch(/^\$argon2id/); // Real behavior
});

// ❌ Solitary approach - over-mocked
vi.mock("../db", () => ({ db: mockDb }));
vi.mock("../security", () => ({ hashPassword: vi.fn() }));
```

For detailed examples and guidelines, see [Sociable Testing Examples](./31_SOCIABLE_TESTING_EXAMPLES.md).

## User Event Testing vs FireEvent

Cloud Gallery prefers userEvent over fireEvent for more realistic user interaction simulation.

### Key Differences

**fireEvent**:
- Dispatches single DOM events
- Low-level wrapper around dispatchEvent API
- Tests implementation details rather than behavior
- Less realistic user simulation

**userEvent**:
- Simulates full user interactions
- Fires multiple events (pressIn, pressOut, keyDown, keyUp, etc.)
- Includes visibility and interactability checks
- More realistic user behavior simulation
- Better test reliability and maintainability

### React Native Testing Library UserEvent API

React Native Testing Library includes built-in userEvent support:

```typescript
import { render, screen, userEvent } from "@testing-library/react-native";

// Setup userEvent instance
const user = userEvent.setup();

// Press interactions (130ms minimum duration)
await user.press(element);
await user.longPress(element, { duration: 500 });
```

### Migration Patterns

#### Before (fireEvent approach)
```typescript
it('should submit form', async () => {
  render(<MyComponent />);
  
  const button = screen.getByText('Submit');
  fireEvent.press(button);
  
  expect(mockSubmit).toHaveBeenCalled();
});
```

#### After (userEvent approach)
```typescript
it('should submit form', async () => {
  const user = userEvent.setup();
  render(<MyComponent />);
  
  const button = screen.getByText('Submit');
  await user.press(button);
  
  expect(mockSubmit).toHaveBeenCalled();
});
```

### Special Cases Requiring fireEvent

Some React Native interactions still require fireEvent:

```typescript
// TextInput value changes
fireEvent.changeText(textInput, 'new value');

// Switch value changes  
fireEvent(switch, 'valueChange', true);

// Pull-to-refresh
fireEvent(scrollView, 'refresh');

// Custom events
fireEvent(customElement, 'customEvent', eventData);
```

### Performance Considerations

- userEvent.press() takes minimum 130ms due to React Native logic
- userEvent.longPress() takes minimum 500ms (configurable)
- Use fake timers for faster test execution with press/longPress
- fireEvent is faster but less realistic

### Best Practices

1. **Prefer userEvent** for all standard interactions (press, longPress)
2. **Use fireEvent** only for React Native-specific events without userEvent equivalent
3. **Always await** userEvent actions (they return Promise)
4. **Setup userEvent** in each test, not in before/after hooks
5. **Add comments** justifying fireEvent usage for special cases
6. **Use fake timers** for performance-critical tests with press/longPress

### Example: Complete Test Migration

```typescript
// Before
it('should edit user profile', async () => {
  render(<UserProfile />);
  
  const editButton = screen.getByText('Edit');
  fireEvent.press(editButton);
  
  const nameInput = screen.getByDisplayValue('John');
  fireEvent.changeText(nameInput, 'Jane');
  
  const saveButton = screen.getByText('Save');
  fireEvent.press(saveButton);
  
  expect(mockUpdate).toHaveBeenCalledWith({ name: 'Jane' });
});

// After
it('should edit user profile', async () => {
  const user = userEvent.setup();
  render(<UserProfile />);
  
  const editButton = screen.getByText('Edit');
  await user.press(editButton);
  
  const nameInput = screen.getByDisplayValue('John');
  // fireEvent for TextInput - userEvent doesn't have type method
  fireEvent.changeText(nameInput, 'Jane');
  
  const saveButton = screen.getByText('Save');
  await user.press(saveButton);
  
  expect(mockUpdate).toHaveBeenCalledWith({ name: 'Jane' });
});
```

## Resources

- **Vitest Docs**: https://vitest.dev/
- **Testing Library**: https://testing-library.com/
- **Jest Mock Functions**: https://jestjs.io/docs/mock-functions
- **Sociable Testing Guide**: [Sociable Testing Examples](./31_SOCIABLE_TESTING_EXAMPLES.md)

## Next Steps

- Review [coverage requirements](./20_COVERAGE.md)
- Check [exceptions list](./99_EXCEPTIONS.md)
- Study [sociable testing examples](./31_SOCIABLE_TESTING_EXAMPLES.md)
- Review existing tests for patterns
