// Authentication routes for Cloud Gallery

import { Router, Request, Response } from "express";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  validatePasswordStrength,
  verifyAccessToken,
} from "./security";
import { authRateLimit, authenticateToken } from "./auth";
import { z } from "zod";

const router = Router();

// JWT secret (should be in environment variables)
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Input validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// Mock user database (replace with real database)
const users: {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}[] = [];

// Helper function to find user by email
function findUserByEmail(email: string) {
  return users.find((user) => user.email === email);
}

// Helper function to create user
function createUser(email: string, passwordHash: string) {
  const user = {
    id: Math.random().toString(36).substr(2, 9),
    email,
    passwordHash,
    createdAt: new Date(),
  };
  users.push(user);
  return user;
}

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post("/register", authRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = findUserByEmail(validatedData.email);
    if (existingUser) {
      return res.status(409).json({
        error: "User already exists",
        message: "An account with this email already exists",
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(validatedData.password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: "Weak password",
        message: "Password does not meet security requirements",
        details: passwordValidation.errors,
      });
    }

    // Hash password
    const passwordHash = await hashPassword(validatedData.password);

    // Create user
    const user = createUser(validatedData.email, passwordHash);

    // Generate tokens
    const accessToken = generateAccessToken(
      { id: user.id, email: user.email },
      JWT_SECRET,
    );
    const refreshToken = generateRefreshToken(
      { id: user.id, email: user.email },
      JWT_SECRET,
    );

    // Return user info and tokens (excluding password hash)
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        message: "Invalid input data",
        details: error.errors,
      });
    }

    console.error("Registration error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to register user",
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens
 */
router.post("/login", authRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = loginSchema.parse(req.body);

    // Find user
    const user = findUserByEmail(validatedData.email);
    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect",
      });
    }

    // Verify password
    const isValidPassword = await verifyPassword(
      validatedData.password,
      user.passwordHash,
    );
    if (!isValidPassword) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Email or password is incorrect",
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(
      { id: user.id, email: user.email },
      JWT_SECRET,
    );
    const refreshToken = generateRefreshToken(
      { id: user.id, email: user.email },
      JWT_SECRET,
    );

    // Return user info and tokens
    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        message: "Invalid input data",
        details: error.errors,
      });
    }

    console.error("Login error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to authenticate user",
    });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: "Refresh token required",
        message: "Please provide a refresh token",
      });
    }

    // Verify refresh token (using verifyAccessToken for now)
    const decoded = verifyAccessToken(refreshToken, JWT_SECRET);
    if (!decoded) {
      return res.status(403).json({
        error: "Invalid or expired refresh token",
        message: "Please authenticate again",
      });
    }

    // Find user
    const user = findUserByEmail((decoded as any).email);
    if (!user) {
      return res.status(403).json({
        error: "User not found",
        message: "Please authenticate again",
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(
      { id: user.id, email: user.email },
      JWT_SECRET,
    );

    res.json({
      message: "Token refreshed successfully",
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to refresh token",
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info (protected route)
 */
router.get("/me", authenticateToken, async (req: Request, res: Response) => {
  try {
    // Find user
    const user = findUserByEmail(req.user!.email);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User account not found",
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get user info error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get user info",
    });
  }
});

export default router;
