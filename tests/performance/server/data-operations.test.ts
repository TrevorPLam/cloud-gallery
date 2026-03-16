/**
 * Data operations performance benchmarks
 * Tests database queries, batch operations, and data export performance
 */

import { bench, describe } from 'vitest';
import { 
  PerformanceAssertions, 
  measureBatchPerformance,
  measureTime 
} from '../utils/benchmark-helpers';
import { serverThresholds } from '../utils/thresholds';
import { generateTestPhotos, generateTestAlbums } from '../utils/data-generators';

// Mock database service
class MockDatabaseService {
  private photos = new Map<string, any>();
  private albums = new Map<string, any>();
  private queryCount = 0;

  // Simulate database query
  async query(sql: string, params: any[] = []) {
    const startTime = performance.now();
    this.queryCount++;
    
    // Simulate query execution time
    await new Promise(resolve => setTimeout(resolve, 1 + Math.random() * 10));
    
    let result = [];
    
    // Simple query simulation
    if (sql.includes('SELECT * FROM photos')) {
      if (sql.includes('WHERE id =')) {
        const photoId = params[0];
        const photo = this.photos.get(photoId);
        result = photo ? [photo] : [];
      } else if (sql.includes('LIMIT')) {
        const limit = params[0] || 20;
        result = Array.from(this.photos.values()).slice(0, limit);
      } else {
        result = Array.from(this.photos.values());
      }
    } else if (sql.includes('SELECT * FROM albums')) {
      result = Array.from(this.albums.values());
    } else if (sql.includes('INSERT INTO photos')) {
      const photo = params[0];
      this.photos.set(photo.id, photo);
      result = [{ id: photo.id }];
    } else if (sql.includes('INSERT INTO albums')) {
      const album = params[0];
      this.albums.set(album.id, album);
      result = [{ id: album.id }];
    } else if (sql.includes('UPDATE photos SET')) {
      const [updates, photoId] = params;
      const photo = this.photos.get(photoId);
      if (photo) {
        Object.assign(photo, updates);
        result = [photo];
      }
    } else if (sql.includes('DELETE FROM photos')) {
      const photoId = params[0];
      this.photos.delete(photoId);
      result = [{ deleted: 1 }];
    }
    
    return {
      rows: result,
      executionTime: performance.now() - startTime,
      queryCount: this.queryCount,
    };
  }

  // Simulate batch insert
  async batchInsert(table: string, records: any[]) {
    const startTime = performance.now();
    
    for (const record of records) {
      if (table === 'photos') {
        this.photos.set(record.id, record);
      } else if (table === 'albums') {
        this.albums.set(record.id, record);
      }
    }
    
    // Simulate database batch operation overhead
    await new Promise(resolve => setTimeout(resolve, 10 + records.length * 0.1));
    
    return {
      insertedCount: records.length,
      executionTime: performance.now() - startTime,
    };
  }

  // Simulate transaction
  async transaction(operations: Array<{ type: string; data: any }>) {
    const startTime = performance.now();
    const results = [];
    
    try {
      for (const op of operations) {
        if (op.type === 'insert') {
          if (op.data.table === 'photos') {
            this.photos.set(op.data.record.id, op.data.record);
          } else if (op.data.table === 'albums') {
            this.albums.set(op.data.record.id, op.data.record);
          }
          results.push({ success: true, id: op.data.record.id });
        } else if (op.type === 'update') {
          const record = op.data.table === 'photos' 
            ? this.photos.get(op.data.id)
            : this.albums.get(op.data.id);
          if (record) {
            Object.assign(record, op.data.updates);
            results.push({ success: true, id: op.data.id });
          } else {
            results.push({ success: false, id: op.data.id, error: 'Not found' });
          }
        } else if (op.type === 'delete') {
          const deleted = op.data.table === 'photos'
            ? this.photos.delete(op.data.id)
            : this.albums.delete(op.data.id);
          results.push({ success: deleted, id: op.data.id });
        }
      }
      
      return {
        success: true,
        results,
        executionTime: performance.now() - startTime,
      };
    } catch (error) {
      // Simulate rollback
      return {
        success: false,
        error,
        executionTime: performance.now() - startTime,
      };
    }
  }

  // Simulate data export
  async exportData(format: 'json' | 'csv' = 'json', filters: any = {}) {
    const startTime = performance.now();
    
    let photos = Array.from(this.photos.values());
    let albums = Array.from(this.albums.values());
    
    // Apply filters
    if (filters.dateRange) {
      photos = photos.filter(photo => 
        photo.createdAt >= filters.dateRange.start &&
        photo.createdAt <= filters.dateRange.end
      );
    }
    
    if (filters.albumId) {
      photos = photos.filter(photo => 
        photo.albumIds?.includes(filters.albumId)
      );
    }
    
    const exportData = {
      photos,
      albums,
      exportedAt: Date.now(),
      count: photos.length + albums.length,
    };
    
    // Simulate export processing time
    await new Promise(resolve => setTimeout(resolve, exportData.count * 0.5));
    
    let exportString;
    if (format === 'json') {
      exportString = JSON.stringify(exportData, null, 2);
    } else {
      // Simple CSV export simulation
      const csvHeaders = 'id,uri,width,height,size,createdAt\n';
      const csvRows = photos.map(photo => 
        `${photo.id},${photo.uri},${photo.width},${photo.height},${photo.size},${photo.createdAt}`
      ).join('\n');
      exportString = csvHeaders + csvRows;
    }
    
    return {
      data: exportString,
      size: exportString.length,
      recordCount: exportData.count,
      executionTime: performance.now() - startTime,
    };
  }

