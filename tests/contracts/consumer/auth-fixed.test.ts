// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PactV4, Matchers } from "@pact-foundation/pact";
import path from "path";
import { commonHeaders } from "../utils/setup";
import { createRegistrationRequest } from "../utils/helpers";

describe("Authentication API Consumer Tests (Fixed)", () => {
  const provider = new PactV4({
    consumer: "cloud-gallery-client",
    provider: "cloud-gallery-api",
    port: 4000,
    dir: path.resolve(process.cwd(), "tests", "contracts", "pacts"),
    logLevel: "INFO",
  });

  describe("POST /api/auth/register", () => {
    it("should register a new user successfully", async () => {
      const registrationRequest = createRegistrationRequest();

      await provider
        .addInteraction()
        .uponReceiving("a valid user registration request (fixed)")
        .withRequest("POST", "/api/auth/register", (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(registrationRequest);
        })
        .willRespondWith(201, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            message: Matchers.like("User registered successfully"),
            user: {
              id: Matchers.like("123e4567-e89b-12d3-a456-426614174000"),
              email: Matchers.like(registrationRequest.email),
              createdAt: Matchers.like("2024-01-01T00:00:00.000Z"),
            },
            tokens: {
              accessToken: Matchers.like("mock-access-token"),
              refreshToken: Matchers.like("mock-refresh-token"),
            },
          });
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
