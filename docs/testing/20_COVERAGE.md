# Coverage Requirements

Complete guide to code coverage requirements, measurement, and enforcement in Cloud Gallery.

## Coverage Target

**100% coverage** for all first-party, non-generated code across:

- ✅ **Lines**: 100%
- ✅ **Branches**: 100%
- ✅ **Functions**: 100%
- ✅ **Statements**: 100%

## What "100%" Means

### Line Coverage
Every executable line of code must be executed by at least one test.

```typescript
// ✅ 100% line coverage
function add(a: number, b: number): number {
  return a + b;  // This line must be executed
}

// Test:
expect(add(1, 2)).toBe(3);  // ✅ Executes the return line
```

### Branch Coverage
Every conditional path must be tested (both true and false branches).

```typescript
// ❌ 50% branch coverage
function isPositive(n: number): boolean {
  if (n > 0) {
    return true;  // ✅ Tested
  }
  return false;  // ❌ Not tested
}

// Test (incomplete):
expect(isPositive(5)).toBe(true);  // Only tests one branch

// ✅ 100% branch coverage
// Tests (complete):
expect(isPositive(5)).toBe(true);   // ✅ Tests n > 0
expect(isPositive(-5)).toBe(false); // ✅ Tests n <= 0
```

### Function Coverage
Every function must be called at least once.

```typescript
// ✅ 100% function coverage
export function helper1() { }
export function helper2() { }

// Tests must call both:
helper1();  // ✅
helper2();  // ✅
```

### Statement Coverage
Similar to line coverage but counts statements, not lines.

```typescript
// One line, three statements
const a = 1, b = 2, c = 3;  // Must execute to cover all three
```

## How Coverage is Computed

### Tool: V8 Coverage

We use V8's built-in code coverage (via Vitest):
- **Native**: No instrumentation overhead
- **Accurate**: Tracks actual execution
- **Fast**: Built into V8 engine

### Excluded Files

The following are **automatically excluded** from coverage:

#### Bootstrap Files
```
client/index.js          # Expo registration
client/App.tsx           # React Native root component
server/index.ts          # Express server bootstrap
```

**Why**: Platform initialization code that can't be unit tested effectively.

#### UI Components
```
client/components/**     # React Native components
client/screens/**        # Screen components
client/navigation/**     # Navigation configuration
```

**Why**: Primarily JSX/styling with minimal logic. UI testing requires E2E framework.

#### Type Definitions
```
client/types/**          # TypeScript interfaces
```

**Why**: No runtime code to execute.

#### Constants
```
client/constants/**      # Theme colors, static data
```

**Why**: Static data with no executable logic.

#### Platform-Specific Code
```
client/hooks/**          # React hooks with platform dependencies
```

**Why**: Tightly coupled to React Native runtime, requires full platform mocks.

See [99_EXCEPTIONS.md](./99_EXCEPTIONS.md) for complete list and justifications.

### Included Files

These **must have 100% coverage**:

```
client/lib/storage.ts      # ✅ AsyncStorage operations
client/lib/query-client.ts # ✅ API client
server/routes.ts           # ✅ Route registration
server/storage.ts          # ✅ In-memory storage
shared/schema.ts           # ✅ Data validation
```

## Checking Coverage

### Local Development

```bash
# Run tests with coverage
npm run test:coverage
```

Output shows coverage by file:
```
File              | % Stmts | % Branch | % Funcs | % Lines |
------------------|---------|----------|---------|---------|
query-client.ts   |     100 |      100 |     100 |     100 |
storage.ts        |     100 |      100 |     100 |     100 |
routes.ts         |     100 |      100 |     100 |     100 |
```

### HTML Report

Open detailed interactive report:
```bash
npm run test:coverage
open coverage/index.html
```

Features:
- **File browser**: Navigate through source files
- **Line highlighting**: Green (covered) / Red (uncovered)
- **Branch indicators**: Shows which branches are covered
- **Filter options**: View only uncovered code

### CI/CD

Coverage is enforced in CI:
```yaml
# GitHub Actions example
- name: Test with coverage
  run: npm run test:coverage

# This command FAILS if coverage < 100%
```

## Adding Tests for New Code

### Step 1: Write the Code

```typescript
// client/lib/calculator.ts
export function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error("Division by zero");
  }
  return a / b;
}
```

### Step 2: Create Test File

```typescript
// client/lib/calculator.test.ts
import { describe, it, expect } from "vitest";
import { divide } from "./calculator";

describe("divide", () => {
  it("should divide two numbers", () => {
    expect(divide(6, 2)).toBe(3);
  });

  it("should throw error for division by zero", () => {
    expect(() => divide(6, 0)).toThrow("Division by zero");
  });
});
```

### Step 3: Verify Coverage

```bash
npm run test:coverage
```

