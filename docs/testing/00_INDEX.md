# Testing Documentation Index

This directory contains comprehensive documentation for the Cloud Gallery testing system.

## 📚 Documentation Structure

### Core Documentation

- **[00_INDEX.md](./00_INDEX.md)** - This file - navigation hub
- **[10_RUNNING_TESTS.md](./10_RUNNING_TESTS.md)** - How to run tests locally
- **[20_COVERAGE.md](./20_COVERAGE.md)** - Coverage requirements and reporting
- **[30_TEST_PATTERNS.md](./30_TEST_PATTERNS.md)** - Testing patterns and best practices
- **[40_TEST_FACTORIES.md](./40_TEST_FACTORIES.md)** - Test factories and performance testing
- **[50_ACCESSIBILITY_TESTING.md](./50_ACCESSIBILITY_TESTING.md)** - WCAG 2.1 AA accessibility testing
- **[60_CONTRACT_TESTING.md](./60_CONTRACT_TESTING.md)** - API contract testing with Pact
- **[60_VISUAL_TESTING.md](./60_VISUAL_TESTING.md)** - Visual regression testing with Chromatic
- **[70_TEST_METRICS_MONITORING.md](./70_TEST_METRICS_MONITORING.md)** - Test metrics and monitoring system
- **[80_ONBOARDING_GUIDE.md](./80_ONBOARDING_GUIDE.md)** - Developer testing onboarding guide
- **[90_WORKSHOP_MATERIALS.md](./90_WORKSHOP_MATERIALS.md)** - Testing best practices workshop
- **[99_EXCEPTIONS.md](./99_EXCEPTIONS.md)** - Coverage exceptions and justifications

### Advanced Testing Patterns

- **[31_SOCIABLE_TESTING_EXAMPLES.md](./31_SOCIABLE_TESTING_EXAMPLES.md)** - Sociable testing patterns and examples
- **[32_ELIMINATING_INTERACTION_ASSERTIONS.md](./32_ELIMINATING_INTERACTION_ASSERTIONS.md)** - Moving beyond interaction testing

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

# Run accessibility tests
npm run test:accessibility

# Run performance tests
npm run test:performance:ci

# Run visual regression tests
npm run test:visual

# Run contract tests
npm run test:contracts

# Run security tests
npm run test:security

# Run compliance tests
npm run test:compliance

# Extract test metrics
npm run test:metrics

# Detect flaky tests
npm run test:flaky-detect

# Update metrics dashboard
npm run test:update-dashboard

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

### Core Testing Stack
- **Test Runner**: [Vitest](https://vitest.dev/) - Fast, modern test runner with Vite integration
- **Coverage**: V8 - Built-in code coverage
- **Environment**: Happy DOM - Lightweight DOM implementation
- **Assertions**: Vitest built-in assertions
- **Mocking**: Vitest mocking utilities

### Advanced Testing Tools
- **Contract Testing**: [Pact](https://pact.io/) - Consumer-driven contract testing
- **Visual Testing**: [Chromatic](https://www.chromatic.com/) - Visual regression testing
- **Accessibility Testing**: [vitest-axe](https://github.com/nickcolley/jest-axe) - WCAG 2.1 AA compliance
- **Performance Testing**: Vitest Benchmark - Performance regression detection
- **Security Testing**: Custom security test suites
- **E2E Testing**: [Detox](https://github.com/wix/Detox) - React Native end-to-end testing

### Metrics & Monitoring
- **Test Metrics**: Custom metrics collection and analysis
- **Flaky Test Detection**: Multi-algorithm flaky test identification
- **Trend Analysis**: Historical performance and quality trends
- **Interactive Dashboard**: Real-time metrics visualization

### Test Data Management
- **Test Factories**: Custom data generation utilities
- **Property Testing**: [fast-check](https://github.com/dubzzz/fast-check) - Property-based testing
- **Database Testing**: In-memory test database infrastructure

## 📝 Test File Naming

- Test files use `.test.ts` or `.test.tsx` suffix
- Located alongside source files or in `__tests__` directories
- Example: `storage.ts` → `storage.test.ts`

## 🚀 CI/CD Integration

### Comprehensive Testing Pipeline
Coverage and quality are enforced in:
- ✅ Local development (via npm scripts)
- ✅ Pre-commit validation (focused/skipped test checks)
- ✅ CI pipeline (GitHub Actions workflows)
- ✅ Pull request validation (automated comments and reports)

### CI/CD Workflows
- **test-coverage.yml** - Main testing pipeline with all test types
- **test-metrics.yml** - Dedicated metrics collection and monitoring
- **visual-testing.yml** - Visual regression testing with Chromatic
- **e2e-tests.yml** - End-to-end testing on iOS and Android
- **security-scan.yml** - Security testing and compliance validation
- **contract-testing.yml** - API contract testing and verification

### Automated Reporting
Coverage reports are generated in:
- **Text**: Console output
- **JSON**: `coverage/coverage-final.json`
- **HTML**: `coverage/index.html`
- **LCOV**: `coverage/lcov.info`

### Quality Gates
- **100% Coverage Required**: For all first-party, non-generated code
- **Zero Focused/Skipped Tests**: Blocked by pre-commit hooks
- **Performance Regressions**: Automatically detected and reported
- **Flaky Test Detection**: Identified and tracked
- **Security Compliance**: HIPAA and GDPR validation
- **Accessibility Compliance**: WCAG 2.1 AA standards

## 📚 Next Steps

### For New Developers
1. Read [80_ONBOARDING_GUIDE.md](./80_ONBOARDING_GUIDE.md) for structured onboarding
2. Follow the 90-day testing onboarding program
3. Attend testing best practices workshop [90_WORKSHOP_MATERIALS.md](./90_WORKSHOP_MATERIALS.md)

### For Testing Fundamentals
1. Read [10_RUNNING_TESTS.md](./10_RUNNING_TESTS.md) to learn how to run tests
2. Review [20_COVERAGE.md](./20_COVERAGE.md) to understand coverage requirements
3. Study [30_TEST_PATTERNS.md](./30_TEST_PATTERNS.md) for testing best practices
4. Check [40_TEST_FACTORIES.md](./40_TEST_FACTORIES.md) for test data generation and performance testing
5. Review [99_EXCEPTIONS.md](./99_EXCEPTIONS.md) for coverage exceptions

### For Advanced Testing
1. Learn [31_SOCIABLE_TESTING_EXAMPLES.md](./31_SOCIABLE_TESTING_EXAMPLES.md) for modern testing patterns
2. Master [32_ELIMINATING_INTERACTION_ASSERTIONS.md](./32_ELIMINATING_INTERACTION_ASSERTIONS.md) for behavior-focused testing
3. Implement [50_ACCESSIBILITY_TESTING.md](./50_ACCESSIBILITY_TESTING.md) for WCAG compliance
4. Set up [60_CONTRACT_TESTING.md](./60_CONTRACT_TESTING.md) for API contracts
5. Use [60_VISUAL_TESTING.md](./60_VISUAL_TESTING.md) for visual regression testing
6. Monitor [70_TEST_METRICS_MONITORING.md](./70_TEST_METRICS_MONITORING.md) for test quality

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
