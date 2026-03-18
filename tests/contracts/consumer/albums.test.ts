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
  createAlbumMatcher,
  createErrorResponseMatcher,
  createAlbumCreationRequest,
} from "../utils/helpers";

describe("Albums API Consumer Tests", () => {
  const provider = new PactV4({
    consumer: "cloud-gallery-client",
    provider: "cloud-gallery-api",
    port: 4000,
    dir: path.resolve(process.cwd(), "tests", "contracts", "pacts"),
    logLevel: "INFO",
  });

  describe("GET /api/albums", () => {
    it("should return user albums", async () => {
      await provider
        .addInteraction()
        .given("user has albums")
        .uponReceiving("a request for user albums")
        .withRequest("GET", "/api/albums", (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            albums: Matchers.eachLike(createAlbumMatcher()),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/albums`, {
            method: "GET",
            headers: authHeaders,
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.albums).toBeDefined();
          expect(Array.isArray(data.albums)).toBe(true);
        });
    });

    it("should return empty array when user has no albums", async () => {
      await provider
        .addInteraction()
        .given("user has no albums")
        .uponReceiving("a request for albums when none exist")
        .withRequest("GET", "/api/albums", (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({ albums: [] });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/albums`, {
            method: "GET",
            headers: authHeaders,
          });

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.albums).toEqual([]);
        });
    });

    it("should reject request without authentication", async () => {
      await provider
        .addInteraction()
        .uponReceiving("a request for albums without authentication")
        .withRequest("GET", "/api/albums", (builder) => {
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
          const response = await fetch(`${mockServer.url}/api/albums`, {
            method: "GET",
            headers: commonHeaders,
          });

          expect(response.status).toBe(401);
          const data = await response.json();
          expect(data.error).toBe("User not authenticated");
        });
    });
  });

  describe("GET /api/albums/:id", () => {
    it("should return a specific album with photo IDs", async () => {
      const albumId = matchers.uuid.generate;

      await provider
        .addInteraction()
        .given("album exists and belongs to user")
        .uponReceiving("a request for a specific album")
        .withRequest("GET", `/api/albums/${albumId}`, (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            album: createAlbumMatcher({ id: Matchers.like(albumId) }),
            photoIds: Matchers.eachLike(matchers.uuid),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/albums/${albumId}`,
            { method: "GET", headers: authHeaders },
          );

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.album).toBeDefined();
          expect(data.album.id).toBe(albumId);
          expect(data.photoIds).toBeDefined();
          expect(Array.isArray(data.photoIds)).toBe(true);
        });
    });

    it("should return 404 for non-existent album", async () => {
      const nonExistentAlbumId = "123e4567-e89b-12d3-a456-426614174999";

      await provider
        .addInteraction()
        .given("album does not exist")
        .uponReceiving("a request for non-existent album")
        .withRequest("GET", `/api/albums/${nonExistentAlbumId}`, (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(404, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(404, "Album not found", "Album not found"),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/albums/${nonExistentAlbumId}`,
            { method: "GET", headers: authHeaders },
          );

          expect(response.status).toBe(404);
          const data = await response.json();
          expect(data.error).toBe("Album not found");
        });
    });

    it("should reject access to album belonging to another user", async () => {
      const albumId = matchers.uuid.generate;

      await provider
        .addInteraction()
        .given("album exists but belongs to another user")
        .uponReceiving("a request for album belonging to another user")
        .withRequest("GET", `/api/albums/${albumId}`, (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(404, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(404, "Album not found", "Album not found"),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/albums/${albumId}`,
            { method: "GET", headers: authHeaders },
          );

          expect(response.status).toBe(404);
          const data = await response.json();
          expect(data.error).toBe("Album not found");
        });
    });
  });

  describe("POST /api/albums", () => {
    it("should create a new album", async () => {
      const albumRequest = createAlbumCreationRequest();

      await provider
        .addInteraction()
        .given("user is authenticated")
        .uponReceiving("a request to create an album")
        .withRequest("POST", "/api/albums", (builder) => {
          builder.headers(authHeaders);
          builder.jsonBody(albumRequest);
        })
        .willRespondWith(201, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            album: createAlbumMatcher({
              title: Matchers.like(albumRequest.title),
              description: Matchers.like(albumRequest.description),
            }),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/albums`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(albumRequest),
          });

          expect(response.status).toBe(201);
          const data = await response.json();
          expect(data.album).toBeDefined();
          expect(data.album.title).toBe(albumRequest.title);
          expect(data.album.description).toBe(albumRequest.description);
        });
    });

    it("should reject album creation with invalid data", async () => {
      const invalidAlbumRequest = { title: "", description: "" };

      await provider
        .addInteraction()
        .uponReceiving("a request to create album with invalid data")
        .withRequest("POST", "/api/albums", (builder) => {
          builder.headers(authHeaders);
          builder.jsonBody(invalidAlbumRequest);
        })
        .willRespondWith(400, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(400, "Invalid album data", "Invalid input data"),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(`${mockServer.url}/api/albums`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify(invalidAlbumRequest),
          });

          expect(response.status).toBe(400);
          const data = await response.json();
          expect(data.error).toBe("Invalid album data");
        });
    });

    it("should reject album creation without authentication", async () => {
      const albumRequest = createAlbumCreationRequest();

      await provider
        .addInteraction()
        .uponReceiving("a request to create album without authentication")
        .withRequest("POST", "/api/albums", (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(albumRequest);
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
          const response = await fetch(`${mockServer.url}/api/albums`, {
            method: "POST",
            headers: commonHeaders,
            body: JSON.stringify(albumRequest),
          });

          expect(response.status).toBe(401);
          const data = await response.json();
          expect(data.error).toBe("User not authenticated");
        });
    });
  });

  describe("POST /api/albums/:id/photos", () => {
    it("should add a photo to an album", async () => {
      const albumId = matchers.uuid.generate;
      const photoId = matchers.uuid.generate;
      const addPhotoRequest = { photoId };

      await provider
        .addInteraction()
        .given("album and photo exist and belong to user")
        .given("photo is not already in album")
        .uponReceiving("a request to add photo to album")
        .withRequest("POST", `/api/albums/${albumId}/photos`, (builder) => {
          builder.headers(authHeaders);
          builder.jsonBody(addPhotoRequest);
        })
        .willRespondWith(201, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            message: Matchers.like("Photo added to album"),
            albumId: Matchers.like(albumId),
            photoId: Matchers.like(photoId),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/albums/${albumId}/photos`,
            {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify(addPhotoRequest),
            },
          );

          expect(response.status).toBe(201);
          const data = await response.json();
          expect(data.message).toBe("Photo added to album");
          expect(data.albumId).toBe(albumId);
          expect(data.photoId).toBe(photoId);
        });
    });

    it("should reject adding photo that already exists in album", async () => {
      const albumId = matchers.uuid.generate;
      const photoId = matchers.uuid.generate;
      const addPhotoRequest = { photoId };

      await provider
        .addInteraction()
        .given("album and photo exist and belong to user")
        .given("photo is already in album")
        .uponReceiving("a request to add photo already in album")
        .withRequest("POST", `/api/albums/${albumId}/photos`, (builder) => {
          builder.headers(authHeaders);
          builder.jsonBody(addPhotoRequest);
        })
        .willRespondWith(409, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(
              409,
              "Photo already in album",
              "Photo already in album",
            ),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/albums/${albumId}/photos`,
            {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify(addPhotoRequest),
            },
          );

          expect(response.status).toBe(409);
          const data = await response.json();
          expect(data.error).toBe("Photo already in album");
        });
    });

    it("should return 404 when adding photo to non-existent album", async () => {
      const nonExistentAlbumId = "123e4567-e89b-12d3-a456-426614174999";
      const photoId = matchers.uuid.generate;
      const addPhotoRequest = { photoId };

      await provider
        .addInteraction()
        .given("album does not exist")
        .uponReceiving("a request to add photo to non-existent album")
        .withRequest(
          "POST",
          `/api/albums/${nonExistentAlbumId}/photos`,
          (builder) => {
            builder.headers(authHeaders);
            builder.jsonBody(addPhotoRequest);
          },
        )
        .willRespondWith(404, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(404, "Album not found", "Album not found"),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/albums/${nonExistentAlbumId}/photos`,
            {
              method: "POST",
              headers: authHeaders,
              body: JSON.stringify(addPhotoRequest),
            },
          );

          expect(response.status).toBe(404);
          const data = await response.json();
          expect(data.error).toBe("Album not found");
        });
    });
  });

  describe("DELETE /api/albums/:id/photos/:photoId", () => {
    it("should remove a photo from an album", async () => {
      const albumId = matchers.uuid.generate;
      const photoId = matchers.uuid.generate;

      await provider
        .addInteraction()
        .given("album and photo exist and belong to user")
        .given("photo is in album")
        .uponReceiving("a request to remove photo from album")
        .withRequest(
          "DELETE",
          `/api/albums/${albumId}/photos/${photoId}`,
          (builder) => {
            builder.headers(authHeaders);
          },
        )
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            message: Matchers.like("Photo removed from album"),
            albumId: Matchers.like(albumId),
            photoId: Matchers.like(photoId),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/albums/${albumId}/photos/${photoId}`,
            { method: "DELETE", headers: authHeaders },
          );

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.message).toBe("Photo removed from album");
          expect(data.albumId).toBe(albumId);
          expect(data.photoId).toBe(photoId);
        });
    });

    it("should return 404 when removing photo not in album", async () => {
      const albumId = matchers.uuid.generate;
      const photoId = matchers.uuid.generate;

      await provider
        .addInteraction()
        .given("album and photo exist and belong to user")
        .given("photo is not in album")
        .uponReceiving("a request to remove photo not in album")
        .withRequest(
          "DELETE",
          `/api/albums/${albumId}/photos/${photoId}`,
          (builder) => {
            builder.headers(authHeaders);
          },
        )
        .willRespondWith(404, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(
              404,
              "Photo not in album",
              "Photo not in album",
            ),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/albums/${albumId}/photos/${photoId}`,
            { method: "DELETE", headers: authHeaders },
          );

          expect(response.status).toBe(404);
          const data = await response.json();
          expect(data.error).toBe("Photo not in album");
        });
    });
  });

  describe("DELETE /api/albums/:id", () => {
    it("should delete an album", async () => {
      const albumId = matchers.uuid.generate;

      await provider
        .addInteraction()
        .given("album exists and belongs to user")
        .uponReceiving("a request to delete an album")
        .withRequest("DELETE", `/api/albums/${albumId}`, (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(200, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody({
            message: Matchers.like("Album deleted successfully"),
            albumId: Matchers.like(albumId),
          });
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/albums/${albumId}`,
            { method: "DELETE", headers: authHeaders },
          );

          expect(response.status).toBe(200);
          const data = await response.json();
          expect(data.message).toBe("Album deleted successfully");
          expect(data.albumId).toBe(albumId);
        });
    });

    it("should return 404 when deleting non-existent album", async () => {
      const nonExistentAlbumId = "123e4567-e89b-12d3-a456-426614174999";

      await provider
        .addInteraction()
        .given("album does not exist")
        .uponReceiving("a request to delete non-existent album")
        .withRequest("DELETE", `/api/albums/${nonExistentAlbumId}`, (builder) => {
          builder.headers(authHeaders);
        })
        .willRespondWith(404, (builder) => {
          builder.headers(commonHeaders);
          builder.jsonBody(
            createErrorResponseMatcher(404, "Album not found", "Album not found"),
          );
        })
        .executeTest(async (mockServer) => {
          const response = await fetch(
            `${mockServer.url}/api/albums/${nonExistentAlbumId}`,
            { method: "DELETE", headers: authHeaders },
          );

          expect(response.status).toBe(404);
          const data = await response.json();
          expect(data.error).toBe("Album not found");
        });
    });
  });
});
