// AI-META-BEGIN
// AI-META: Multi-tier caching architecture with intelligent management and cross-platform synchronization
// OWNERSHIP: client/lib/cache
// ENTRYPOINTS: imported by embedding-cache, photo-cache, and data management modules
// DEPENDENCIES: AsyncStorage, encryption.ts, Platform, ML embedding services
// DANGER: Cache synchronization overhead; memory usage management; encryption performance impact
// CHANGE-SAFETY: Cache strategies can be extended via CacheStrategy interface; eviction policies are configurable
// TESTS: client/lib/cache/advanced-cache.test.ts, verify cache strategies and synchronization
// AI-META-END

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptData, decryptData } from '../encryption';

export type CacheTier = 'memory' | 'disk' | 'network' | 'hybrid';

export type CacheStrategy = 
  | 'write-through'    // Write to all tiers immediately
  | 'write-behind'     // Write to memory first, async to disk
  | 'write-around'     // Write directly to disk, bypass memory
  | 'refresh-ahead'    // Proactively refresh expiring items
  | 'cache-aside'      // Application manages cache explicitly;

export type EvictionPolicy = 
  | 'lru'             // Least Recently Used
  | 'lfu'             // Least Frequently Used
  | 'fifo'            // First In, First Out
  | 'random'          // Random eviction
  | 'ttl'             // Time To Live based
  | 'size-based'      // Based on item size
  | 'adaptive';       // Adaptive based on usage patterns

export interface CacheItem<T = any> {
  key: string;
  value: T;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  size: number;
  ttl?: number;
  expiresAt?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface CacheConfig {
  strategy: CacheStrategy;
  evictionPolicy: EvictionPolicy;
  maxMemoryItems: number;
  maxMemorySize: number; // in bytes
  maxDiskItems: number;
  maxDiskSize: number; // in bytes
  defaultTtl: number; // in milliseconds
  encryptionEnabled: boolean;
  compressionEnabled: boolean;
  syncInterval: number; // in milliseconds
  backgroundRefresh: boolean;
  predictiveCaching: boolean;
  adaptiveSizing: boolean;
}

export interface CacheStats {
  memory: {
    items: number;
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
  };
  disk: {
    items: number;
    size: number;
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
  };
  network: {
    hits: number;
    misses: number;
    hitRate: number;
    latency: number;
  };
  overall: {
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    avgResponseTime: number;
    compressionRatio: number;
    encryptionOverhead: number;
  };
}

export interface CacheEvent {
  type: 'hit' | 'miss' | 'set' | 'delete' | 'evict' | 'sync' | 'error';
  key: string;
  tier: CacheTier;
  timestamp: number;
  metadata?: Record<string, any>;
}

class AdvancedCacheManager {
  private static instance: AdvancedCacheManager;
  private memoryCache: Map<string, CacheItem> = new Map();
  private diskCacheKeys: Set<string> = new Set();
  private config: CacheConfig;
  private stats: CacheStats;
  private eventLog: CacheEvent[] = [];
  private syncTimer?: NodeJS.Timeout;
  private predictiveModel: Map<string, number> = new Map(); // Access probability prediction

  private constructor(config?: Partial<CacheConfig>) {
    this.config = {
      strategy: 'write-through',
      evictionPolicy: 'lru',
      maxMemoryItems: 1000,
      maxMemorySize: 50 * 1024 * 1024, // 50MB
      maxDiskItems: 10000,
      maxDiskSize: 500 * 1024 * 1024, // 500MB
      defaultTtl: 3600000, // 1 hour
      encryptionEnabled: true,
      compressionEnabled: true,
      syncInterval: 30000, // 30 seconds
      backgroundRefresh: true,
      predictiveCaching: true,
      adaptiveSizing: true,
      ...config
    };

    this.stats = this.initializeStats();
    this.startBackgroundTasks();
  }

  static getInstance(config?: Partial<CacheConfig>): AdvancedCacheManager {
    if (!AdvancedCacheManager.instance) {
      AdvancedCacheManager.instance = new AdvancedCacheManager(config);
    }
    return AdvancedCacheManager.instance;
  }

  private initializeStats(): CacheStats {
    return {
      memory: { items: 0, size: 0, hits: 0, misses: 0, hitRate: 0, evictions: 0 },
      disk: { items: 0, size: 0, hits: 0, misses: 0, hitRate: 0, evictions: 0 },
      network: { hits: 0, misses: 0, hitRate: 0, latency: 0 },
      overall: { totalHits: 0, totalMisses: 0, hitRate: 0, avgResponseTime: 0, compressionRatio: 0, encryptionOverhead: 0 }
    };
  }

