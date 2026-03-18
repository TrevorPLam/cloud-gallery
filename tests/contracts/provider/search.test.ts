// @vitest-environment node
import { describe, it, expect } from "vitest";
import { Verifier } from "@pact-foundation/pact";
import path from "path";

// Provider verification tests require a live server. Skip when PROVIDER_BASE_URL is not set.
describe.skipIf(!process.env.PROVIDER_BASE_URL)("Search API Provider Verification", () => {
  const providerBaseUrl =
    process.env.PROVIDER_BASE_URL || "http://localhost:5000";

  // Pact verifier configuration
  const verifier = new Verifier({
    providerBaseUrl,
    provider: "cloud-gallery-api",
    providerStatesSetupUrl: `${providerBaseUrl}/api/pact/states`,
    requestFilter: (req: any, _res: any, next: () => void) => {
      // Add authentication headers for all search endpoints
      req.headers["Authorization"] = "Bearer test-jwt-token";
      next();
    },
    stateHandlers: {
      "user has photos matching search query": async () => {
        console.log("Setting up state: user has photos matching search query");
        // Create test photos with matching content
        return Promise.resolve();
      },
      "user has no photos matching search query": async () => {
        console.log(
          "Setting up state: user has no photos matching search query",
        );
        // Ensure no photos match the search query
        return Promise.resolve();
      },
      "user has search history and photos": async () => {
        console.log("Setting up state: user has search history and photos");
        // Create test photos and search history
        return Promise.resolve();
      },
      "user has no matching search history": async () => {
        console.log("Setting up state: user has no matching search history");
        // Ensure no search history matches the partial query
        return Promise.resolve();
      },
      "user has search history": async () => {
        console.log("Setting up state: user has search history");
        // Create test search history
        return Promise.resolve();
      },
      "user has no search history": async () => {
        console.log("Setting up state: user has no search history");
        // Ensure user has no search history
        return Promise.resolve();
      },
      "system has popular search terms": async () => {
        console.log("Setting up state: system has popular search terms");
        // Ensure system has popular search terms
        return Promise.resolve();
      },
      "user has photos with various metadata": async () => {
        console.log("Setting up state: user has photos with various metadata");
        // Create test photos with diverse metadata
        return Promise.resolve();
      },
      "user has no photos": async () => {
        console.log("Setting up state: user has no photos");
        // Ensure user has no photos
        return Promise.resolve();
      },
      "user has photos with matching text content": async () => {
        console.log(
          "Setting up state: user has photos with matching text content",
        );
        // Create test photos with matching OCR/text content
        return Promise.resolve();
      },
      "user has no photos with matching text content": async () => {
        console.log(
          "Setting up state: user has no photos with matching text content",
        );
        // Ensure no photos have matching text content
        return Promise.resolve();
      },
    },
    logLevel: "INFO",
  });

  describe("Search endpoints verification", () => {
    it("should validate search contracts", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyProvider({
          pactUrls: pactFiles,
          timeout: 30000,
        });

        console.log("Search pact verification output:", output);
        expect(output).toBeDefined();
      } catch (error) {
        console.error("Search pact verification failed:", error);
        throw error;
      }
    }, 60000);
  });

  describe("Individual search endpoint verification", () => {
    it("should verify POST /api/search", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyProvider({
          pactUrls: pactFiles,
          consumerVersionTags: ["dev"],
          providerVersionTags: ["dev"],
        });

        expect(output).toBeDefined();
      } catch (error) {
        console.error("POST search verification failed:", error);
        throw error;
      }
    }, 30000);

    it("should verify GET /api/search/suggestions", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyProvider({
          pactUrls: pactFiles,
          consumerVersionTags: ["dev"],
          providerVersionTags: ["dev"],
        });

        expect(output).toBeDefined();
      } catch (error) {
        console.error("GET search suggestions verification failed:", error);
        throw error;
      }
    }, 30000);

    it("should verify GET /api/search/popular", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyProvider({
          pactUrls: pactFiles,
          consumerVersionTags: ["dev"],
          providerVersionTags: ["dev"],
        });

        expect(output).toBeDefined();
      } catch (error) {
        console.error("GET popular searches verification failed:", error);
        throw error;
      }
    }, 30000);

    it("should verify POST /api/search/fulltext", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyProvider({
          pactUrls: pactFiles,
          consumerVersionTags: ["dev"],
          providerVersionTags: ["dev"],
        });

        expect(output).toBeDefined();
      } catch (error) {
        console.error("POST full-text search verification failed:", error);
        throw error;
      }
    }, 30000);

    it("should verify GET /api/search/filters", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyProvider({
          pactUrls: pactFiles,
          consumerVersionTags: ["dev"],
          providerVersionTags: ["dev"],
        });

        expect(output).toBeDefined();
      } catch (error) {
        console.error("GET search filters verification failed:", error);
        throw error;
      }
    }, 30000);
  });
});

