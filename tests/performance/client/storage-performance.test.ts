/**
 * Client storage performance benchmarks
 * Tests AsyncStorage operations, photo management, and local search performance
 */

import { bench, describe } from 'vitest';
import { 
  PerformanceAssertions, 
  measureBatchPerformance,
  measureTime 
} from '../utils/benchmark-helpers';
import { clientThresholds } from '../utils/thresholds';
import { generateTestPhotos } from '../utils/data-generators';

// Mock AsyncStorage for testing
class MockAsyncStorage {
  private storage = new Map<string, string>();
  private operationCount = 0;

  async getItem(key: string): Promise<string | null> {
    const startTime = performance.now();
    this.operationCount++;
    
    // Simulate storage read delay
    await new Promise(resolve => setTimeout(resolve, 1 + Math.random() * 5));
    
    const value = this.storage.get(key) || null;
    const duration = performance.now() - startTime;
    
    return {
      value,
      duration,
      operationCount: this.operationCount,
    } as any;
  }

  async setItem(key: string, value: string): Promise<void> {
    const startTime = performance.now();
    this.operationCount++;
    
    // Simulate storage write delay
    await new Promise(resolve => setTimeout(resolve, 2 + Math.random() * 8));
    
    this.storage.set(key, value);
    const duration = performance.now() - startTime;
    
    return {
      duration,
      operationCount: this.operationCount,
    } as any;
  }

  async removeItem(key: string): Promise<void> {
    const startTime = performance.now();
    this.operationCount++;
    
    await new Promise(resolve => setTimeout(resolve, 1 + Math.random() * 3));
    
    this.storage.delete(key);
    const duration = performance.now() - startTime;
    
    return {
      duration,
      operationCount: this.operationCount,
    } as any;
  }

  async getAllKeys(): Promise<string[]> {
    const startTime = performance.now();
    this.operationCount++;
    
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10));
    
    const keys = Array.from(this.storage.keys());
    const duration = performance.now() - startTime;
    
    return {
      keys,
      duration,
      operationCount: this.operationCount,
    } as any;
  }

  async multiGet(keys: string[]): Promise<[string, string | null][]> {
    const startTime = performance.now();
    this.operationCount++;
    
    await new Promise(resolve => setTimeout(resolve, 10 + keys.length * 0.5));
    
    const results = keys.map(key => [key, this.storage.get(key) || null]);
    const duration = performance.now() - startTime;
    
    return {
      results,
      duration,
      operationCount: this.operationCount,
    } as any;
  }

  async multiSet(keyValuePairs: [string, string][]): Promise<void> {
    const startTime = performance.now();
    this.operationCount++;
    
    await new Promise(resolve => setTimeout(resolve, 20 + keyValuePairs.length * 0.8));
    
    keyValuePairs.forEach(([key, value]) => {
      this.storage.set(key, value);
    });
    
    const duration = performance.now() - startTime;
    
    return {
      duration,
      operationCount: this.operationCount,
    } as any;
  }

  async multiRemove(keys: string[]): Promise<void> {
    const startTime = performance.now();
    this.operationCount++;
    
    await new Promise(resolve => setTimeout(resolve, 15 + keys.length * 0.3));
    
    keys.forEach(key => {
      this.storage.delete(key);
    });
    
    const duration = performance.now() - startTime;
    
    return {
      duration,
      operationCount: this.operationCount,
    } as any;
  }

  getStats() {
    return {
      itemCount: this.storage.size,
      operationCount: this.operationCount,
      estimatedSize: Array.from(this.storage.values()).reduce((sum, val) => sum + val.length, 0),
    };
  }

  clear() {
    this.storage.clear();
    this.operationCount = 0;
  }
}

// Mock photo storage service
class MockPhotoStorageService {
  private storage = new MockAsyncStorage();
  private readonly PHOTOS_KEY = '@cloud_gallery_photos';
  private readonly ALBUMS_KEY = '@cloud_gallery_albums';

