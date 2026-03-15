# Testing Documentation Index

This directory contains comprehensive documentation for the Cloud Gallery testing system.

## 📚 Documentation Structure

### Core Documentation

- **[00_INDEX.md](./00_INDEX.md)** - This file - navigation hub
- **[10_RUNNING_TESTS.md](./10_RUNNING_TESTS.md)** - How to run tests locally
- **[20_COVERAGE.md](./20_COVERAGE.md)** - Coverage requirements and reporting
- **[30_TEST_PATTERNS.md](./30_TEST_PATTERNS.md)** - Testing patterns and best practices
- **[40_TEST_FACTORIES.md](./40_TEST_FACTORIES.md)** - Test factories and performance testing
- **[99_EXCEPTIONS.md](./99_EXCEPTIONS.md)** - Coverage exceptions and justifications

## 🎯 Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with UI
npm run test:ui
```

## 📊 Current Status

- **Total Tests**: ~730 tests across 61 test files (run `npm test` for current count)
- **Coverage**: Target 100% for first-party, non-generated code (see [20_COVERAGE.md](./20_COVERAGE.md)); run `npm run test:coverage` to verify
- **Test Files**: Located under `client/`, `server/`, and `shared/` with `.test.ts` / `.test.tsx` suffix. Key suites include:
  - `client/lib/storage.test.ts`, `client/lib/query-client.test.ts`, `client/lib/storage.performance.test.ts`
  - `server/index.test.ts`, `server/routes.test.ts`, `server/middleware.test.ts`, `server/security.test.ts`, `server/storage.test.ts`
  - `server/*-routes.test.ts` (sharing, memory, smart-album, auth, etc.)
  - `server/services/*.test.ts` (partner-sharing, backup, memories, sync, smart-albums, etc.)
  - `shared/schema.test.ts`
- **Focused/skipped guard**: Run `npm run test:check-focused` before commit to block `.only` and `.skip` in test files (see [10_RUNNING_TESTS.md](./10_RUNNING_TESTS.md)).

## 🏗️ Testing Architecture

### Test Layers

1. **Unit Tests** (highest volume)
   - Pure logic functions
   - Data validation
   - Storage operations
   - API client logic

2. **Integration Tests** (critical seams)
   - Server middleware integration
   - Database/storage integration
   - Schema validation

3. **E2E / UI Tests** (documented exceptions)
   - React Native components excluded (primarily JSX/styling)
   - Screens and navigation excluded (UI scaffolding)
   - See [99_EXCEPTIONS.md](./99_EXCEPTIONS.md) for details

### Coverage Philosophy

This project maintains **100% coverage for all first-party, non-generated code** with minimal, justified exceptions. Coverage is enforced at:

- **Lines**: 100%
- **Branches**: 100%
- **Functions**: 100%
- **Statements**: 100%

## 🔍 What to Test

### ✅ Always Test

- **Core Business Logic**: Storage operations, data transformations
- **API Clients**: Network requests, error handling
- **Validation Logic**: Schema validation, input sanitization
- **Error Paths**: All error conditions and edge cases
- **Data Structures**: Type definitions with runtime behavior

### 🚫 Documented Exceptions

- **Platform Bootstrap**: Expo/React Native initialization code
- **UI Components**: React Native components (primarily JSX/styling)
- **Navigation Scaffolding**: React Navigation setup
- **Type Definitions**: Pure TypeScript interfaces
- **Platform-Specific Code**: OS-specific implementations

See [99_EXCEPTIONS.md](./99_EXCEPTIONS.md) for complete list and justifications.

## 🛠️ Tools & Framework

- **Test Runner**: [Vitest](https://vitest.dev/) - Fast, modern test runner with Vite integration
- **Coverage**: V8 - Built-in code coverage
- **Environment**: Happy DOM - Lightweight DOM implementation
- **Assertions**: Vitest built-in assertions
- **Mocking**: Vitest mocking utilities

## 📝 Test File Naming

- Test files use `.test.ts` or `.test.tsx` suffix
- Located alongside source files or in `__tests__` directories
- Example: `storage.ts` → `storage.test.ts`

## 🚀 CI/CD Integration

Coverage is enforced in:
- ✅ Local development (via npm scripts)
- ✅ Pre-commit validation (planned)
- ✅ CI pipeline (planned)

Coverage reports are generated in:
- **Text**: Console output
- **JSON**: `coverage/coverage-final.json`
- **HTML**: `coverage/index.html`
- **LCOV**: `coverage/lcov.info`

## 📚 Next Steps

1. Read [10_RUNNING_TESTS.md](./10_RUNNING_TESTS.md) to learn how to run tests
2. Review [20_COVERAGE.md](./20_COVERAGE.md) to understand coverage requirements
3. Study [30_TEST_PATTERNS.md](./30_TEST_PATTERNS.md) for testing best practices
4. Check [40_TEST_FACTORIES.md](./40_TEST_FACTORIES.md) for test data generation and performance testing
5. Review [99_EXCEPTIONS.md](./99_EXCEPTIONS.md) for coverage exceptions

## 🤝 Contributing

When adding new code:
1. Write tests for all new logic using [test factories](./40_TEST_FACTORIES.md)
2. Add edge case tests for boundary conditions
3. Consider performance tests for critical paths
4. Run `npm run test:coverage` to verify coverage
5. Update documentation if adding new patterns
6. All PRs must maintain high coverage standards

## 📞 Support

For questions about testing:
1. Check this documentation first
2. Review existing tests for examples
3. Ask in team chat or create an issue
