// AI-META-BEGIN
// AI-META: Authentication endpoints for register/login/token refresh/profile
// OWNERSHIP: server/auth
// ENTRYPOINTS: mounted at /api/auth via server/routes.ts
// DEPENDENCIES: zod validation, ./security, ./auth, ./audit, ./auth-captcha-routes
// DANGER: Changes affect account security, token issuance, and brute-force protections
// CHANGE-SAFETY: Preserve response contracts and auth/captcha event logging side effects
// TESTS: server/auth-routes.test.ts
// AI-META-END

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  checkPasswordBreach,
  validatePasswordStrength,
} from "./security";
import { SRPRoutines, SRPParameters, SRPServerSession } from "tssrp6a";
import { authenticateToken, authRateLimit } from "./auth";
import {
  checkCaptchaRequirement,
  verifyCaptchaMiddleware,
  recordAuthFailure,
  recordAuthSuccess,
} from "./auth-captcha-routes";
import { logAuthEvent, logSecurityEvent, AuditEventType } from "./audit";

import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

// JWT secret (should be in environment variables)
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Input validation schemas
const registerSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  srpSalt: z.string().optional(), // SRP salt (for SRP registration)
  srpVerifier: z.string().optional(), // SRP verifier (for SRP registration)
}).refine(
  (data) => {
    // Either traditional password OR SRP fields must be provided
    return (data.password && !data.srpSalt && !data.srpVerifier) || 
           (!data.password && data.srpSalt && data.srpVerifier);
  },
  {
    message: "Provide either password with email, or srpSalt and srpVerifier for SRP registration",
  }
);

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
});

// Helper function to find user by email
async function findUserByEmail(email: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.username, email))
    .limit(1);
  return result[0];
}

// Helper function to create user
async function createUser(email: string, passwordHash?: string, srpSalt?: string, srpVerifier?: string) {
  const [user] = await db
    .insert(users)
    .values({
      password: passwordHash || null,
      srpSalt: srpSalt || null,
      srpVerifier: srpVerifier || null,
      username: email, // Use email as username for now since schema requires it
    })
    .returning();
  return user;
}

/**
 * POST /api/auth/register
 * Register a new user (supports both traditional and SRP registration)
 */
router.post("/register", authRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await findUserByEmail(validatedData.email);
    if (existingUser) {
      return res.status(409).json({
        error: "User already exists",
        message: "An account with this email already exists",
      });
    }

    let user;
    
    // Handle SRP registration
    if (validatedData.srpSalt && validatedData.srpVerifier) {
      // SRP registration - client provides salt and verifier
      user = await createUser(
        validatedData.email,
        undefined, // No password hash for SRP
        validatedData.srpSalt,
        validatedData.srpVerifier
      );
    } else {
      // Traditional registration - validate password strength and breach
      const passwordValidation = validatePasswordStrength(validatedData.password);
      if (!passwordValidation.isValid) {
        return res.status(400).json({
          error: "Weak password",
          message: "Password does not meet security requirements",
          details: passwordValidation.errors,
        });
      }

      // Check if password has been breached
      const isBreached = await checkPasswordBreach(validatedData.password);
      if (isBreached) {
        return res.status(400).json({
          error: "Breached password",
          message:
            "This password has been found in known data breaches. Please choose a different password.",
        });
      }

      // Hash password
      const passwordHash = await hashPassword(validatedData.password);

      // Create user
      user = await createUser(validatedData.email, passwordHash);
    }

    // Generate tokens
    const accessToken = generateAccessToken(
      { id: user.id, email: user.username },
      JWT_SECRET,
    );
    const refreshToken = generateRefreshToken(
      { id: user.id, email: user.username },
      JWT_SECRET,
    );

    // Return user info and tokens (excluding password hash)
    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user.id,
        email: user.username,
        // createdAt: user.createdAt,
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

// In-memory storage for SRP sessions (in production, use Redis or similar)
const srpSessions = new Map<string, any>();

/**
 * POST /api/auth/login/challenge
 * SRP login challenge - server step 1
 */
router.post("/login/challenge", authRateLimit, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        error: "Email required",
        message: "Email is required for SRP challenge",
      });
    }

    // Find user
    const user = await findUserByEmail(email);
    if (!user || !user.srpSalt || !user.srpVerifier) {
      return res.status(401).json({
        error: "Invalid credentials",
        message: "Email not found or user not set up for SRP",
      });
    }

    // Initialize SRP server session
    const srpRoutines = new SRPRoutines(new SRPParameters());
    const serverSession = new SRPServerSession(srpRoutines);
    
    // Server step 1: generate B
    const B = await serverSession.step1(email, user.srpSalt, user.srpVerifier);
    
    // Store server session temporarily
    const sessionId = generateSecureToken(32);
    srpSessions.set(sessionId, {
      serverSession,
      email,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    });

    // Return challenge to client
    res.json({
      sessionId,
      salt: user.srpSalt,
      B,
    });
  } catch (error) {
    console.error("SRP challenge error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to generate SRP challenge",
    });
  }
});

