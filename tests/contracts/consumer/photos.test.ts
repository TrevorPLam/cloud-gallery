import { PactV4, Matchers } from "@pact-foundation/pact";
import {
  createPact,
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
  const provider = createPact();

  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  describe("GET /api/photos", () => {
    it("should return user photos with pagination", async () => {
      await provider
        .given("user has photos")
        .uponReceiving("a request for user photos")
        .withRequest({
          method: "GET",
          path: "/api/photos",
          headers: authHeaders,
          query: { limit: "20", offset: "0" },
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            photos: Matchers.eachLike(createPhotoMatcher()),
            pagination: createPaginationMatcher(50, 20, 0),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/photos?limit=20&offset=0`,
          {
            method: "GET",
            headers: authHeaders,
          },
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
        .given("user has favorite photos")
        .uponReceiving("a request for favorite photos")
        .withRequest({
          method: "GET",
          path: "/api/photos",
          headers: authHeaders,
          query: { favorites: "true", limit: "10", offset: "0" },
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            photos: Matchers.eachLike(createPhotoMatcher({ isFavorite: true })),
            pagination: createPaginationMatcher(5, 10, 0),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/photos?favorites=true&limit=10&offset=0`,
          {
            method: "GET",
            headers: authHeaders,
          },
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
        .uponReceiving("a request without authentication")
        .withRequest({
          method: "GET",
          path: "/api/photos",
          headers: commonHeaders,
        })
        .willRespondWith({
          status: 401,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            401,
            "User not authenticated",
            "Authentication required",
          ),
        });

      await provider.executeTest(async (mockServer) => {
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
        .given("photo exists and belongs to user")
        .uponReceiving("a request for a specific photo")
        .withRequest({
          method: "GET",
          path: `/api/photos/${photoId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            photo: createPhotoMatcher({ id: Matchers.like(photoId) }),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/photos/${photoId}`,
          {
            method: "GET",
            headers: authHeaders,
          },
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
        .given("photo does not exist")
        .uponReceiving("a request for non-existent photo")
        .withRequest({
          method: "GET",
          path: `/api/photos/${nonExistentPhotoId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 404,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            404,
            "Photo not found",
            "Photo not found",
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/photos/${nonExistentPhotoId}`,
          {
            method: "GET",
            headers: authHeaders,
          },
        );

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe("Photo not found");
      });
    });

    it("should reject access to photo belonging to another user", async () => {
      const photoId = matchers.uuid.generate;

      await provider
        .given("photo exists but belongs to another user")
        .uponReceiving("a request for photo belonging to another user")
        .withRequest({
          method: "GET",
          path: `/api/photos/${photoId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 404,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            404,
            "Photo not found",
            "Photo not found",
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/photos/${photoId}`,
          {
            method: "GET",
            headers: authHeaders,
          },
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
        .given("user is authenticated")
        .uponReceiving("a request to create a photo")
        .withRequest({
          method: "POST",
          path: "/api/photos",
          headers: authHeaders,
          body: photoRequest,
        })
        .willRespondWith({
          status: 201,
          headers: commonHeaders,
          body: {
            photo: createPhotoMatcher({
              uri: Matchers.like(photoRequest.uri),
              filename: Matchers.like(photoRequest.filename),
              width: Matchers.like(photoRequest.width),
              height: Matchers.like(photoRequest.height),
              size: Matchers.like(photoRequest.size),
              mimeType: Matchers.like(photoRequest.mimeType),
            }),
          },
        });

      await provider.executeTest(async (mockServer) => {
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
        .uponReceiving("a request to create photo with invalid data")
        .withRequest({
          method: "POST",
          path: "/api/photos",
          headers: authHeaders,
          body: invalidPhotoRequest,
        })
        .willRespondWith({
          status: 400,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            400,
            "Invalid photo data",
            "Invalid input data",
          ),
        });

      await provider.executeTest(async (mockServer) => {
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
        .uponReceiving("a request to create photo without authentication")
        .withRequest({
          method: "POST",
          path: "/api/photos",
          headers: commonHeaders,
          body: photoRequest,
        })
        .willRespondWith({
          status: 401,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            401,
            "User not authenticated",
            "Authentication required",
          ),
        });

      await provider.executeTest(async (mockServer) => {
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
        .given("photo exists and belongs to user")
        .uponReceiving("a request to toggle photo favorite status")
        .withRequest({
          method: "PUT",
          path: `/api/photos/${photoId}/favorite`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            photo: createPhotoMatcher({
              id: Matchers.like(photoId),
              isFavorite: Matchers.like(true),
            }),
            message: Matchers.like("Photo added to favorites"),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/photos/${photoId}/favorite`,
          {
            method: "PUT",
            headers: authHeaders,
          },
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
        .given("photo does not exist")
        .uponReceiving("a request to favorite non-existent photo")
        .withRequest({
          method: "PUT",
          path: `/api/photos/${nonExistentPhotoId}/favorite`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 404,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            404,
            "Photo not found",
            "Photo not found",
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/photos/${nonExistentPhotoId}/favorite`,
          {
            method: "PUT",
            headers: authHeaders,
          },
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
        .given("photo exists and belongs to user")
        .uponReceiving("a request to delete a photo")
        .withRequest({
          method: "DELETE",
          path: `/api/photos/${photoId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            message: Matchers.like("Photo moved to trash"),
            photoId: Matchers.like(photoId),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/photos/${photoId}`,
          {
            method: "DELETE",
            headers: authHeaders,
          },
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
        .given("photo does not exist")
        .uponReceiving("a request to delete non-existent photo")
        .withRequest({
          method: "DELETE",
          path: `/api/photos/${nonExistentPhotoId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 404,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            404,
            "Photo not found or already deleted",
            "Photo not found or already deleted",
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(
          `${mockServer.url}/api/photos/${nonExistentPhotoId}`,
          {
            method: "DELETE",
            headers: authHeaders,
          },
        );

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe("Photo not found or already deleted");
      });
    });
  });
});
