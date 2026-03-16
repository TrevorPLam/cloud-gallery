import { PactV4, SpecificationVersion } from '@pact-foundation/pact';
import path from 'path';

// Pact configuration for Cloud Gallery API contract testing
export const pactConfig = {
  consumer: 'cloud-gallery-client',
  provider: 'cloud-gallery-api',
  port: 4000, // Mock server port for consumer tests
  log: path.resolve(process.cwd(), 'logs', 'pact.log'),
  dir: path.resolve(process.cwd(), 'tests', 'contracts', 'pacts'),
  logLevel: 'INFO' as const,
  spec: SpecificationVersion.V4,
};

// Create a new Pact instance for testing
export function createPact() {
  return new PactV4(pactConfig);
}

// Common request headers for API calls
export const commonHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// Auth headers (for authenticated endpoints)
export const authHeaders = {
  ...commonHeaders,
  'Authorization': 'Bearer valid-jwt-token',
};

// Helper to create flexible matchers for common patterns
export const matchers = {
  // UUID pattern matching
  uuid: {
    matcher: 'regex',
    regex: '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
    generate: '123e4567-e89b-12d3-a456-426614174000'
  },
  
  // ISO timestamp pattern
  timestamp: {
    matcher: 'regex',
    regex: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z?$',
    generate: '2024-01-01T00:00:00.000Z'
  },
  
  // Email pattern
  email: {
    matcher: 'regex',
    regex: '^[\\w\\.-]+@[\\w\\.-]+\\.[a-zA-Z]{2,}$',
    generate: 'user@example.com'
  },
  
  // JWT token pattern
  jwtToken: {
    matcher: 'regex',
    regex: '^[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+\\.[A-Za-z0-9-_]+$',
    generate: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
  }
};

// Common error response structures
export const errorResponses = {
  validationError: {
    status: 400,
    headers: commonHeaders,
    body: {
      error: 'Validation error',
      message: 'Invalid input data',
      details: [
        {
          code: 'INVALID_STRING',
          message: 'Invalid format',
          path: ['field']
        }
      ]
    }
  },
  
  unauthorizedError: {
    status: 401,
    headers: commonHeaders,
    body: {
      error: 'Unauthorized',
      message: 'Authentication required'
    }
  },
  
  forbiddenError: {
    status: 403,
    headers: commonHeaders,
    body: {
      error: 'Forbidden',
      message: 'Access denied'
    }
  },
  
  notFoundError: {
    status: 404,
    headers: commonHeaders,
    body: {
      error: 'Not found',
      message: 'Resource not found'
    }
  },
  
  serverError: {
    status: 500,
    headers: commonHeaders,
    body: {
      error: 'Internal server error',
      message: 'Something went wrong'
    }
  }
};
