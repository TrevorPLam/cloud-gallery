# Test Factories and Performance Testing

Guide to using test factories and performance testing in Cloud Gallery.

## Test Factories

Test factories provide reusable, consistent test data generation for better test maintainability.

### Location

All test factories are located in `tests/factories.ts`.

### Available Factories

#### Basic Factories

```typescript
import { 
  createTestPhoto, 
  createTestAlbum, 
  createTestUserProfile 
} from "../tests/factories";

// Create single test items
const photo = createTestPhoto();
const album = createTestAlbum();
const user = createTestUserProfile();
```

#### Bulk Data Generation

```typescript
import { 
  createTestPhotos, 
  createTestAlbums, 
  createTestData 
} from "../tests/factories";

// Create arrays of test data
const photos = createTestPhotos(10); // 10 photos
const albums = createTestAlbums(5);  // 5 albums

// Create related data with relationships
const { photos, albums } = createTestData(100, 10);
// 100 photos distributed across 10 albums
```

#### Custom Overrides

All factories accept override parameters:

```typescript
const customPhoto = createTestPhoto({
  width: 4000,
  height: 3000,
  isFavorite: true,
  albumIds: ["album1", "album2"],
});

const customAlbum = createTestAlbum({
  title: "Vacation Photos",
  photoIds: ["photo1", "photo2"],
});
```

### Edge Case Testing

#### Boundary Test Data

```typescript
import { boundaryTestData } from "../tests/factories";

// Test extreme photo dimensions
const extremePhotos = boundaryTestData.extremePhotos();
// Includes: 1x1, 10000x10000, zero dimensions

// Test edge case album titles
const edgeAlbums = boundaryTestData.extremeAlbums();
// Includes: empty, very long, Unicode, control characters

// Test edge case user profiles
const edgeUsers = boundaryTestData.extremeUsers();
// Includes: empty names, long usernames, special characters
```

#### Example Edge Case Tests

```typescript
describe("Photo Edge Cases", () => {
  it("should handle extreme dimensions", () => {
    const extremePhotos = boundaryTestData.extremePhotos();
    
    extremePhotos.forEach(photo => {
      expect(photo.width).toBeGreaterThanOrEqual(0);
      expect(photo.height).toBeGreaterThanOrEqual(0);
    });
  });

  it("should handle special characters in titles", () => {
    const edgeAlbums = boundaryTestData.extremeAlbums();
    
    edgeAlbums.forEach(album => {
      expect(album.title).toBeDefined();
      // Handles Unicode, empty strings, etc.
    });
  });
});
```

## Performance Testing

Performance tests ensure the application handles large datasets and high-frequency operations efficiently.

### Performance Test Files

- `client/lib/storage.performance.test.ts` - Storage performance benchmarks
- Performance tests use `.performance.test.ts` naming convention

### Performance Test Structure

#### Basic Performance Test

```typescript
describe("Storage Performance Tests", () => {
  it("should handle large photo sets efficiently", async () => {
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

#### Memory Usage Testing

```typescript
it("should not cause memory leaks with repeated operations", async () => {
  const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
  
  // Perform repeated operations
  for (let i = 0; i < 100; i++) {
    const testData = performanceTestData.largeDataset(100, 5);
    await getPhotos();
  }

  // Force garbage collection if available
  if (global.gc) global.gc();
  
  const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
  const memoryIncrease = finalMemory - initialMemory;

  // Memory increase should be reasonable
  expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Less than 10MB
});
```

#### Concurrent Operations Testing

```typescript
it("should handle concurrent operations gracefully", async () => {
  const concurrentOperations = Array.from({ length: 50 }, (_, i) =>
    addPhoto(createTestPhoto({ id: `concurrent_${i}` }))
  );

  await Promise.all(concurrentOperations);

  expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledTimes(50);
});
```

### Performance Data Generators

#### Large Dataset Generation

```typescript
import { performanceTestData } from "../tests/factories";

// Generate large datasets for testing
const largeDataset = performanceTestData.largeDataset(1000, 50);
// 1000 photos across 50 albums

// Generate stress test data
const stressData = performanceTestData.stressTestData(100);
// 100 iterations of test data
```

#### Stress Testing

```typescript
it("should maintain performance under memory pressure", async () => {
  // Create memory pressure with large objects
  const memoryPressureData = Array.from({ length: 1000 }, (_, i) => ({
    id: `memory_test_${i}`,
    uri: `photo_${i}.jpg`,
    width: 4000,
    height: 3000,
    metadata: {
      description: "A".repeat(1000), // Large description
      tags: Array.from({ length: 50 }, (_, j) => `tag_${j}`),
    },
  }));

  vi.mocked(AsyncStorage.getItem).mockResolvedValue(
    JSON.stringify(memoryPressureData)
  );

  const startTime = performance.now();
  const retrieved = await getPhotos();
  const retrieveTime = performance.now() - startTime;

  expect(retrieveTime).toBeLessThan(1000); // Should still be fast
  expect(retrieved).toHaveLength(1000);
});
```

### Performance Benchmarks

#### Common Performance Thresholds

- **Photo Operations**: < 1 second for 1000 photos
- **Album Operations**: < 200ms for large datasets
- **Photo Grouping**: < 100ms for 500 photos
- **Storage Info Calculation**: < 50ms
- **Memory Growth**: < 10MB for 100 repeated operations
- **Concurrent Operations**: < 10ms average per operation

#### Critical Path Performance

Focus on performance testing for:

1. **Data Loading**: Initial app startup and data retrieval
2. **Photo Operations**: Adding, deleting, modifying photos
3. **Album Management**: Creating and organizing albums
4. **Search and Filter**: Finding photos quickly
5. **Batch Operations**: Processing multiple items

### Running Performance Tests

```bash
# Run all tests including performance
npm test

# Run only performance tests
npm test -- client/lib/storage.performance.test.ts

# Run with coverage (includes performance tests)
npm run test:coverage
```

### Performance Test Best Practices

1. **Use Realistic Data**: Use factories to generate realistic test data
2. **Measure Consistently**: Use `performance.now()` for accurate timing
3. **Test Multiple Scales**: Test small, medium, and large datasets
4. **Monitor Memory**: Check for memory leaks in repeated operations
5. **Set Reasonable Thresholds**: Base thresholds on real device performance
6. **Isolate Tests**: Performance tests shouldn't affect other test results

### CI/CD Integration

Performance tests run in CI/CD pipelines to catch regressions:

```yaml
# GitHub Actions example
- name: Run performance tests
  run: npm test -- client/lib/storage.performance.test.ts
  
- name: Check performance thresholds
  run: |
    # Parse test results for performance metrics
    # Fail if thresholds are exceeded
```

## Best Practices

### Test Data Management

1. **Use Factories**: Always use test factories instead of hardcoded data
2. **Customize Overrides**: Use override parameters for specific test cases
3. **Edge Cases**: Use boundary test data for comprehensive testing
4. **Consistency**: Factories ensure consistent test data across tests

### Performance Testing

1. **Isolate Performance Tests**: Keep them in separate files
2. **Use Realistic Scenarios**: Test actual usage patterns
3. **Monitor Resources**: Track both time and memory usage
4. **Set Appropriate Thresholds**: Base on real device capabilities
5. **Document Expectations**: Include performance requirements in tests

### Maintenance

1. **Update Factories**: Keep factories in sync with data models
2. **Review Thresholds**: Adjust performance thresholds as needed
3. **Add New Factories**: Create factories for new data types
4. **Monitor Coverage**: Ensure performance tests cover critical paths
