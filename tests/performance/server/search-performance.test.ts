/**
 * Search performance benchmarks
 * Tests search indexing, query performance, and scalability
 */

import { bench, describe } from 'vitest';
import { 
  PerformanceAssertions, 
  PerformanceTestData,
  measureBatchPerformance,
  measureTime 
} from '../utils/benchmark-helpers';
import { serverThresholds } from '../utils/thresholds';
import { generateTestPhotos, generateSearchQueries } from '../utils/data-generators';

// Mock search service for testing
class MockSearchService {
  private index = new Map<string, any[]>();
  private photos: any[] = [];

  indexPhotos(photos: any[]) {
    const startTime = performance.now();
    
    // Simulate search indexing
    photos.forEach(photo => {
      const terms = [
        photo.metadata?.description || '',
        ...(photo.metadata?.tags || []),
        photo.metadata?.location?.city || '',
        photo.metadata?.location?.country || '',
      ].filter(Boolean).join(' ').toLowerCase();
      
      terms.split(' ').forEach(term => {
        if (!this.index.has(term)) {
          this.index.set(term, []);
        }
        this.index.get(term)!.push(photo.id);
      });
    });
    
    this.photos.push(...photos);
    
    return performance.now() - startTime;
  }

  search(query: any) {
    const startTime = performance.now();
    
    // Simulate search query processing
    const results = this.photos.filter(photo => {
      const searchText = [
        photo.metadata?.description || '',
        ...(photo.metadata?.tags || []),
        photo.metadata?.location?.city || '',
      ].join(' ').toLowerCase();
      
      return searchText.includes(query.text.toLowerCase());
    });
    
    // Apply filters
    let filteredResults = results;
    
    if (query.filters?.tags?.length) {
      filteredResults = filteredResults.filter(photo =>
        query.filters.tags.some((tag: string) =>
          photo.metadata?.tags?.includes(tag)
        )
      );
    }
    
    if (query.filters?.favorites) {
      filteredResults = filteredResults.filter(photo => photo.isFavorite);
    }
    
    if (query.filters?.dateRange) {
      filteredResults = filteredResults.filter(photo =>
        photo.createdAt >= query.filters.dateRange.start &&
        photo.createdAt <= query.filters.dateRange.end
      );
    }
    
    // Apply pagination
    const offset = query.offset || 0;
    const limit = query.limit || 20;
    const paginatedResults = filteredResults.slice(offset, offset + limit);
    
    return {
      results: paginatedResults,
      total: filteredResults.length,
      duration: performance.now() - startTime,
    };
  }

  clear() {
    this.index.clear();
    this.photos = [];
  }
}

