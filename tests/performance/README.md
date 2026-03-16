# Performance Testing Directory

This directory contains performance benchmarks and regression tests for Cloud Gallery.

## Structure

```
tests/performance/
├── README.md                    # This file
├── utils/                       # Performance testing utilities
│   ├── benchmark-helpers.ts     # Common benchmark utilities
│   ├── data-generators.ts       # Performance test data generators
│   └── thresholds.ts            # Performance threshold definitions
├── server/                      # Server-side performance tests
│   ├── search-performance.test.ts
│   ├── photo-processing.test.ts
│   └── data-operations.test.ts
├── client/                      # Client-side performance tests
│   ├── storage-performance.test.ts
│   ├── ui-rendering.test.ts
│   └── image-handling.test.ts
└── shared/                      # Shared performance tests
    ├── crypto-performance.test.ts
    └── validation-performance.test.ts
```

## Running Performance Tests

```bash
# Run all performance tests
npm run test:performance

# Run specific performance test
npm run test:performance -- tests/performance/server/search-performance.test.ts

# Run benchmarks with Vitest
vitest bench

# Run with CodSpeed integration
vitest bench --reporter=verbose
```

## Performance Thresholds

See `utils/thresholds.ts` for defined performance thresholds and regression detection limits.

## CI/CD Integration

Performance tests run automatically in CI/CD with regression detection. See `.github/workflows/test-coverage.yml` for integration details.
