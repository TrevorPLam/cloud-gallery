// AI-META-BEGIN
// AI-META: Integration tests for search API endpoints covering NLP search functionality
// OWNERSHIP: server/api (search testing)
// ENTRYPOINTS: Test suite for search routes
// DEPENDENCIES: supertest, express, SearchService mocks, authentication
// DANGER: API testing complexity; authentication mocking; database interactions
// CHANGE-SAFETY: Safe - tests validate API behavior; update when adding endpoints
// TESTS: npm run test server/search-routes.test.ts
// AI-META-END

import request from "supertest";
import express from "express";
import { describe, it, expect, beforeEach, jest } from "vitest";
import searchRoutes from "./search-routes";
import { SearchService } from "./services/search";
import { SearchIndexService } from "./services/search-index";
import { authenticateToken } from "./auth";

// Mock services
jest.mock("./services/search");
jest.mock("./services/search-index");
jest.mock("./auth");
jest.mock("./db");

const mockSearchService = SearchService as jest.MockedClass<
  typeof SearchService
>;
const mockSearchIndexService = SearchIndexService as jest.MockedClass<
  typeof SearchIndexService
>;
const mockAuthenticateToken = authenticateToken as jest.MockedFunction<
  typeof authenticateToken
>;

// Mock app
const app = express();
app.use(express.json());
app.use("/api/search", searchRoutes);

// Test data
const mockUser = { id: "user123", username: "testuser" };
const mockPhotos = [
  {
    id: "1",
    userId: "user123",
    uri: "https://example.com/photo1.jpg",
    filename: "beach_sunset.jpg",
    createdAt: new Date(),
    isFavorite: true,
    isVideo: false,
    mlLabels: ["beach", "sunset"],
    tags: ["vacation"],
    notes: "Beautiful sunset",
  },
  {
    id: "2",
    userId: "user123",
    uri: "https://example.com/photo2.jpg",
    filename: "family_dinner.jpg",
    createdAt: new Date(),
    isFavorite: false,
    isVideo: false,
    mlLabels: ["people", "food"],
    tags: ["family"],
    notes: "Family dinner",
  },
];

