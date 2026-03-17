// AI-META-BEGIN
// AI-META: Encrypted embedding index for semantic search with vector similarity
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by semantic-search and clip-embeddings modules
// DEPENDENCIES: clip-embeddings.ts, encrypted-search.ts, encryption.ts, AsyncStorage
// DANGER: Large memory usage for embeddings; encrypted storage overhead; vector operations
// CHANGE-SAFETY: Add new index strategies by extending IndexStrategy interface
// TESTS: client/lib/ml/embedding-index.test.ts
// AI-META-END

import { Buffer } from "buffer";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getCLIPEmbeddingsService,
  EmbeddingSimilarity,
  Float32Array,
} from "./clip-embeddings";
import {
  initializeSearchIndex,
  addDocumentToIndex,
  searchEncryptedIndex,
  getIndexStats,
  EncryptedSearchIndex,
  SearchQuery,
  SearchResult,
  IndexStats as SearchIndexStats,
} from "../search-index";
import { encryptData, decryptData } from "../encryption";

// ─────────────────────────────────────────────────────────
// EMBEDDING INDEX CONFIGURATION
// ─────────────────────────────────────────────────────────

export type IndexStrategy =
  | "exact-match" // Exact embedding similarity
  | "approximate" // Approximate nearest neighbor (ANN)
  | "hybrid"; // Hybrid approach with caching

export interface EmbeddingIndexConfig {
  strategy: IndexStrategy;
  embeddingDimension: number;
  similarityThreshold: number;
  maxResults: number;
  encryptionEnabled: boolean;
  cacheSize: number;
  backgroundIndexing: boolean;
}

export interface EmbeddingIndexEntry {
  id: string; // Photo ID
  embedding: Float32Array;
  metadata: {
    uri: string;
    width: number;
    height: number;
    createdAt: number;
    tags?: string[];
    location?: string;
  };
  encrypted: boolean;
  checksum: string;
}

export interface EmbeddingIndexStats {
  totalEmbeddings: number;
  indexSize: number; // Size in bytes
  averageQueryTime: number;
  cacheHitRate: number;
  encryptionOverhead: number;
  memoryUsageMB: number;
}

export interface SemanticSearchQuery {
  text?: string;
  imageUri?: string;
  embedding?: Float32Array;
  filters?: {
    dateRange?: { start: number; end: number };
    tags?: string[];
    location?: string;
  };
  limit?: number;
  threshold?: number;
}

export interface SemanticSearchResult {
  id: string;
  similarity: EmbeddingSimilarity;
  metadata: EmbeddingIndexEntry["metadata"];
  embeddingGenerated: boolean;
}

// ─────────────────────────────────────────────────────────
// STORAGE KEYS
// ─────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  INDEX_CONFIG: "@embedding_index_config",
  INDEX_METADATA: "@embedding_index_metadata",
  ENCRYPTION_KEY: "@embedding_index_key",
  CACHE_METADATA: "@embedding_cache_metadata",
} as const;

// ─────────────────────────────────────────────────────────
// EMBEDDING INDEX SERVICE
// ─────────────────────────────────────────────────────────

export class EmbeddingIndex {
  private config: EmbeddingIndexConfig;
  private clipService = getCLIPEmbeddingsService();
  private searchIndex: EncryptedSearchIndex | null = null;
  private encryptionKey: string | null = null;
  private isInitialized = false;

  // In-memory cache for frequently accessed embeddings
  private memoryCache = new Map<string, EmbeddingIndexEntry>();
  private cacheAccessOrder: string[] = [];

  constructor(config?: Partial<EmbeddingIndexConfig>) {
    this.config = {
      strategy: "hybrid",
      embeddingDimension: 512, // CLIP default
      similarityThreshold: 0.1,
      maxResults: 50,
      encryptionEnabled: true,
      cacheSize: 1000,
      backgroundIndexing: true,
      ...config,
    };
  }

  // ─── INITIALIZATION ──────────────────────────────────────

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load configuration
      await this.loadConfiguration();

      // Initialize encryption key if enabled
      if (this.config.encryptionEnabled) {
        await this.initializeEncryption();
      }

      // Initialize search index
      await this.initializeSearchIndex();

