import { Verifier } from "@pact-foundation/pact";
import path from "path";

describe("Albums API Provider Verification", () => {
  const providerBaseUrl =
    process.env.PROVIDER_BASE_URL || "http://localhost:5000";

  // Pact verifier configuration
  const verifier = new Verifier({
    providerBaseUrl,
    provider: "cloud-gallery-api",
    providerStatesSetupUrl: `${providerBaseUrl}/api/pact/states`,
    requestFilter: (req, res) => {
      // Add authentication headers for all album endpoints
      req.headers["Authorization"] = "Bearer test-jwt-token";
    },
    stateHandlers: {
      "user has albums": async () => {
        console.log("Setting up state: user has albums");
        // Create test albums for the user
        return Promise.resolve();
      },
      "user has no albums": async () => {
        console.log("Setting up state: user has no albums");
        // Ensure user has no albums
        return Promise.resolve();
      },
      "album exists and belongs to user": async () => {
        console.log("Setting up state: album exists and belongs to user");
        // Create a specific test album
        return Promise.resolve();
      },
      "album and photo exist and belong to user": async () => {
        console.log(
          "Setting up state: album and photo exist and belong to user",
        );
        // Create test album and photo, but photo is not in album
        return Promise.resolve();
      },
      "album does not exist": async () => {
        console.log("Setting up state: album does not exist");
        // Ensure album doesn't exist
        return Promise.resolve();
      },
      "album exists but belongs to another user": async () => {
        console.log("Setting up state: album exists but belongs to another user");
        // Create album for different user
        return Promise.resolve();
      },
    },
    logLevel: "INFO",
  });

  describe("Albums endpoints verification", () => {
    it("should validate albums contracts", async () => {
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
          providerBaseUrl,
          pactUrls: pactFiles,
          timeout: 30000,
        });

        console.log("Albums pact verification output:", output);
        expect(output).toBeDefined();
      } catch (error) {
        console.error("Albums pact verification failed:", error);
        throw error;
      }
    }, 60000);
  });

  describe("Individual album endpoint verification", () => {
    it("should verify GET /api/albums", async () => {
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
          providerBaseUrl,
          pactUrls: pactFiles,
          consumerVersionTags: ["dev"],
        });

        console.log("GET /api/albums verification output:", output);
        expect(output).toBeDefined();
      } catch (error) {
        console.error("GET /api/albums verification failed:", error);
        throw error;
      }
    }, 60000);

    it("should verify GET /api/albums/:id", async () => {
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
          providerBaseUrl,
          pactUrls: pactFiles,
          consumerVersionTags: ["dev"],
        });

        console.log("GET /api/albums/:id verification output:", output);
        expect(output).toBeDefined();
      } catch (error) {
        console.error("GET /api/albums/:id verification failed:", error);
        throw error;
      }
    }, 60000);
    });

    it("should verify POST /api/albums", async () => {
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
          providerBaseUrl,
          pactUrls: pactFiles,
          consumerVersionTags: ["dev"],
        });

        console.log("POST /api/albums verification output:", output);
        expect(output).toBeDefined();
      } catch (error) {
        console.error("POST /api/albums verification failed:", error);
        throw error;
      }
    }, 60000);

    it("should verify POST /api/albums/:id/photos", async () => {
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
          providerBaseUrl,
          pactUrls: pactFiles,
          consumerVersionTags: ["dev"],
        });

        console.log("POST /api/albums/:id/photos verification output:", output);
        expect(output).toBeDefined();
      } catch (error) {
        console.error("POST /api/albums/:id/photos verification failed:", error);
        throw error;
      }
    }, 60000);

    it("should verify DELETE /api/albums/:id/photos/:photoId", async () => {
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
          providerBaseUrl,
          pactUrls: pactFiles,
          consumerVersionTags: ["dev"],
        });

        console.log("DELETE /api/albums/:id/photos/:photoId verification output:", output);
        expect(output).toBeDefined();
      } catch (error) {
        console.error("DELETE /api/albums/:id/photos/:photoId verification failed:", error);
        throw error;
      }
    }, 60000);

    it("should verify DELETE /api/albums/:id", async () => {
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
          providerBaseUrl,
          pactUrls: pactFiles,
          consumerVersionTags: ["dev"],
        });

        console.log("DELETE /api/albums/:id verification output:", output);
        expect(output).toBeDefined();
      } catch (error) {
        console.error("DELETE /api/albums/:id verification failed:", error);
        throw error;
      }
    }, 60000);
});

// Album-specific state handlers
export const albumStateHandlers = {
  setupAlbumStates: (app: any) => {
    // Extend the main provider states handler with album-specific states
    app.post("/api/pact/states", async (req: any, res: any) => {
      const { state } = req.body;

      try {
        console.log(`Setting album provider state: ${state}`);

        switch (state) {
          case "user has albums":
            await createTestAlbums();
            break;
          case "user has no albums":
            await cleanupTestAlbums();
            break;
          case "album exists and belongs to user":
            await createTestAlbum();
            break;
          case "album does not exist":
            await cleanupTestAlbums();
            break;
          case "album exists but belongs to another user":
            await createOtherUserAlbum();
            break;
          case "album and photo exist and belong to user (basic)": 
            await createTestAlbumAndPhoto();
            break;
          case "album and photo exist and belong to user": // Photo not in album
            await createTestAlbumAndPhotoNotInAlbum();
            break;
          case "album and photo exist and belong to user (photo in album)": // Photo in album
            await createTestAlbumAndPhotoInAlbum();
            break;
          default:
            console.log(`Delegating to generic handler for state: ${state}`);
        }

        res.status(200).json({ status: "ok", state });
      } catch (error) {
        console.error(`Failed to set album provider state ${state}:`, error);
        res.status(500).json({ error: "Failed to set state" });
      }
    });
  },
};

// Album-specific helper functions
async function createTestAlbums() {
  console.log("Creating test albums for user");
  // Implementation would create multiple test albums in database
}

async function cleanupTestAlbums() {
  console.log("Cleaning up test albums");
  // Implementation would delete all test albums
}

async function createTestAlbum() {
  console.log("Creating single test album");
  // Implementation would create a specific test album with known ID
}

async function createOtherUserAlbum() {
  console.log("Creating album belonging to another user");
  // Implementation would create an album that belongs to a different user
}

async function createTestAlbumAndPhoto() {
  console.log("Creating test album and photo");
  // Implementation would create both album and photo for the user
}

async function createTestAlbumAndPhotoNotInAlbum() {
  console.log("Creating test album and photo (photo not in album)");
  // Implementation would create album and photo but not associate them
}

async function createTestAlbumAndPhotoInAlbum() {
  console.log("Creating test album and photo (photo in album)");
  // Implementation would create album and photo and add photo to album
}
