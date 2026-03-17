import { PactV4, Matchers } from "@pact-foundation/pact";
import {
  createPact,
  commonHeaders,
  authHeaders,
  matchers,
} from "../utils/setup";
import {
  createPhotoMatcher,
  createSearchResultsMatcher,
  createErrorResponseMatcher,
  createSearchRequest,
} from "../utils/helpers";

describe("Search API Consumer Tests", () => {
  const provider = createPact();

  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  describe("POST /api/search", () => {
    it("should return search results for valid query", async () => {
      const searchRequest = createSearchRequest();

      await provider
        .given("user has photos matching search query")
        .uponReceiving("a search request with valid query")
        .withRequest({
          method: "POST",
          path: "/api/search",
          headers: authHeaders,
          body: searchRequest,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: createSearchResultsMatcher(15, searchRequest.query),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/search`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(searchRequest),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.photos).toBeDefined();
        expect(data.total).toBe(15);
        expect(data.query).toBe(searchRequest.query);
        expect(data.suggestions).toBeDefined();
        expect(data.pagination).toBeDefined();
      });
    });

    it("should return empty results for query with no matches", async () => {
      const searchRequest = {
        query: "nonexistent-tag",
        limit: 20,
        offset: 0,
      };

      await provider
        .given("user has no photos matching search query")
        .uponReceiving("a search request with no matching results")
        .withRequest({
          method: "POST",
          path: "/api/search",
          headers: authHeaders,
          body: searchRequest,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: createSearchResultsMatcher(0, searchRequest.query),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/search`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(searchRequest),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.photos).toEqual([]);
        expect(data.total).toBe(0);
        expect(data.query).toBe(searchRequest.query);
      });
    });

    it("should reject empty search query", async () => {
      const invalidSearchRequest = {
        query: "",
        limit: 20,
        offset: 0,
      };

      await provider
        .uponReceiving("a search request with empty query")
        .withRequest({
          method: "POST",
          path: "/api/search",
          headers: authHeaders,
          body: invalidSearchRequest,
        })
        .willRespondWith({
          status: 400,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            400,
            "Search query cannot be empty",
            "Search query cannot be empty",
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/search`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(invalidSearchRequest),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe("Search query cannot be empty");
      });
    });

    it("should reject search request without authentication", async () => {
      const searchRequest = createSearchRequest();

      await provider
        .uponReceiving("a search request without authentication")
        .withRequest({
          method: "POST",
          path: "/api/search",
          headers: commonHeaders,
          body: searchRequest,
        })
        .willRespondWith({
          status: 401,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            401,
            "User not authenticated",
            "Authentication required",
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/search`, {
          method: "POST",
          headers: commonHeaders,
          body: JSON.stringify(searchRequest),
        });

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe("User not authenticated");
      });
    });
  });

  describe("GET /api/search/suggestions", () => {
    it("should return search suggestions", async () => {
      await provider
        .given("user has search history and photos")
        .uponReceiving("a request for search suggestions")
        .withRequest({
          method: "GET",
          path: "/api/search/suggestions",
          headers: authHeaders,
          query: { partial: "vac", limit: "5" },
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            suggestions: Matchers.eachLike("vacation"),
            dbSuggestions: Matchers.eachLike("vacation"),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/search/suggestions?partial=vac&limit=5`,
          {
            method: "GET",
            headers: authHeaders,
          },
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.suggestions).toBeDefined();
        expect(data.dbSuggestions).toBeDefined();
        expect(Array.isArray(data.suggestions)).toBe(true);
        expect(Array.isArray(data.dbSuggestions)).toBe(true);
      });
    });

    it("should return empty suggestions for unknown partial", async () => {
      await provider
        .given("user has no matching search history")
        .uponReceiving("a request for suggestions with unknown partial")
        .withRequest({
          method: "GET",
          path: "/api/search/suggestions",
          headers: authHeaders,
          query: { partial: "xyz123", limit: "5" },
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            suggestions: [],
            dbSuggestions: [],
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/search/suggestions?partial=xyz123&limit=5`,
          {
            method: "GET",
            headers: authHeaders,
          },
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.suggestions).toEqual([]);
        expect(data.dbSuggestions).toEqual([]);
      });
    });

    it("should reject suggestions request without authentication", async () => {
      await provider
        .uponReceiving("a suggestions request without authentication")
        .withRequest({
          method: "GET",
          path: "/api/search/suggestions",
          headers: commonHeaders,
          query: { partial: "vac", limit: "5" },
        })
        .willRespondWith({
          status: 401,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            401,
            "User not authenticated",
            "Authentication required",
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/search/suggestions?partial=vac&limit=5`,
          {
            method: "GET",
            headers: commonHeaders,
          },
        );

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe("User not authenticated");
      });
    });
  });

  describe("GET /api/search/popular", () => {
    it("should return popular search terms", async () => {
      await provider
        .given("user has search history")
        .given("system has popular search terms")
        .uponReceiving("a request for popular searches")
        .withRequest({
          method: "GET",
          path: "/api/search/popular",
          headers: authHeaders,
          query: { limit: "10" },
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            popularSearches: Matchers.eachLike("vacation"),
            popularTerms: Matchers.eachLike("beach"),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/search/popular?limit=10`,
          {
            method: "GET",
            headers: authHeaders,
          },
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.popularSearches).toBeDefined();
        expect(data.popularTerms).toBeDefined();
        expect(Array.isArray(data.popularSearches)).toBe(true);
        expect(Array.isArray(data.popularTerms)).toBe(true);
      });
    });

    it("should return empty popular searches for new user", async () => {
      await provider
        .given("user has no search history")
        .uponReceiving("a request for popular searches from new user")
        .withRequest({
          method: "GET",
          path: "/api/search/popular",
          headers: authHeaders,
          query: { limit: "10" },
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            popularSearches: [],
            popularTerms: Matchers.eachLike("beach"), // System-wide terms still returned
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/search/popular?limit=10`,
          {
            method: "GET",
            headers: authHeaders,
          },
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.popularSearches).toEqual([]);
        expect(data.popularTerms).toBeDefined();
      });
    });
  });

  describe("POST /api/search/fulltext", () => {
    it("should perform full-text search", async () => {
      const fullTextSearchRequest = {
        query: "beach sunset",
        limit: 20,
        offset: 0,
      };

      await provider
        .given("user has photos with matching text content")
        .uponReceiving("a full-text search request")
        .withRequest({
          method: "POST",
          path: "/api/search/fulltext",
          headers: authHeaders,
          body: fullTextSearchRequest,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            photos: Matchers.eachLike(createPhotoMatcher()),
            total: Matchers.like(8),
            query: Matchers.like(fullTextSearchRequest.query),
            pagination: {
              limit: Matchers.like(fullTextSearchRequest.limit),
              offset: Matchers.like(fullTextSearchRequest.offset),
              hasMore: Matchers.like(false),
              total: Matchers.like(8),
            },
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/search/fulltext`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(fullTextSearchRequest),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.photos).toBeDefined();
        expect(data.total).toBe(8);
        expect(data.query).toBe(fullTextSearchRequest.query);
        expect(data.pagination).toBeDefined();
      });
    });

    it("should return empty results for full-text search with no matches", async () => {
      const fullTextSearchRequest = {
        query: "nonexistent-text-12345",
        limit: 20,
        offset: 0,
      };

      await provider
        .given("user has no photos with matching text content")
        .uponReceiving("a full-text search request with no matches")
        .withRequest({
          method: "POST",
          path: "/api/search/fulltext",
          headers: authHeaders,
          body: fullTextSearchRequest,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            photos: [],
            total: 0,
            query: Matchers.like(fullTextSearchRequest.query),
            pagination: {
              limit: Matchers.like(fullTextSearchRequest.limit),
              offset: Matchers.like(fullTextSearchRequest.offset),
              hasMore: Matchers.like(false),
              total: 0,
            },
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/search/fulltext`, {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify(fullTextSearchRequest),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.photos).toEqual([]);
        expect(data.total).toBe(0);
      });
    });
  });

  describe("GET /api/search/filters", () => {
    it("should return available filter options", async () => {
      await provider
        .given("user has photos with various metadata")
        .uponReceiving("a request for available filters")
        .withRequest({
          method: "GET",
          path: "/api/search/filters",
          headers: authHeaders,
          query: { limit: "100", offset: "0" },
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            objects: Matchers.eachLike("beach"),
            tags: Matchers.eachLike("vacation"),
            locations: {
              cities: Matchers.eachLike("New York"),
              countries: Matchers.eachLike("USA"),
            },
            mediaTypes: ["photo", "video"],
            hasFavorites: Matchers.like(true),
            hasVideos: Matchers.like(false),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/search/filters?limit=100&offset=0`,
          {
            method: "GET",
            headers: authHeaders,
          },
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.objects).toBeDefined();
        expect(data.tags).toBeDefined();
        expect(data.locations).toBeDefined();
        expect(data.locations.cities).toBeDefined();
        expect(data.locations.countries).toBeDefined();
        expect(data.mediaTypes).toEqual(["photo", "video"]);
        expect(typeof data.hasFavorites).toBe("boolean");
        expect(typeof data.hasVideos).toBe("boolean");
      });
    });

    it("should return empty filters for user with no photos", async () => {
      await provider
        .given("user has no photos")
        .uponReceiving("a request for filters from user with no photos")
        .withRequest({
          method: "GET",
          path: "/api/search/filters",
          headers: authHeaders,
          query: { limit: "100", offset: "0" },
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            objects: [],
            tags: [],
            locations: {
              cities: [],
              countries: [],
            },
            mediaTypes: ["photo", "video"],
            hasFavorites: Matchers.like(false),
            hasVideos: Matchers.like(false),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/search/filters?limit=100&offset=0`,
          {
            method: "GET",
            headers: authHeaders,
          },
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.objects).toEqual([]);
        expect(data.tags).toEqual([]);
        expect(data.locations.cities).toEqual([]);
        expect(data.locations.countries).toEqual([]);
        expect(data.hasFavorites).toBe(false);
        expect(data.hasVideos).toBe(false);
      });
    });
  });
});
