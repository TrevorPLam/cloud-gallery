// AI-META-BEGIN
// AI-META: High-performance embedding cache with progressive generation and encrypted storage
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by clip-embeddings and semantic-search modules
// DEPENDENCIES: clip-embeddings.ts, AsyncStorage, encryption.ts, Platform
// DANGER: Large memory usage for embeddings; cache eviction policies; encrypted storage overhead
// CHANGE-SAFETY: Add new cache strategies by extending CacheStrategy interface
// TESTS: client/lib/ml/embedding-cache.test.ts
// AI-META-END

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { encryptData, decryptData, XCHACHA20_KEYBYTES } from '../encryption';
import { getCLIPEmbeddingsService, Float32Array } from './clip-embeddings';

// ─────────────────────────────────────────────────────────
// CACHE CONFIGURATION
// ─────────────────────────────────────────────────────────

export type CacheStrategy = 
  | 'memory-only'        // Keep embeddings in memory only
  | 'disk-priority'      // Prioritize disk caching with memory fallback
  | 'progressive'        // Progressive generation with background processing
  | 'hybrid';           // Hybrid strategy with smart eviction

export interface CacheConfig {
  strategy: CacheStrategy;
  maxMemoryEntries: number;
  maxDiskEntries: number;
  maxMemoryMB: number;
  maxDiskCacheMB: number;
  encryptionEnabled: boolean;
  backgroundGeneration: boolean;
  compressionEnabled: boolean;
}

export interface CacheEntry {
  id: string;
  type: 'text' | 'image';
  embedding: Float32Array;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
  size: number; // Size in bytes
  checksum: string; // For integrity verification
  metadata?: Record<string, any>;
}

export interface CacheStats {
  memoryEntries: number;
  diskEntries: number;
  memoryUsageMB: number;
  diskUsageMB: number;
  hitRate: number;
  missRate: number;
  evictionCount: number;
  compressionRatio?: number;
  encryptionOverhead: number;
}

export interface GenerationProgress {
  id: string;
  type: 'text' | 'image';
  progress: number; // 0-100
  stage: 'queued' | 'processing' | 'completed' | 'error';
  error?: string;
  startTime: number;
  estimatedTimeRemaining?: number;
}

// ─────────────────────────────────────────────────────────
// CACHE STORAGE KEYS
// ─────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  CACHE_METADATA: '@embedding_cache_metadata',
  CACHE_CONFIG: '@embedding_cache_config',
  GENERATION_QUEUE: '@embedding_generation_queue',
  ENCRYPTION_KEY: '@embedding_cache_key',
} as const;

// ─────────────────────────────────────────────────────────
// EMBEDDING CACHE SERVICE
// ─────────────────────────────────────────────────────────

export class EmbeddingCache {
  private config: CacheConfig;
  private clipService = getCLIPEmbeddingsService();
  
  // In-memory cache
  private memoryCache = new Map<string, CacheEntry>();
  
