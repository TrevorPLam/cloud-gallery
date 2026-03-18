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
  createPaginationMatcher,
  createErrorResponseMatcher,
  createPhotoCreationRequest,
} from "../utils/helpers";

describe("Photos API Consumer Tests", () => {
  const provider = new PactV4({
    consumer: "cloud-gallery-client",
    provider: "cloud-gallery-api",
    port: 4000,
    dir: path.resolve(process.cwd(), "tests", "contracts", "pacts"),
    logLevel: "INFO",
  });

  describe("GET /api/photos", () => {
    it("should return user photos with pagination", async () => {
      await provider
        .addInteraction()
        .given("user has photos")
        .uponReceiving("a request for user photos")
        .withRequest("GET", "/api/photos", (builder) => {
          builder.headers(authHeaders);
          builder.query({ limit: "20", offset: "0" });
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            photos: Matchers.eachLike(createPhotoMatcher()),
            pagination: createPaginationMatcher(50, 20, 0),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/photos?limit=20&offset=0`,
            { method: "GET", headers: authHeaders },
          );

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.photos).toBeDefined();
          expect(data.pagination).toBeDefined();
          expect(data.pagination.limit).toBe(20);
          expect(data.pagination.offset).toBe(0);
        });
    });

    it("should return favorite photos only", async () => {
      await provider
        .addInteraction()
        .given("user has favorite photos")
        .uponReceiving("a request for favorite photos")
        .withRequest("GET", "/api/photos", (builder) => {
          builder.headers(authHeaders);
          builder.query({ favorites: "true", limit: "10", offset: "0" });
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            photos: Matchers.eachLike(createPhotoMatcher({ isFavorite: true })),
            pagination: createPaginationMatcher(5, 10, 0),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/photos?favorites=true&limit=10&offset=0`,
            { method: "GET", headers: authHeaders },
          );

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.photos).toBeDefined();
          data.photos.forEach((photo: any) => {
            expect(photo.isFavorite).toBe(true);
          });
        });
    });

    it("should reject request without authentication", async () => {
      await provider
        .addInteraction()
        .uponReceiving("a request without authentication")
        .withRequest("GET", "/api/photos", (builder) => {
          builder.headers(commonHeaders);
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
          const response = await fetch(`${mockServer.url}/api/photos`, {
            method: "GET",
            headers: commonHeaders,
          });

          expect(response.status).toBe(401);
          const data = await response.json();
          expect(data.error).toBe("User not authenticated");
        });
    });
  });

  describe("GET /api/photos/:id", () => {
    it("should return a specific photo", async () => {
      const photoId = matchers.uuid.generate;

      await provider
        .addInteraction()
        .given("photo exists and belongs to user")
        .uponReceiving("a request for a specific photo")
        .withRequest("GET", `/api/photos/${photoId}`, (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            photo: createPhotoMatcher({ id: Matchers.like(photoId) }),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/photos/${photoId}`,
            { method: "GET", headers: authHeaders },
          );

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.photo).toBeDefined();
          expect(data.photo.id).toBe(photoId);
        });
    });

    it("should return 404 for non-existent photo", async () => {
      const nonExistentPhotoId = "123e4567-e89b-12d3-a456-426614174999";

      await provider
        .addInteraction()
        .given("photo does not exist")
        .uponReceiving("a request for non-existent photo")
        .withRequest("GET", `/api/photos/${nonExistentPhotoId}`, (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(404, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(404, "Photo not found", "Photo not found"),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/photos/${nonExistentPhotoId}`,
            { method: "GET", headers: authHeaders },
          );

          expect(response.status).toBe(404);
          const data = await response.json();
          expect(data.error).toBe("Photo not found");
        });
    });

    it("should reject access to photo belonging to another user", async () => {
      const photoId = matchers.uuid.generate;

      await provider
        .addInteraction()
        .given("photo exists but belongs to another user")
        .uponReceiving("a request for photo belonging to another user")
        .withRequest("GET", `/api/photos/${photoId}`, (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(404, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(404, "Photo not found", "Photo not found"),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/photos/${photoId}`,
            { method: "GET", headers: authHeaders },
          );

          expect(response.status).toBe(404);
          const data = await response.json();
          expect(data.error).toBe("Photo not found");
        });
    });
  });

  describe("POST /api/photos", () => {
    it("should create a new photo", async () => {
      const photoRequest = createPhotoCreationRequest();

      await provider
        .addInteraction()
        .given("user is authenticated")
        .uponReceiving("a request to create a photo")
        .withRequest("POST", "/api/photos", (builder) => {
          builder.headers(authHeaders);
          builder.jsonBody(photoRequest);
        })
        .willRespondWith(201, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            photo: createPhotoMatcher({
              uri: Matchers.like(photoRequest.uri),
              filename: Matchers.like(photoRequest.filename),
              width: Matchers.like(photoRequest.width),
              height: Matchers.like(photoRequest.height),
              size: Matchers.like(photoRequest.size),
              mimeType: Matchers.like(photoRequest.mimeType),
            }),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/photos`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(photoRequest),
          });

          expect(response.status).toBe(201);
          const data = await response.json();
          expect(data.photo).toBeDefined();
          expect(data.photo.uri).toBe(photoRequest.uri);
          expect(data.photo.filename).toBe(photoRequest.filename);
        });
    });

    it("should reject photo creation with invalid data", async () => {
      const invalidPhotoRequest = {
        uri: "invalid-uri",
        filename: "",
        width: -1,
        height: -1,
        size: -1,
        mimeType: "invalid-type",
      };

      await provider
        .addInteraction()
        .uponReceiving("a request to create photo with invalid data")
        .withRequest("POST", "/api/photos", (builder) => {
          builder.headers(authHeaders);
          builder.jsonBody(invalidPhotoRequest);
        })
        .willRespondWith(400, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(
              400,
              "Invalid photo data",
              "Invalid input data",
            ),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/photos`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(invalidPhotoRequest),
          });

          expect(response.status).toBe(400);
          const data = await response.json();
          expect(data.error).toBe("Invalid photo data");
        });
    });

    it("should reject photo creation without authentication", async () => {
      const photoRequest = createPhotoCreationRequest();

      await provider
        .addInteraction()
        .uponReceiving("a request to create photo without authentication")
        .withRequest("POST", "/api/photos", (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(photoRequest);
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
          const response = await fetch(`${mockServer.url}/api/photos`, {
            method: "POST",
            headers: commonHeaders,
            body: JSON.stringify(photoRequest),
          });

          expect(response.status).toBe(401);
          const data = await response.json();
          expect(data.error).toBe("User not authenticated");
        });
    });
  });

  describe("PUT /api/photos/:id/favorite", () => {
    it("should toggle photo favorite status", async () => {
      const photoId = matchers.uuid.generate;

      await provider
        .addInteraction()
        .given("photo exists and belongs to user")
        .uponReceiving("a request to toggle photo favorite status")
        .withRequest("PUT", `/api/photos/${photoId}/favorite`, (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            photo: createPhotoMatcher({
              id: Matchers.like(photoId),
              isFavorite: Matchers.like(true),
            }),
            message: Matchers.like("Photo added to favorites"),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/photos/${photoId}/favorite`,
            { method: "PUT", headers: authHeaders },
          );

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.photo).toBeDefined();
          expect(data.photo.isFavorite).toBe(true);
          expect(data.message).toContain("favorites");
        });
    });

    it("should return 404 when trying to favorite non-existent photo", async () => {
      const nonExistentPhotoId = "123e4567-e89b-12d3-a456-426614174999";

      await provider
        .addInteraction()
        .given("photo does not exist")
        .uponReceiving("a request to favorite non-existent photo")
        .withRequest(
          "PUT",
          `/api/photos/${nonExistentPhotoId}/favorite`,
          (builder) => {
            builder.headers(authHeaders);
          },
        )
        .willRespondWith(404, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(404, "Photo not found", "Photo not found"),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/photos/${nonExistentPhotoId}/favorite`,
            { method: "PUT", headers: authHeaders },
          );

          expect(response.status).toBe(404);
          const data = await response.json();
          expect(data.error).toBe("Photo not found");
        });
    });
  });

  describe("DELETE /api/photos/:id", () => {
    it("should soft delete a photo", async () => {
      const photoId = matchers.uuid.generate;

      await provider
        .addInteraction()
        .given("photo exists and belongs to user")
        .uponReceiving("a request to delete a photo")
        .withRequest("DELETE", `/api/photos/${photoId}`, (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            message: Matchers.like("Photo moved to trash"),
            photoId: Matchers.like(photoId),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/photos/${photoId}`,
            { method: "DELETE", headers: authHeaders },
          );

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.message).toBe("Photo moved to trash");
          expect(data.photoId).toBe(photoId);
        });
    });

    it("should return 404 when trying to delete non-existent photo", async () => {
      const nonExistentPhotoId = "123e4567-e89b-12d3-a456-426614174999";

      await provider
        .addInteraction()
        .given("photo does not exist")
        .uponReceiving("a request to delete non-existent photo")
        .withRequest("DELETE", `/api/photos/${nonExistentPhotoId}`, (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(404, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(
              404,
              "Photo not found or already deleted",
              "Photo not found or already deleted",
            ),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/photos/${nonExistentPhotoId}`,
            { method: "DELETE", headers: authHeaders },
          );

          expect(response.status).toBe(404);
          const data = await response.json();
          expect(data.error).toBe("Photo not found or already deleted");
        });
    });
  });
});