describe('Search Performance Tests', () => {
  const searchService = new MockSearchService();

  describe('Photo Indexing Performance', () => {
    bench('index single photo', () => {
      const photos = generateTestPhotos(1);
      searchService.indexPhotos(photos);
      searchService.clear();
    });

    bench('index 10 photos', async () => {
      const photos = generateTestPhotos(10);
      await PerformanceAssertions.assertTimeThreshold(
        () => searchService.indexPhotos(photos),
        serverThresholds.search.indexPhoto.maxTime * 10,
        'Indexing 10 photos should complete within threshold'
      );
      searchService.clear();
    });

    bench('index 100 photos', async () => {
      const photos = generateTestPhotos(100);
      await PerformanceAssertions.assertTimeThreshold(
        () => searchService.indexPhotos(photos),
        serverThresholds.search.indexPhoto.maxTime * 100,
        'Indexing 100 photos should complete within threshold'
      );
      searchService.clear();
    });

    bench('index 1000 photos', async () => {
      const photos = generateTestPhotos(1000);
      await PerformanceAssertions.assertTimeThreshold(
        () => searchService.indexPhotos(photos),
        serverThresholds.search.batchSearch.maxTime * 10,
        'Indexing 1000 photos should complete within threshold'
      );
      searchService.clear();
    });
  });

  describe('Search Query Performance', () => {
    // Setup test data
    const largePhotoSet = generateTestPhotos(1000);
    
    beforeAll(() => {
      searchService.indexPhotos(largePhotoSet);
    });

    bench('simple text search', async () => {
      const query = { text: 'vacation', filters: {} };
      await PerformanceAssertions.assertTimeThreshold(
        () => searchService.search(query),
        serverThresholds.search.searchQuery.maxTime,
        'Simple text search should complete within threshold'
      );
    });

    bench('search with tag filters', async () => {
      const query = {
        text: 'vacation',
        filters: { tags: ['vacation', 'family'] }
      };
      await PerformanceAssertions.assertTimeThreshold(
        () => searchService.search(query),
        serverThresholds.search.searchQuery.maxTime,
        'Search with tag filters should complete within threshold'
      );
    });

    bench('search with date range', async () => {
      const query = {
        text: 'vacation',
        filters: {
          dateRange: {
            start: Date.now() - (30 * 24 * 60 * 60 * 1000),
            end: Date.now(),
          }
        }
      };
      await PerformanceAssertions.assertTimeThreshold(
        () => searchService.search(query),
        serverThresholds.search.searchQuery.maxTime,
        'Search with date range should complete within threshold'
      );
    });

    bench('complex search with multiple filters', async () => {
      const query = {
        text: 'vacation family',
        filters: {
          tags: ['vacation', 'family'],
          favorites: true,
          dateRange: {
            start: Date.now() - (30 * 24 * 60 * 60 * 1000),
            end: Date.now(),
          },
        },
        limit: 50,
        offset: 0,
      };
      await PerformanceAssertions.assertTimeThreshold(
        () => searchService.search(query),
        serverThresholds.search.complexSearch.maxTime,
        'Complex search should complete within threshold'
      );
    });

    bench('paginated search', async () => {
      const query = {
        text: 'photo',
        filters: {},
        limit: 20,
        offset: 100,
      };
      await PerformanceAssertions.assertTimeThreshold(
        () => searchService.search(query),
        serverThresholds.search.searchQuery.maxTime,
        'Paginated search should complete within threshold'
      );
    });
  });

  describe('Batch Search Performance', () => {
    const queries = generateSearchQueries(50);
    
    bench('batch search 10 queries', async () => {
      await PerformanceAssertions.assertMinThroughput(
        queries.slice(0, 10),
        (query) => searchService.search(query),
        serverThresholds.search.batchSearch.minThroughput,
        { batchSize: 10 }
      );
    });

    bench('batch search 50 queries', async () => {
      const { totalTime, avgTime, throughput } = await measureBatchPerformance(
        queries,
        (query) => searchService.search(query),
        { batchSize: 50, iterations: 1 }
      );
      
      console.log(`Batch search 50 queries: ${totalTime.toFixed(2)}ms total, ${avgTime.toFixed(2)}ms avg, ${throughput.toFixed(2)} ops/sec`);
    });

    bench('concurrent search operations', async () => {
      const { totalTime, throughput } = await measureBatchPerformance(
        queries.slice(0, 20),
        (query) => searchService.search(query),
        { batchSize: 20, iterations: 1, concurrent: true }
      );
      
      console.log(`Concurrent search 20 queries: ${totalTime.toFixed(2)}ms total, ${throughput.toFixed(2)} ops/sec`);
    });
  });

  describe('Search Scalability Tests', () => {
    bench('search performance with 1K photos', async () => {
      const photos = generateTestPhotos(1000);
      searchService.indexPhotos(photos);
      
      const query = { text: 'vacation', filters: {} };
      await PerformanceAssertions.assertTimeThreshold(
        () => searchService.search(query),
        serverThresholds.search.searchQuery.maxTime,
        'Search with 1K photos should complete within threshold'
      );
      
      searchService.clear();
    });

    bench('search performance with 5K photos', async () => {
      const photos = generateTestPhotos(5000);
      searchService.indexPhotos(photos);
      
      const query = { text: 'vacation', filters: {} };
      const metrics = await measureTime(() => searchService.search(query));
      const { duration } = metrics;
      
      // Should scale reasonably (allow 2x more time for 5x more data)
      const expectedMaxTime = serverThresholds.search.searchQuery.maxTime * 2;
      if (duration > expectedMaxTime) {
        throw new Error(`Search scaling issue: ${duration.toFixed(2)}ms > ${expectedMaxTime}ms`);
      }
      
      console.log(`Search with 5K photos: ${duration.toFixed(2)}ms`);
      searchService.clear();
    });

    bench('search memory usage', async () => {
      const photos = generateTestPhotos(1000, { includeMetadata: true });
      
      const { memoryDelta } = await PerformanceAssertions.assertMemoryThreshold(
        () => searchService.indexPhotos(photos),
        50 * 1024 * 1024, // 50MB max for indexing 1000 photos
        'Search indexing should not exceed memory threshold'
      );
      
      console.log(`Search indexing memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
      searchService.clear();
    });
  });
});
