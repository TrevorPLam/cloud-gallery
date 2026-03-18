import { Matchers } from "@pact-foundation/pact";
import { matchers } from "./setup";

// Helper functions for creating contract expectations

/**
 * Create a user object matcher for contract testing
 */
export function createUserMatcher(overrides: Partial<any> = {}) {
  return Matchers.like({
    id: matchers.uuid,
    email: matchers.email,
    createdAt: matchers.timestamp,
    ...overrides,
  });
}

/**
 * Create a photo object matcher for contract testing
 */
export function createPhotoMatcher(overrides: Partial<any> = {}) {
  return Matchers.like({
    id: matchers.uuid,
    uri: Matchers.regex(
      "^https?://.*/photo/.*\\.(jpg|jpeg|png|gif)$",
      "https://example.com/photo/test.jpg",
    ),
    filename: Matchers.like("test-photo.jpg"),
    width: Matchers.like(1920),
    height: Matchers.like(1080),
    size: Matchers.like(1024000),
    mimeType: Matchers.like("image/jpeg"),
    isFavorite: Matchers.like(false),
    isVideo: Matchers.like(false),
    tags: Matchers.eachLike("vacation"),
    mlLabels: Matchers.eachLike("beach"),
    location: Matchers.like({
      latitude: Matchers.like(40.7128),
      longitude: Matchers.like(-74.006),
      city: Matchers.like("New York"),
      country: Matchers.like("USA"),
    }),
    createdAt: matchers.timestamp,
    modifiedAt: matchers.timestamp,
    deletedAt: null,
    userId: matchers.uuid,
    ...overrides,
  });
}

/**
 * Create an album object matcher for contract testing
 */
export function createAlbumMatcher(overrides: Partial<any> = {}) {
  return Matchers.like({
    id: matchers.uuid,
    title: Matchers.like("Summer Vacation"),
    description: Matchers.like("Photos from our summer trip"),
    coverPhotoId: matchers.uuid,
    photoCount: Matchers.like(25),
    createdAt: matchers.timestamp,
    modifiedAt: matchers.timestamp,
    userId: matchers.uuid,
    ...overrides,
  });
}

/**
 * Create authentication response matcher
 */
export function createAuthResponseMatcher(overrides: Partial<any> = {}) {
  return Matchers.like({
    message: Matchers.like("Login successful"),
    user: createUserMatcher(),
    tokens: Matchers.like({
      accessToken: matchers.jwtToken,
      refreshToken: matchers.jwtToken,
    }),
    ...overrides,
  });
}

/**
 * Create pagination response matcher
 */
export function createPaginationMatcher(
  total: number,
  limit: number,
  offset: number,
) {
  return Matchers.like({
    limit: Matchers.like(limit),
    offset: Matchers.like(offset),
    total: Matchers.like(total),
    hasMore: Matchers.like(offset + limit < total),
  });
}

/**
 * Create search results matcher
 */
export function createSearchResultsMatcher(photosCount: number, query: string) {
  return Matchers.like({
    photos: Matchers.eachLike(createPhotoMatcher()),
    total: Matchers.like(photosCount),
    query: Matchers.like(query),
    suggestions: Matchers.eachLike("vacation"),
    pagination: createPaginationMatcher(photosCount, 20, 0),
  });
}

/**
 * Create API error response matcher
 */
export function createErrorResponseMatcher(
  status: number,
  error: string,
  message: string,
) {
  return Matchers.like({
    error: Matchers.like(error),
    message: Matchers.like(message),
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
    email: "test@example.com",
    password: "SecurePassword123!",
  };
}

/**
 * Create a mock login request
 */
export function createLoginRequest() {
  return {
    email: "test@example.com",
    password: "SecurePassword123!",
  };
}

/**
 * Create a mock photo creation request
 */
export function createPhotoCreationRequest() {
  return {
    uri: "https://example.com/photo/test.jpg",
    filename: "test-photo.jpg",
    width: 1920,
    height: 1080,
    size: 1024000,
    mimeType: "image/jpeg",
  };
}

/**
 * Create a mock album creation request
 */
export function createAlbumCreationRequest() {
  return {
    title: "Test Album",
    description: "A test album for contract testing",
  };
}

/**
 * Create a mock search request
 */
export function createSearchRequest() {
  return {
    query: "vacation",
    limit: 20,
    offset: 0,
  };
}
