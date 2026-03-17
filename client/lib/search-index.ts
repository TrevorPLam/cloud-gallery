// Encrypted Search Index implementation using inverted index pattern
// Provides privacy-preserving search index construction and management

import { Buffer } from "buffer";
import sodium from "@s77rt/react-native-sodium";
import {
  EncryptedSearchTerm,
  SearchIndexEntry,
  SearchTokenType,
  initializeSSE,
  encryptSearchTerm,
  decryptSearchTerm,
  generateTokenId,
  secureWipeSSE,
} from "./encrypted-search";

// Index configuration constants
export const INDEX_VERSION = "1.0.0";
export const MAX_INDEX_SIZE = 1000000; // 1M entries max
export const INDEX_COMPRESSION_THRESHOLD = 10000; // Compress after 10k entries
export const INDEX_CACHE_SIZE = 1000; // Cache 1k recent entries

// Index metadata
export interface IndexMetadata {
  version: string;
  createdAt: number;
  lastUpdated: number;
  totalEntries: number;
  totalTerms: number;
  indexSize: number; // Size in bytes
  compressionEnabled: boolean;
  encryptionKeyId: string; // Reference to encryption key
}

// Inverted index entry (encrypted)
export interface InvertedIndexEntry {
  encryptedTerm: string; // Base64 encoded encrypted search term
  documentIds: string[]; // List of document IDs containing this term
  termFrequency: Record<string, number>; // Frequency per document
  lastAccessed: number; // For cache management
  accessCount: number; // Access frequency tracking
}

// Search index interface
export interface EncryptedSearchIndex {
  metadata: IndexMetadata;
  invertedIndex: Map<string, InvertedIndexEntry>; // Map from encrypted term to index entry
  documentIndex: Map<string, SearchIndexEntry>; // Map from document ID to index entry
  termCache: Map<string, EncryptedSearchTerm>; // Cache of recently used terms
}

// Index statistics
export interface IndexStats {
  totalDocuments: number;
  totalTerms: number;
  averageTermsPerDocument: number;
  indexSize: number; // Size in bytes
  cacheHitRate: number;
  mostAccessedTerms: string[]; // Top 10 most accessed terms
  indexCompressionRatio?: number;
}

// Search result interface
export interface SearchResult {
  documentId: string;
  relevanceScore: number; // 0.0 to 1.0
  matchedTerms: string[]; // Encrypted terms that matched
  termPositions?: Record<string, number[]>; // Positions of terms in document
  metadata?: Record<string, any>; // Additional document metadata
}

// Search query interface
export interface SearchQuery {
  encryptedTerms: string[]; // Encrypted search terms
  operators?: string[]; // Boolean operators (AND, OR, NOT)
  filters?: SearchFilter; // Additional filters (date, location, etc.)
  limit?: number;
  offset?: number;
}

// Search filter interface
export interface SearchFilter {
  dateRange?: {
    start: number;
    end: number;
  };
  location?: {
    latitude: number;
    longitude: number;
    radius: number; // in meters
  };
  tags?: string[];
  mediaType?: string[];
}

/**
 * Initialize encrypted search index
 * @param encryptionKeyId - Reference to encryption key
 * @returns New encrypted search index
 */
export async function initializeSearchIndex(
  encryptionKeyId: string,
): Promise<EncryptedSearchIndex> {
  await initializeSSE();

  const now = Date.now();
  const metadata: IndexMetadata = {
    version: INDEX_VERSION,
    createdAt: now,
    lastUpdated: now,
    totalEntries: 0,
    totalTerms: 0,
    indexSize: 0,
    compressionEnabled: false,
    encryptionKeyId,
  };

  return {
    metadata,
    invertedIndex: new Map(),
    documentIndex: new Map(),
    termCache: new Map(),
  };
}

/**
 * Add document to encrypted search index
 * @param index - Search index to update
 * @param documentId - Unique document identifier
 * @param terms - List of plain text terms to index
 * @param sseKey - SSE encryption key
 * @param metadata - Optional document metadata
 */