  async savePhoto(photo: any): Promise<void> {
    const startTime = performance.now();
    
    // Get existing photos
    const existingResult = await this.storage.getItem(this.PHOTOS_KEY);
    const photos = existingResult ? JSON.parse(existingResult) : [];
    
    // Add new photo
    photos.push(photo);
    
    // Save back to storage
    await this.storage.setItem(this.PHOTOS_KEY, JSON.stringify(photos));
    
    return {
      duration: performance.now() - startTime,
      photoCount: photos.length,
    } as any;
  }

  async savePhotos(photos: any[]): Promise<void> {
    const startTime = performance.now();
    
    // Get existing photos
    const existingResult = await this.storage.getItem(this.PHOTOS_KEY);
    const existingPhotos = existingResult ? JSON.parse(existingResult) : [];
    
    // Merge photos
    const allPhotos = [...existingPhotos, ...photos];
    
    // Save to storage
    await this.storage.setItem(this.PHOTOS_KEY, JSON.stringify(allPhotos));
    
    return {
      duration: performance.now() - startTime,
      photoCount: allPhotos.length,
    } as any;
  }

  async loadPhotos(): Promise<any[]> {
    const startTime = performance.now();
    
    const result = await this.storage.getItem(this.PHOTOS_KEY);
    const photos = result ? JSON.parse(result) : [];
    
    return {
      photos,
      duration: performance.now() - startTime,
      count: photos.length,
    } as any;
  }

  async searchPhotos(query: string): Promise<any[]> {
    const startTime = performance.now();
    
    const { photos } = await this.loadPhotos();
    
    const filteredPhotos = photos.filter((photo: any) => {
      const searchText = [
        photo.metadata?.description || '',
        ...(photo.metadata?.tags || []),
        photo.metadata?.location?.city || '',
      ].join(' ').toLowerCase();
      
      return searchText.includes(query.toLowerCase());
    });
    
    return {
      photos: filteredPhotos,
      duration: performance.now() - startTime,
      total: photos.length,
      filtered: filteredPhotos.length,
    } as any;
  }

  async deletePhoto(photoId: string): Promise<void> {
    const startTime = performance.now();
    
    const { photos } = await this.loadPhotos();
    const filteredPhotos = photos.filter((photo: any) => photo.id !== photoId);
    
    await this.storage.setItem(this.PHOTOS_KEY, JSON.stringify(filteredPhotos));
    
    return {
      duration: performance.now() - startTime,
      deletedCount: photos.length - filteredPhotos.length,
    } as any;
  }

  async getStorageInfo(): Promise<any> {
    const stats = this.storage.getStats();
    const { photos } = await this.loadPhotos();
    
    const totalSize = photos.reduce((sum: number, photo: any) => {
      return sum + (photo.size || 0) + JSON.stringify(photo.metadata || {}).length;
    }, 0);
    
    return {
      photoCount: photos.length,
      totalSize,
      averageSize: photos.length > 0 ? totalSize / photos.length : 0,
      storageStats: stats,
    };
  }

  clear() {
    this.storage.clear();
  }
}

