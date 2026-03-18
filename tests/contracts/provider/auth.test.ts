// @vitest-environment node
import { describe, it, expect } from "vitest";
import { Verifier } from "@pact-foundation/pact";
import path from "path";

// Provider verification tests require a live server. Skip when PROVIDER_BASE_URL is not set.
describe.skipIf(!process.env.PROVIDER_BASE_URL)("Authentication API Provider Verification", () => {
  const providerBaseUrl =
    process.env.PROVIDER_BASE_URL || "http://localhost:5000";

  // Pact verifier configuration
  const verifier = new Verifier({
    providerBaseUrl,
    provider: "cloud-gallery-api",
    providerStatesSetupUrl: `${providerBaseUrl}/api/pact/states`,
    requestFilter: (req: any, _res: any, next: () => void) => {
      // Add authentication headers for protected endpoints
      if (
        req.path.includes("/api/auth/") &&
        req.path !== "/api/auth/register" &&
        req.path !== "/api/auth/login"
      ) {
        req.headers["Authorization"] = "Bearer test-jwt-token";
      }
      next();
    },
    stateHandlers: {
      "user does not exist": async () => {
        // Setup: Ensure no user exists with test email
        console.log("Setting up state: user does not exist");
        // In a real implementation, this would clean up the test database
        return Promise.resolve();
      },
      "user already exists": async () => {
        // Setup: Create a test user
        console.log("Setting up state: user already exists");
        // In a real implementation, this would create a test user in the database
        return Promise.resolve();
      },
      "user exists with valid credentials": async () => {
        // Setup: Create a test user with known credentials
        console.log("Setting up state: user exists with valid credentials");
        return Promise.resolve();
      },
      "user exists but credentials are invalid": async () => {
        // Setup: Create a test user but ensure the test password is different
        console.log(
          "Setting up state: user exists but credentials are invalid",
        );
        return Promise.resolve();
      },
      "valid refresh token exists": async () => {
        // Setup: Create a user with a valid refresh token
        console.log("Setting up state: valid refresh token exists");
        return Promise.resolve();
      },
      "refresh token is invalid or expired": async () => {
        // Setup: Ensure no valid refresh token exists
        console.log("Setting up state: refresh token is invalid or expired");
        return Promise.resolve();
      },
      "user is authenticated": async () => {
        // Setup: Create an authenticated user session
        console.log("Setting up state: user is authenticated");
        return Promise.resolve();
      },
    },
    logLevel: "INFO",
  });

  describe("Authentication endpoints verification", () => {
    it("should validate auth contracts", async () => {
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
          timeout: 30000, // 30 seconds timeout
        });

        console.log("Pact verification output:", output);
        expect(output).toBeDefined();
      } catch (error) {
        console.error("Pact verification failed:", error);
        throw error;
      }
    }, 60000); // 60 seconds timeout for the entire test
  });

  describe("Individual endpoint verification", () => {
    it("should verify POST /api/auth/register", async () => {
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
          includeWipPactsSince: "2020-01-01",
        });

        expect(output).toBeDefined();
      } catch (error) {
        console.error("Registration endpoint verification failed:", error);
        throw error;
      }
    }, 30000);

    it("should verify POST /api/auth/login", async () => {
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
        console.error("Login endpoint verification failed:", error);
        throw error;
      }
    }, 30000);

    it("should verify POST /api/auth/refresh", async () => {
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
        console.error("Refresh endpoint verification failed:", error);
        throw error;
      }
    }, 30000);

    it("should verify GET /api/auth/me", async () => {
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
        console.error("User info endpoint verification failed:", error);
        throw error;
      }
    }, 30000);
  });
});

// Helper endpoint for provider states (this would be added to the actual server)
export const providerStatesHandler = {
  setupProviderStates: (app: any) => {
    app.post("/api/pact/states", async (req: any, res: any) => {
      const { state } = req.body;

      try {
        // In a real implementation, this would set up database state
        console.log(`Setting provider state: ${state}`);

        // For each state, perform the necessary database setup
        switch (state) {
          case "user does not exist":
            // Clean up any test user
            await cleanupTestUser();
            break;
          case "user already exists":
            // Create test user
            await createTestUser();
            break;
          case "user exists with valid credentials":
            await createTestUserWithValidCredentials();
            break;
          case "user exists but credentials are invalid":
            await createTestUserWithInvalidCredentials();
            break;
          case "valid refresh token exists":
            await createTestUserWithRefreshToken();
            break;
          case "refresh token is invalid or expired":
            await cleanupRefreshTokens();
            break;
          case "user is authenticated":
            await createAuthenticatedUser();
            break;
          default:
            console.warn(`Unknown provider state: ${state}`);
        }

        res.status(200).json({ status: "ok", state });
      } catch (error) {
        console.error(`Failed to set provider state ${state}:`, error);
        res.status(500).json({ error: "Failed to set state" });
      }
    });
  },
};

// Helper functions (these would be implemented with actual database operations)
async function cleanupTestUser() {
  // Implementation would delete test user from database
  console.log("Cleaning up test user");
}

async function createTestUser() {
  // Implementation would create test user in database
  console.log("Creating test user");
}

async function createTestUserWithValidCredentials() {
  // Implementation would create test user with known credentials
  console.log("Creating test user with valid credentials");
}

async function createTestUserWithInvalidCredentials() {
  // Implementation would create test user with different credentials
  console.log("Creating test user with invalid credentials");
}

async function createTestUserWithRefreshToken() {
  // Implementation would create user with valid refresh token
  console.log("Creating test user with refresh token");
}

async function cleanupRefreshTokens() {
  // Implementation would clean up refresh tokens
  console.log("Cleaning up refresh tokens");
}

async function createAuthenticatedUser() {
  // Implementation would create authenticated user session
  console.log("Creating authenticated user");
}