  private startBackgroundTasks(): void {
    // Start periodic synchronization
    if (this.config.syncInterval > 0) {
      this.syncTimer = setInterval(() => {
        this.synchronizeCaches();
      }, this.config.syncInterval);
    }

    // Start predictive caching analysis
    if (this.config.predictiveCaching) {
      setInterval(() => {
        this.updatePredictiveModel();
      }, 60000); // Every minute
    }

    // Start adaptive sizing
    if (this.config.adaptiveSizing) {
      setInterval(() => {
        this.adaptiveCacheSizing();
      }, 300000); // Every 5 minutes
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      // Check memory cache first
      const memoryItem = this.memoryCache.get(key);
      if (memoryItem && this.isValid(memoryItem)) {
        this.updateAccessStats(memoryItem, 'memory');
        this.logEvent('hit', key, 'memory');
        this.stats.memory.hits++;
        this.stats.overall.totalHits++;
        this.updateHitRates();
        return memoryItem.value;
      }

      // Check disk cache
      if (this.diskCacheKeys.has(key)) {
        const diskItem = await this.getFromDisk<T>(key);
        if (diskItem && this.isValid(diskItem)) {
          // Promote to memory cache based on strategy
          if (this.shouldPromoteToMemory(diskItem)) {
            await this.setToMemory(key, diskItem);
          }
          this.updateAccessStats(diskItem, 'disk');
          this.logEvent('hit', key, 'disk');
          this.stats.disk.hits++;
          this.stats.overall.totalHits++;
          this.updateHitRates();
          return diskItem.value;
        }
      }

      // Cache miss
      this.logEvent('miss', key, 'memory');
      this.stats.memory.misses++;
      this.stats.overall.totalMisses++;
      this.updateHitRates();

      // Predictive caching - prefetch related items
      if (this.config.predictiveCaching) {
        this.triggerPredictivePrefetch(key);
      }

      return null;
    } catch (error) {
      console.error('❌ Cache get error:', error);
      this.logEvent('error', key, 'memory', { error: error.message });
      return null;
    } finally {
      this.updateResponseTime(Date.now() - startTime);
    }
  }

  async set<T>(key: string, value: T, options: {
    ttl?: number;
    tags?: string[];
    metadata?: Record<string, any>;
  } = {}): Promise<void> {
    try {
      const item: CacheItem<T> = {
        key,
        value,
        timestamp: Date.now(),
        accessCount: 0,
        lastAccessed: Date.now(),
        size: this.calculateSize(value),
        ttl: options.ttl || this.config.defaultTtl,
        expiresAt: options.ttl ? Date.now() + options.ttl : undefined,
        tags: options.tags,
        metadata: options.metadata
      };

      switch (this.config.strategy) {
        case 'write-through':
          await this.setToMemory(key, item);
          await this.setToDisk(key, item);
          break;
        case 'write-behind':
          await this.setToMemory(key, item);
          // Async write to disk
          setTimeout(() => this.setToDisk(key, item), 100);
          break;
        case 'write-around':
          await this.setToDisk(key, item);
          break;
        case 'cache-aside':
          await this.setToMemory(key, item);
          break;
        default:
          await this.setToMemory(key, item);
          await this.setToDisk(key, item);
      }

      this.logEvent('set', key, 'memory');
    } catch (error) {
      console.error('❌ Cache set error:', error);
      this.logEvent('error', key, 'memory', { error: error.message });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      // Remove from memory
      this.memoryCache.delete(key);
      
      // Remove from disk
      if (this.diskCacheKeys.has(key)) {
        await AsyncStorage.removeItem(this.getDiskKey(key));
        this.diskCacheKeys.delete(key);
      }

      this.logEvent('delete', key, 'memory');
    } catch (error) {
      console.error('❌ Cache delete error:', error);
      this.logEvent('error', key, 'memory', { error: error.message });
    }
  }

  async clear(tier?: CacheTier): Promise<void> {
    try {
      switch (tier) {
        case 'memory':
          this.memoryCache.clear();
          break;
        case 'disk':
          for (const key of this.diskCacheKeys) {
            await AsyncStorage.removeItem(this.getDiskKey(key));
          }
          this.diskCacheKeys.clear();
          break;
        default:
          this.memoryCache.clear();
          for (const key of this.diskCacheKeys) {
            await AsyncStorage.removeItem(this.getDiskKey(key));
          }
          this.diskCacheKeys.clear();
      }
    } catch (error) {
      console.error('❌ Cache clear error:', error);
    }
  }