// Search-specific state handlers
export const searchStateHandlers = {
  setupSearchStates: (app: any) => {
    // Extend the main provider states handler with search-specific states
    app.post("/api/pact/states", async (req: any, res: any) => {
      const { state } = req.body;

      try {
        console.log(`Setting search provider state: ${state}`);

        switch (state) {
          case "user has photos matching search query":
            await createTestPhotosWithSearchableContent();
            break;
          case "user has no photos matching search query":
            await createTestPhotosWithoutSearchableContent();
            break;
          case "user has search history and photos":
            await createTestSearchHistoryAndPhotos();
            break;
          case "user has no matching search history":
            await createTestSearchHistoryWithoutMatchingTerms();
            break;
          case "user has search history":
            await createTestSearchHistory();
            break;
          case "user has no search history":
            await cleanupTestSearchHistory();
            break;
          case "system has popular search terms":
            await createTestPopularSearchTerms();
            break;
          case "user has photos with various metadata":
            await createTestPhotosWithMetadata();
            break;
          case "user has no photos":
            await cleanupTestPhotos();
            break;
          case "user has photos with matching text content":
            await createTestPhotosWithTextContent();
            break;
          case "user has no photos with matching text content":
            await createTestPhotosWithoutTextContent();
            break;
          default:
            console.log(`Delegating to generic handler for state: ${state}`);
        }

        res.status(200).json({ status: "ok", state });
      } catch (error) {
        console.error(`Failed to set search provider state ${state}:`, error);
        res.status(500).json({ error: "Failed to set state" });
      }
    });
  },
};

// Search-specific helper functions
async function createTestPhotosWithSearchableContent() {
  console.log("Creating test photos with searchable content");
  // Implementation would create photos with ML labels, tags, etc.
}

async function createTestPhotosWithoutSearchableContent() {
  console.log("Creating test photos without searchable content");
  // Implementation would create photos that don't match search queries
}

async function createTestSearchHistoryAndPhotos() {
  console.log("Creating test search history and photos");
  // Implementation would create both search history and photos
}

async function createTestSearchHistoryWithoutMatchingTerms() {
  console.log("Creating test search history without matching terms");
  // Implementation would create search history that doesn't match partial query
}

async function createTestSearchHistory() {
  console.log("Creating test search history");
  // Implementation would create user search history
}

async function cleanupTestSearchHistory() {
  console.log("Cleaning up test search history");
  // Implementation would delete test search history
}

async function createTestPopularSearchTerms() {
  console.log("Creating test popular search terms");
  // Implementation would create system-wide popular search terms
}

async function createTestPhotosWithMetadata() {
  console.log("Creating test photos with various metadata");
  // Implementation would create photos with diverse ML labels, tags, locations
}

async function cleanupTestPhotos() {
  console.log("Cleaning up test photos");
  // Implementation would delete all test photos
}

async function createTestPhotosWithTextContent() {
  console.log("Creating test photos with text content");
  // Implementation would create photos with OCR text content
}

async function createTestPhotosWithoutTextContent() {
  console.log("Creating test photos without text content");
  // Implementation would create photos without matching OCR text
}
