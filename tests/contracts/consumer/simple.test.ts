import { PactV4, Matchers } from "@pact-foundation/pact";
import path from "path";

describe("Simple Contract Test", () => {
  const provider = new PactV4({
    consumer: "cloud-gallery-client",
    provider: "cloud-gallery-api",
    port: 4000,
    log: path.resolve(process.cwd(), "logs", "pact.log"),
    dir: path.resolve(process.cwd(), "tests", "contracts", "pacts"),
    logLevel: "INFO",
  });

  it("should create a simple contract", async () => {
    await provider.setup();

    await provider.addInteraction({
      uponReceiving: "a simple request",
      withRequest: {
        method: "GET",
        path: "/api/health",
        headers: {
          "Content-Type": "application/json",
        },
      },
      willRespondWith: {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          status: Matchers.like("ok"),
          timestamp: Matchers.like("2024-01-01T00:00:00.000Z"),
        },
      },
    });

    const result = await provider.addSynchronousInteraction("a simple request");
    console.log("Mock server result:", result);

    // Try to make the request manually
    const response = await fetch(`http://localhost:4000/api/health`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    console.log("Response:", response);
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.timestamp).toBeDefined();
  });
});
