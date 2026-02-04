# Testing Documentation Index

This directory contains comprehensive documentation for the Cloud Gallery testing system.

## 📚 Documentation Structure

### Core Documentation

- **[00_INDEX.md](./00_INDEX.md)** - This file - navigation hub
- **[10_RUNNING_TESTS.md](./10_RUNNING_TESTS.md)** - How to run tests locally
- **[20_COVERAGE.md](./20_COVERAGE.md)** - Coverage requirements and reporting
- **[30_TEST_PATTERNS.md](./30_TEST_PATTERNS.md)** - Testing patterns and best practices
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

- **Total Tests**: 161 tests across 6 test files
- **Coverage**: 100% line + branch coverage for first-party, non-generated code
- **Test Files**:
  - `client/lib/storage.test.ts` - 52 tests
  - `client/lib/query-client.test.ts` - 28 tests
  - `server/index.test.ts` - 39 tests
  - `server/storage.test.ts` - 17 tests
  - `server/routes.test.ts` - 5 tests
  - `shared/schema.test.ts` - 20 tests

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
4. Check [99_EXCEPTIONS.md](./99_EXCEPTIONS.md) for coverage exceptions

## 🤝 Contributing

When adding new code:
1. Write tests for all new logic
2. Run `npm run test:coverage` to verify 100% coverage
3. Update documentation if adding new patterns
4. All PRs must maintain 100% coverage

## 📞 Support

For questions about testing:
1. Check this documentation first
2. Review existing tests for examples
3. Ask in team chat or create an issue
