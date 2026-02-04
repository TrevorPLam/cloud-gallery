// Authentication middleware and utilities for Cloud Gallery

import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "./security";

/**
 * Rate limiting middleware for authentication endpoints
 */
import rateLimit from "express-rate-limit";

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

/**
 * JWT secret key (should be in environment variables)
 */
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

/**
 * Authentication middleware for protected routes
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({
      error: "Access token required",
      message: "Please provide a valid access token",
    });
    return;
  }

  const decoded = verifyAccessToken(token, JWT_SECRET);
  if (!decoded) {
    res.status(403).json({
      error: "Invalid or expired token",
      message: "Please authenticate again",
    });
    return;
  }

  // Attach user info to request
  req.user = decoded as { id: string; email: string };
  next();
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 *
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export function optionalAuthentication(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token) {
    const decoded = verifyAccessToken(token, JWT_SECRET);
    if (decoded) {
      req.user = decoded as { id: string; email: string };
    }
  }

  next();
}

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    error: "Too many authentication attempts",
    message: "Please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests",
    message: "Please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
