import { PactV4, Matchers } from '@pact-foundation/pact';
import { createPact, commonHeaders, authHeaders, matchers } from '../utils/setup';
import { 
  createAlbumMatcher, 
  createErrorResponseMatcher,
  createAlbumCreationRequest 
} from '../utils/helpers';

describe('Albums API Consumer Tests', () => {
  const provider = createPact();

  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  describe('GET /api/albums', () => {
    it('should return user albums', async () => {
      await provider
        .given('user has albums')
        .uponReceiving('a request for user albums')
        .withRequest({
          method: 'GET',
          path: '/api/albums',
          headers: authHeaders,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            albums: Matchers.eachLike(createAlbumMatcher())
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums`, {
          method: 'GET',
          headers: authHeaders,
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.albums).toBeDefined();
        expect(Array.isArray(data.albums)).toBe(true);
      });
    });

    it('should return empty array when user has no albums', async () => {
      await provider
        .given('user has no albums')
        .uponReceiving('a request for albums when none exist')
        .withRequest({
          method: 'GET',
          path: '/api/albums',
          headers: authHeaders,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            albums: []
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums`, {
          method: 'GET',
          headers: authHeaders,
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.albums).toEqual([]);
      });
    });

    it('should reject request without authentication', async () => {
      await provider
        .uponReceiving('a request for albums without authentication')
        .withRequest({
          method: 'GET',
          path: '/api/albums',
          headers: commonHeaders,
        })
        .willRespondWith({
          status: 401,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            401,
            'User not authenticated',
            'Authentication required'
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums`, {
          method: 'GET',
          headers: commonHeaders,
        });

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('User not authenticated');
      });
    });
  });

  describe('GET /api/albums/:id', () => {
    it('should return a specific album with photo IDs', async () => {
      const albumId = matchers.uuid.generate;
      
      await provider
        .given('album exists and belongs to user')
        .uponReceiving('a request for a specific album')
        .withRequest({
          method: 'GET',
          path: `/api/albums/${albumId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            album: createAlbumMatcher({ id: Matchers.like(albumId) }),
            photoIds: Matchers.eachLike(matchers.uuid)
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums/${albumId}`, {
          method: 'GET',
          headers: authHeaders,
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.album).toBeDefined();
        expect(data.album.id).toBe(albumId);
        expect(data.photoIds).toBeDefined();
        expect(Array.isArray(data.photoIds)).toBe(true);
      });
    });

    it('should return 404 for non-existent album', async () => {
      const nonExistentAlbumId = '123e4567-e89b-12d3-a456-426614174999';
      
      await provider
        .given('album does not exist')
        .uponReceiving('a request for non-existent album')
        .withRequest({
          method: 'GET',
          path: `/api/albums/${nonExistentAlbumId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 404,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            404,
            'Album not found',
            'Album not found'
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums/${nonExistentAlbumId}`, {
          method: 'GET',
          headers: authHeaders,
        });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Album not found');
      });
    });

    it('should reject access to album belonging to another user', async () => {
      const albumId = matchers.uuid.generate;
      
      await provider
        .given('album exists but belongs to another user')
        .uponReceiving('a request for album belonging to another user')
        .withRequest({
          method: 'GET',
          path: `/api/albums/${albumId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 404,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            404,
            'Album not found',
            'Album not found'
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums/${albumId}`, {
          method: 'GET',
          headers: authHeaders,
        });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Album not found');
      });
    });
  });

  describe('POST /api/albums', () => {
    it('should create a new album', async () => {
      const albumRequest = createAlbumCreationRequest();
      
      await provider
        .given('user is authenticated')
        .uponReceiving('a request to create an album')
        .withRequest({
          method: 'POST',
          path: '/api/albums',
          headers: authHeaders,
          body: albumRequest,
        })
        .willRespondWith({
          status: 201,
          headers: commonHeaders,
          body: {
            album: createAlbumMatcher({
              name: Matchers.like(albumRequest.name),
              description: Matchers.like(albumRequest.description)
            })
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(albumRequest),
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.album).toBeDefined();
        expect(data.album.name).toBe(albumRequest.name);
        expect(data.album.description).toBe(albumRequest.description);
      });
    });

    it('should reject album creation with invalid data', async () => {
      const invalidAlbumRequest = {
        name: '', // Empty name
        description: ''
      };
      
      await provider
        .uponReceiving('a request to create album with invalid data')
        .withRequest({
          method: 'POST',
          path: '/api/albums',
          headers: authHeaders,
          body: invalidAlbumRequest,
        })
        .willRespondWith({
          status: 400,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            400,
            'Invalid album data',
            'Invalid input data'
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(invalidAlbumRequest),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Invalid album data');
      });
    });

    it('should reject album creation without authentication', async () => {
      const albumRequest = createAlbumCreationRequest();
      
      await provider
        .uponReceiving('a request to create album without authentication')
        .withRequest({
          method: 'POST',
          path: '/api/albums',
          headers: commonHeaders,
          body: albumRequest,
        })
        .willRespondWith({
          status: 401,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            401,
            'User not authenticated',
            'Authentication required'
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify(albumRequest),
        });

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('User not authenticated');
      });
    });
  });

  describe('POST /api/albums/:id/photos', () => {
    it('should add a photo to an album', async () => {
      const albumId = matchers.uuid.generate;
      const photoId = matchers.uuid.generate;
      const addPhotoRequest = { photoId };
      
      await provider
        .given('album and photo exist and belong to user')
        .given('photo is not already in album')
        .uponReceiving('a request to add photo to album')
        .withRequest({
          method: 'POST',
          path: `/api/albums/${albumId}/photos`,
          headers: authHeaders,
          body: addPhotoRequest,
        })
        .willRespondWith({
          status: 201,
          headers: commonHeaders,
          body: {
            message: Matchers.like('Photo added to album'),
            albumId: Matchers.like(albumId),
            photoId: Matchers.like(photoId)
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums/${albumId}/photos`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(addPhotoRequest),
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.message).toBe('Photo added to album');
        expect(data.albumId).toBe(albumId);
        expect(data.photoId).toBe(photoId);
      });
    });

    it('should reject adding photo that already exists in album', async () => {
      const albumId = matchers.uuid.generate;
      const photoId = matchers.uuid.generate;
      const addPhotoRequest = { photoId };
      
      await provider
        .given('album and photo exist and belong to user')
        .given('photo is already in album')
        .uponReceiving('a request to add photo already in album')
        .withRequest({
          method: 'POST',
          path: `/api/albums/${albumId}/photos`,
          headers: authHeaders,
          body: addPhotoRequest,
        })
        .willRespondWith({
          status: 409,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            409,
            'Photo already in album',
            'Photo already in album'
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums/${albumId}/photos`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(addPhotoRequest),
        });

        expect(response.status).toBe(409);
        const data = await response.json();
        expect(data.error).toBe('Photo already in album');
      });
    });

    it('should return 404 when adding photo to non-existent album', async () => {
      const nonExistentAlbumId = '123e4567-e89b-12d3-a456-426614174999';
      const photoId = matchers.uuid.generate;
      const addPhotoRequest = { photoId };
      
      await provider
        .given('album does not exist')
        .uponReceiving('a request to add photo to non-existent album')
        .withRequest({
          method: 'POST',
          path: `/api/albums/${nonExistentAlbumId}/photos`,
          headers: authHeaders,
          body: addPhotoRequest,
        })
        .willRespondWith({
          status: 404,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            404,
            'Album not found',
            'Album not found'
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums/${nonExistentAlbumId}/photos`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify(addPhotoRequest),
        });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Album not found');
      });
    });
  });

  describe('DELETE /api/albums/:id/photos/:photoId', () => {
    it('should remove a photo from an album', async () => {
      const albumId = matchers.uuid.generate;
      const photoId = matchers.uuid.generate;
      
      await provider
        .given('album and photo exist and belong to user')
        .given('photo is in album')
        .uponReceiving('a request to remove photo from album')
        .withRequest({
          method: 'DELETE',
          path: `/api/albums/${albumId}/photos/${photoId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            message: Matchers.like('Photo removed from album'),
            albumId: Matchers.like(albumId),
            photoId: Matchers.like(photoId)
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums/${albumId}/photos/${photoId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe('Photo removed from album');
        expect(data.albumId).toBe(albumId);
        expect(data.photoId).toBe(photoId);
      });
    });

    it('should return 404 when removing photo not in album', async () => {
      const albumId = matchers.uuid.generate;
      const photoId = matchers.uuid.generate;
      
      await provider
        .given('album and photo exist and belong to user')
        .given('photo is not in album')
        .uponReceiving('a request to remove photo not in album')
        .withRequest({
          method: 'DELETE',
          path: `/api/albums/${albumId}/photos/${photoId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 404,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            404,
            'Photo not in album',
            'Photo not in album'
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums/${albumId}/photos/${photoId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Photo not in album');
      });
    });
  });

  describe('DELETE /api/albums/:id', () => {
    it('should delete an album', async () => {
      const albumId = matchers.uuid.generate;
      
      await provider
        .given('album exists and belongs to user')
        .uponReceiving('a request to delete an album')
        .withRequest({
          method: 'DELETE',
          path: `/api/albums/${albumId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 200,
          headers: commonHeaders,
          body: {
            message: Matchers.like('Album deleted successfully'),
            albumId: Matchers.like(albumId)
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums/${albumId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe('Album deleted successfully');
        expect(data.albumId).toBe(albumId);
      });
    });

    it('should return 404 when deleting non-existent album', async () => {
      const nonExistentAlbumId = '123e4567-e89b-12d3-a456-426614174999';
      
      await provider
        .given('album does not exist')
        .uponReceiving('a request to delete non-existent album')
        .withRequest({
          method: 'DELETE',
          path: `/api/albums/${nonExistentAlbumId}`,
          headers: authHeaders,
        })
        .willRespondWith({
          status: 404,
          headers: commonHeaders,
          body: createErrorResponseMatcher(
            404,
            'Album not found',
            'Album not found'
          ),
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/albums/${nonExistentAlbumId}`, {
          method: 'DELETE',
          headers: authHeaders,
        });

        expect(response.status).toBe(404);
        const data = await response.json();
        expect(data.error).toBe('Album not found');
      });
    });
  });
});