export async function addDocumentToIndex(
  index: EncryptedSearchIndex,
  documentId: string,
  terms: string[],
  sseKey: string,
  metadata?: Record<string, any>,
): Promise<void> {
  try {
    // Validate inputs
    if (!documentId || !terms || !sseKey) {
      throw new Error("Invalid inputs for document indexing");
    }

    if (index.documentIndex.has(documentId)) {
      throw new Error(`Document ${documentId} already exists in index`);
    }

    if (index.metadata.totalEntries >= MAX_INDEX_SIZE) {
      throw new Error("Index size limit reached");
    }

    // Encrypt and process each term
    const encryptedTerms: EncryptedSearchTerm[] = [];
    const termFrequencies: Record<string, number> = {};

    for (const term of terms) {
      if (!term || term.trim().length === 0) continue;

      const encryptedTerm = encryptSearchTerm(
        term.trim(),
        sseKey,
        SearchTokenType.EXACT,
      );
      encryptedTerms.push(encryptedTerm);

      // Update term frequencies
      const termKey = encryptedTerm.encryptedTerm;
      termFrequencies[termKey] = (termFrequencies[termKey] || 0) + 1;

      // Update inverted index
      if (!index.invertedIndex.has(termKey)) {
        index.invertedIndex.set(termKey, {
          encryptedTerm: termKey,
          documentIds: [],
          termFrequency: {},
          lastAccessed: Date.now(),
          accessCount: 0,
        });
        index.metadata.totalTerms++;
      }

      const indexEntry = index.invertedIndex.get(termKey)!;

      // Add document ID if not already present
      if (!indexEntry.documentIds.includes(documentId)) {
        indexEntry.documentIds.push(documentId);
      }

      // Update term frequency for this document
      indexEntry.termFrequency[documentId] = termFrequencies[termKey];

      // Update access statistics
      indexEntry.lastAccessed = Date.now();
      indexEntry.accessCount++;

      // Cache the encrypted term
      if (index.termCache.size < INDEX_CACHE_SIZE) {
        index.termCache.set(termKey, encryptedTerm);
      }
    }

    // Create document index entry
    const documentEntry: SearchIndexEntry = {
      documentId,
      encryptedTerms,
      termFrequencies,
      location: metadata?.location || "",
      timestamp: Date.now(),
    };

    index.documentIndex.set(documentId, documentEntry);
    index.metadata.totalEntries++;
    index.metadata.lastUpdated = Date.now();

    // Update index size estimate
    index.metadata.indexSize = estimateIndexSize(index);

    // Check if compression is needed
    if (
      index.metadata.totalEntries >= INDEX_COMPRESSION_THRESHOLD &&
      !index.metadata.compressionEnabled
    ) {
      index.metadata.compressionEnabled = true;
      console.log("Index compression enabled due to size threshold");
    }
  } catch (error) {
    console.error("Failed to add document to index:", error);
    throw error;
  }
}

/**
 * Remove document from encrypted search index
 * @param index - Search index to update
 * @param documentId - Document identifier to remove
 */
export async function removeDocumentFromIndex(
  index: EncryptedSearchIndex,
  documentId: string,
): Promise<void> {
  try {
    const documentEntry = index.documentIndex.get(documentId);
    if (!documentEntry) {
      return; // Document not found, nothing to remove
    }

    // Remove from inverted index
    for (const encryptedTerm of documentEntry.encryptedTerms) {
      const termKey = encryptedTerm.encryptedTerm;
      const indexEntry = index.invertedIndex.get(termKey);

      if (indexEntry) {
        // Remove document ID from the list
        indexEntry.documentIds = indexEntry.documentIds.filter(
          (id) => id !== documentId,
        );
        delete indexEntry.termFrequency[documentId];

        // Remove index entry if no documents remain
        if (indexEntry.documentIds.length === 0) {
          index.invertedIndex.delete(termKey);
          index.metadata.totalTerms--;
          index.termCache.delete(termKey);
        }
      }
    }

    // Remove from document index
    index.documentIndex.delete(documentId);
    index.metadata.totalEntries--;
    index.metadata.lastUpdated = Date.now();

    // Update index size
    index.metadata.indexSize = estimateIndexSize(index);
  } catch (error) {
    console.error("Failed to remove document from index:", error);
    throw error;
  }
}

