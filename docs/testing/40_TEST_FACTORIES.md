# Performance Testing and Test Factories

Guide to performance testing, test factories, and benchmarking in Cloud Gallery.

## Performance Testing Overview

Performance testing ensures the application handles large datasets and high-frequency operations efficiently while detecting regressions over time.

### Performance Testing Infrastructure

Cloud Gallery uses Vitest's built-in benchmark functionality enhanced with the CodSpeed plugin for consistent CI/CD benchmarking.

#### Key Components

- **Vitest Bench**: Native benchmarking support in Vitest
- **CodSpeed Plugin**: CI/CD integration for consistent performance measurement
- **Performance Thresholds**: Defined limits for acceptable performance
- **Regression Detection**: Automated detection of performance regressions
- **Performance Reports**: Detailed analysis and trend tracking

## Performance Test Structure

### Directory Structure

```
tests/performance/
├── README.md                    # Performance testing overview
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

### Basic Performance Test

```typescript
import { bench, describe } from 'vitest';
import { PerformanceAssertions } from '../utils/benchmark-helpers';
import { serverThresholds } from '../utils/thresholds';

describe('Search Performance', () => {
  bench('search query performance', async () => {
    await PerformanceAssertions.assertTimeThreshold(
      () => searchService.search(query),
      serverThresholds.search.searchQuery.maxTime,
      'Search query should complete within threshold'
    );
  });
});
```

### Performance Assertions

The `PerformanceAssertions` class provides built-in assertion helpers:

```typescript
// Time threshold assertion
await PerformanceAssertions.assertTimeThreshold(
  operation,
  thresholdMs,
  'Operation should complete within threshold'
);

// Memory threshold assertion
await PerformanceAssertions.assertMemoryThreshold(
  operation,
  thresholdBytes,
  'Operation should not exceed memory threshold'
);

// Throughput assertion
await PerformanceAssertions.assertMinThroughput(
  items,
  operation,
  minOpsPerSecond,
  { batchSize: 100 }
);
```

## Performance Thresholds

### Server-Side Thresholds

```typescript
export const serverThresholds = {
  photoProcessing: {
    extractMetadata: { maxTime: 50 },      // 50ms per photo
    generateThumbnail: { maxTime: 200 },   // 200ms per photo
    processBatch: { maxTime: 1000, minThroughput: 10 },
  },
  search: {
    indexPhoto: { maxTime: 10 },           // 10ms per photo
    searchQuery: { maxTime: 100 },         // 100ms per query
    complexSearch: { maxTime: 500 },       // 500ms for complex queries
  },
  dataOperations: {
    databaseQuery: { maxTime: 50 },        // 50ms per query
    batchInsert: { maxTime: 500, minThroughput: 100 },
  },
} as const;
```

### Client-Side Thresholds

```typescript
export const clientThresholds = {
  storage: {
    savePhoto: { maxTime: 100 },          // 100ms per photo
    loadPhotos: { maxTime: 500, minThroughput: 100 },
    searchLocal: { maxTime: 200 },         // 200ms for local search
  },
  ui: {
    componentRender: { maxTime: 16 },      // 16ms for 60fps
    listRender: { maxTime: 50, minThroughput: 100 },
    imageLoad: { maxTime: 300 },          // 300ms for image loading
  },
} as const;
```

### Regression Detection

```typescript
export const regressionDetection = {
  timeRegressionThreshold: 0.15,        // 15% increase triggers alert
  memoryRegressionThreshold: 0.20,       // 20% increase triggers alert
  throughputRegressionThreshold: 0.10,   // 10% decrease triggers alert
  minSamples: 5,                         // Minimum samples for detection
  confidenceLevel: 0.95,                 // Statistical confidence
  maxVariance: 0.05,                     // 5% max variance
} as const;
```

## Running Performance Tests

### Local Development

```bash
# Run all performance tests
npm run test:performance

# Run specific performance test
npm run test:performance -- tests/performance/server/search-performance.test.ts

