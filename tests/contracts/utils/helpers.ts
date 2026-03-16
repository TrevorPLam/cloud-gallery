import { like, eachLike, term } from '@pact-foundation/pact-core';
import { matchers } from './setup';

// Helper functions for creating contract expectations

/**
 * Create a user object matcher for contract testing
 */
export function createUserMatcher(overrides: Partial<any> = {}) {
  return like({
    id: matchers.uuid,
    email: matchers.email,
    createdAt: matchers.timestamp,
    ...overrides
  });
}

/**
 * Create a photo object matcher for contract testing
 */
export function createPhotoMatcher(overrides: Partial<any> = {}) {
  return like({
    id: matchers.uuid,
    uri: term({
      matcher: 'regex',
      regex: '^https?://.*/photo/.*\\.(jpg|jpeg|png|gif)$',
      generate: 'https://example.com/photo/test.jpg'
    }),
    filename: like('test-photo.jpg'),
    width: like(1920),
    height: like(1080),
    size: like(1024000),
    mimeType: like('image/jpeg'),
    isFavorite: like(false),
    isVideo: like(false),
    tags: eachLike('vacation'),
    mlLabels: eachLike('beach'),
    location: like({
      latitude: like(40.7128),
      longitude: like(-74.0060),
      city: like('New York'),
      country: like('USA')
    }),
    createdAt: matchers.timestamp,
    modifiedAt: matchers.timestamp,
    deletedAt: null,
    userId: matchers.uuid,
    ...overrides
  });
}

/**
 * Create an album object matcher for contract testing
 */
export function createAlbumMatcher(overrides: Partial<any> = {}) {
  return like({
    id: matchers.uuid,
    name: like('Summer Vacation'),
    description: like('Photos from our summer trip'),
    coverPhotoId: matchers.uuid,
    photoCount: like(25),
    createdAt: matchers.timestamp,
    modifiedAt: matchers.timestamp,
    userId: matchers.uuid,
    ...overrides
  });
}

/**
 * Create authentication response matcher
 */
export function createAuthResponseMatcher(overrides: Partial<any> = {}) {
  return like({
    message: like('Login successful'),
    user: createUserMatcher(),
    tokens: like({
      accessToken: matchers.jwtToken,
      refreshToken: matchers.jwtToken
    }),
    ...overrides
  });
}

/**
 * Create pagination response matcher
 */
export function createPaginationMatcher(total: number, limit: number, offset: number) {
  return like({
    limit: like(limit),
    offset: like(offset),
    total: like(total),
    hasMore: like(offset + limit < total)
  });
}

/**
 * Create search results matcher
 */
export function createSearchResultsMatcher(photosCount: number, query: string) {
  return like({
    photos: eachLike(createPhotoMatcher()),
    total: like(photosCount),
    query: like(query),
    suggestions: eachLike('vacation'),
    pagination: createPaginationMatcher(photosCount, 20, 0)
  });
}

/**
 * Create API error response matcher
 */
export function createErrorResponseMatcher(status: number, error: string, message: string) {
  return like({
    error: like(error),
    message: like(message)
  });
}

/**
 * Helper to extract user ID from auth response for use in subsequent requests
 */
export function extractUserId(authResponse: any): string {
  return authResponse.user.id;
}

/**
 * Helper to extract access token from auth response for use in subsequent requests
 */
export function extractAccessToken(authResponse: any): string {
  return authResponse.tokens.accessToken;
}

/**
 * Create a mock user registration request
 */
export function createRegistrationRequest() {
  return {
    email: 'test@example.com',
    password: 'SecurePassword123!'
  };
}

/**
 * Create a mock login request
 */
export function createLoginRequest() {
  return {
    email: 'test@example.com',
    password: 'SecurePassword123!'
  };
}

/**
 * Create a mock photo creation request
 */
export function createPhotoCreationRequest() {
  return {
    uri: 'https://example.com/photo/test.jpg',
    filename: 'test-photo.jpg',
    width: 1920,
    height: 1080,
    size: 1024000,
    mimeType: 'image/jpeg'
  };
}

/**
 * Create a mock album creation request
 */
export function createAlbumCreationRequest() {
  return {
    name: 'Test Album',
    description: 'A test album for contract testing'
  };
}

/**
 * Create a mock search request
 */
export function createSearchRequest() {
  return {
    query: 'vacation',
    limit: 20,
    offset: 0
  };
}