  private async setToMemory<T>(key: string, item: CacheItem<T>): Promise<void> {
    // Check memory limits
    if (this.shouldEvictFromMemory(item)) {
      await this.evictFromMemory();
    }

    this.memoryCache.set(key, item);
    this.stats.memory.items = this.memoryCache.size;
    this.stats.memory.size = this.calculateMemorySize();
  }

  private async setToDisk<T>(key: string, item: CacheItem<T>): Promise<void> {
    // Check disk limits
    if (this.shouldEvictFromDisk(item)) {
      await this.evictFromDisk();
    }

    const diskKey = this.getDiskKey(key);
    let serializedItem = JSON.stringify(item);

    // Apply compression if enabled
    if (this.config.compressionEnabled) {
      serializedItem = await this.compressData(serializedItem);
      item.metadata = { ...item.metadata, compressed: true };
    }

    // Apply encryption if enabled
    if (this.config.encryptionEnabled) {
      serializedItem = await encryptData(serializedItem);
      item.metadata = { ...item.metadata, encrypted: true };
    }

    await AsyncStorage.setItem(diskKey, serializedItem);
    this.diskCacheKeys.add(key);
    this.stats.disk.items = this.diskCacheKeys.size;
  }

  private async getFromDisk<T>(key: string): Promise<CacheItem<T> | null> {
    try {
      const diskKey = this.getDiskKey(key);
      let serializedItem = await AsyncStorage.getItem(diskKey);

      if (!serializedItem) {
        return null;
      }

      // Apply decryption if needed
      const metadata = JSON.parse(serializedItem).metadata;
      if (metadata?.encrypted) {
        serializedItem = await decryptData(serializedItem);
      }

      // Apply decompression if needed
      if (metadata?.compressed) {
        serializedItem = await this.decompressData(serializedItem);
      }

      const item: CacheItem<T> = JSON.parse(serializedItem);
      return item;
    } catch (error) {
      console.error('❌ Disk cache get error:', error);
      return null;
    }
  }

  private shouldEvictFromMemory(item: CacheItem): boolean {
    return (
      this.memoryCache.size >= this.config.maxMemoryItems ||
      this.stats.memory.size + item.size > this.config.maxMemorySize
    );
  }

  private shouldEvictFromDisk(item: CacheItem): boolean {
    return (
      this.diskCacheKeys.size >= this.config.maxDiskItems ||
      this.stats.disk.size + item.size > this.config.maxDiskSize
    );
  }

  private async evictFromMemory(): Promise<void> {
    let keyToEvict: string | null = null;

    switch (this.config.evictionPolicy) {
      case 'lru':
        keyToEvict = this.findLRUKey();
        break;
      case 'lfu':
        keyToEvict = this.findLFUKey();
        break;
      case 'fifo':
        keyToEvict = this.findFIFOKey();
        break;
      case 'ttl':
        keyToEvict = this.findExpiredKey();
        break;
      case 'size-based':
        keyToEvict = this.findLargestKey();
        break;
      case 'adaptive':
        keyToEvict = this.findAdaptiveEvictionKey();
        break;
      default:
        keyToEvict = this.findLRUKey();
    }

    if (keyToEvict) {
      this.memoryCache.delete(keyToEvict);
      this.stats.memory.evictions++;
      this.logEvent('evict', keyToEvict, 'memory');
    }
  }

  private async evictFromDisk(): Promise<void> {
    let keyToEvict: string | null = null;

    // For disk, we use a simpler approach - find the least recently used
    const diskItems: Array<{ key: string; item: CacheItem }> = [];
    
    for (const key of this.diskCacheKeys) {
      const item = await this.getFromDisk(key);
      if (item) {
        diskItems.push({ key, item });
      }
    }

    if (diskItems.length === 0) return;

    // Sort by last accessed time
    diskItems.sort((a, b) => a.item.lastAccessed - b.item.lastAccessed);
    keyToEvict = diskItems[0].key;

    if (keyToEvict) {
      await AsyncStorage.removeItem(this.getDiskKey(keyToEvict));
      this.diskCacheKeys.delete(keyToEvict);
      this.stats.disk.evictions++;
      this.logEvent('evict', keyToEvict, 'disk');
    }
  }

