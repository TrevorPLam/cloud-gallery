// @vitest-environment node
import { describe, it, expect } from "vitest";
import { PactV4, Matchers } from "@pact-foundation/pact";
import path from "path";

describe("Simple Contract Test", () => {
  const provider = new PactV4({
    consumer: "cloud-gallery-client",
    provider: "cloud-gallery-api",
    port: 4000,
    dir: path.resolve(process.cwd(), "tests", "contracts", "pacts"),
    logLevel: "INFO",
  });

  it("should create a simple contract", async () => {
    await provider
      .addInteraction()
      .uponReceiving("a simple request")
      .withRequest("GET", "/api/health", (builder) => {
        builder.headers({ "Content-Type": "application/json" });
      })
      .willRespondWith(200, (builder) => {
        builder.headers({ "Content-Type": "application/json" });
        builder.jsonBody({
          status: Matchers.like("ok"),
          timestamp: Matchers.like("2024-01-01T00:00:00.000Z"),
        });
      })
      .executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/health`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.status).toBe("ok");
        expect(data.timestamp).toBeDefined();
      });
  });
});