Should show:
```
calculator.ts | 100 | 100 | 100 | 100 |
```

### Step 4: Check for Missed Branches

If coverage < 100%, check HTML report:
```bash
open coverage/index.html
```

Look for:
- 🔴 **Red lines**: Not executed
- 🟡 **Yellow lines**: Partially covered (some branches missed)
- 🟢 **Green lines**: Fully covered

## Common Coverage Patterns

### Error Paths

Always test error conditions:

```typescript
// ❌ Missing error path
export async function fetchUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  return response.json();  // What if fetch fails?
}

// ✅ Complete coverage
export async function fetchUser(id: string) {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch user: ${response.status}`);
  }
  return response.json();
}

// Test both paths:
it("should fetch user successfully", async () => {
  // Test happy path
});

it("should throw on fetch error", async () => {
  // Test error path
});
```

### All Branches

Test all conditional branches:

```typescript
// ❌ Missing branches
function getStatus(value: number) {
  if (value > 100) return "high";
  if (value > 50) return "medium";
  return "low";
}

// ✅ Test all three branches:
expect(getStatus(150)).toBe("high");     // > 100
expect(getStatus(75)).toBe("medium");    // > 50
expect(getStatus(25)).toBe("low");       // <= 50
```

### Edge Cases

Cover boundary conditions:

```typescript
function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// ✅ Test boundaries:
expect(clamp(5, 0, 10)).toBe(5);    // Within range
expect(clamp(-5, 0, 10)).toBe(0);   // Below min
expect(clamp(15, 0, 10)).toBe(10);  // Above max
expect(clamp(0, 0, 10)).toBe(0);    // Exactly min
expect(clamp(10, 0, 10)).toBe(10);  // Exactly max
```

### Async Operations

Test all promise paths:

```typescript
async function loadData() {
  try {
    const data = await fetch("/api/data");
    return data.json();
  } catch (error) {
    return null;
  }
}

// ✅ Test both success and failure:
it("should load data successfully", async () => {
  // Mock successful fetch
});

it("should return null on error", async () => {
  // Mock failed fetch
});
```

## Fixing Coverage Gaps

### 1. Identify Gaps

```bash
npm run test:coverage
# Look for files with < 100%
```

### 2. View Details

```bash
open coverage/index.html
# Click on file with < 100%
# Red/yellow lines show gaps
```

### 3. Add Missing Tests

Focus on:
- 🔴 Red lines: Add tests that execute these lines
- 🟡 Yellow lines: Add tests for uncovered branches

### 4. Verify

```bash
npm run test:coverage
# Confirm 100% for the file
```

## Coverage Gates

### Local Enforcement

Coverage thresholds are configured in `vitest.config.ts`:

```typescript
coverage: {
  thresholds: {
    lines: 100,
    functions: 100,
    branches: 100,
    statements: 100,
  },
}
```

Running `npm run test:coverage` **will fail** if any threshold is not met.

### Pre-commit Hook

Recommended pre-commit hook:

```bash
#!/bin/sh
echo "Running tests with coverage..."
npm run test:coverage
```

Install:
```bash
cp scripts/pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### CI/CD Gates

Coverage must pass before merge:
- ✅ All tests pass
- ✅ Coverage ≥ 100%
- ❌ PR blocked if either fails

## Reporting

### Formats Generated

1. **Console**: Human-readable summary
2. **HTML**: Interactive report (`coverage/index.html`)
3. **LCOV**: Standard format (`coverage/lcov.info`)
4. **JSON**: Machine-readable (`coverage/coverage-final.json`)

### Integration with Tools

- **VS Code**: Use Coverage Gutters extension with LCOV
- **GitHub**: Upload LCOV to Codecov/Coveralls
- **CI**: Parse JSON for programmatic checks

## Policy: No Merge if Coverage Drops

**Hard Rule**: PRs must maintain 100% coverage.

If your PR reduces coverage:
1. Add tests for new code
2. Add tests for modified code
3. Ensure all branches are covered
4. Run `npm run test:coverage` locally before pushing

**Exception Process**:
If code genuinely cannot be tested (rare):
1. Document in [99_EXCEPTIONS.md](./99_EXCEPTIONS.md)
2. Add to vitest.config.ts exclusions
3. Get approval from tech lead
4. Must include mitigation strategy

## Tools and Resources

- **Vitest**: https://vitest.dev/
- **V8 Coverage**: Built into Node.js/Chrome
- **Coverage Config**: `vitest.config.ts`
- **Test Setup**: `vitest.setup.ts`

## Next Steps

- Review [test patterns](./30_TEST_PATTERNS.md) for testing strategies
- Check [coverage exceptions](./99_EXCEPTIONS.md) for excluded code
- Read [running tests](./10_RUNNING_TESTS.md) for commands
