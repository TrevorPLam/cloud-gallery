import { PactV4 } from '@pact-foundation/pact';
import { like, eachLike, term } from '@pact-foundation/pact-core';
import path from 'path';
import { commonHeaders, matchers } from '../utils/setup';
import { 
  createAuthResponseMatcher, 
  createErrorResponseMatcher,
  createRegistrationRequest,
  createLoginRequest 
} from '../utils/helpers';

describe('Authentication API Consumer Tests', () => {
  const provider = new PactV4({
    consumer: 'cloud-gallery-client',
    provider: 'cloud-gallery-api',
    port: 4000,
    log: path.resolve(process.cwd(), 'logs', 'pact.log'),
    dir: path.resolve(process.cwd(), 'tests', 'contracts', 'pacts'),
    logLevel: 'INFO',
  });

  beforeAll(async () => {
    await provider.setup();
  });

  afterAll(async () => {
    await provider.finalize();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const registrationRequest = createRegistrationRequest();
      
      await provider
        .addInteraction({
          states: [{ description: 'user does not exist' }],
          uponReceiving: 'a valid user registration request',
          withRequest: {
            method: 'POST',
            path: '/api/auth/register',
            headers: commonHeaders,
            body: registrationRequest,
          },
          willRespondWith: {
            status: 201,
            headers: commonHeaders,
            body: createAuthResponseMatcher({
              message: like('User registered successfully')
            }),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/register`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify(registrationRequest),
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.message).toBe('User registered successfully');
        expect(data.user.email).toBe(registrationRequest.email);
        expect(data.tokens.accessToken).toBeDefined();
        expect(data.tokens.refreshToken).toBeDefined();
      });
    });

    it('should reject registration with existing email', async () => {
      const registrationRequest = createRegistrationRequest();
      
      await provider
        .addInteraction({
          states: [{ description: 'user already exists' }],
          uponReceiving: 'a registration request with existing email',
          withRequest: {
            method: 'POST',
            path: '/api/auth/register',
            headers: commonHeaders,
            body: registrationRequest,
          },
          willRespondWith: {
            status: 409,
            headers: commonHeaders,
            body: createErrorResponseMatcher(
              409,
              'User already exists',
              'An account with this email already exists'
            ),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/register`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify(registrationRequest),
        });

        expect(response.status).toBe(409);
        const data = await response.json();
        expect(data.error).toBe('User already exists');
      });
    });

    it('should reject registration with invalid email', async () => {
      const invalidRequest = {
        email: 'invalid-email',
        password: 'ValidPassword123!'
      };
      
      await provider
        .addInteraction({
          uponReceiving: 'a registration request with invalid email',
          withRequest: {
            method: 'POST',
            path: '/api/auth/register',
            headers: commonHeaders,
            body: invalidRequest,
          },
          willRespondWith: {
            status: 400,
            headers: commonHeaders,
            body: createErrorResponseMatcher(
              400,
              'Validation error',
              'Invalid input data'
            ),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/register`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify(invalidRequest),
        });

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.error).toBe('Validation error');
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate user with valid credentials', async () => {
      const loginRequest = createLoginRequest();
      
      await provider
        .addInteraction({
          states: [{ description: 'user exists with valid credentials' }],
          uponReceiving: 'a valid login request',
          withRequest: {
            method: 'POST',
            path: '/api/auth/login',
            headers: commonHeaders,
            body: loginRequest,
          },
          willRespondWith: {
            status: 200,
            headers: commonHeaders,
            body: createAuthResponseMatcher({
              message: like('Login successful')
            }),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/login`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify(loginRequest),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe('Login successful');
        expect(data.user.email).toBe(loginRequest.email);
        expect(data.tokens.accessToken).toBeDefined();
        expect(data.tokens.refreshToken).toBeDefined();
      });
    });

    it('should reject login with invalid credentials', async () => {
      const invalidLoginRequest = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };
      
      await provider
        .addInteraction({
          states: [{ description: 'user exists but credentials are invalid' }],
          uponReceiving: 'a login request with invalid credentials',
          withRequest: {
            method: 'POST',
            path: '/api/auth/login',
            headers: commonHeaders,
            body: invalidLoginRequest,
          },
          willRespondWith: {
            status: 401,
            headers: commonHeaders,
            body: createErrorResponseMatcher(
              401,
              'Invalid credentials',
              'Email or password is incorrect'
            ),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/login`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify(invalidLoginRequest),
        });

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Invalid credentials');
      });
    });

    it('should reject login for non-existent user', async () => {
      const nonExistentUserRequest = {
        email: 'nonexistent@example.com',
        password: 'SomePassword123!'
      };
      
      await provider
        .addInteraction({
          states: [{ description: 'user does not exist' }],
          uponReceiving: 'a login request for non-existent user',
          withRequest: {
            method: 'POST',
            path: '/api/auth/login',
            headers: commonHeaders,
            body: nonExistentUserRequest,
          },
          willRespondWith: {
            status: 401,
            headers: commonHeaders,
            body: createErrorResponseMatcher(
              401,
              'Invalid credentials',
              'Email or password is incorrect'
            ),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/login`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify(nonExistentUserRequest),
        });

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Invalid credentials');
      });
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const refreshRequest = {
        refreshToken: matchers.jwtToken.generate
      };
      
      await provider
        .addInteraction({
          states: [{ description: 'valid refresh token exists' }],
          uponReceiving: 'a token refresh request',
          withRequest: {
            method: 'POST',
            path: '/api/auth/refresh',
            headers: commonHeaders,
            body: refreshRequest,
          },
          willRespondWith: {
            status: 200,
            headers: commonHeaders,
            body: {
              message: like('Token refreshed successfully'),
              accessToken: matchers.jwtToken
            },
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/refresh`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify(refreshRequest),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.message).toBe('Token refreshed successfully');
        expect(data.accessToken).toBeDefined();
      });
    });

    it('should reject refresh with invalid token', async () => {
      const invalidRefreshRequest = {
        refreshToken: 'invalid-jwt-token'
      };
      
      await provider
        .addInteraction({
          states: [{ description: 'refresh token is invalid or expired' }],
          uponReceiving: 'a token refresh request with invalid token',
          withRequest: {
            method: 'POST',
            path: '/api/auth/refresh',
            headers: commonHeaders,
            body: invalidRefreshRequest,
          },
          willRespondWith: {
            status: 403,
            headers: commonHeaders,
            body: createErrorResponseMatcher(
              403,
              'Invalid or expired refresh token',
              'Please authenticate again'
            ),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/refresh`, {
          method: 'POST',
          headers: commonHeaders,
          body: JSON.stringify(invalidRefreshRequest),
        });

        expect(response.status).toBe(403);
        const data = await response.json();
        expect(data.error).toBe('Invalid or expired refresh token');
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user info with valid token', async () => {
      await provider
        .addInteraction({
          states: [{ description: 'user is authenticated' }],
          uponReceiving: 'a request for current user info',
          withRequest: {
            method: 'GET',
            path: '/api/auth/me',
            headers: {
              ...commonHeaders,
              'Authorization': `Bearer ${matchers.jwtToken.generate}`
            },
          },
          willRespondWith: {
            status: 200,
            headers: commonHeaders,
            body: {
              user: {
                id: matchers.uuid,
                email: like('test@example.com')
              }
            },
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/me`, {
          method: 'GET',
          headers: {
            ...commonHeaders,
            'Authorization': `Bearer ${matchers.jwtToken.generate}`
          },
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.user.id).toBeDefined();
        expect(data.user.email).toBeDefined();
      });
    });

    it('should reject request without authentication token', async () => {
      await provider
        .addInteraction({
          uponReceiving: 'a request without authentication token',
          withRequest: {
            method: 'GET',
            path: '/api/auth/me',
            headers: commonHeaders,
          },
          willRespondWith: {
            status: 401,
            headers: commonHeaders,
            body: createErrorResponseMatcher(
              401,
              'Unauthorized',
              'Authentication required'
            ),
          },
        });

      await provider.executeTest(async (mockServer) => {
        const response = await fetch(`${mockServer.url}/api/auth/me`, {
          method: 'GET',
          headers: commonHeaders,
        });

        expect(response.status).toBe(401);
        const data = await response.json();
        expect(data.error).toBe('Unauthorized');
      });
    });
  });
});
