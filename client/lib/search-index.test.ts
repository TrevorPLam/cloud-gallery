// Comprehensive test suite for Encrypted Search Index functionality
// Tests index construction, search operations, and performance

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  initializeSearchIndex,
  addDocumentToIndex,
  removeDocumentFromIndex,
  searchEncryptedIndex,
  getIndexStats,
  optimizeIndex,
  serializeIndex,
  deserializeIndex,
  clearIndex,
  EncryptedSearchIndex,
  SearchQuery,
  SearchFilter,
} from "./search-index";
import {
  initializeSSE,
  generateSSEKey,
  encryptSearchTerm,
  SearchTokenType,
} from "./encrypted-search";

describe("Encrypted Search Index", () => {
  let index: EncryptedSearchIndex;
  let sseKey: string;
  const encryptionKeyId = "test-key-id";

  beforeEach(async () => {
    await initializeSSE();
    sseKey = generateSSEKey();
    index = await initializeSearchIndex(encryptionKeyId);
  });

  afterEach(() => {
    clearIndex(index);
  });

  describe("Index Initialization", () => {
    it("should initialize search index successfully", async () => {
      const testIndex = await initializeSearchIndex("test-key-id");

      expect(testIndex.metadata.version).toBe("1.0.0");
      expect(testIndex.metadata.totalEntries).toBe(0);
      expect(testIndex.metadata.totalTerms).toBe(0);
      expect(testIndex.invertedIndex.size).toBe(0);
      expect(testIndex.documentIndex.size).toBe(0);
      expect(testIndex.termCache.size).toBe(0);
    });

    it("should have correct initial metadata", async () => {
      const now = Date.now();
      const testIndex = await initializeSearchIndex("test-key-id");

      expect(testIndex.metadata.createdAt).toBeGreaterThanOrEqual(now);
      expect(testIndex.metadata.lastUpdated).toBeGreaterThanOrEqual(now);
      expect(testIndex.metadata.encryptionKeyId).toBe("test-key-id");
      expect(testIndex.metadata.compressionEnabled).toBe(false);
    });
  });

  describe("Document Indexing", () => {
    it("should add documents to index successfully", async () => {
      const documentId = "doc1";
      const terms = ["beach", "vacation", "sunset"];

      await addDocumentToIndex(index, documentId, terms, sseKey);

      expect(index.metadata.totalEntries).toBe(1);
      expect(index.documentIndex.has(documentId)).toBe(true);
      expect(index.invertedIndex.size).toBe(3); // 3 unique terms
    });

    it("should index multiple documents", async () => {
      const documents = [
        { id: "doc1", terms: ["beach", "vacation"] },
        { id: "doc2", terms: ["mountain", "hiking"] },
        { id: "doc3", terms: ["beach", "sunset"] },
      ];

      for (const doc of documents) {
        await addDocumentToIndex(index, doc.id, doc.terms, sseKey);
      }

      expect(index.metadata.totalEntries).toBe(3);
      expect(index.invertedIndex.size).toBe(4); // beach, vacation, mountain, hiking, sunset
      expect(index.documentIndex.size).toBe(3);
    });

    it("should handle duplicate terms within a document", async () => {
      const documentId = "doc1";
      const terms = ["beach", "vacation", "beach", "beach", "sunset"];

      await addDocumentToIndex(index, documentId, terms, sseKey);

      const documentEntry = index.documentIndex.get(documentId);
      expect(documentEntry?.encryptedTerms.length).toBe(3); // 3 unique terms
      expect(documentEntry?.termFrequencies).toEqual({
        [expect.any(String)]: 3, // beach appears 3 times
        [expect.any(String)]: 1, // vacation appears 1 time
        [expect.any(String)]: 1, // sunset appears 1 time
      });
    });

    it("should reject duplicate document IDs", async () => {
      const documentId = "doc1";
      const terms1 = ["beach", "vacation"];
      const terms2 = ["mountain", "hiking"];

      await addDocumentToIndex(index, documentId, terms1, sseKey);

      await expect(
        addDocumentToIndex(index, documentId, terms2, sseKey),
      ).rejects.toThrow("already exists in index");
    });

    it("should handle empty term lists", async () => {
      const documentId = "doc1";
      const terms: string[] = [];

      await addDocumentToIndex(index, documentId, terms, sseKey);

      expect(index.metadata.totalEntries).toBe(1);
      expect(index.invertedIndex.size).toBe(0); // No terms indexed
    });

    it("should filter out empty and whitespace terms", async () => {
      const documentId = "doc1";
      const terms = ["beach", "", "  ", "vacation", "\t"];

      await addDocumentToIndex(index, documentId, terms, sseKey);

      expect(index.invertedIndex.size).toBe(2); // Only "beach" and "vacation"
    });
  });

  describe("Document Removal", () => {
    beforeEach(async () => {
      // Add some test documents
      await addDocumentToIndex(index, "doc1", ["beach", "vacation"], sseKey);
      await addDocumentToIndex(index, "doc2", ["mountain", "hiking"], sseKey);
      await addDocumentToIndex(index, "doc3", ["beach", "sunset"], sseKey);
    });

    it("should remove documents from index", async () => {
      await removeDocumentFromIndex(index, "doc1");

      expect(index.metadata.totalEntries).toBe(2);
      expect(index.documentIndex.has("doc1")).toBe(false);

      // Check inverted index is updated
      const beachEntry = Array.from(index.invertedIndex.values()).find(
        (entry) => entry.documentIds.includes("doc1"),
      );
      expect(beachEntry).toBeUndefined();
    });

    it("should handle removal of non-existent documents", async () => {
      await expect(
        removeDocumentFromIndex(index, "nonexistent"),
      ).resolves.not.toThrow();

      expect(index.metadata.totalEntries).toBe(3); // No change
    });

    it("should clean up inverted index entries when no documents remain", async () => {
      // Remove all documents containing "beach"
      await removeDocumentFromIndex(index, "doc1");
      await removeDocumentFromIndex(index, "doc3");

      // "beach" term should be removed from inverted index
      const beachEntries = Array.from(index.invertedIndex.values()).filter(
        (entry) => entry.documentIds.length === 0,
      );

      expect(index.invertedIndex.size).toBe(2); // Only "mountain" and "hiking" remain
    });
  });

  describe("Search Operations", () => {
    beforeEach(async () => {
      // Add test documents
      await addDocumentToIndex(
        index,
        "doc1",
        ["beach", "vacation", "sunset"],
        sseKey,
      );
      await addDocumentToIndex(
        index,
        "doc2",
        ["mountain", "hiking", "sunset"],
        sseKey,
      );
      await addDocumentToIndex(
        index,
        "doc3",
        ["beach", "family", "portrait"],
        sseKey,
      );
      await addDocumentToIndex(
        index,
        "doc4",
        ["vacation", "travel", "photo"],
        sseKey,
      );
    });

    it("should search for single terms", async () => {
      const encryptedTerm = encryptSearchTerm("beach", sseKey);
      const query: SearchQuery = {
        encryptedTerms: [encryptedTerm.encryptedTerm],
        limit: 10,
        offset: 0,
      };

      const results = await searchEncryptedIndex(
        index,
        [encryptedTerm.encryptedTerm],
        query,
      );

      expect(results.length).toBe(2); // doc1 and doc3 contain "beach"
      expect(results.map((r) => r.documentId)).toContain("doc1");
      expect(results.map((r) => r.documentId)).toContain("doc3");
    });

    it("should search for multiple terms", async () => {
      const term1 = encryptSearchTerm("sunset", sseKey);
      const term2 = encryptSearchTerm("vacation", sseKey);
      const query: SearchQuery = {
        encryptedTerms: [term1.encryptedTerm, term2.encryptedTerm],
        limit: 10,
        offset: 0,
      };

      const results = await searchEncryptedIndex(
        index,
        [term1.encryptedTerm, term2.encryptedTerm],
        query,
      );

      expect(results.length).toBe(3); // doc1, doc2, doc4
      expect(results.map((r) => r.documentId)).toContain("doc1");
      expect(results.map((r) => r.documentId)).toContain("doc2");
      expect(results.map((r) => r.documentId)).toContain("doc4");
    });

    it("should return empty results for non-existent terms", async () => {
      const encryptedTerm = encryptSearchTerm("nonexistent", sseKey);
      const query: SearchQuery = {
        encryptedTerms: [encryptedTerm.encryptedTerm],
        limit: 10,
        offset: 0,
      };

      const results = await searchEncryptedIndex(
        index,
        [encryptedTerm.encryptedTerm],
        query,
      );

      expect(results.length).toBe(0);
    });

    it("should calculate relevance scores", async () => {
      const encryptedTerm = encryptSearchTerm("beach", sseKey);
      const query: SearchQuery = {
        encryptedTerms: [encryptedTerm.encryptedTerm],
        limit: 10,
        offset: 0,
      };

      const results = await searchEncryptedIndex(
        index,
        [encryptedTerm.encryptedTerm],
        query,
      );

      results.forEach((result) => {
        expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
        expect(result.relevanceScore).toBeLessThanOrEqual(1);
        expect(result.matchedTerms).toContain(encryptedTerm.encryptedTerm);
      });
    });

    it("should sort results by relevance score", async () => {
      // Add a document with "beach" appearing multiple times for higher relevance
      await addDocumentToIndex(
        index,
        "doc5",
        ["beach", "beach", "beach"],
        sseKey,
      );

      const encryptedTerm = encryptSearchTerm("beach", sseKey);
      const query: SearchQuery = {
        encryptedTerms: [encryptedTerm.encryptedTerm],
        limit: 10,
        offset: 0,
      };

      const results = await searchEncryptedIndex(
        index,
        [encryptedTerm.encryptedTerm],
        query,
      );

      // Results should be sorted by relevance (higher scores first)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].relevanceScore).toBeGreaterThanOrEqual(
          results[i].relevanceScore,
        );
      }
    });

    it("should support pagination", async () => {
      const encryptedTerm = encryptSearchTerm("beach", sseKey);
      const query1: SearchQuery = {
        encryptedTerms: [encryptedTerm.encryptedTerm],
        limit: 1,
        offset: 0,
      };
      const query2: SearchQuery = {
        encryptedTerms: [encryptedTerm.encryptedTerm],
        limit: 1,
        offset: 1,
      };

      const results1 = await searchEncryptedIndex(
        index,
        [encryptedTerm.encryptedTerm],
        query1,
      );
      const results2 = await searchEncryptedIndex(
        index,
        [encryptedTerm.encryptedTerm],
        query2,
      );

      expect(results1.length).toBe(1);
      expect(results2.length).toBe(1);
      expect(results1[0].documentId).not.toBe(results2[0].documentId);
    });
  });

  describe("Index Statistics", () => {
    beforeEach(async () => {
      await addDocumentToIndex(index, "doc1", ["beach", "vacation"], sseKey);
      await addDocumentToIndex(index, "doc2", ["mountain", "hiking"], sseKey);
      await addDocumentToIndex(index, "doc3", ["beach", "sunset"], sseKey);
    });

    it("should calculate accurate statistics", () => {
      const stats = getIndexStats(index);

      expect(stats.totalDocuments).toBe(3);
      expect(stats.totalTerms).toBe(4); // beach, vacation, mountain, hiking, sunset
      expect(stats.averageTermsPerDocument).toBeCloseTo(4 / 3, 2);
      expect(stats.indexSize).toBeGreaterThan(0);
      expect(stats.mostAccessedTerms).toBeInstanceOf(Array);
    });

    it("should update statistics after document removal", async () => {
      await removeDocumentFromIndex(index, "doc1");

      const stats = getIndexStats(index);

      expect(stats.totalDocuments).toBe(2);
      expect(stats.totalTerms).toBeLessThan(4); // Some terms removed
    });
  });

  describe("Index Optimization", () => {
    beforeEach(async () => {
      // Add many documents for optimization testing
      for (let i = 0; i < 50; i++) {
        await addDocumentToIndex(
          index,
          `doc${i}`,
          [`term${i}`, `shared${i % 5}`],
          sseKey,
        );
      }
    });

    it("should optimize index successfully", async () => {
      const initialStats = getIndexStats(index);

      await optimizeIndex(index);

      const optimizedStats = getIndexStats(index);

      expect(index.metadata.lastUpdated).toBeGreaterThan(
        initialStats.totalDocuments,
      );
      expect(optimizedStats.totalDocuments).toBe(initialStats.totalDocuments);
      expect(optimizedStats.totalTerms).toBeLessThanOrEqual(
        initialStats.totalTerms,
      );
    });

    it("should clean up empty entries during optimization", async () => {
      // Remove some documents to create empty entries
      await removeDocumentFromIndex(index, "doc1");
      await removeDocumentFromIndex(index, "doc2");

      const beforeOptimization = index.invertedIndex.size;
      await optimizeIndex(index);

      // Empty entries should be removed
      expect(index.invertedIndex.size).toBeLessThanOrEqual(beforeOptimization);
    });

    it("should manage cache size during optimization", async () => {
      // Fill cache beyond limit
      for (let i = 0; i < 150; i++) {
        const encryptedTerm = encryptSearchTerm(`cacheterm${i}`, sseKey);
        index.termCache.set(encryptedTerm.encryptedTerm, encryptedTerm);
      }

      expect(index.termCache.size).toBeGreaterThan(100);

      await optimizeIndex(index);

      expect(index.termCache.size).toBeLessThanOrEqual(100);
    });
  });

  describe("Index Serialization", () => {
    beforeEach(async () => {
      await addDocumentToIndex(index, "doc1", ["beach", "vacation"], sseKey);
      await addDocumentToIndex(index, "doc2", ["mountain", "hiking"], sseKey);
    });

    it("should serialize index to JSON", () => {
      const serialized = serializeIndex(index);

      expect(serialized).toBeTypeOf("string");
      expect(() => JSON.parse(serialized)).not.toThrow();

      const parsed = JSON.parse(serialized);
      expect(parsed.metadata).toBeDefined();
      expect(parsed.invertedIndex).toBeDefined();
      expect(parsed.documentIndex).toBeDefined();
      expect(parsed.termCache).toBeDefined();
    });

    it("should deserialize index from JSON", () => {
      const serialized = serializeIndex(index);
      const deserialized = deserializeIndex(serialized);

      expect(deserialized.metadata.version).toBe(index.metadata.version);
      expect(deserialized.metadata.totalEntries).toBe(
        index.metadata.totalEntries,
      );
      expect(deserialized.invertedIndex.size).toBe(index.invertedIndex.size);
      expect(deserialized.documentIndex.size).toBe(index.documentIndex.size);
    });

    it("should maintain data integrity through serialization", () => {
      const serialized = serializeIndex(index);
      const deserialized = deserializeIndex(serialized);

      // Test search functionality still works
      const encryptedTerm = encryptSearchTerm("beach", sseKey);
      const query: SearchQuery = {
        encryptedTerms: [encryptedTerm.encryptedTerm],
        limit: 10,
        offset: 0,
      };

      const originalResults = searchEncryptedIndex(
        index,
        [encryptedTerm.encryptedTerm],
        query,
      );
      const deserializedResults = searchEncryptedIndex(
        deserialized,
        [encryptedTerm.encryptedTerm],
        query,
      );

      // Results should be the same
      expect(originalResults).resolves.toHaveLength(deserializedResults.length);
    });

    it("should handle invalid serialized data", () => {
      expect(() => {
        deserializeIndex("invalid json");
      }).toThrow();

      expect(() => {
        deserializeIndex('{"invalid": "structure"}');
      }).toThrow();
    });
  });

  describe("Index Clearing", () => {
    beforeEach(async () => {
      await addDocumentToIndex(index, "doc1", ["beach", "vacation"], sseKey);
      await addDocumentToIndex(index, "doc2", ["mountain", "hiking"], sseKey);
    });

    it("should clear all index data", () => {
      clearIndex(index);

      expect(index.metadata.totalEntries).toBe(0);
      expect(index.metadata.totalTerms).toBe(0);
      expect(index.invertedIndex.size).toBe(0);
      expect(index.documentIndex.size).toBe(0);
      expect(index.termCache.size).toBe(0);
    });

    it("should update metadata after clearing", () => {
      const beforeClear = index.metadata.lastUpdated;
      clearIndex(index);

      expect(index.metadata.lastUpdated).toBeGreaterThan(beforeClear);
      expect(index.metadata.indexSize).toBe(0);
    });
  });

  describe("Performance Tests", () => {
    it("should handle large number of documents efficiently", async () => {
      const startTime = Date.now();

      // Add 1000 documents
      for (let i = 0; i < 1000; i++) {
        await addDocumentToIndex(
          index,
          `doc${i}`,
          [`term${i % 100}`, `shared${i % 10}`],
          sseKey,
        );
      }

      const indexingTime = Date.now() - startTime;

      expect(index.metadata.totalEntries).toBe(1000);
      expect(indexingTime).toBeLessThan(10000); // Should complete within 10 seconds

      // Test search performance
      const searchStartTime = Date.now();
      const encryptedTerm = encryptSearchTerm("term50", sseKey);
      const query: SearchQuery = {
        encryptedTerms: [encryptedTerm.encryptedTerm],
        limit: 20,
        offset: 0,
      };

      const results = await searchEncryptedIndex(
        index,
        [encryptedTerm.encryptedTerm],
        query,
      );
      const searchTime = Date.now() - searchStartTime;

      expect(results.length).toBe(10); // 10 documents contain "term50"
      expect(searchTime).toBeLessThan(1000); // Search should complete within 1 second
    });

    it("should handle concurrent operations", async () => {
      const promises: Promise<any>[] = [];

      // Add multiple documents concurrently
      for (let i = 0; i < 50; i++) {
        promises.push(
          addDocumentToIndex(index, `doc${i}`, [`term${i}`], sseKey),
        );
      }

      await Promise.all(promises);

      expect(index.metadata.totalEntries).toBe(50);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty search queries", async () => {
      const query: SearchQuery = {
        encryptedTerms: [],
        limit: 10,
        offset: 0,
      };

      const results = await searchEncryptedIndex(index, [], query);

      expect(results.length).toBe(0);
    });

    it("should handle very long terms", async () => {
      const longTerm = "a".repeat(200);
      await addDocumentToIndex(index, "doc1", [longTerm], sseKey);

      const encryptedTerm = encryptSearchTerm(longTerm, sseKey);
      const query: SearchQuery = {
        encryptedTerms: [encryptedTerm.encryptedTerm],
        limit: 10,
        offset: 0,
      };

      const results = await searchEncryptedIndex(
        index,
        [encryptedTerm.encryptedTerm],
        query,
      );

      expect(results.length).toBe(1);
      expect(results[0].documentId).toBe("doc1");
    });

    it("should handle special characters in terms", async () => {
      const specialTerms = [
        "test@example.com",
        "photo_2024-01-15",
        "bébé photos",
      ];

      for (const term of specialTerms) {
        await addDocumentToIndex(index, `doc_${term}`, [term], sseKey);
      }

      for (const term of specialTerms) {
        const encryptedTerm = encryptSearchTerm(term, sseKey);
        const query: SearchQuery = {
          encryptedTerms: [encryptedTerm.encryptedTerm],
          limit: 10,
          offset: 0,
        };

        const results = await searchEncryptedIndex(
          index,
          [encryptedTerm.encryptedTerm],
          query,
        );
        expect(results.length).toBe(1);
      }
    });
  });
});