  // Get database statistics
  getStats() {
    return {
      photoCount: this.photos.size,
      albumCount: this.albums.size,
      queryCount: this.queryCount,
      memoryUsage: this.photos.size * 1000 + this.albums.size * 500, // Rough estimate
    };
  }

  // Clear all data
  clear() {
    this.photos.clear();
    this.albums.clear();
    this.queryCount = 0;
  }
}

describe('Data Operations Performance Tests', () => {
  const dbService = new MockDatabaseService();

  describe('Basic Database Queries', () => {
    beforeAll(async () => {
      // Setup test data
      const photos = generateTestPhotos(1000);
      const albums = generateTestAlbums(50);
      
      await dbService.batchInsert('photos', photos);
      await dbService.batchInsert('albums', albums);
    });

    bench('single photo query', async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => dbService.query('SELECT * FROM photos WHERE id = ?', ['perf_photo_0']),
        serverThresholds.dataOperations.databaseQuery.maxTime,
        'Single photo query should complete within threshold'
      );
    });

    bench('single album query', async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => dbService.query('SELECT * FROM albums WHERE id = ?', ['perf_album_0']),
        serverThresholds.dataOperations.databaseQuery.maxTime,
        'Single album query should complete within threshold'
      );
    });

    bench('query with limit', async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => dbService.query('SELECT * FROM photos LIMIT ?', [20]),
        serverThresholds.dataOperations.databaseQuery.maxTime,
        'Query with limit should complete within threshold'
      );
    });

    bench('query all photos (1K records)', async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => dbService.query('SELECT * FROM photos'),
        serverThresholds.dataOperations.databaseQuery.maxTime * 10,
        'Query all photos should complete within threshold'
      );
    });
  });

  describe('Batch Operations Performance', () => {
    beforeEach(() => {
      dbService.clear();
    });

    bench('batch insert 10 photos', async () => {
      const photos = generateTestPhotos(10);
      await PerformanceAssertions.assertTimeThreshold(
        () => dbService.batchInsert('photos', photos),
        serverThresholds.dataOperations.batchInsert.maxTime / 10,
        'Batch insert 10 photos should complete within threshold'
      );
    });

    bench('batch insert 100 photos', async () => {
      const photos = generateTestPhotos(100);
      await PerformanceAssertions.assertTimeThreshold(
        () => dbService.batchInsert('photos', photos),
        serverThresholds.dataOperations.batchInsert.maxTime,
        'Batch insert 100 photos should complete within threshold'
      );
    });

    bench('batch insert 1000 photos', async () => {
      const photos = generateTestPhotos(1000);
      const result = await dbService.batchInsert('photos', photos);
      
      // Should maintain reasonable performance for large batches
      const expectedMaxTime = serverThresholds.dataOperations.batchInsert.maxTime * 10;
      if (result.executionTime > expectedMaxTime) {
        throw new Error(`Batch insert 1000 photos too slow: ${result.executionTime.toFixed(2)}ms`);
      }
      
      console.log(`Batch insert 1000 photos: ${result.executionTime.toFixed(2)}ms`);
    });

    bench('batch insert with throughput check', async () => {
      const photos = generateTestPhotos(500);
      
      const { throughput } = await measureBatchPerformance(
        photos,
        (photo) => dbService.batchInsert('photos', [photo]),
        { batchSize: 500, iterations: 1 }
      );
      
      const minThroughput = serverThresholds.dataOperations.batchInsert.minThroughput || 100;
      if (throughput < minThroughput) {
        throw new Error(`Batch insert throughput too low: ${throughput.toFixed(2)} ops/sec < ${minThroughput} ops/sec`);
      }
      
      console.log(`Batch insert throughput: ${throughput.toFixed(2)} records/sec`);
    });
  });

  describe('Transaction Performance', () => {
    beforeEach(() => {
      dbService.clear();
    });

    bench('small transaction (10 operations)', async () => {
      const photos = generateTestPhotos(10);
      const operations = photos.map(photo => ({
        type: 'insert',
        data: { table: 'photos', record: photo }
      }));
      
      await PerformanceAssertions.assertTimeThreshold(
        () => dbService.transaction(operations),
        serverThresholds.dataOperations.batchInsert.maxTime / 10,
        'Small transaction should complete within threshold'
      );
    });

    bench('medium transaction (100 operations)', async () => {
      const photos = generateTestPhotos(100);
      const operations = photos.map(photo => ({
        type: 'insert',
        data: { table: 'photos', record: photo }
      }));
      
      await PerformanceAssertions.assertTimeThreshold(
        () => dbService.transaction(operations),
        serverThresholds.dataOperations.batchInsert.maxTime,
        'Medium transaction should complete within threshold'
      );
    });

    bench('complex transaction (mixed operations)', async () => {
      const photos = generateTestPhotos(50);
      const operations = [
        // Insert operations
        ...photos.slice(0, 30).map(photo => ({
          type: 'insert',
          data: { table: 'photos', record: photo }
        })),
        // Update operations
        ...photos.slice(30, 40).map(photo => ({
          type: 'update',
          data: { table: 'photos', id: photo.id, updates: { isFavorite: true } }
        })),
        // Delete operations
        ...photos.slice(40, 50).map(photo => ({
          type: 'delete',
          data: { table: 'photos', id: photo.id }
        })),
      ];
      
      await PerformanceAssertions.assertTimeThreshold(
        () => dbService.transaction(operations),
        serverThresholds.dataOperations.batchInsert.maxTime,
        'Complex transaction should complete within threshold'
      );
    });
  });

  describe('Data Export Performance', () => {
    beforeEach(async () => {
      dbService.clear();
      const photos = generateTestPhotos(1000);
      const albums = generateTestAlbums(50);
      await dbService.batchInsert('photos', photos);
      await dbService.batchInsert('albums', albums);
    });

    bench('export JSON format (small dataset)', async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => dbService.exportData('json', { dateRange: { start: Date.now() - 86400000, end: Date.now() } }),
        serverThresholds.dataOperations.dataExport.maxTime / 10,
        'Small JSON export should complete within threshold'
      );
    });

    bench('export JSON format (large dataset)', async () => {
      const result = await dbService.exportData('json');
      
      if (result.executionTime > serverThresholds.dataOperations.dataExport.maxTime) {
        throw new Error(`Large JSON export too slow: ${result.executionTime.toFixed(2)}ms`);
      }
      
      console.log(`JSON export: ${result.recordCount} records, ${(result.size / 1024).toFixed(2)}KB, ${result.executionTime.toFixed(2)}ms`);
    });

    bench('export CSV format', async () => {
      const result = await dbService.exportData('csv');
      
      if (result.executionTime > serverThresholds.dataOperations.dataExport.maxTime) {
        throw new Error(`CSV export too slow: ${result.executionTime.toFixed(2)}ms`);
      }
      
      console.log(`CSV export: ${result.recordCount} records, ${(result.size / 1024).toFixed(2)}KB, ${result.executionTime.toFixed(2)}ms`);
    });

    bench('export with filters', async () => {
      const filters = {
        dateRange: {
          start: Date.now() - (7 * 24 * 60 * 60 * 1000), // Last 7 days
          end: Date.now(),
        },
        albumId: 'perf_album_0',
      };
      
      const result = await dbService.exportData('json', filters);
      
      if (result.executionTime > serverThresholds.dataOperations.dataExport.maxTime) {
        throw new Error(`Filtered export too slow: ${result.executionTime.toFixed(2)}ms`);
      }
      
      console.log(`Filtered export: ${result.recordCount} records, ${result.executionTime.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage Tests', () => {
    bench('memory usage during batch operations', async () => {
      const photos = generateTestPhotos(1000, { 
        minSize: 2 * 1024 * 1024, 
        maxSize: 5 * 1024 * 1024 
      });
      
      const { memoryDelta } = await PerformanceAssertions.assertMemoryThreshold(
        () => dbService.batchInsert('photos', photos),
        200 * 1024 * 1024, // 200MB max for 1000 photos
        'Batch insert should not exceed memory threshold'
      );
      
      console.log(`Batch insert memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });

    bench('memory usage during export', async () => {
      // Setup large dataset
      const photos = generateTestPhotos(2000);
      await dbService.batchInsert('photos', photos);
      
      const { memoryDelta } = await PerformanceAssertions.assertMemoryThreshold(
        () => dbService.exportData('json'),
        100 * 1024 * 1024, // 100MB max for export
        'Data export should not exceed memory threshold'
      );
      
      console.log(`Data export memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Scalability Tests', () => {
    bench('query performance scaling', async () => {
      const sizes = [100, 500, 1000, 2000];
      const results = [];
      
      for (const size of sizes) {
        dbService.clear();
        const photos = generateTestPhotos(size);
        await dbService.batchInsert('photos', photos);
        
        const { duration } = await measureTime(() => 
          dbService.query('SELECT * FROM photos LIMIT ?', [50])
        );
        
        results.push({ size, duration });
      }
      
      // Performance should scale reasonably (not exponentially)
      const firstDuration = results[0].duration;
      const lastDuration = results[results.length - 1].duration;
      const scaleFactor = results[results.length - 1].size / results[0].size;
      const performanceFactor = lastDuration / firstDuration;
      
      if (performanceFactor > scaleFactor * 2) {
        throw new Error(`Query performance scaling poorly: ${performanceFactor.toFixed(2)}x slower for ${scaleFactor}x more data`);
      }
      
      console.log('Query scaling results:', results.map(r => `${r.size}: ${r.duration.toFixed(2)}ms`).join(', '));
    });
  });
});