/**
 * POST /api/auth/login/verify
 * SRP login verify - server step 2
 */
router.post("/login/verify", authRateLimit, async (req: Request, res: Response) => {
  try {
    const { sessionId, A, M1 } = req.body;
    
    if (!sessionId || !A || !M1) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "sessionId, A, and M1 are required",
      });
    }

    // Retrieve SRP session
    const srpSession = srpSessions.get(sessionId);
    if (!srpSession || srpSession.expiresAt < Date.now()) {
      srpSessions.delete(sessionId);
      return res.status(401).json({
        error: "Invalid or expired session",
        message: "SRP session has expired, please try again",
      });
    }

    // Server step 2: verify client proof and generate M2
    const M2 = await srpSession.serverSession.step2(A, M1);
    
    // Find user for token generation
    const user = await findUserByEmail(srpSession.email);
    if (!user) {
      srpSessions.delete(sessionId);
      return res.status(401).json({
        error: "User not found",
        message: "User account not found",
      });
    }

    // Clean up SRP session
    srpSessions.delete(sessionId);

    // Generate JWT tokens
    const accessToken = generateAccessToken(
      { id: user.id, email: user.username },
      JWT_SECRET,
    );
    const refreshToken = generateRefreshToken(
      { id: user.id, email: user.username },
      JWT_SECRET,
    );

    // Return tokens and server proof
    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        email: user.username,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
      M2, // Server proof for client verification
    });
  } catch (error) {
    console.error("SRP verify error:", error);
    res.status(401).json({
      error: "Authentication failed",
      message: "Invalid SRP credentials",
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return tokens (traditional login)
 */
router.post(
  "/login",
  authRateLimit,
  checkCaptchaRequirement,
  verifyCaptchaMiddleware,
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const validatedData = loginSchema.parse(req.body);

      // Find user
      const user = await findUserByEmail(validatedData.email);
      if (!user) {
        recordAuthFailure(req);
        return res.status(401).json({
          error: "Invalid credentials",
          message: "Email or password is incorrect",
        });
      }

      // Verify password
      const isValidPassword = await verifyPassword(
        validatedData.password,
        user.password, // Schema uses 'password' column
      );
      if (!isValidPassword) {
        recordAuthFailure(req);
        return res.status(401).json({
          error: "Invalid credentials",
          message: "Email or password is incorrect",
        });
      }

      // Record successful authentication
      recordAuthSuccess(req);

      // Generate tokens
      const accessToken = generateAccessToken(
        { id: user.id, email: user.username },
        JWT_SECRET,
      );
      const refreshToken = generateRefreshToken(
        { id: user.id, email: user.username },
        JWT_SECRET,
      );

      // Return user info and tokens
      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          email: user.username,
          // createdAt: user.createdAt,
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
  },
);

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
    const user = await findUserByEmail((decoded as any).email);
    if (!user) {
      return res.status(403).json({
        error: "User not found",
        message: "Please authenticate again",
      });
    }

    // Generate new access token
    const newAccessToken = generateAccessToken(
      { id: user.id, email: user.username },
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
    const user = await findUserByEmail(req.user!.email);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
        message: "User account not found",
      });
    }

    res.json({
      user: {
        id: user.id,
        email: user.username,
        // createdAt: user.createdAt,
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
