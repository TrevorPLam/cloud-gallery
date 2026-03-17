// AI-META-BEGIN
// AI-META: Mock authentication middleware factory for server route tests
// OWNERSHIP: server/__mocks__
// ENTRYPOINTS: Imported by server route test files
// DEPENDENCIES: vitest, express types
// DANGER: Must properly simulate JWT verification and user context
// CHANGE-SAFETY: Update when auth middleware changes
// TESTS: Used throughout server route test suite
// AI-META-END

import { vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';

export interface MockUser {
  id: string;
  email: string;
  username?: string;
  role?: string;
}

// Mock authentication middleware factory
export const createMockAuthMiddleware = (defaultUser: MockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  username: 'testuser',
  role: 'user'
}) => {
  const mockAuth = vi.fn((req: Request, res: Response, next: NextFunction) => {
    // Set user context on request
    req.user = defaultUser;
    next();
  });

  // Helper to create user-specific middleware
  const withUser = (user: MockUser) => {
    return vi.fn((req: Request, res: Response, next: NextFunction) => {
      req.user = user;
      next();
    });
  };

  // Helper to simulate authentication failure
  const withError = (error: Error | string) => {
    return vi.fn((req: Request, res: Response, next: NextFunction) => {
      if (typeof error === 'string') {
        return res.status(401).json({ error });
      }
      return res.status(401).json({ error: error.message });
    });
  };

  // Helper to simulate missing token
  const withoutToken = vi.fn((req: Request, res: Response, next: NextFunction) => {
    res.status(401).json({ error: 'No token provided' });
  });

  return {
    mockAuth,
    withUser,
    withError,
    withoutToken,
    defaultUser
  };
};

// Mock JWT verification functions
export const createMockJWT = () => {
  const mockVerify = vi.fn((token: string) => {
    if (token === 'valid-token') {
      return { id: 'test-user-id', email: 'test@example.com' };
    }
    if (token === 'admin-token') {
      return { id: 'admin-user-id', email: 'admin@example.com', role: 'admin' };
    }
    if (token === 'other-user-token') {
      return { id: 'other-user-id', email: 'other@example.com' };
    }
    throw new Error('Invalid token');
  });

  const mockSign = vi.fn((payload: any, secret: string) => {
    return `mock_token_${JSON.stringify(payload)}`;
  });

  return {
    verify: mockVerify,
    sign: mockSign
  };
};

// Default mock auth middleware instance
export const { mockAuth, withUser, withError, withoutToken } = createMockAuthMiddleware();
export const { verify: mockJWTVerify, sign: mockJWTSign } = createMockJWT();