  private findLRUKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.memoryCache.entries()) {
      if (item.lastAccessed < oldestTime) {
        oldestTime = item.lastAccessed;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private findLFUKey(): string | null {
    let leastUsedKey: string | null = null;
    let leastCount = Infinity;

    for (const [key, item] of this.memoryCache.entries()) {
      if (item.accessCount < leastCount) {
        leastCount = item.accessCount;
        leastUsedKey = key;
      }
    }

    return leastUsedKey;
  }

  private findFIFOKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, item] of this.memoryCache.entries()) {
      if (item.timestamp < oldestTimestamp) {
        oldestTimestamp = item.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  private findExpiredKey(): string | null {
    const now = Date.now();

    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiresAt && item.expiresAt < now) {
        return key;
      }
    }

    return null;
  }

  private findLargestKey(): string | null {
    let largestKey: string | null = null;
    let largestSize = 0;

    for (const [key, item] of this.memoryCache.entries()) {
      if (item.size > largestSize) {
        largestSize = item.size;
        largestKey = key;
      }
    }

    return largestKey;
  }

  private findAdaptiveEvictionKey(): string | null {
    // Adaptive eviction considers access frequency, recency, and size
    let bestKey: string | null = null;
    let bestScore = Infinity;

    for (const [key, item] of this.memoryCache.entries()) {
      const score = this.calculateEvictionScore(item);
      if (score < bestScore) {
        bestScore = score;
        bestKey = key;
      }
    }

    return bestKey;
  }

  private calculateEvictionScore(item: CacheItem): number {
    const now = Date.now();
    const age = now - item.timestamp;
    const timeSinceAccess = now - item.lastAccessed;
    const accessFrequency = item.accessCount / Math.max(1, age / 1000); // accesses per second
    const sizeFactor = item.size / 1024; // size in KB

    // Lower score = more likely to evict
    return (timeSinceAccess / accessFrequency) * sizeFactor;
  }

  private isValid(item: CacheItem): boolean {
    if (item.expiresAt && item.expiresAt < Date.now()) {
      return false;
    }
    return true;
  }

  private shouldPromoteToMemory(item: CacheItem): boolean {
    // Promote based on access frequency and recency
    const accessFrequency = item.accessCount / Math.max(1, (Date.now() - item.timestamp) / 1000);
    return accessFrequency > 0.1; // More than 0.1 accesses per second
  }

  private updateAccessStats(item: CacheItem, tier: CacheTier): void {
    item.accessCount++;
    item.lastAccessed = Date.now();

    // Update predictive model
    if (this.config.predictiveCaching) {
      const currentScore = this.predictiveModel.get(item.key) || 0;
      this.predictiveModel.set(item.key, currentScore + 1);
    }
  }

  private updateHitRates(): void {
    const totalMemoryRequests = this.stats.memory.hits + this.stats.memory.misses;
    this.stats.memory.hitRate = totalMemoryRequests > 0 ? this.stats.memory.hits / totalMemoryRequests : 0;

    const totalDiskRequests = this.stats.disk.hits + this.stats.disk.misses;
    this.stats.disk.hitRate = totalDiskRequests > 0 ? this.stats.disk.hits / totalDiskRequests : 0;

    const totalRequests = this.stats.overall.totalHits + this.stats.overall.totalMisses;
    this.stats.overall.hitRate = totalRequests > 0 ? this.stats.overall.totalHits / totalRequests : 0;
  }

  private updateResponseTime(duration: number): void {
    const currentAvg = this.stats.overall.avgResponseTime;
    const count = this.stats.overall.totalHits + this.stats.overall.totalMisses;
    this.stats.overall.avgResponseTime = (currentAvg * (count - 1) + duration) / count;
  }

  private calculateMemorySize(): number {
    let totalSize = 0;
    for (const item of this.memoryCache.values()) {
      totalSize += item.size;
    }
    return totalSize;
  }

  private calculateSize(value: any): number {
    // Rough estimation of object size in bytes
    try {
      return JSON.stringify(value).length * 2; // UTF-16 characters
    } catch (error) {
      return 1024; // Default 1KB
    }
  }

  private getDiskKey(key: string): string {
    return `cache_${key}`;
  }