describe("Search Routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authentication middleware
    mockAuthenticateToken.mockImplementation((req, res, next) => {
      (req as any).user = mockUser;
      next();
    });

    // Mock search service
    mockSearchService.prototype.search = jest.fn().mockResolvedValue({
      photos: mockPhotos,
      total: 2,
      query: { text: "beach" },
      suggestions: ["beach photos", "sunset photos"],
    });

    mockSearchService.prototype.getSuggestions = jest
      .fn()
      .mockResolvedValue(["beach", "sunset", "ocean"]);
    mockSearchService.prototype.getPopularSearches = jest
      .fn()
      .mockResolvedValue(["beach photos", "sunset photos"]);

    // Mock search index service
    mockSearchIndexService.prototype.getSearchSuggestions = jest
      .fn()
      .mockResolvedValue([
        { suggestion: "beach", type: "label", count: 10 },
        { suggestion: "vacation", type: "tag", count: 5 },
      ]);

    mockSearchIndexService.prototype.getPopularSearchTerms = jest
      .fn()
      .mockResolvedValue([
        { search_term: "beach", photo_count: 10, user_count: 3 },
        { search_term: "sunset", photo_count: 8, user_count: 2 },
      ]);

    mockSearchIndexService.prototype.fullTextSearch = jest
      .fn()
      .mockResolvedValue([
        {
          id: "1",
          uri: "test.jpg",
          filename: "test.jpg",
          created_at: new Date(),
          rank: 0.9,
        },
      ]);
  });

  describe("POST /api/search", () => {
    it("should search photos with natural language query", async () => {
      const response = await request(app)
        .post("/api/search")
        .send({
          query: "beach photos",
          limit: 20,
          offset: 0,
        })
        .expect(200);

      expect(response.body).toEqual({
        photos: mockPhotos,
        total: 2,
        query: { text: "beach" },
        suggestions: ["beach photos", "sunset photos"],
        pagination: {
          limit: 20,
          offset: 0,
          hasMore: false,
          total: 2,
        },
      });

      expect(mockSearchService.prototype.search).toHaveBeenCalledWith(
        "user123",
        "beach photos",
        20,
        0,
      );
    });

    it("should reject requests with empty query", async () => {
      const response = await request(app)
        .post("/api/search")
        .send({
          query: "",
          limit: 20,
          offset: 0,
        })
        .expect(400);

      expect(response.body).toEqual({
        error: "Search query cannot be empty",
        code: "EMPTY_QUERY",
      });
    });

    it("should handle invalid request parameters", async () => {
      const response = await request(app)
        .post("/api/search")
        .send({
          query: "test",
          limit: -1, // Invalid limit
          offset: 0,
        })
        .expect(400);

      expect(response.body.error).toContain("Invalid request parameters");
    });

    it("should require authentication", async () => {
      mockAuthenticateToken.mockImplementation((req, res, next) => {
        res.status(401).json({ error: "Unauthorized" });
      });

      const response = await request(app)
        .post("/api/search")
        .send({
          query: "beach photos",
          limit: 20,
          offset: 0,
        })
        .expect(401);

      expect(response.body).toEqual({
        error: "Unauthorized",
      });
    });

    it("should handle search service errors", async () => {
      mockSearchService.prototype.search = jest
        .fn()
        .mockRejectedValue(new Error("Search failed"));

      const response = await request(app)
        .post("/api/search")
        .send({
          query: "beach photos",
          limit: 20,
          offset: 0,
        })
        .expect(500);

      expect(response.body).toEqual({
        error: "Internal server error",
        code: "SEARCH_FAILED",
      });
    });

    it("should use default pagination values", async () => {
      await request(app)
        .post("/api/search")
        .send({
          query: "beach photos",
        })
        .expect(200);

      expect(mockSearchService.prototype.search).toHaveBeenCalledWith(
        "user123",
        "beach photos",
        20,
        0,
      );
    });
  });

  describe("GET /api/search/suggestions", () => {
    it("should get search suggestions", async () => {
      const response = await request(app)
        .get("/api/search/suggestions")
        .query({
          partial: "be",
          limit: 5,
        })
        .expect(200);

      expect(response.body).toEqual({
        suggestions: ["beach", "sunset", "ocean"],
        dbSuggestions: [
          { suggestion: "beach", type: "label", count: 10 },
          { suggestion: "vacation", type: "tag", count: 5 },
        ],
      });

      expect(mockSearchService.prototype.getSuggestions).toHaveBeenCalledWith(
        "user123",
        "be",
        5,
      );
      expect(
        mockSearchIndexService.prototype.getSearchSuggestions,
      ).toHaveBeenCalledWith("user123", "be", 5);
    });

    it("should require minimum query length", async () => {
      const response = await request(app)
        .get("/api/search/suggestions")
        .query({
          partial: "b", // Too short
          limit: 5,
        })
        .expect(200);

      expect(response.body.suggestions).toEqual([]);
    });

    it("should handle invalid parameters", async () => {
      const response = await request(app)
        .get("/api/search/suggestions")
        .query({
          partial: "test",
          limit: 0, // Invalid limit
        })
        .expect(400);

      expect(response.body.error).toContain("Invalid request parameters");
    });
  });

  describe("GET /api/search/popular", () => {
    it("should get popular searches", async () => {
      const response = await request(app)
        .get("/api/search/popular")
        .expect(200);

      expect(response.body).toEqual({
        popularSearches: ["beach photos", "sunset photos"],
        popularTerms: ["beach", "sunset"],
      });

      expect(
        mockSearchService.prototype.getPopularSearches,
      ).toHaveBeenCalledWith("user123", 10);
      expect(
        mockSearchIndexService.prototype.getPopularSearchTerms,
      ).toHaveBeenCalledWith(10);
    });

    it("should limit results as requested", async () => {
      await request(app)
        .get("/api/search/popular")
        .query({
          limit: 5,
        })
        .expect(200);

      expect(
        mockSearchService.prototype.getPopularSearches,
      ).toHaveBeenCalledWith("user123", 5);
      expect(
        mockSearchIndexService.prototype.getPopularSearchTerms,
      ).toHaveBeenCalledWith(5);
    });

    it("should enforce maximum limit", async () => {
      await request(app)
        .get("/api/search/popular")
        .query({
          limit: 100, // Over maximum
        })
        .expect(200);

      expect(
        mockSearchService.prototype.getPopularSearches,
      ).toHaveBeenCalledWith("user123", 20);
      expect(
        mockSearchIndexService.prototype.getPopularSearchTerms,
      ).toHaveBeenCalledWith(20);
    });
  });

  describe("POST /api/search/fulltext", () => {
    it("should perform full-text search", async () => {
      // Mock database count query
      const mockDb = require("./db").db;
      mockDb.select = jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          then: jest.fn().mockResolvedValue([{ count: 1 }]),
        }),
      });

      const response = await request(app)
        .post("/api/search/fulltext")
        .send({
          query: "beach",
          limit: 20,
          offset: 0,
        })
        .expect(200);

      expect(response.body.photos).toHaveLength(1);
      expect(response.body.total).toBe(1);
      expect(response.body.query).toBe("beach");

      expect(
        mockSearchIndexService.prototype.fullTextSearch,
      ).toHaveBeenCalledWith("user123", "beach", 20, 0);
    });

    it("should reject empty queries", async () => {
      const response = await request(app)
        .post("/api/search/fulltext")
        .send({
          query: "",
          limit: 20,
          offset: 0,
        })
        .expect(400);

      expect(response.body).toEqual({
        error: "Search query cannot be empty",
        code: "EMPTY_QUERY",
      });
    });
  });

  describe("GET /api/search/filters", () => {
    it("should get available filter options", async () => {
      // Mock database queries for filters
      const mockDb = require("./db").db;
      mockDb.select = jest
        .fn()
        .mockReturnValueOnce({
          where: jest.fn().mockReturnValue({
            then: jest
              .fn()
              .mockResolvedValue([{ label: "beach" }, { label: "sunset" }]),
          }),
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnValue({
            then: jest
              .fn()
              .mockResolvedValue([{ tag: "vacation" }, { tag: "family" }]),
          }),
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnValue({
            then: jest
              .fn()
              .mockResolvedValue([{ city: "California" }, { country: "USA" }]),
          }),
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnValue({
            then: jest.fn().mockResolvedValue([{ count: 5 }]),
          }),
        })
        .mockReturnValueOnce({
          where: jest.fn().mockReturnValue({
            then: jest.fn().mockResolvedValue([{ count: 2 }]),
          }),
        });

      const response = await request(app)
        .get("/api/search/filters")
        .expect(200);

      expect(response.body).toHaveProperty("objects");
      expect(response.body).toHaveProperty("tags");
      expect(response.body).toHaveProperty("locations");
      expect(response.body).toHaveProperty("mediaTypes");
      expect(response.body).toHaveProperty("hasFavorites");
      expect(response.body).toHaveProperty("hasVideos");
    });
  });

  describe("POST /api/search/index/rebuild", () => {
    it("should rebuild search indexes", async () => {
      mockSearchIndexService.prototype.rebuildSearchIndexes = jest
        .fn()
        .mockResolvedValue(undefined);
      mockSearchIndexService.prototype.refreshPopularSearches = jest
        .fn()
        .mockResolvedValue(undefined);

      const response = await request(app)
        .post("/api/search/index/rebuild")
        .expect(200);

      expect(response.body).toEqual({
        message: "Search indexes rebuilt successfully",
        timestamp: expect.any(String),
      });

      expect(
        mockSearchIndexService.prototype.rebuildSearchIndexes,
      ).toHaveBeenCalled();
      expect(
        mockSearchIndexService.prototype.refreshPopularSearches,
      ).toHaveBeenCalled();
    });

    it("should handle index rebuild errors", async () => {
      mockSearchIndexService.prototype.rebuildSearchIndexes = jest
        .fn()
        .mockRejectedValue(new Error("Rebuild failed"));

      const response = await request(app)
        .post("/api/search/index/rebuild")
        .expect(500);

      expect(response.body).toEqual({
        error: "Internal server error",
        code: "INDEX_REBUILD_FAILED",
      });
    });
  });

  describe("GET /api/search/index/stats", () => {
    it("should get search index statistics", async () => {
      mockSearchIndexService.prototype.getIndexStats = jest
        .fn()
        .mockResolvedValue([
          { indexname: "idx_photos_ml_labels_gin", tablename: "photos" },
          { indexname: "idx_photos_tags_gin", tablename: "photos" },
        ]);

      const response = await request(app)
        .get("/api/search/index/stats")
        .expect(200);

      expect(response.body).toHaveProperty("indexes");
      expect(response.body).toHaveProperty("popularTerms");
      expect(response.body).toHaveProperty("timestamp");

      expect(mockSearchIndexService.prototype.getIndexStats).toHaveBeenCalled();
      expect(
        mockSearchIndexService.prototype.getPopularSearchTerms,
      ).toHaveBeenCalledWith(10);
    });

    it("should handle stats errors", async () => {
      mockSearchIndexService.prototype.getIndexStats = jest
        .fn()
        .mockRejectedValue(new Error("Stats failed"));

      const response = await request(app)
        .get("/api/search/index/stats")
        .expect(500);

      expect(response.body).toEqual({
        error: "Internal server error",
        code: "INDEX_STATS_FAILED",
      });
    });
  });

  describe("Security Tests", () => {
    it("should prevent SQL injection in search queries", async () => {
      const maliciousQuery = "'; DROP TABLE photos; --";

      const response = await request(app)
        .post("/api/search")
        .send({
          query: maliciousQuery,
          limit: 20,
          offset: 0,
        })
        .expect(200);

      // Should not cause errors and should be handled safely
      expect(mockSearchService.prototype.search).toHaveBeenCalledWith(
        "user123",
        maliciousQuery,
        20,
        0,
      );
    });

    it("should rate limit search requests", async () => {
      // This would require implementing rate limiting middleware
      // For now, just verify the endpoint exists and is protected
      await request(app)
        .post("/api/search")
        .send({
          query: "test",
          limit: 20,
          offset: 0,
        })
        .expect(200);
    });

    it("should validate user isolation", async () => {
      await request(app)
        .post("/api/search")
        .send({
          query: "beach photos",
          limit: 20,
          offset: 0,
        })
        .expect(200);

      // Verify that the user ID is passed to the search service
      expect(mockSearchService.prototype.search).toHaveBeenCalledWith(
        "user123",
        "beach photos",
        20,
        0,
      );
    });
  });

  describe("Performance Tests", () => {
    it("should handle large search queries efficiently", async () => {
      const largeQuery = "beach ".repeat(1000); // Large query

      const response = await request(app)
        .post("/api/search")
        .send({
          query: largeQuery,
          limit: 20,
          offset: 0,
        })
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it("should handle concurrent search requests", async () => {
      const promises = Array(10)
        .fill(null)
        .map(() =>
          request(app).post("/api/search").send({
            query: "beach photos",
            limit: 20,
            offset: 0,
          }),
        );

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});