# Run benchmarks with verbose output
vitest bench --reporter=verbose

# Run with CodSpeed integration
vitest bench --reporter=verbose
```

### CI/CD Integration

Performance tests run automatically in CI/CD with regression detection:

```bash
# CI/CD performance test execution
npm run test:performance:ci

# Regression analysis
node scripts/check-performance-regressions.js
```

## Test Factories

Test factories provide reusable, consistent test data generation for better performance test maintainability.

### Basic Factories

```typescript
import { 
  generateTestPhotos, 
  generateTestAlbums,
  generateSearchQueries
} from "../tests/performance/utils/data-generators";

// Generate performance test data
const photos = generateTestPhotos(1000, {
  minSize: 1024 * 1024,      // 1MB minimum
  maxSize: 10 * 1024 * 1024, // 10MB maximum
  includeMetadata: true,
});

const queries = generateSearchQueries(50);
const albums = generateTestAlbums(100, 10); // 10 photos per album
```

### Performance Data Generators

```typescript
// Large dataset for stress testing
const largeDataset = generateTestPhotos(10000, {
  minSize: 5 * 1024 * 1024,   // 5MB photos
  maxSize: 20 * 1024 * 1024,  // 20MB photos
  includeMetadata: true,
});

// Stress test queries
const stressQueries = generateSearchQueries(100);
```

### Custom Data Generation

```typescript
// Generate data with specific characteristics
const customPhotos = generateTestPhotos(500, {
  minSize: 2 * 1024 * 1024,
  maxSize: 8 * 1024 * 1024,
  minDimensions: [2000, 1500],
  maxDimensions: [4000, 3000],
  includeMetadata: true,
});
```

## Performance Testing Patterns

### Batch Operation Testing

```typescript
describe('Batch Operations Performance', () => {
  bench('batch photo processing', async () => {
    const photos = generateTestPhotos(100);
    
    const { totalTime, avgTime, throughput } = await measureBatchPerformance(
      photos,
      (photo) => processingService.processPhoto(photo),
      { batchSize: 100, iterations: 1 }
    );
    
    console.log(`Batch processing: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(2)}ms avg, ${throughput.toFixed(2)} ops/sec`);
    
    // Assert performance requirements
    expect(avgTime).toBeLessThan(serverThresholds.photoProcessing.extractMetadata.maxTime);
    expect(throughput).toBeGreaterThan(serverThresholds.photoProcessing.processBatch.minThroughput);
  });
});
```

### Memory Usage Testing

```typescript
describe('Memory Usage Performance', () => {
  bench('memory usage during large operations', async () => {
    const photos = generateTestPhotos(1000, { 
      minSize: 5 * 1024 * 1024, 
      maxSize: 15 * 1024 * 1024 
    });
    
    const { memoryDelta } = await PerformanceAssertions.assertMemoryThreshold(
      () => processingService.processBatch(photos),
      200 * 1024 * 1024, // 200MB max
      'Batch processing should not exceed memory threshold'
    );
    
    console.log(`Memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
  });
});
```

### Scalability Testing

```typescript
describe('Scalability Performance', () => {
  bench('performance scaling with data size', async () => {
    const sizes = [100, 500, 1000, 2000];
    const results = [];
    
    for (const size of sizes) {
      const photos = generateTestPhotos(size);
      const { duration } = await measureTime(() => searchService.indexPhotos(photos));
      results.push({ size, duration: duration / size });
    }
    
    // Verify linear scaling (not exponential)
    const firstTime = results[0].duration;
    const lastTime = results[results.length - 1].duration;
    const scaleFactor = results[results.length - 1].size / results[0].size;
    const performanceFactor = lastTime / firstTime;
    
    if (performanceFactor > scaleFactor * 2) {
      throw new Error(`Performance scaling poorly: ${performanceFactor.toFixed(2)}x slower for ${scaleFactor}x more data`);
    }
  });
});
```

## CI/CD Integration

### GitHub Actions Workflow

Performance tests are integrated into the CI/CD pipeline:

```yaml
- name: Run performance tests
  run: npm run test:performance:ci

- name: Check performance compliance
  run: |
    if [ -f "coverage/performance-results.json" ]; then
      echo "✅ Performance tests completed"
      node scripts/check-performance-regressions.js
    else
      echo "⚠️ No performance results found"
    fi
```

### Regression Detection

The regression detection script:

1. **Loads baseline performance** from previous main branch runs
2. **Compares current results** against baseline
3. **Detects regressions** based on configured thresholds
4. **Updates baseline** on main branch if no regressions
5. **Fails build** if regressions are detected

### Performance Reports

Performance results are reported in PR comments:

```
## 📊 Test Results Report

### Performance Testing
| Metric | Result |
|--------|--------|
| Status | ✅ Passed |
| Score | 98% |
| Regressions | 0 |
```

## Performance Best Practices

### Test Design

1. **Use Realistic Data**: Generate realistic test data with factories
2. **Test Multiple Scales**: Small, medium, and large datasets
3. **Measure Consistently**: Use proper timing and measurement utilities
4. **Set Appropriate Thresholds**: Base on real device capabilities
5. **Isolate Tests**: Performance tests shouldn't affect other tests

### Benchmarking Guidelines

1. **Warm Up**: Allow for JIT compilation and caching
2. **Multiple Samples**: Run multiple iterations for statistical significance
3. **Control Environment**: Consistent testing environment
4. **Monitor Resources**: Track both time and memory usage
5. **Document Expectations**: Include performance requirements in tests

### Regression Prevention

1. **Establish Baselines**: Create performance baselines for critical paths
2. **Monitor Trends**: Track performance over time
3. **Set Alerts**: Configure appropriate regression thresholds
4. **Review Changes**: Analyze performance impact of code changes
5. **Optimize Proactively**: Address performance issues before they become problems

## Troubleshooting Performance Tests

### Common Issues

1. **Inconsistent Results**: Ensure proper warmup and multiple samples
2. **Memory Leaks**: Check for proper cleanup in tests
3. **CI/CD Variability**: Use CodSpeed for consistent measurements
4. **Threshold Too Strict**: Adjust thresholds based on realistic expectations
5. **Test Interference**: Ensure tests are properly isolated

### Debugging Performance Issues

```typescript
// Enable detailed performance logging
if (process.env.DEBUG_PERFORMANCE) {
  console.log('Performance debug:', {
    operation: 'search',
    dataSize: photos.length,
    duration: result.duration,
    memory: result.memoryDelta,
  });
}

// Profile specific operations
const { profile } = await measureTime(() => {
  return performance.profile(() => searchService.complexSearch(query));
});
```

## Performance Monitoring

### Metrics to Track

- **Response Time**: Time to complete operations
- **Throughput**: Operations per second
- **Memory Usage**: Memory consumption during operations
- **Scalability**: Performance with increasing data size
- **Regression Rate**: Frequency of performance regressions

### Performance Dashboards

Consider integrating with monitoring tools:

- **CodSpeed**: CI/CD performance tracking
- **GitHub Actions**: Performance reports in PRs
- **Custom Dashboards**: Performance trends over time
- **Alerting**: Automated notifications for regressions

## Maintenance

### Updating Performance Tests

1. **Review Thresholds**: Adjust as application evolves
2. **Add New Tests**: Cover new features and critical paths
3. **Update Factories**: Keep data generators current
4. **Monitor Coverage**: Ensure critical operations are tested
5. **Document Changes**: Update documentation with new patterns

### Performance Test Evolution

As the application grows:

1. **Expand Test Coverage**: Add tests for new functionality
2. **Refine Thresholds**: Adjust based on user expectations
3. **Improve Tooling**: Enhance testing infrastructure
4. **Analyze Trends**: Use historical data for planning
5. **Optimize Continuously**: Make performance a team priority