  private logEvent(type: CacheEvent['type'], key: string, tier: CacheTier, metadata?: Record<string, any>): void {
    const event: CacheEvent = {
      type,
      key,
      tier,
      timestamp: Date.now(),
      metadata
    };

    this.eventLog.push(event);
    
    // Keep only last 1000 events
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-1000);
    }
  }

  private async synchronizeCaches(): Promise<void> {
    try {
      this.logEvent('sync', 'all', 'memory');
      
      // Sync memory cache to disk for persistence
      for (const [key, item] of this.memoryCache.entries()) {
        if (item.accessCount > 5) { // Only sync frequently accessed items
          await this.setToDisk(key, item);
        }
      }
    } catch (error) {
      console.error('❌ Cache synchronization error:', error);
    }
  }

  private updatePredictiveModel(): void {
    // Update access probability predictions
    const totalAccesses = Array.from(this.predictiveModel.values()).reduce((sum, count) => sum + count, 0);
    
    for (const [key, count] of this.predictiveModel.entries()) {
      const probability = count / totalAccesses;
      this.predictiveModel.set(key, probability);
    }
  }

  private triggerPredictivePrefetch(key: string): void {
    // Find related keys based on patterns and prefetch them
    const relatedKeys = this.findRelatedKeys(key);
    
    for (const relatedKey of relatedKeys) {
      const probability = this.predictiveModel.get(relatedKey) || 0;
      if (probability > 0.3) { // Prefetch if access probability > 30%
        // This would trigger background prefetch of related items
        console.log(`🔮 Predictive prefetch triggered for: ${relatedKey}`);
      }
    }
  }

  private findRelatedKeys(key: string): string[] {
    // Simple pattern matching for related keys
    const relatedKeys: string[] = [];
    const keyParts = key.split(':');
    
    for (const cacheKey of this.memoryCache.keys()) {
      const cacheParts = cacheKey.split(':');
      
      // Check if keys share common parts
      if (keyParts.length > 1 && cacheParts.length > 1) {
        for (let i = 0; i < Math.min(keyParts.length, cacheParts.length) - 1; i++) {
          if (keyParts[i] === cacheParts[i]) {
            relatedKeys.push(cacheKey);
            break;
          }
        }
      }
    }
    
    return relatedKeys;
  }

  private async adaptiveCacheSizing(): Promise<void> {
    // Adjust cache sizes based on performance metrics
    const memoryHitRate = this.stats.memory.hitRate;
    const diskHitRate = this.stats.disk.hitRate;
    
    if (memoryHitRate < 0.7 && this.config.maxMemoryItems < 2000) {
      // Increase memory cache if hit rate is low
      this.config.maxMemoryItems = Math.min(2000, this.config.maxMemoryItems * 1.2);
      console.log(`📈 Adaptive sizing: Increased memory cache to ${this.config.maxMemoryItems} items`);
    } else if (memoryHitRate > 0.9 && this.config.maxMemoryItems > 500) {
      // Decrease memory cache if hit rate is high
      this.config.maxMemoryItems = Math.max(500, this.config.maxMemoryItems * 0.9);
      console.log(`📉 Adaptive sizing: Decreased memory cache to ${this.config.maxMemoryItems} items`);
    }
  }

  private async compressData(data: string): Promise<string> {
    // Simple compression placeholder - in production, use a proper compression library
    return data;
  }

  private async decompressData(data: string): Promise<string> {
    // Simple decompression placeholder - in production, use a proper compression library
    return data;
  }

  // Public API methods
  getStats(): CacheStats {
    return { ...this.stats };
  }

  getEventLog(limit: number = 100): CacheEvent[] {
    return this.eventLog.slice(-limit);
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  async updateConfig(newConfig: Partial<CacheConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    // Restart background tasks if needed
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.startBackgroundTasks();
    }
  }

  async getKeysByTag(tag: string): Promise<string[]> {
    const keys: string[] = [];
    
    // Check memory cache
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.tags?.includes(tag)) {
        keys.push(key);
      }
    }
    
    // Check disk cache
    for (const key of this.diskCacheKeys) {
      const item = await this.getFromDisk(key);
      if (item?.tags?.includes(tag)) {
        keys.push(key);
      }
    }
    
    return keys;
  }

  async invalidateByTag(tag: string): Promise<void> {
    const keys = await this.getKeysByTag(tag);
    
    for (const key of keys) {
      await this.delete(key);
    }
  }

  cleanup(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
  }
}

// Export singleton instance
export const advancedCache = AdvancedCacheManager.getInstance();

// Convenience functions
export const getCached = <T>(key: string): Promise<T | null> => {
  return advancedCache.get<T>(key);
};

export const setCached = <T>(key: string, value: T, options?: {
  ttl?: number;
  tags?: string[];
  metadata?: Record<string, any>;
}): Promise<void> => {
  return advancedCache.set(key, value, options);
};

export const deleteCached = (key: string): Promise<void> => {
  return advancedCache.delete(key);
};

export const clearCache = (tier?: CacheTier): Promise<void> => {
  return advancedCache.clear(tier);
};

export const getCacheStats = (): CacheStats => {
  return advancedCache.getStats();
};