/**
 * Search encrypted index using encrypted search terms
 * @param index - Search index to query
 * @param encryptedTerms - List of encrypted search terms
 * @param query - Search query configuration
 * @returns Search results
 */
export async function searchEncryptedIndex(
  index: EncryptedSearchIndex,
  encryptedTerms: string[],
  query: SearchQuery,
): Promise<SearchResult[]> {
  try {
    const results: SearchResult[] = [];
    const documentScores: Map<string, number> = new Map();
    const documentMatches: Map<string, string[]> = new Map();

    // Process each encrypted term
    for (const encryptedTerm of encryptedTerms) {
      const indexEntry = index.invertedIndex.get(encryptedTerm);

      if (!indexEntry) {
        continue; // Term not found in index
      }

      // Update access statistics
      indexEntry.lastAccessed = Date.now();
      indexEntry.accessCount++;

      // Calculate relevance scores for matching documents
      for (const documentId of indexEntry.documentIds) {
        const termFrequency = indexEntry.termFrequency[documentId] || 0;
        const documentEntry = index.documentIndex.get(documentId);

        if (!documentEntry) continue;

        // Calculate TF-IDF style relevance score
        const totalTermsInDoc = documentEntry.encryptedTerms.length;
        const tf = termFrequency / totalTermsInDoc; // Term frequency
        const idf = Math.log(
          index.metadata.totalEntries / indexEntry.documentIds.length,
        ); // Inverse document frequency
        const relevanceScore = tf * idf;

        // Update document score
        const currentScore = documentScores.get(documentId) || 0;
        documentScores.set(documentId, currentScore + relevanceScore);

        // Track matched terms
        const matches = documentMatches.get(documentId) || [];
        matches.push(encryptedTerm);
        documentMatches.set(documentId, matches);
      }
    }

    // Convert to search results
    for (const [documentId, score] of documentScores.entries()) {
      const documentEntry = index.documentIndex.get(documentId);
      if (!documentEntry) continue;

      // Normalize score to 0-1 range
      const normalizedScore = Math.min(score / encryptedTerms.length, 1.0);

      const result: SearchResult = {
        documentId,
        relevanceScore: normalizedScore,
        matchedTerms: documentMatches.get(documentId) || [],
      };

      results.push(result);
    }

    // Sort by relevance score (descending)
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Apply pagination
    const limit = query.limit || 20;
    const offset = query.offset || 0;
    return results.slice(offset, offset + limit);
  } catch (error) {
    console.error("Encrypted index search failed:", error);
    throw error;
  }
}

/**
 * Get index statistics
 * @param index - Search index to analyze
 * @returns Index statistics
 */
export function getIndexStats(index: EncryptedSearchIndex): IndexStats {
  try {
    const totalDocuments = index.metadata.totalEntries;
    const totalTerms = index.metadata.totalTerms;
    const averageTermsPerDocument =
      totalDocuments > 0 ? totalTerms / totalDocuments : 0;

    // Calculate cache hit rate (simplified)
    const cacheHitRate =
      index.termCache.size > 0 ? (index.termCache.size / totalTerms) * 100 : 0;

    // Find most accessed terms
    const mostAccessedTerms = Array.from(index.invertedIndex.entries())
      .sort((a, b) => b[1].accessCount - a[1].accessCount)
      .slice(0, 10)
      .map(([term]) => term);

    return {
      totalDocuments,
      totalTerms,
      averageTermsPerDocument,
      indexSize: index.metadata.indexSize,
      cacheHitRate,
      mostAccessedTerms,
    };
  } catch (error) {
    console.error("Failed to get index stats:", error);
    throw error;
  }
}

/**
 * Estimate index size in bytes
 * @param index - Search index to estimate
 * @returns Estimated size in bytes
 */
