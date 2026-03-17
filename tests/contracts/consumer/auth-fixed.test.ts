import { PactV4, Matchers } from "@pact-foundation/pact";
import path from "path";
import { commonHeaders } from "../utils/setup";
import { createRegistrationRequest } from "../utils/helpers";

describe("Authentication API Consumer Tests (Fixed)", () => {
  const provider = new PactV4({
    consumer: "cloud-gallery-client",
    provider: "cloud-gallery-api",
    port: 4000,
    log: path.resolve(process.cwd(), "logs", "pact.log"),
    dir: path.resolve(process.cwd(), "tests", "contracts", "pacts"),
    logLevel: "INFO",
  });

  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    // Pact V4 automatically handles cleanup
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const registrationRequest = createRegistrationRequest();

      await provider
        .addInteraction()
        .uponReceiving("a valid user registration request")
        .withRequest("POST", "/api/auth/register")
        .withHeaders(commonHeaders)
        .withBody(registrationRequest)
        .willRespondWith(201)
        .withHeaders(commonHeaders)
        .withBody({
          message: "User registered successfully",
          user: {
            id: Matchers.uuid(),
            email: registrationRequest.email,
            createdAt: Matchers.datetime("iso-date-time"),
          },
          tokens: {
            accessToken: Matchers.string(),
            refreshToken: Matchers.string(),
          },
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/auth/register`, {
            method: "POST",
            headers: commonHeaders,
            body: JSON.stringify(registrationRequest),
          });

          expect(response.status).toBe(201);
          const data = await response.json();
          expect(data.message).toBe("User registered successfully");
          expect(data.user.email).toBe(registrationRequest.email);
          expect(data.tokens.accessToken).toBeDefined();
          expect(data.tokens.refreshToken).toBeDefined();
        });
    });
  });
});