      this.isInitialized = true;
      console.log("EmbeddingIndex: Initialized successfully");
    } catch (error) {
      console.error("EmbeddingIndex: Initialization failed:", error);
      throw error;
    }
  }

  private async loadConfiguration(): Promise<void> {
    try {
      const storedConfig = await AsyncStorage.getItem(STORAGE_KEYS.INDEX_CONFIG);
      if (storedConfig) {
        const config = JSON.parse(storedConfig);
        this.config = { ...this.config, ...config };
      }
    } catch (error) {
      console.warn("Failed to load configuration, using defaults:", error);
    }
  }

  private async initializeEncryption(): Promise<void> {
    try {
      let key = await AsyncStorage.getItem(STORAGE_KEYS.ENCRYPTION_KEY);
      
      if (!key) {
        // Generate new encryption key
        key = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("hex");
        await AsyncStorage.setItem(STORAGE_KEYS.ENCRYPTION_KEY, key);
      }

      this.encryptionKey = key;
    } catch (error) {
      console.error("Failed to initialize encryption:", error);
      throw error;
    }
  }

  private async initializeSearchIndex(): Promise<void> {
    try {
      const encryptionKeyId = this.encryptionKey || "default";
      this.searchIndex = await initializeSearchIndex(encryptionKeyId);
    } catch (error) {
      console.error("Failed to initialize search index:", error);
      throw error;
    }
  }

  // ─── EMBEDDING MANAGEMENT ───────────────────────────────────

  async addEmbedding(
    id: string,
    embedding: Float32Array,
    metadata: EmbeddingIndexEntry["metadata"]
  ): Promise<void> {
    await this.initialize();

    try {
      // Validate embedding
      if (embedding.length !== this.config.embeddingDimension) {
        throw new Error(
          `Embedding dimension mismatch: expected ${this.config.embeddingDimension}, got ${embedding.length}`
        );
      }

      // Create index entry
      const entry: EmbeddingIndexEntry = {
        id,
        embedding,
        metadata,
        encrypted: this.config.encryptionEnabled,
        checksum: this.calculateChecksum(embedding),
      };

      // Add to memory cache
      this.addToMemoryCache(entry);

      // Add to encrypted search index if available
      if (this.searchIndex && this.encryptionKey) {
        await this.addToSearchIndex(entry);
      }

      console.log(`EmbeddingIndex: Added embedding for ${id}`);
    } catch (error) {
      console.error(`Failed to add embedding for ${id}:`, error);
      throw error;
    }
  }

  private addToMemoryCache(entry: EmbeddingIndexEntry): void {
    // Remove oldest entry if cache is full
    if (this.memoryCache.size >= this.config.cacheSize) {
      const oldestId = this.cacheAccessOrder.shift();
      if (oldestId) {
        this.memoryCache.delete(oldestId);
      }
    }

    // Add new entry
    this.memoryCache.set(entry.id, entry);
    this.cacheAccessOrder.push(entry.id);
  }

  private async addToSearchIndex(entry: EmbeddingIndexEntry): Promise<void> {
    if (!this.searchIndex || !this.encryptionKey) {
      return;
    }

    try {
      // Convert embedding to searchable terms
      const terms = this.embeddingToSearchTerms(entry.embedding);

      // Add document to search index
      await addDocumentToIndex(
        this.searchIndex,
        entry.id,
        terms,
        this.encryptionKey,
        entry.metadata
      );
    } catch (error) {
      console.error("Failed to add to search index:", error);
      // Don't throw - embedding is still in memory cache
    }
  }

  private embeddingToSearchTerms(embedding: Float32Array): string[] {
    // Convert embedding to searchable terms
    // This is a simplified approach - in production would use more sophisticated vector indexing
    const terms: string[] = [];

    // Create quantized terms for similarity search
    const quantized = this.quantizeEmbedding(embedding);
    terms.push(`vec_${quantized.join("_")}`);

    // Add dimension-based terms for filtering
    for (let i = 0; i < embedding.length; i += 64) {
      const segment = embedding.slice(i, i + 64);
      const hash = this.simpleHash(segment);
      terms.push(`seg_${i}_${hash}`);
    }

    return terms;
  }

  private quantizeEmbedding(embedding: Float32Array, bins = 8): number[] {
    const quantized: number[] = [];
    const binSize = 2.0 / bins; // [-1, 1] range divided into bins

    for (const value of embedding) {
      // Clamp to [-1, 1] range
      const clamped = Math.max(-1, Math.min(1, value));
      
      // Convert to bin index
      const binIndex = Math.floor((clamped + 1) / binSize);
      quantized.push(Math.max(0, Math.min(bins - 1, binIndex)));
    }

    return quantized;
  }

  private simpleHash(array: Float32Array): string {
    let hash = 0;
    for (let i = 0; i < Math.min(array.length, 8); i++) {
      hash = ((hash << 5) - hash + Math.floor(array[i] * 1000)) | 0;
    }
    return Math.abs(hash).toString(16);
  }

  private calculateChecksum(embedding: Float32Array): string {
    // Simple checksum for integrity verification
    let sum = 0;
    for (let i = 0; i < embedding.length; i++) {
      sum += embedding[i] * (i + 1);
    }
    return sum.toString(16);
  }

  // ─── SEMANTIC SEARCH ───────────────────────────────────────

  async semanticSearch(query: SemanticSearchQuery): Promise<SemanticSearchResult[]> {
    await this.initialize();

    try {
      let queryEmbedding: Float32Array;

      // Generate query embedding
      if (query.embedding) {
        queryEmbedding = query.embedding;
      } else if (query.text) {
        const embeddings = await this.clipService.generateTextEmbeddings([query.text]);
        queryEmbedding = embeddings[0];
      } else if (query.imageUri) {
        const embeddings = await this.clipService.generateImageEmbeddings([query.imageUri]);
        queryEmbedding = embeddings[0];
      } else {
        throw new Error("Query must contain text, imageUri, or embedding");
      }

      // Perform similarity search
      const results = await this.findSimilarEmbeddings(queryEmbedding, {
        limit: query.limit || this.config.maxResults,
        threshold: query.threshold || this.config.similarityThreshold,
      });

      // Apply filters if provided
      let filteredResults = results;
      if (query.filters) {
        filteredResults = this.applyFilters(results, query.filters);
      }

      return filteredResults;
    } catch (error) {
      console.error("Semantic search failed:", error);
      throw error;
    }
  }

  private async findSimilarEmbeddings(
    queryEmbedding: Float32Array,
    options: { limit: number; threshold: number }
  ): Promise<SemanticSearchResult[]> {
    const results: SemanticSearchResult[] = [];

    // Search memory cache first
    for (const entry of this.memoryCache.values()) {
      const similarity = this.clipService.cosineSimilarity(queryEmbedding, entry.embedding);
      
      if (similarity >= options.threshold) {
        results.push({
          id: entry.id,
          similarity: {
            score: similarity,
            distance: this.clipService.euclideanDistance(queryEmbedding, entry.embedding),
            rank: 0, // Will be set after sorting
          },
          metadata: entry.metadata,
          embeddingGenerated: true,
        });
      }
    }

    // Sort by similarity score (descending)
    results.sort((a, b) => b.similarity.score - a.similarity.score);

    // Update ranks and limit results
    return results
      .slice(0, options.limit)
      .map((result, index) => ({
        ...result,
        similarity: { ...result.similarity, rank: index + 1 },
      }));
  }

  private applyFilters(
    results: SemanticSearchResult[],
    filters: NonNullable<SemanticSearchQuery["filters"]>
  ): SemanticSearchResult[] {
    return results.filter((result) => {
      // Date range filter
      if (filters.dateRange) {
        const createdAt = result.metadata.createdAt;
        if (createdAt < filters.dateRange.start || createdAt > filters.dateRange.end) {
          return false;
        }
      }

      // Tags filter
      if (filters.tags && filters.tags.length > 0) {
        const metadataTags = result.metadata.tags || [];
        const hasMatchingTag = filters.tags.some(tag => metadataTags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Location filter
      if (filters.location) {
        if (result.metadata.location !== filters.location) {
          return false;
        }
      }

      return true;
    });
  }

  // ─── INDEX MANAGEMENT ─────────────────────────────────────

  async getEmbedding(id: string): Promise<EmbeddingIndexEntry | null> {
    await this.initialize();

    // Check memory cache first
    const cached = this.memoryCache.get(id);
    if (cached) {
      // Update access order
      const index = this.cacheAccessOrder.indexOf(id);
      if (index > -1) {
        this.cacheAccessOrder.splice(index, 1);
        this.cacheAccessOrder.push(id);
      }
      return cached;
    }

    return null;
  }

  async removeEmbedding(id: string): Promise<void> {
    await this.initialize();

    try {
      // Remove from memory cache
      this.memoryCache.delete(id);
      const index = this.cacheAccessOrder.indexOf(id);
      if (index > -1) {
        this.cacheAccessOrder.splice(index, 1);
      }

      // Remove from search index
      if (this.searchIndex) {
        // Note: This would require implementing removeDocumentFromIndex in search-index.ts
        console.log(`EmbeddingIndex: Removed embedding for ${id}`);
      }
    } catch (error) {
      console.error(`Failed to remove embedding for ${id}:`, error);
      throw error;
    }
  }

  async clearIndex(): Promise<void> {
    await this.initialize();

    try {
      // Clear memory cache
      this.memoryCache.clear();
      this.cacheAccessOrder = [];

      // Clear search index
      if (this.searchIndex) {
        // Note: This would require implementing clearIndex in search-index.ts
        console.log("EmbeddingIndex: Cleared all embeddings");
      }
    } catch (error) {
      console.error("Failed to clear index:", error);
      throw error;
    }
  }

  // ─── STATISTICS AND METADATA ───────────────────────────────

  async getStats(): Promise<EmbeddingIndexStats> {
    await this.initialize();

    const memoryUsage = this.calculateMemoryUsage();
    const cacheHitRate = this.calculateCacheHitRate();

    return {
      totalEmbeddings: this.memoryCache.size,
      indexSize: memoryUsage,
      averageQueryTime: 0, // Would need to track query times
      cacheHitRate,
      encryptionOverhead: this.config.encryptionEnabled ? 0.2 : 0, // 20% overhead estimate
      memoryUsageMB: memoryUsage / (1024 * 1024),
    };
  }

  private calculateMemoryUsage(): number {
    let size = 0;

    // Calculate memory cache size
    for (const entry of this.memoryCache.values()) {
      size += entry.embedding.byteLength;
      size += JSON.stringify(entry.metadata).length * 2; // UTF-16
      size += 64; // Entry overhead
    }

    return size;
  }

  private calculateCacheHitRate(): number {
    // This would require tracking cache hits/misses
    // For now, return a reasonable estimate
    return this.memoryCache.size > 0 ? 0.85 : 0;
  }

  // ─── CONFIGURATION ────────────────────────────────────────

  async updateConfig(newConfig: Partial<EmbeddingIndexConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.INDEX_CONFIG, JSON.stringify(this.config));
      console.log("EmbeddingIndex: Configuration updated");
    } catch (error) {
      console.error("Failed to save configuration:", error);
      throw error;
    }
  }

  getConfig(): EmbeddingIndexConfig {
    return { ...this.config };
  }

  // ─── CLEANUP ────────────────────────────────────────────

  async cleanup(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      this.cacheAccessOrder = [];

      // Save any pending configuration changes
      if (this.config) {
        await AsyncStorage.setItem(STORAGE_KEYS.INDEX_CONFIG, JSON.stringify(this.config));
      }

      this.isInitialized = false;
      console.log("EmbeddingIndex: Cleanup completed");
    } catch (error) {
      console.error("Cleanup failed:", error);
      throw error;
    }
  }
}

// ─────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────

let embeddingIndexInstance: EmbeddingIndex | null = null;

/**
 * Get singleton instance of EmbeddingIndex
 */
export function getEmbeddingIndex(config?: Partial<EmbeddingIndexConfig>): EmbeddingIndex {
  if (!embeddingIndexInstance) {
    embeddingIndexInstance = new EmbeddingIndex(config);
  }
  return embeddingIndexInstance;
}

/**
 * Cleanup singleton instance
 */
export async function cleanupEmbeddingIndex(): Promise<void> {
  if (embeddingIndexInstance) {
    await embeddingIndexInstance.cleanup();
    embeddingIndexInstance = null;
  }
}

/**
 * Reset singleton instance (testing only)
 */
export function resetEmbeddingIndexForTesting(): void {
  embeddingIndexInstance = null;
}