function estimateIndexSize(index: EncryptedSearchIndex): number {
  try {
    let size = 0;

    // Estimate inverted index size
    for (const [term, entry] of index.invertedIndex.entries()) {
      size += term.length * 2; // Term string (UTF-16)
      size += entry.documentIds.length * 36; // UUID strings
      size += Object.keys(entry.termFrequency).length * 40; // Frequency map
      size += 16; // Metadata overhead
    }

    // Estimate document index size
    for (const [docId, entry] of index.documentIndex.entries()) {
      size += docId.length * 2; // Document ID
      size += entry.encryptedTerms.length * 100; // Encrypted terms
      size += Object.keys(entry.termFrequencies).length * 40; // Frequency map
      size += 32; // Metadata overhead
    }

    // Add cache size
    size += index.termCache.size * 150; // Average cache entry size

    return size;
  } catch (error) {
    console.error("Failed to estimate index size:", error);
    return 0;
  }
}

/**
 * Optimize index for better performance
 * @param index - Search index to optimize
 */
export async function optimizeIndex(
  index: EncryptedSearchIndex,
): Promise<void> {
  try {
    console.log("Starting index optimization...");

    // Remove empty entries
    for (const [term, entry] of index.invertedIndex.entries()) {
      if (entry.documentIds.length === 0) {
        index.invertedIndex.delete(term);
        index.metadata.totalTerms--;
      }
    }

    // Sort document IDs for better compression
    for (const entry of index.invertedIndex.values()) {
      entry.documentIds.sort();
    }

    // Clear cache if it's too large
    if (index.termCache.size > INDEX_CACHE_SIZE) {
      // Keep most recently accessed terms
      const sortedEntries = Array.from(index.termCache.entries()).sort(
        (a, b) => {
          const entryA = index.invertedIndex.get(a[0]);
          const entryB = index.invertedIndex.get(b[0]);
          return (entryB?.lastAccessed || 0) - (entryA?.lastAccessed || 0);
        },
      );

      index.termCache.clear();

      // Keep top entries
      for (let i = 0; i < INDEX_CACHE_SIZE && i < sortedEntries.length; i++) {
        index.termCache.set(sortedEntries[i][0], sortedEntries[i][1]);
      }
    }

    // Update metadata
    index.metadata.lastUpdated = Date.now();
    index.metadata.indexSize = estimateIndexSize(index);

    console.log("Index optimization completed");
  } catch (error) {
    console.error("Index optimization failed:", error);
    throw error;
  }
}

/**
 * Serialize index to JSON for storage
 * @param index - Search index to serialize
 * @returns Serialized index data
 */
export function serializeIndex(index: EncryptedSearchIndex): string {
  try {
    const serialized = {
      metadata: index.metadata,
      invertedIndex: Array.from(index.invertedIndex.entries()),
      documentIndex: Array.from(index.documentIndex.entries()),
      termCache: Array.from(index.termCache.entries()),
    };

    return JSON.stringify(serialized);
  } catch (error) {
    console.error("Index serialization failed:", error);
    throw error;
  }
}

/**
 * Deserialize index from JSON
 * @param serializedData - Serialized index data
 * @returns Deserialized search index
 */
export function deserializeIndex(serializedData: string): EncryptedSearchIndex {
  try {
    const parsed = JSON.parse(serializedData);

    return {
      metadata: parsed.metadata,
      invertedIndex: new Map(parsed.invertedIndex),
      documentIndex: new Map(parsed.documentIndex),
      termCache: new Map(parsed.termCache),
    };
  } catch (error) {
    console.error("Index deserialization failed:", error);
    throw error;
  }
}

/**
 * Clear all data from index (for testing or reset)
 * @param index - Search index to clear
 */
export function clearIndex(index: EncryptedSearchIndex): void {
  try {
    index.invertedIndex.clear();
    index.documentIndex.clear();
    index.termCache.clear();

    index.metadata.totalEntries = 0;
    index.metadata.totalTerms = 0;
    index.metadata.indexSize = 0;
    index.metadata.lastUpdated = Date.now();

    console.log("Index cleared successfully");
  } catch (error) {
    console.error("Index clearing failed:", error);
    throw error;
  }
}