describe('Client Storage Performance Tests', () => {
  const storageService = new MockPhotoStorageService();

  describe('AsyncStorage Operations', () => {
    beforeEach(() => {
      storageService.clear();
    });

    bench('single item save', async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.storage.setItem('test_key', 'test_value'),
        clientThresholds.storage.savePhoto.maxTime / 2,
        'Single item save should complete within threshold'
      );
    });

    bench('single item load', async () => {
      await storageService.storage.setItem('test_key', 'test_value');
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.storage.getItem('test_key'),
        clientThresholds.storage.savePhoto.maxTime / 2,
        'Single item load should complete within threshold'
      );
    });

    bench('multi-save 10 items', async () => {
      const pairs = Array.from({ length: 10 }, (_, i) => [`key_${i}`, `value_${i}`]);
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.storage.multiSet(pairs),
        clientThresholds.storage.savePhoto.maxTime,
        'Multi-save 10 items should complete within threshold'
      );
    });

    bench('multi-load 10 items', async () => {
      const pairs = Array.from({ length: 10 }, (_, i) => [`key_${i}`, `value_${i}`]);
      await storageService.storage.multiSet(pairs);
      const keys = pairs.map(([key]) => key);
      
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.storage.multiGet(keys),
        clientThresholds.storage.savePhoto.maxTime,
        'Multi-load 10 items should complete within threshold'
      );
    });

    bench('multi-remove 10 items', async () => {
      const pairs = Array.from({ length: 10 }, (_, i) => [`key_${i}`, `value_${i}`]);
      await storageService.storage.multiSet(pairs);
      const keys = pairs.map(([key]) => key);
      
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.storage.multiRemove(keys),
        clientThresholds.storage.savePhoto.maxTime,
        'Multi-remove 10 items should complete within threshold'
      );
    });
  });

  describe('Photo Storage Operations', () => {
    beforeEach(() => {
      storageService.clear();
    });

    bench('save single photo', async () => {
      const photos = generateTestPhotos(1);
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.savePhoto(photos[0]),
        clientThresholds.storage.savePhoto.maxTime,
        'Save single photo should complete within threshold'
      );
    });

    bench('save 10 photos', async () => {
      const photos = generateTestPhotos(10);
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.savePhotos(photos),
        clientThresholds.storage.savePhoto.maxTime * 5,
        'Save 10 photos should complete within threshold'
      );
    });

    bench('save 100 photos', async () => {
      const photos = generateTestPhotos(100);
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.savePhotos(photos),
        clientThresholds.storage.savePhoto.maxTime * 20,
        'Save 100 photos should complete within threshold'
      );
    });

    bench('load photos (small dataset)', async () => {
      const photos = generateTestPhotos(50);
      await storageService.savePhotos(photos);
      
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.loadPhotos(),
        clientThresholds.storage.loadPhotos.maxTime / 2,
        'Load small dataset should complete within threshold'
      );
    });

    bench('load photos (large dataset)', async () => {
      const photos = generateTestPhotos(500);
      await storageService.savePhotos(photos);
      
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.loadPhotos(),
        clientThresholds.storage.loadPhotos.maxTime,
        'Load large dataset should complete within threshold'
      );
    });

    bench('delete photo', async () => {
      const photos = generateTestPhotos(10);
      await storageService.savePhotos(photos);
      
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.deletePhoto(photos[0].id),
        clientThresholds.storage.savePhoto.maxTime,
        'Delete photo should complete within threshold'
      );
    });
  });

  describe('Local Search Performance', () => {
    beforeEach(async () => {
      storageService.clear();
      const photos = generateTestPhotos(1000);
      await storageService.savePhotos(photos);
    });

    bench('simple text search', async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.searchPhotos('vacation'),
        clientThresholds.storage.searchLocal.maxTime,
        'Simple text search should complete within threshold'
      );
    });

    bench('search with no results', async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.searchPhotos('nonexistent_term'),
        clientThresholds.storage.searchLocal.maxTime,
        'Search with no results should complete within threshold'
      );
    });

    bench('search with many results', async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.searchPhotos('photo'), // Should match many photos
        clientThresholds.storage.searchLocal.maxTime,
        'Search with many results should complete within threshold'
      );
    });

    bench('concurrent searches', async () => {
      const queries = ['vacation', 'family', 'nature', 'city', 'portrait'];
      
      const { totalTime, throughput } = await measureBatchPerformance(
        queries,
        (query) => storageService.searchPhotos(query),
        { batchSize: 5, iterations: 1, concurrent: true }
      );
      
      console.log(`Concurrent searches: ${totalTime.toFixed(2)}ms total, ${throughput.toFixed(2)} ops/sec`);
    });
  });

  describe('Storage Throughput Tests', () => {
    beforeEach(() => {
      storageService.clear();
    });

    bench('photo save throughput', async () => {
      const photos = generateTestPhotos(100);
      
      const { throughput } = await measureBatchPerformance(
        photos,
        (photo) => storageService.savePhoto(photo),
        { batchSize: 100, iterations: 1 }
      );
      
      const minThroughput = clientThresholds.storage.savePhoto.minThroughput || 10;
      if (throughput < minThroughput) {
        throw new Error(`Photo save throughput too low: ${throughput.toFixed(2)} ops/sec < ${minThroughput} ops/sec`);
      }
      
      console.log(`Photo save throughput: ${throughput.toFixed(2)} photos/sec`);
    });

    bench('photo load throughput', async () => {
      // Setup data
      const photos = generateTestPhotos(200);
      await storageService.savePhotos(photos);
      
      const { throughput } = await measureBatchPerformance(
        Array.from({ length: 50 }, () => null),
        () => storageService.loadPhotos(),
        { batchSize: 50, iterations: 1 }
      );
      
      console.log(`Photo load throughput: ${throughput.toFixed(2)} loads/sec`);
    });
  });

  describe('Memory Usage Tests', () => {
    bench('memory usage during batch save', async () => {
      storageService.clear();
      const photos = generateTestPhotos(200, { 
        minSize: 3 * 1024 * 1024, 
        maxSize: 8 * 1024 * 1024 
      });
      
      const { memoryDelta } = await PerformanceAssertions.assertMemoryThreshold(
        () => storageService.savePhotos(photos),
        50 * 1024 * 1024, // 50MB max for 200 photos
        'Batch save should not exceed memory threshold'
      );
      
      console.log(`Batch save memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });

    bench('memory usage during search', async () => {
      // Setup large dataset
      const photos = generateTestPhotos(1000, { includeMetadata: true });
      await storageService.savePhotos(photos);
      
      const { memoryDelta } = await PerformanceAssertions.assertMemoryThreshold(
        () => storageService.searchPhotos('vacation'),
        10 * 1024 * 1024, // 10MB max for search
        'Search should not exceed memory threshold'
      );
      
      console.log(`Search memory usage: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('Storage Info and Statistics', () => {
    beforeEach(async () => {
      storageService.clear();
      const photos = generateTestPhotos(500);
      await storageService.savePhotos(photos);
    });

    bench('calculate storage info', async () => {
      await PerformanceAssertions.assertTimeThreshold(
        () => storageService.getStorageInfo(),
        clientThresholds.storage.loadPhotos.maxTime / 2,
        'Storage info calculation should complete within threshold'
      );
    });

    bench('storage info accuracy', async () => {
      const info = await storageService.getStorageInfo();
      
      // Verify storage info is accurate
      if (info.photoCount !== 500) {
        throw new Error(`Storage info photo count incorrect: ${info.photoCount} != 500`);
      }
      
      if (info.totalSize <= 0) {
        throw new Error(`Storage info total size invalid: ${info.totalSize}`);
      }
      
      console.log(`Storage info: ${info.photoCount} photos, ${(info.totalSize / 1024 / 1024).toFixed(2)}MB total, ${(info.averageSize / 1024).toFixed(2)}KB avg`);
    });
  });

  describe('Scalability Tests', () => {
    bench('storage performance scaling', async () => {
      const sizes = [100, 500, 1000, 2000];
      const results = [];
      
      for (const size of sizes) {
        storageService.clear();
        const photos = generateTestPhotos(size);
        
        const { duration: saveDuration } = await measureTime(() => 
          storageService.savePhotos(photos)
        );
        
        const { duration: loadDuration } = await measureTime(() => 
          storageService.loadPhotos()
        );
        
        results.push({ 
          size, 
          saveDuration: saveDuration / size, 
          loadDuration: loadDuration / size 
        });
      }
      
      // Performance should scale reasonably
      const firstSaveTime = results[0].saveDuration;
      const lastSaveTime = results[results.length - 1].saveDuration;
      const saveScaleFactor = lastSaveTime / firstSaveTime;
      
      if (saveScaleFactor > 5) {
        throw new Error(`Save performance scaling poorly: ${saveScaleFactor.toFixed(2)}x slower per photo`);
      }
      
      console.log('Storage scaling results (per photo):', 
        results.map(r => `${r.size}: save ${r.saveDuration.toFixed(2)}ms, load ${r.loadDuration.toFixed(2)}ms`).join(', ')
      );
    });
  });
});
