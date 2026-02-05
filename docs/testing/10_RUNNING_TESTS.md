# Running Tests

Complete guide to running tests in the Cloud Gallery project.

## Prerequisites

1. **Node.js**: Version 18 or higher
2. **npm**: Comes with Node.js
3. **Dependencies installed**: Run `npm install`

## Quick Reference

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with interactive UI
npm run test:ui
```

## Running Tests

### Run All Tests

```bash
npm test
```

This command:
- Runs all test files (`**/*.test.ts`, `**/*.spec.ts`)
- Exits after completion
- Shows test results in console
- Best for: CI/CD, pre-commit checks

**Example output:**
```
 ✓ client/lib/storage.test.ts (52 tests) 37ms
 ✓ client/lib/query-client.test.ts (28 tests) 21ms
 ✓ server/storage.test.ts (17 tests) 8ms

 Test Files  6 passed (6)
      Tests  161 passed (161)
   Duration  4.35s
```

### Watch Mode

```bash
npm run test:watch
```

This command:
- Runs tests on startup
- Watches files for changes
- Re-runs affected tests automatically
- Stays running until you exit (Ctrl+C)
- Best for: Active development

**Features:**
- Only re-runs tests affected by your changes
- Press `a` to run all tests
- Press `f` to run only failed tests
- Press `q` to quit

### Coverage Report

```bash
npm run test:coverage
```

This command:
- Runs all tests once
- Generates coverage report
- Displays summary in console
- Creates HTML report at `coverage/index.html`
- **Fails if coverage < 100%** (enforced threshold)
- Best for: Validating coverage before commits

**Example output:**
```
 % Coverage report from v8
------------------|---------|----------|---------|---------|---
File              | % Stmts | % Branch | % Funcs | % Lines |
------------------|---------|----------|---------|---------|---
All files         |     100 |      100 |     100 |     100 |
 client/lib       |     100 |      100 |     100 |     100 |
  query-client.ts |     100 |      100 |     100 |     100 |
  storage.ts      |     100 |      100 |     100 |     100 |
 server           |     100 |      100 |     100 |     100 |
  routes.ts       |     100 |      100 |     100 |     100 |
  storage.ts      |     100 |      100 |     100 |     100 |
 shared           |     100 |      100 |     100 |     100 |
  schema.ts       |     100 |      100 |     100 |     100 |
------------------|---------|----------|---------|---------|---
```

**View HTML Report:**
```bash
# Open in browser
open coverage/index.html  # macOS
xdg-open coverage/index.html  # Linux
start coverage/index.html  # Windows
```

### Interactive UI

```bash
npm run test:ui
```

This command:
- Opens Vitest UI in your browser
- Shows test hierarchy and results
- Allows filtering and searching tests
- Displays coverage visualization
- Best for: Debugging, exploring test suites

## Running Specific Tests

### Run a Single Test File

```bash
npm test client/lib/storage.test.ts
```

### Run Tests Matching Pattern

```bash
npm test storage
```

Runs all test files with "storage" in the name.

### Run a Single Test Suite

Edit the test file and add `.only`:

```typescript
describe.only("MyComponent", () => {
  // Only this suite will run
});
```

### Run a Single Test

Edit the test file and add `.only`:

```typescript
it.only("should do something", () => {
  // Only this test will run
});
```

⚠️ **Remember to remove `.only` before committing!**

## Focused Test Guardrails

To prevent accidentally committing focused or skipped tests, run:

```bash
npm run test:check-focused
```

This command fails if it finds any of the following patterns in the codebase:
- `.only`
- `describe.skip`
- `it.skip`
- `test.skip`

The CI configuration also enforces this by disallowing focused tests in Vitest.

### Skip a Test Temporarily

```typescript
it.skip("should do something", () => {
  // This test will be skipped
});
```

Or:

```typescript
describe.skip("MyComponent", () => {
  // All tests in this suite will be skipped
});
```

## Debugging Tests

### VS Code Debugging

1. Set breakpoints in your test file
2. Open Command Palette (Cmd+Shift+P / Ctrl+Shift+P)
3. Select "JavaScript Debug Terminal"
4. Run: `npm test`

### Console Debugging

Add `console.log` statements:

```typescript
it("should do something", () => {
  const result = myFunction();
  console.log("Result:", result);
  expect(result).toBe(expected);
});
```

### Vitest UI Debugging

```bash
npm run test:ui
```

Then click on individual tests to see:
- Test code
- Console logs
- Error stack traces
- Execution time

## Troubleshooting

### Tests Failing After Fresh Clone

**Problem**: Tests fail with "module not found" errors

**Solution**:
```bash
npm install
npm test
```

### Coverage Fails But Tests Pass

**Problem**: Coverage is below 100% threshold

**Solution**:
1. Run `npm run test:coverage`
2. Look for uncovered lines in the report
3. Add tests to cover missing lines/branches
4. See [20_COVERAGE.md](./20_COVERAGE.md) for guidance

### Tests Hang or Timeout

**Problem**: Tests don't complete

**Solution**:
1. Check for unresolved promises
2. Ensure all async operations have `await`
3. Check for infinite loops
4. Press Ctrl+C to stop and review test code

### Mock Not Working

**Problem**: Mock functions not being called

**Solution**:
```typescript
// Clear mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});

// Verify mock was called
expect(myMock).toHaveBeenCalled();
expect(myMock).toHaveBeenCalledWith(expectedArgs);
```

### Platform-Specific Issues

**Problem**: React Native mocks not working

**Solution**: Check `vitest.setup.ts` for proper mocks:
```typescript
// Already configured:
- react-native (Platform, StyleSheet, etc.)
- @react-native-async-storage/async-storage
- expo-constants
- expo-haptics
- expo-image
- @react-navigation/native
```

### Cache Issues

**Problem**: Tests show stale results

**Solution**:
```bash
# Clear Vitest cache
rm -rf node_modules/.vitest
npm test
```

## Performance Tips

### Faster Test Runs

1. **Run affected tests only** (watch mode does this automatically)
2. **Use `.only` during development** (remember to remove!)
3. **Parallelize on CI** (Vitest does this by default)

### Faster Coverage

Coverage collection adds overhead. During active development:
```bash
# Use watch mode without coverage
npm run test:watch

# Only run coverage before commits
npm run test:coverage
```

## CI/CD Integration

### Local Pre-commit

Add to `.git/hooks/pre-commit`:
```bash
#!/bin/sh
npm run test:coverage
```

Make executable:
```bash
chmod +x .git/hooks/pre-commit
```

### GitHub Actions (Example)

```yaml
- name: Run tests with coverage
  run: npm run test:coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
```

## Test Output Formats

### Console (default)
- Human-readable test results
- Color-coded pass/fail
- Execution times

### Coverage Reports
- **HTML**: Interactive browsable report at `coverage/index.html`
- **LCOV**: `coverage/lcov.info` (for CI tools)
- **JSON**: `coverage/coverage-final.json` (for programmatic access)
- **Text**: Console summary

## Environment Variables

Tests run with these defaults:
- `NODE_ENV`: "test"
- Mocks for all React Native and Expo modules

To override:
```bash
EXPO_PUBLIC_DOMAIN=test.example.com npm test
```

## Next Steps

- Learn about [coverage requirements](./20_COVERAGE.md)
- Study [test patterns](./30_TEST_PATTERNS.md)
- Review [coverage exceptions](./99_EXCEPTIONS.md)
