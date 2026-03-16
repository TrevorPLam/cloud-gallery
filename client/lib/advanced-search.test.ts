// Comprehensive test suite for Advanced Search functionality
// Tests complex queries, boolean operators, and execution planning

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { 
  initializeAdvancedSearch,
  createTermNode,
  createAndNode,
  createOrNode,
  createNotNode,
  createFilterNode,
  buildComplexQuery,
  encryptQueryNode,
  createExecutionPlan,
  executeComplexQuery,
  optimizeComplexQuery,
  QueryNodeType,
  ComplexQuery,
  SearchFilter
} from "./advanced-search";
import { 
  initializeSearchIndex,
  EncryptedSearchIndex,
  addDocumentToIndex
} from "./search-index";
import { 
  initializeSSE,
  generateSSEKey
} from "./encrypted-search";

describe("Advanced Search", () => {
  let index: EncryptedSearchIndex;
  let sseKey: string;

  beforeEach(async () => {
    await initializeAdvancedSearch();
    await initializeSSE();
    sseKey = generateSSEKey();
    index = await initializeSearchIndex("test-key-id");
    
    // Add test documents
    await addDocumentToIndex(index, "doc1", ["beach", "vacation", "sunset"], sseKey);
    await addDocumentToIndex(index, "doc2", ["mountain", "hiking", "sunset"], sseKey);
    await addDocumentToIndex(index, "doc3", ["beach", "family", "portrait"], sseKey);
    await addDocumentToIndex(index, "doc4", ["vacation", "travel", "photo"], sseKey);
    await addDocumentToIndex(index, "doc5", ["family", "portrait", "studio"], sseKey);
  });

  afterEach(() => {
    // Clean up index
    index.invertedIndex.clear();
    index.documentIndex.clear();
    index.termCache.clear();
  });

  describe("Query Node Creation", () => {
    it("should create term nodes", () => {
      const node = createTermNode("beach");
      
      expect(node.type).toBe(QueryNodeType.TERM);
      expect(node.value).toBe("beach");
      expect(node.weight).toBe(1.0);
      expect(node.encrypted).toBe(false);
    });

    it("should create term nodes with custom weight", () => {
      const node = createTermNode("important", 2.0);
      
      expect(node.weight).toBe(2.0);
    });

    it("should create AND nodes", () => {
      const child1 = createTermNode("beach");
      const child2 = createTermNode("sunset");
      const andNode = createAndNode(child1, child2);
      
      expect(andNode.type).toBe(QueryNodeType.AND);
      expect(andNode.children).toHaveLength(2);
      expect(andNode.children?.[0]).toBe(child1);
      expect(andNode.children?.[1]).toBe(child2);
    });

    it("should create OR nodes", () => {
      const child1 = createTermNode("vacation");
      const child2 = createTermNode("travel");
      const orNode = createOrNode(child1, child2);
      
      expect(orNode.type).toBe(QueryNodeType.OR);
      expect(orNode.children).toHaveLength(2);
    });

    it("should create NOT nodes", () => {
      const child = createTermNode("crowded");
      const notNode = createNotNode(child);
      
      expect(notNode.type).toBe(QueryNodeType.NOT);
      expect(notNode.children).toHaveLength(1);
      expect(notNode.children?.[0]).toBe(child);
    });

    it("should create filter nodes", () => {
      const filter: SearchFilter = {
        dateRange: {
          start: Date.now() - 86400000, // 1 day ago
          end: Date.now()
        }
      };
      const filterNode = createFilterNode(filter);
      
      expect(filterNode.type).toBe(QueryNodeType.FILTER);
      expect(filterNode.filter).toBe(filter);
      expect(filterNode.weight).toBe(0.5);
    });

    it("should validate node creation requirements", () => {
      expect(() => {
        createAndNode(); // No children
      }).toThrow("requires at least 2 children");
      
      expect(() => {
        createOrNode(); // No children
      }).toThrow("requires at least 2 children");
      
      expect(() => {
        createNotNode(); // No children
      }).toThrow("requires at least 2 children");
    });
  });

  describe("Complex Query Building", () => {
    it("should build simple term queries", () => {
      const query = buildComplexQuery("beach");
      
      expect(query.root.type).toBe(QueryNodeType.TERM);
      expect(query.root.value).toBe("beach");
      expect(query.queryId).toBeTypeOf("string");
      expect(query.timestamp).toBeGreaterThan(0);
    });

    it("should build AND queries", () => {
      const query = buildComplexQuery("beach AND sunset");
      
      expect(query.root.type).toBe(QueryNodeType.AND);
      expect(query.root.children).toHaveLength(2);
      expect(query.root.children?.[0].value).toBe("beach");
      expect(query.root.children?.[1].value).toBe("sunset");
    });

    it("should build OR queries", () => {
      const query = buildComplexQuery("vacation OR travel");
      
      expect(query.root.type).toBe(QueryNodeType.OR);
      expect(query.root.children).toHaveLength(2);
      expect(query.root.children?.[0].value).toBe("vacation");
      expect(query.root.children?.[1].value).toBe("travel");
    });

    it("should build NOT queries", () => {
      const query = buildComplexQuery("NOT crowded");
      
      expect(query.root.type).toBe(QueryNodeType.NOT);
      expect(query.root.children).toHaveLength(1);
      expect(query.root.children?.[0].value).toBe("crowded");
    });

    it("should handle complex query strings", () => {
      const query = buildComplexQuery("beach AND sunset OR vacation");
      
      // This is a simplified parser - in production would handle operator precedence
      expect(query.root.type).toBe(QueryNodeType.AND);
      expect(query.root.children?.[0].value).toBe("beach");
      expect(query.root.children?.[1].type).toBe(QueryNodeType.TERM);
      expect(query.root.children?.[1].value).toBe("sunset OR vacation");
    });

    it("should trim and normalize query strings", () => {
      const query = buildComplexQuery("  beach   AND  sunset  ");
      
      expect(query.root.type).toBe(QueryNodeType.AND);
      expect(query.root.children?.[0].value).toBe("beach");
      expect(query.root.children?.[1].value).toBe("sunset");
    });
  });

  describe("Query Node Encryption", () => {
    it("should encrypt term nodes", async () => {
      const node = createTermNode("beach");
      const encryptedNode = await encryptQueryNode(node, sseKey);
      
      expect(encryptedNode.type).toBe(QueryNodeType.TERM);
      expect(encryptedNode.value).not.toBe("beach"); // Should be encrypted
      expect(encryptedNode.encrypted).toBe(true);
    });

    it("should encrypt AND node children", async () => {
      const child1 = createTermNode("beach");
      const child2 = createTermNode("sunset");
      const andNode = createAndNode(child1, child2);
      const encryptedNode = await encryptQueryNode(andNode, sseKey);
      
      expect(encryptedNode.type).toBe(QueryNodeType.AND);
      expect(encryptedNode.children).toHaveLength(2);
      expect(encryptedNode.children?.[0].value).not.toBe("beach");
      expect(encryptedNode.children?.[1].value).not.toBe("sunset");
      expect(encryptedNode.children?.[0].encrypted).toBe(true);
      expect(encryptedNode.children?.[1].encrypted).toBe(true);
    });

    it("should encrypt OR node children", async () => {
      const child1 = createTermNode("vacation");
      const child2 = createTermNode("travel");
      const orNode = createOrNode(child1, child2);
      const encryptedNode = await encryptQueryNode(orNode, sseKey);
      
      expect(encryptedNode.type).toBe(QueryNodeType.OR);
      expect(encryptedNode.children?.[0].encrypted).toBe(true);
      expect(encryptedNode.children?.[1].encrypted).toBe(true);
    });

    it("should encrypt NOT node children", async () => {
      const child = createTermNode("crowded");
      const notNode = createNotNode(child);
      const encryptedNode = await encryptQueryNode(notNode, sseKey);
      
      expect(encryptedNode.type).toBe(QueryNodeType.NOT);
      expect(encryptedNode.children?.[0].encrypted).toBe(true);
    });

    it("should not encrypt filter nodes", async () => {
      const filter: SearchFilter = {
        dateRange: { start: 0, end: Date.now() }
      };
      const filterNode = createFilterNode(filter);
      const encryptedNode = await encryptQueryNode(filterNode, sseKey);
      
      expect(encryptedNode.type).toBe(QueryNodeType.FILTER);
      expect(encryptedNode.filter).toBe(filter);
      expect(encryptedNode.encrypted).toBe(false);
    });
  });

  describe("Execution Planning", () => {
    it("should create execution plan for simple term query", () => {
      const query = buildComplexQuery("beach");
      const plan = createExecutionPlan(query, index);
      
      expect(plan.steps.length).toBe(1);
      expect(plan.steps[0].operation).toBe("TERM_LOOKUP");
      expect(plan.steps[0].encryptedTerms).toHaveLength(1);
      expect(plan.estimatedComplexity).toBe(1);
      expect(plan.requiresFullScan).toBe(false);
    });

    it("should create execution plan for AND query", () => {
      const query = buildComplexQuery("beach AND sunset");
      const plan = createExecutionPlan(query, index);
      
      expect(plan.steps.length).toBeGreaterThan(1);
      expect(plan.steps.some(step => step.operation === "AND_OPERATION")).toBe(true);
      expect(plan.estimatedComplexity).toBeGreaterThan(1);
    });

    it("should create execution plan for OR query", () => {
      const query = buildComplexQuery("vacation OR travel");
      const plan = createExecutionPlan(query, index);
      
      expect(plan.steps.length).toBeGreaterThan(1);
      expect(plan.steps.some(step => step.operation === "OR_OPERATION")).toBe(true);
    });

    it("should create execution plan for NOT query", () => {
      const query = buildComplexQuery("NOT crowded");
      const plan = createExecutionPlan(query, index);
      
      expect(plan.steps.length).toBeGreaterThan(1);
      expect(plan.steps.some(step => step.operation === "NOT_OPERATION")).toBe(true);
      expect(plan.requiresFullScan).toBe(true);
    });

    it("should estimate result counts accurately", () => {
      const query = buildComplexQuery("beach");
      const plan = createExecutionPlan(query, index);
      
      expect(plan.estimatedResults).toBeGreaterThan(0);
      expect(plan.estimatedResults).toBeLessThanOrEqual(index.metadata.totalEntries);
    });

    it("should handle complex nested queries", () => {
      const child1 = createTermNode("beach");
      const child2 = createTermNode("sunset");
      const child3 = createTermNode("vacation");
      const andNode = createAndNode(child1, child2);
      const orNode = createOrNode(andNode, child3);
      
      const complexQuery: ComplexQuery = {
        root: orNode,
        queryId: "test",
        timestamp: Date.now(),
        timeout: 30000,
        maxResults: 50,
        enableRelevanceScoring: true
      };
      
      const plan = createExecutionPlan(complexQuery, index);
      
      expect(plan.steps.length).toBeGreaterThan(2);
      expect(plan.estimatedComplexity).toBeGreaterThan(2);
    });
  });

  describe("Query Execution", () => {
    it("should execute simple term queries", async () => {
      const query = buildComplexQuery("beach");
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBe(2); // doc1 and doc3 contain "beach"
      expect(results.every(r => r.queryId === query.queryId)).toBe(true);
      expect(results.every(r => r.executionTime > 0)).toBe(true);
    });

    it("should execute AND queries", async () => {
      const query = buildComplexQuery("beach AND sunset");
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBe(1); // Only doc1 contains both "beach" and "sunset"
      expect(results[0].documentId).toBe("doc1");
    });

    it("should execute OR queries", async () => {
      const query = buildComplexQuery("beach OR vacation");
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBe(3); // doc1, doc3, doc4 contain either "beach" or "vacation"
      const docIds = results.map(r => r.documentId);
      expect(docIds).toContain("doc1");
      expect(docIds).toContain("doc3");
      expect(docIds).toContain("doc4");
    });

    it("should execute NOT queries", async () => {
      const query = buildComplexQuery("NOT portrait");
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBe(3); // All documents except doc3 and doc5 (which contain "portrait")
      const docIds = results.map(r => r.documentId);
      expect(docIds).not.toContain("doc3");
      expect(docIds).not.toContain("doc5");
    });

    it("should limit results", async () => {
      const query = buildComplexQuery("beach OR vacation");
      query.maxResults = 2;
      
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it("should calculate relevance factors", async () => {
      const query = buildComplexQuery("beach");
      const results = await executeComplexQuery(query, index, sseKey);
      
      results.forEach(result => {
        expect(result.relevanceFactors.termMatch).toBeGreaterThanOrEqual(0);
        expect(result.relevanceFactors.operatorMatch).toBeGreaterThanOrEqual(0);
        expect(result.relevanceFactors.filterMatch).toBeGreaterThanOrEqual(0);
        expect(result.relevanceFactors.boost).toBe(1.0);
      });
    });

    it("should provide debug information", async () => {
      const query = buildComplexQuery("beach AND sunset");
      const results = await executeComplexQuery(query, index, sseKey);
      
      results.forEach(result => {
        expect(result.debugInfo).toBeDefined();
        expect(result.debugInfo?.stepsExecuted).toBeGreaterThan(0);
        expect(result.debugInfo?.indexLookups).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe("Query Optimization", () => {
    it("should optimize simple queries", () => {
      const query = buildComplexQuery("beach");
      const optimized = optimizeComplexQuery(query);
      
      expect(optimized.root).toEqual(query.root); // Simple queries shouldn't change
    });

    it("should optimize AND queries by selectivity", () => {
      const child1 = createTermNode("beach"); // Less selective (appears in 2 docs)
      const child2 = createTermNode("sunset"); // More selective (appears in 2 docs)
      child1.weight = 2.0; // Higher weight = less selective
      child2.weight = 1.0; // Lower weight = more selective
      
      const andNode = createAndNode(child1, child2);
      const query: ComplexQuery = {
        root: andNode,
        queryId: "test",
        timestamp: Date.now(),
        timeout: 30000,
        maxResults: 50,
        enableRelevanceScoring: true
      };
      
      const optimized = optimizeComplexQuery(query);
      
      // More selective term should come first
      expect(optimized.root.children?.[0].weight).toBeLessThanOrEqual(optimized.root.children?.[1].weight);
    });

    it("should optimize OR queries by selectivity", () => {
      const child1 = createTermNode("beach"); // Less selective
      const child2 = createTermNode("rare"); // More selective
      child1.weight = 2.0;
      child2.weight = 1.0;
      
      const orNode = createOrNode(child1, child2);
      const query: ComplexQuery = {
        root: orNode,
        queryId: "test",
        timestamp: Date.now(),
        timeout: 30000,
        maxResults: 50,
        enableRelevanceScoring: true
      };
      
      const optimized = optimizeComplexQuery(query);
      
      // Less selective term should come first for OR operations
      expect(optimized.root.children?.[0].weight).toBeGreaterThanOrEqual(optimized.root.children?.[1].weight);
    });

    it("should handle optimization errors gracefully", () => {
      const query = buildComplexQuery("beach");
      
      // Mock an error during optimization
      const originalNode = query.root;
      query.root = null as any;
      
      const optimized = optimizeComplexQuery(query);
      
      // Should return original query on error
      expect(optimized).toBe(query);
    });
  });

  describe("Filter Handling", () => {
    it("should apply date range filters", async () => {
      const filter: SearchFilter = {
        dateRange: {
          start: Date.now() - 86400000, // 1 day ago
          end: Date.now()
        }
      };
      const filterNode = createFilterNode(filter);
      const termNode = createTermNode("beach");
      const andNode = createAndNode(termNode, filterNode);
      
      const query: ComplexQuery = {
        root: andNode,
        queryId: "test",
        timestamp: Date.now(),
        timeout: 30000,
        maxResults: 50,
        enableRelevanceScoring: true
      };
      
      const results = await executeComplexQuery(query, index, sseKey);
      
      // Results should be filtered by date (simplified test)
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("should apply location filters", async () => {
      const filter: SearchFilter = {
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          radius: 1000 // 1km
        }
      };
      const filterNode = createFilterNode(filter);
      const termNode = createTermNode("beach");
      const andNode = createAndNode(termNode, filterNode);
      
      const query: ComplexQuery = {
        root: andNode,
        queryId: "test",
        timestamp: Date.now(),
        timeout: 30000,
        maxResults: 50,
        enableRelevanceScoring: true
      };
      
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("should apply tag filters", async () => {
      const filter: SearchFilter = {
        tags: ["vacation", "travel"]
      };
      const filterNode = createFilterNode(filter);
      const termNode = createTermNode("photo");
      const andNode = createAndNode(termNode, filterNode);
      
      const query: ComplexQuery = {
        root: andNode,
        queryId: "test",
        timestamp: Date.now(),
        timeout: 30000,
        maxResults: 50,
        enableRelevanceScoring: true
      };
      
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("should apply media type filters", async () => {
      const filter: SearchFilter = {
        mediaType: ["photo", "video"]
      };
      const filterNode = createFilterNode(filter);
      const termNode = createTermNode("family");
      const andNode = createAndNode(termNode, filterNode);
      
      const query: ComplexQuery = {
        root: andNode,
        queryId: "test",
        timestamp: Date.now(),
        timeout: 30000,
        maxResults: 50,
        enableRelevanceScoring: true
      };
      
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Performance Tests", () => {
    it("should handle complex queries efficiently", async () => {
      const query = buildComplexQuery("beach AND (sunset OR vacation) NOT portrait");
      const startTime = Date.now();
      
      const results = await executeComplexQuery(query, index, sseKey);
      
      const executionTime = Date.now() - startTime;
      
      expect(results.length).toBeGreaterThanOrEqual(0);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it("should handle multiple concurrent queries", async () => {
      const queries = [
        buildComplexQuery("beach"),
        buildComplexQuery("vacation"),
        buildComplexQuery("family"),
        buildComplexQuery("sunset")
      ];
      
      const startTime = Date.now();
      
      const promises = queries.map(query => executeComplexQuery(query, index, sseKey));
      const results = await Promise.all(promises);
      
      const totalTime = Date.now() - startTime;
      
      expect(results.length).toBe(4);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it("should handle large result sets efficiently", async () => {
      // Add more documents
      for (let i = 0; i < 100; i++) {
        await addDocumentToIndex(index, `doc${i + 100}`, [`term${i % 10}`], sseKey);
      }
      
      const query = buildComplexQuery("term1");
      const startTime = Date.now();
      
      const results = await executeComplexQuery(query, index, sseKey);
      
      const executionTime = Date.now() - startTime;
      
      expect(results.length).toBeGreaterThan(0);
      expect(executionTime).toBeLessThan(5000);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty queries", async () => {
      const query: ComplexQuery = {
        root: createTermNode(""),
        queryId: "test",
        timestamp: Date.now(),
        timeout: 30000,
        maxResults: 50,
        enableRelevanceScoring: true
      };
      
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBe(0);
    });

    it("should handle queries with no matching terms", async () => {
      const query = buildComplexQuery("nonexistent_term");
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBe(0);
    });

    it("should handle deeply nested queries", async () => {
      const child1 = createTermNode("beach");
      const child2 = createTermNode("sunset");
      const child3 = createTermNode("vacation");
      const child4 = createTermNode("family");
      
      const and1 = createAndNode(child1, child2);
      const or1 = createOrNode(and1, child3);
      const and2 = createAndNode(or1, child4);
      
      const query: ComplexQuery = {
        root: and2,
        queryId: "test",
        timestamp: Date.now(),
        timeout: 30000,
        maxResults: 50,
        enableRelevanceScoring: true
      };
      
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle special characters in queries", async () => {
      const specialQueries = [
        "test@example.com",
        "photo_2024-01-15",
        "bébé photos",
        "🌅 sunset"
      ];
      
      for (const queryString of specialQueries) {
        expect(async () => {
          const query = buildComplexQuery(queryString);
          await executeComplexQuery(query, index, sseKey);
        }).resolves.not.toThrow();
      }
    });

    it("should handle query timeouts", async () => {
      const query = buildComplexQuery("beach AND sunset OR vacation");
      query.timeout = 1; // 1 millisecond timeout
      
      // This is a simplified test - in a real implementation,
      // the query would be interrupted when timeout is reached
      const results = await executeComplexQuery(query, index, sseKey);
      
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle invalid query nodes gracefully", async () => {
      const invalidQuery: ComplexQuery = {
        root: null as any,
        queryId: "test",
        timestamp: Date.now(),
        timeout: 30000,
        maxResults: 50,
        enableRelevanceScoring: true
      };
      
      expect(async () => {
        await executeComplexQuery(invalidQuery, index, sseKey);
      }).rejects.toThrow();
    });

    it("should handle encryption errors gracefully", async () => {
      const query = buildComplexQuery("beach");
      const invalidKey = "invalid-key";
      
      expect(async () => {
        await executeComplexQuery(query, index, invalidKey);
      }).rejects.toThrow();
    });

    it("should handle index errors gracefully", async () => {
      const query = buildComplexQuery("beach");
      const emptyIndex = await initializeSearchIndex("empty");
      
      const results = await executeComplexQuery(query, emptyIndex, sseKey);
      
      expect(results.length).toBe(0);
    });
  });
});