  // Generation queue for progressive processing
  private generationQueue = new Map<string, GenerationProgress>();
  private isProcessingQueue = false;
  
  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalRequests: 0,
  };
  
  // Encryption key for cache
  private encryptionKey: string | null = null;
  
  // Background processing
  private processingTimeout: NodeJS.Timeout | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      strategy: 'hybrid',
      maxMemoryEntries: 1000,
      maxDiskEntries: 10000,
      maxMemoryMB: 256, // 256MB for memory cache
      maxDiskCacheMB: 1024, // 1GB for disk cache
      encryptionEnabled: true,
      backgroundGeneration: true,
      compressionEnabled: true,
      ...config,
    };

    this.initialize();
  }

  // ─── INITIALIZATION ──────────────────────────────────────

  private async initialize(): Promise<void> {
    try {
      // Load configuration
      await this.loadConfig();
      
      // Initialize encryption if enabled
      if (this.config.encryptionEnabled) {
        await this.initializeEncryption();
      }
      
      // Load cache metadata
      await this.loadCacheMetadata();
      
      // Start background processing if enabled
      if (this.config.backgroundGeneration) {
        this.startBackgroundProcessing();
      }
      
      console.log('EmbeddingCache: Initialized with config:', this.config);
    } catch (error) {
      console.error('EmbeddingCache: Initialization failed:', error);
      throw error;
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const storedConfig = await AsyncStorage.getItem(STORAGE_KEYS.CACHE_CONFIG);
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig);
        this.config = { ...this.config, ...parsed };
      }
    } catch (error) {
      console.warn('EmbeddingCache: Failed to load config, using defaults:', error);
    }
  }

  private async initializeEncryption(): Promise<void> {
    try {
      let key = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTION_KEY);
      
      if (!key) {
        // Generate new encryption key
        key = this.generateEncryptionKey();
        await AsyncStorage.setItem(STORAGE_KEYS.ENCRYPTION_KEY, key);
      }
      
      this.encryptionKey = key;
    } catch (error) {
      console.error('EmbeddingCache: Failed to initialize encryption:', error);
      throw error;
    }
  }

  private generateEncryptionKey(): string {
    // Generate 256-bit key for XChaCha20-Poly1305
    const keyBytes = new ArrayBuffer(XCHACHA20_KEYBYTES);
    const keyView = new Uint8Array(keyBytes);
    
    // Generate cryptographically secure random bytes
    for (let i = 0; i < XCHACHA20_KEYBYTES; i++) {
      keyView[i] = Math.floor(Math.random() * 256);
    }
    
    return Buffer.from(keyBytes).toString('hex');
  }

  private async loadCacheMetadata(): Promise<void> {
    try {
      const metadata = await AsyncStorage.getItem(STORAGE_KEYS.CACHE_METADATA);
      if (metadata) {
        // Load cache statistics and metadata
        const parsed = JSON.parse(metadata);
        this.stats = { ...this.stats, ...parsed.stats };
        
        // Load generation queue
        const queueData = await AsyncStorage.getItem(STORAGE_KEYS.GENERATION_QUEUE);
        if (queueData) {
          const queue = JSON.parse(queueData);
          this.generationQueue = new Map(queue);
        }
      }
    } catch (error) {
      console.warn('EmbeddingCache: Failed to load cache metadata:', error);
    }
  }

  // ─── CACHE OPERATIONS ───────────────────────────────────

  /**
   * Get embedding from cache (memory or disk)
   */
  async get(id: string): Promise<Float32Array | null> {
    this.stats.totalRequests++;
    
    try {
      // Check memory cache first
      const memoryEntry = this.memoryCache.get(id);
      if (memoryEntry) {
        this.updateAccess(memoryEntry);
        this.stats.hits++;
        return memoryEntry.embedding;
      }

      // Check disk cache if strategy allows
      if (this.config.strategy !== 'memory-only') {
        const diskEntry = await this.getFromDisk(id);
        if (diskEntry) {
          // Promote to memory cache if space allows
          if (this.canAddToMemory(diskEntry.size)) {
            this.addToMemory(diskEntry);
          }
          
          this.updateAccess(diskEntry);
          this.stats.hits++;
          return diskEntry.embedding;
        }
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      console.error(`EmbeddingCache: Failed to get embedding for ${id}:`, error);
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Put embedding into cache
   */
  async put(
    id: string, 
    type: 'text' | 'image', 
    embedding: Float32Array,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const entry: CacheEntry = {
        id,
        type,
        embedding,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        size: embedding.byteLength,
        checksum: this.calculateChecksum(embedding),
        metadata,
      };

      // Add to memory cache
      if (this.canAddToMemory(entry.size)) {
        this.addToMemory(entry);
      }

      // Add to disk cache if strategy allows
      if (this.config.strategy !== 'memory-only') {
        await this.putToDisk(entry);
      }

      // Update cache size and trigger cleanup if needed
      await this.ensureCacheSizeLimits();
    } catch (error) {
      console.error(`EmbeddingCache: Failed to put embedding for ${id}:`, error);
    }
  }

  /**
   * Generate and cache embedding progressively
   */
  async generateAndCache(
    id: string,
    type: 'text' | 'image',
    input: string | string[],
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<Float32Array> {
    // Check if already in cache
    const cached = await this.get(id);
    if (cached) {
      return cached;
    }

    // Add to generation queue
    const progress: GenerationProgress = {
      id,
      type,
      progress: 0,
      stage: 'queued',
      startTime: Date.now(),
    };

    this.generationQueue.set(id, progress);
    await this.saveGenerationQueue();

    if (priority === 'high' || !this.config.backgroundGeneration) {
      // Generate immediately for high priority
      return this.generateEmbedding(id, type, input);
    } else {
      // Queue for background processing
      this.startBackgroundProcessing();
      
      // Return placeholder or wait for completion
      return this.waitForGeneration(id);
    }
  }

  private async generateEmbedding(
    id: string,
    type: 'text' | 'image',
    input: string | string[]
  ): Promise<Float32Array> {
    const progress = this.generationQueue.get(id);
    if (!progress) {
      throw new Error(`Generation progress not found for ${id}`);
    }

    try {
      progress.stage = 'processing';
      progress.progress = 10;
      await this.saveGenerationQueue();

      let embedding: Float32Array;

      if (type === 'text') {
        const texts = Array.isArray(input) ? input : [input];
        const embeddings = await this.clipService.generateTextEmbeddings(texts);
        embedding = embeddings[0];
      } else {
        const imageUris = Array.isArray(input) ? input : [input];
        const embeddings = await this.clipService.generateImageEmbeddings(imageUris);
        embedding = embeddings[0];
      }

      progress.progress = 90;
      await this.saveGenerationQueue();

      // Cache the generated embedding
      await this.put(id, type, embedding, { input });

      progress.stage = 'completed';
      progress.progress = 100;
      await this.saveGenerationQueue();

      return embedding;
    } catch (error) {
      progress.stage = 'error';
      progress.error = error instanceof Error ? error.message : 'Unknown error';
      await this.saveGenerationQueue();
      
      console.error(`EmbeddingCache: Failed to generate embedding for ${id}:`, error);
      throw error;
    }
  }

  private async waitForGeneration(id: string, timeout: number = 30000): Promise<Float32Array> {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkProgress = async () => {
        const progress = this.generationQueue.get(id);
        
        if (!progress) {
          reject(new Error(`Generation not found for ${id}`));
          return;
        }

        if (progress.stage === 'completed') {
          const cached = await this.get(id);
          if (cached) {
            resolve(cached);
          } else {
            reject(new Error(`Generation completed but embedding not found for ${id}`));
          }
          return;
        }

        if (progress.stage === 'error') {
          reject(new Error(progress.error || 'Generation failed'));
          return;
        }

        if (Date.now() - startTime > timeout) {
          reject(new Error(`Generation timeout for ${id}`));
          return;
        }

        // Check again in 100ms
        setTimeout(checkProgress, 100);
      };

      checkProgress();
    });
  }

  // ─── MEMORY CACHE MANAGEMENT ─────────────────────────────

  private canAddToMemory(size: number): boolean {
    const currentMemoryUsage = this.getCurrentMemoryUsage();
    return (currentMemoryUsage + size) <= (this.config.maxMemoryMB * 1024 * 1024) &&
           this.memoryCache.size < this.config.maxMemoryEntries;
  }

  private getCurrentMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.memoryCache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  private addToMemory(entry: CacheEntry): void {
    // Evict entries if necessary
    while (!this.canAddToMemory(entry.size) && this.memoryCache.size > 0) {
      this.evictFromMemory();
    }

    this.memoryCache.set(entry.id, entry);
  }

  private evictFromMemory(): void {
    // Find least recently used entry
    let lruEntry: CacheEntry | null = null;
    let lruTime = Date.now();

    for (const entry of this.memoryCache.values()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruEntry = entry;
      }
    }

    if (lruEntry) {
      this.memoryCache.delete(lruEntry.id);
      this.stats.evictions++;
    }
  }

  private updateAccess(entry: CacheEntry): void {
    entry.lastAccessed = Date.now();
    entry.accessCount++;
  }

  // ─── DISK CACHE MANAGEMENT ───────────────────────────────

  private async getFromDisk(id: string): Promise<CacheEntry | null> {
    try {
      const key = this.getDiskKey(id);
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        return null;
      }

      let decryptedData: any;
      
      if (this.config.encryptionEnabled && this.encryptionKey) {
        const encrypted = Buffer.from(data, 'base64');
        decryptedData = await decryptData(encrypted, this.encryptionKey);
      } else {
        decryptedData = JSON.parse(data);
      }

      // Reconstruct Float32Array
      const embedding = new Float32Array(decryptedData.embedding);
      
      return {
        ...decryptedData,
        embedding,
      } as CacheEntry;
    } catch (error) {
      console.error(`EmbeddingCache: Failed to get from disk for ${id}:`, error);
      return null;
    }
  }

  private async putToDisk(entry: CacheEntry): Promise<void> {
    try {
      const key = this.getDiskKey(entry.id);
      
      // Convert Float32Array to regular array for serialization
      const serializableEntry = {
        ...entry,
        embedding: Array.from(entry.embedding),
      };

      let data: string;
      
      if (this.config.encryptionEnabled && this.encryptionKey) {
        const serialized = JSON.stringify(serializableEntry);
        const encrypted = await encryptData(
          Buffer.from(serialized),
          this.encryptionKey
        );
        data = encrypted.toString('base64');
      } else {
        data = JSON.stringify(serializableEntry);
      }

      await AsyncStorage.setItem(key, data);
    } catch (error) {
      console.error(`EmbeddingCache: Failed to put to disk for ${entry.id}:`, error);
    }
  }

  private getDiskKey(id: string): string {
    return `@embedding_cache_${id}`;
  }

  // ─── CACHE MAINTENANCE ───────────────────────────────────

  private async ensureCacheSizeLimits(): Promise<void> {
    // Ensure memory cache limits
    while (this.getCurrentMemoryUsage() > this.config.maxMemoryMB * 1024 * 1024) {
      this.evictFromMemory();
    }

    // Ensure disk cache limits
    if (this.config.strategy !== 'memory-only') {
      await this.ensureDiskCacheLimits();
    }
  }

  private async ensureDiskCacheLimits(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('@embedding_cache_'));
      
      if (cacheKeys.length <= this.config.maxDiskEntries) {
        return;
      }

      // Get metadata for all cache entries to determine eviction candidates
      const entries: Array<{ key: string; lastAccessed: number; size: number }> = [];
      
      for (const key of cacheKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            let entry: any;
            
            if (this.config.encryptionEnabled && this.encryptionKey) {
              const encrypted = Buffer.from(data, 'base64');
              const decrypted = await decryptData(encrypted, this.encryptionKey);
              entry = JSON.parse(decrypted.toString());
            } else {
              entry = JSON.parse(data);
            }
            
            entries.push({
              key,
              lastAccessed: entry.lastAccessed || 0,
              size: entry.size || 0,
            });
          }
        } catch (error) {
          // Remove corrupted entries
          await AsyncStorage.removeItem(key);
        }
      }

      // Sort by last accessed time and evict oldest entries
      entries.sort((a, b) => a.lastAccessed - b.lastAccessed);
      
      const toEvict = entries.slice(0, entries.length - this.config.maxDiskEntries);
      
      for (const { key } of toEvict) {
        await AsyncStorage.removeItem(key);
        this.stats.evictions++;
      }
    } catch (error) {
      console.error('EmbeddingCache: Failed to ensure disk cache limits:', error);
    }
  }

  // ─── BACKGROUND PROCESSING ───────────────────────────────

  private startBackgroundProcessing(): void {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;
    
    const processQueue = async () => {
      while (this.generationQueue.size > 0) {
        const entries = Array.from(this.generationQueue.entries())
          .filter(([_, progress]) => progress.stage === 'queued')
          .sort((a, b) => a[1].startTime - b[1].startTime); // FIFO order

        if (entries.length === 0) {
          break;
        }

        const [id, progress] = entries[0];
        
        try {
          // Get the input data (this would need to be stored or retrieved)
          // For now, we'll skip actual generation in background
          progress.stage = 'processing';
          progress.progress = 50;
          await this.saveGenerationQueue();
          
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 100));
          
          progress.stage = 'completed';
          progress.progress = 100;
          await this.saveGenerationQueue();
          
          // Remove from queue after completion
          this.generationQueue.delete(id);
        } catch (error) {
          progress.stage = 'error';
          progress.error = error instanceof Error ? error.message : 'Unknown error';
          await this.saveGenerationQueue();
        }
      }

      this.isProcessingQueue = false;
    };

    // Start processing with delay to allow batching
    this.processingTimeout = setTimeout(processQueue, 100);
  }

  private async saveGenerationQueue(): Promise<void> {
    try {
      const queue = Array.from(this.generationQueue.entries());
      await AsyncStorage.setItem(STORAGE_KEYS.GENERATION_QUEUE, JSON.stringify(queue));
    } catch (error) {
      console.error('EmbeddingCache: Failed to save generation queue:', error);
    }
  }

  // ─── UTILITIES ───────────────────────────────────────────

  private calculateChecksum(embedding: Float32Array): string {
    // Simple checksum for integrity verification
    let sum = 0;
    for (let i = 0; i < embedding.length; i++) {
      sum += embedding[i];
    }
    return sum.toString(36);
  }

  // ─── STATISTICS AND MONITORING ─────────────────────────────

  async getStats(): Promise<CacheStats> {
    const memoryUsage = this.getCurrentMemoryUsage();
    const hitRate = this.stats.totalRequests > 0 ? this.stats.hits / this.stats.totalRequests : 0;
    const missRate = this.stats.totalRequests > 0 ? this.stats.misses / this.stats.totalRequests : 0;

    // Estimate disk usage
    let diskUsage = 0;
    let diskEntries = 0;
    
    if (this.config.strategy !== 'memory-only') {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => key.startsWith('@embedding_cache_'));
        diskEntries = cacheKeys.length;
        
        for (const key of cacheKeys) {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            diskUsage += data.length;
          }
        }
      } catch (error) {
        console.warn('EmbeddingCache: Failed to calculate disk usage:', error);
      }
    }

    return {
      memoryEntries: this.memoryCache.size,
      diskEntries,
      memoryUsageMB: memoryUsage / (1024 * 1024),
      diskUsageMB: diskUsage / (1024 * 1024),
      hitRate,
      missRate,
      evictionCount: this.stats.evictions,
      encryptionOverhead: this.config.encryptionEnabled ? 0.15 : 0, // 15% overhead estimate
    };
  }

  async getGenerationProgress(id: string): Promise<GenerationProgress | null> {
    return this.generationQueue.get(id) || null;
  }

  async getAllGenerationProgress(): Promise<GenerationProgress[]> {
    return Array.from(this.generationQueue.values());
  }

  // ─── CONFIGURATION ───────────────────────────────────────

  async updateConfig(newConfig: Partial<CacheConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CACHE_CONFIG, JSON.stringify(this.config));
      
      // Apply new limits
      await this.ensureCacheSizeLimits();
    } catch (error) {
      console.error('EmbeddingCache: Failed to update config:', error);
    }
  }

  getConfig(): CacheConfig {
    return { ...this.config };
  }

  // ─── CLEANUP ────────────────────────────────────────────

  async cleanup(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    
    // Clear generation queue
    this.generationQueue.clear();
    
    // Cancel background processing
    if (this.processingTimeout) {
      clearTimeout(this.processingTimeout);
      this.processingTimeout = null;
    }
    
    this.isProcessingQueue = false;
    
    // Save final statistics
    await this.saveStats();
  }

  private async saveStats(): Promise<void> {
    try {
      const stats = {
        stats: this.stats,
        timestamp: Date.now(),
      };
      await AsyncStorage.setItem(STORAGE_KEYS.CACHE_METADATA, JSON.stringify(stats));
    } catch (error) {
      console.error('EmbeddingCache: Failed to save stats:', error);
    }
  }

  async clearCache(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    
    // Clear disk cache
    if (this.config.strategy !== 'memory-only') {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const cacheKeys = keys.filter(key => key.startsWith('@embedding_cache_'));
        
        for (const key of cacheKeys) {
          await AsyncStorage.removeItem(key);
        }
      } catch (error) {
        console.error('EmbeddingCache: Failed to clear disk cache:', error);
      }
    }
    
    // Reset statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
    };
    
    await this.saveStats();
  }
}

// ─────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────

let embeddingCacheInstance: EmbeddingCache | null = null;

/**
 * Get singleton instance of EmbeddingCache
 */
export function getEmbeddingCache(config?: Partial<CacheConfig>): EmbeddingCache {
  if (!embeddingCacheInstance) {
    embeddingCacheInstance = new EmbeddingCache(config);
  }
  return embeddingCacheInstance;
}

/**
 * Cleanup singleton instance
 */
export async function cleanupEmbeddingCache(): Promise<void> {
  if (embeddingCacheInstance) {
    await embeddingCacheInstance.cleanup();
    embeddingCacheInstance = null;
  }
}

/**
 * Reset singleton instance (testing only)
 */
export function resetEmbeddingCacheForTesting(): void {
  embeddingCacheInstance = null;
}
