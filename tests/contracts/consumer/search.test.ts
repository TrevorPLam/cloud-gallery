// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PactV4, Matchers } from "@pact-foundation/pact";
import path from "path";
import {
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
  const provider = new PactV4({
    consumer: "cloud-gallery-client",
    provider: "cloud-gallery-api",
    port: 4000,
    dir: path.resolve(process.cwd(), "tests", "contracts", "pacts"),
    logLevel: "INFO",
  });

  describe("POST /api/search", () => {
    it("should return search results for valid query", async () => {
      const searchRequest = createSearchRequest();

      await provider
        .addInteraction()
        .given("user has photos matching search query")
        .uponReceiving("a search request with valid query")
        .withRequest("POST", "/api/search", (builder) => {
          builder.headers(authHeaders);
          builder.jsonBody(searchRequest);
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(createSearchResultsMatcher(15, searchRequest.query));
        })
        .executeTest(async (mockServer) => {
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
      const searchRequest = { query: "nonexistent-tag", limit: 20, offset: 0 };

      await provider
        .addInteraction()
        .given("user has no photos matching search query")
        .uponReceiving("a search request with no matching results")
        .withRequest("POST", "/api/search", (builder) => {
          builder.headers(authHeaders);
          builder.jsonBody(searchRequest);
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(createSearchResultsMatcher(0, searchRequest.query));
        })
        .executeTest(async (mockServer) => {
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
      const invalidSearchRequest = { query: "", limit: 20, offset: 0 };

      await provider
        .addInteraction()
        .uponReceiving("a search request with empty query")
        .withRequest("POST", "/api/search", (builder) => {
          builder.headers(authHeaders);
          builder.jsonBody(invalidSearchRequest);
        })
        .willRespondWith(400, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(
              400,
              "Search query cannot be empty",
              "Search query cannot be empty",
            ),
          );
        })
        .executeTest(async (mockServer) => {
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
        .addInteraction()
        .uponReceiving("a search request without authentication")
        .withRequest("POST", "/api/search", (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(searchRequest);
        })
        .willRespondWith(401, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(
              401,
              "User not authenticated",
              "Authentication required",
            ),
          );
        })
        .executeTest(async (mockServer) => {
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
        .addInteraction()
        .given("user has search history and photos")
        .uponReceiving("a request for search suggestions")
        .withRequest("GET", "/api/search/suggestions", (builder) => {
          builder.headers(authHeaders);
          builder.query({ partial: "vac", limit: "5" });
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            suggestions: Matchers.eachLike("vacation"),
            dbSuggestions: Matchers.eachLike("vacation"),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/search/suggestions?partial=vac&limit=5`,
            { method: "GET", headers: authHeaders },
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
        .addInteraction()
        .given("user has no matching search history")
        .uponReceiving("a request for suggestions with unknown partial")
        .withRequest("GET", "/api/search/suggestions", (builder) => {
          builder.headers(authHeaders);
          builder.query({ partial: "xyz123", limit: "5" });
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({ suggestions: [], dbSuggestions: [] });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/search/suggestions?partial=xyz123&limit=5`,
            { method: "GET", headers: authHeaders },
          );

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.suggestions).toEqual([]);
          expect(data.dbSuggestions).toEqual([]);
        });
    });

    it("should reject suggestions request without authentication", async () => {
      await provider
        .addInteraction()
        .uponReceiving("a suggestions request without authentication")
        .withRequest("GET", "/api/search/suggestions", (builder) => {
          builder.headers(commonHeaders);
          builder.query({ partial: "vac", limit: "5" });
        })
        .willRespondWith(401, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(
              401,
              "User not authenticated",
              "Authentication required",
            ),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/search/suggestions?partial=vac&limit=5`,
            { method: "GET", headers: commonHeaders },
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
        .addInteraction()
        .given("user has search history")
        .given("system has popular search terms")
        .uponReceiving("a request for popular searches")
        .withRequest("GET", "/api/search/popular", (builder) => {
          builder.headers(authHeaders);
          builder.query({ limit: "10" });
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            popularSearches: Matchers.eachLike("vacation"),
            popularTerms: Matchers.eachLike("beach"),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/search/popular?limit=10`,
            { method: "GET", headers: authHeaders },
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
        .addInteraction()
        .given("user has no search history")
        .uponReceiving("a request for popular searches from new user")
        .withRequest("GET", "/api/search/popular", (builder) => {
          builder.headers(authHeaders);
          builder.query({ limit: "10" });
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            popularSearches: [],
            popularTerms: Matchers.eachLike("beach"),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/search/popular?limit=10`,
            { method: "GET", headers: authHeaders },
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
        .addInteraction()
        .given("user has photos with matching text content")
        .uponReceiving("a full-text search request")
        .withRequest("POST", "/api/search/fulltext", (builder) => {
          builder.headers(authHeaders);
          builder.jsonBody(fullTextSearchRequest);
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            photos: Matchers.eachLike(createPhotoMatcher()),
            total: Matchers.like(8),
            query: Matchers.like(fullTextSearchRequest.query),
            pagination: {
              limit: Matchers.like(fullTextSearchRequest.limit),
              offset: Matchers.like(fullTextSearchRequest.offset),
              hasMore: Matchers.like(false),
              total: Matchers.like(8),
            },
          });
        })
        .executeTest(async (mockServer) => {
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
        .addInteraction()
        .given("user has no photos with matching text content")
        .uponReceiving("a full-text search request with no matches")
        .withRequest("POST", "/api/search/fulltext", (builder) => {
          builder.headers(authHeaders);
          builder.jsonBody(fullTextSearchRequest);
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            photos: [],
            total: 0,
            query: Matchers.like(fullTextSearchRequest.query),
            pagination: {
              limit: Matchers.like(fullTextSearchRequest.limit),
              offset: Matchers.like(fullTextSearchRequest.offset),
              hasMore: Matchers.like(false),
              total: 0,
            },
          });
        })
        .executeTest(async (mockServer) => {
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
        .addInteraction()
        .given("user has photos with various metadata")
        .uponReceiving("a request for available filters")
        .withRequest("GET", "/api/search/filters", (builder) => {
          builder.headers(authHeaders);
          builder.query({ limit: "100", offset: "0" });
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            objects: Matchers.eachLike("beach"),
            tags: Matchers.eachLike("vacation"),
            locations: {
              cities: Matchers.eachLike("New York"),
              countries: Matchers.eachLike("USA"),
            },
            mediaTypes: ["photo", "video"],
            hasFavorites: Matchers.like(true),
            hasVideos: Matchers.like(false),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/search/filters?limit=100&offset=0`,
            { method: "GET", headers: authHeaders },
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
        .addInteraction()
        .given("user has no photos")
        .uponReceiving("a request for filters from user with no photos")
        .withRequest("GET", "/api/search/filters", (builder) => {
          builder.headers(authHeaders);
          builder.query({ limit: "100", offset: "0" });
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            objects: [],
            tags: [],
            locations: { cities: [], countries: [] },
            mediaTypes: ["photo", "video"],
            hasFavorites: Matchers.like(false),
            hasVideos: Matchers.like(false),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/search/filters?limit=100&offset=0`,
            { method: "GET", headers: authHeaders },
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
        .withRequest("GET", "/api/search/filters", (builder) => {
          builder.headers(authHeaders);
          builder.query({ limit: "100", offset: "0" });
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            objects: [],
            tags: [],
            locations: { cities: [], countries: [] },
            mediaTypes: ["photo", "video"],
            hasFavorites: Matchers.like(false),
            hasVideos: Matchers.like(false),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/search/filters?limit=100&offset=0`,
            { method: "GET", headers: authHeaders },
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

