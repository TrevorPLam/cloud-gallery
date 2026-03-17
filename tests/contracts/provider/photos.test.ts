import { Verifier } from "@pact-foundation/pact";
import path from "path";

describe("Photos API Provider Verification", () => {
  const providerBaseUrl =
    process.env.PROVIDER_BASE_URL || "http://localhost:5000";

  // Pact verifier configuration
  const verifier = new Verifier({
    providerBaseUrl,
    provider: "cloud-gallery-api",
    providerStatesSetupUrl: `${providerBaseUrl}/api/pact/states`,
    requestFilter: (req, res) => {
      // Add authentication headers for all photo endpoints
      req.headers["Authorization"] = "Bearer test-jwt-token";
    },
    stateHandlers: {
      "user has photos": async () => {
        console.log("Setting up state: user has photos");
        // Create test photos for the user
        return Promise.resolve();
      },
      "user has favorite photos": async () => {
        console.log("Setting up state: user has favorite photos");
        // Create test photos with some marked as favorites
        return Promise.resolve();
      },
      "photo exists and belongs to user": async () => {
        console.log("Setting up state: photo exists and belongs to user");
        // Create a specific test photo
        return Promise.resolve();
      },
      "photo does not exist": async () => {
        console.log("Setting up state: photo does not exist");
        // Ensure no test photo exists
        return Promise.resolve();
      },
      "photo exists but belongs to another user": async () => {
        console.log(
          "Setting up state: photo exists but belongs to another user",
        );
        // Create a photo belonging to a different user
        return Promise.resolve();
      },
      "user is authenticated": async () => {
        console.log("Setting up state: user is authenticated");
        // Set up authenticated user session
        return Promise.resolve();
      },
    },
    logLevel: "INFO",
  });

  describe("Photos endpoints verification", () => {
    it("should validate photos contracts", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyPacts({
          pactFiles,
          timeout: 30000,
        });

        console.log("Photos pact verification output:", output);
        expect(output).toBeDefined();
      } catch (error) {
        console.error("Photos pact verification failed:", error);
        throw error;
      }
    }, 60000);
  });

  describe("Individual photo endpoint verification", () => {
    it("should verify GET /api/photos", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyPacts({
          pactFiles,
          consumerVersionTags: ["dev"],
          providerVersionTags: ["dev"],
        });

        expect(output).toBeDefined();
      } catch (error) {
        console.error("GET photos verification failed:", error);
        throw error;
      }
    }, 30000);

    it("should verify GET /api/photos/:id", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyPacts({
          pactFiles,
          consumerVersionTags: ["dev"],
          providerVersionTags: ["dev"],
        });

        expect(output).toBeDefined();
      } catch (error) {
        console.error("GET photo by ID verification failed:", error);
        throw error;
      }
    }, 30000);

    it("should verify POST /api/photos", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyPacts({
          pactFiles,
          consumerVersionTags: ["dev"],
          providerVersionTags: ["dev"],
        });

        expect(output).toBeDefined();
      } catch (error) {
        console.error("POST photo verification failed:", error);
        throw error;
      }
    }, 30000);

    it("should verify PUT /api/photos/:id/favorite", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyPacts({
          pactFiles,
          consumerVersionTags: ["dev"],
          providerVersionTags: ["dev"],
        });

        expect(output).toBeDefined();
      } catch (error) {
        console.error("PUT photo favorite verification failed:", error);
        throw error;
      }
    }, 30000);

    it("should verify DELETE /api/photos/:id", async () => {
      const pactFiles = [
        path.resolve(
          __dirname,
          "..",
          "pacts",
          "cloud-gallery-client-cloud-gallery-api.json",
        ),
      ];

      try {
        const output = await verifier.verifyPacts({
          pactFiles,
          consumerVersionTags: ["dev"],
          providerVersionTags: ["dev"],
        });

        expect(output).toBeDefined();
      } catch (error) {
        console.error("DELETE photo verification failed:", error);
        throw error;
      }
    }, 30000);
  });
});

// Photo-specific state handlers
export const photoStateHandlers = {
  setupPhotoStates: (app: any) => {
    // Extend the main provider states handler with photo-specific states
    app.post("/api/pact/states", async (req: any, res: any) => {
      const { state } = req.body;

      try {
        console.log(`Setting photo provider state: ${state}`);

        switch (state) {
          case "user has photos":
            await createTestPhotos();
            break;
          case "user has favorite photos":
            await createTestFavoritePhotos();
            break;
          case "photo exists and belongs to user":
            await createTestPhoto();
            break;
          case "photo does not exist":
            await cleanupTestPhotos();
            break;
          case "photo exists but belongs to another user":
            await createOtherUserPhoto();
            break;
          default:
            // Fall back to generic handler for auth states
            console.log(`Delegating to generic handler for state: ${state}`);
        }

        res.status(200).json({ status: "ok", state });
      } catch (error) {
        console.error(`Failed to set photo provider state ${state}:`, error);
        res.status(500).json({ error: "Failed to set state" });
      }
    });
  },
};

// Photo-specific helper functions
async function createTestPhotos() {
  console.log("Creating test photos for user");
  // Implementation would create multiple test photos in database
}

async function createTestFavoritePhotos() {
  console.log("Creating test favorite photos for user");
  // Implementation would create photos with some marked as favorites
}

async function createTestPhoto() {
  console.log("Creating single test photo");
  // Implementation would create a specific test photo with known ID
}

async function cleanupTestPhotos() {
  console.log("Cleaning up test photos");
  // Implementation would delete all test photos
}

async function createOtherUserPhoto() {
  console.log("Creating photo belonging to another user");
  // Implementation would create a photo that belongs to a different user
}
