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
  generateSecureToken,
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
import { createSRPSessionManager, SRPSessionData } from "./srp-sessions";
import { getSRPSecurityService } from "./srp-security";

import { db } from "./db";
import { users, passwordResetTokens } from "../shared/schema";
import { eq, lt, and, gt, isNull } from "drizzle-orm";

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

// Password reset schemas
const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters long"),
});

// Rate limiting for password reset (stricter than general auth)
export const passwordResetRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 password reset requests per hour
  message: {
    error: "Too many password reset requests",
    message: "Please try again later",
  },
  standardHeaders: true,
  legacyHeaders: false,
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

// SRP session manager (Redis in production, in-memory in development)
const srpSessionManager = createSRPSessionManager();

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

    // Security validation
    const securityService = getSRPSecurityService();
    const validation = await securityService.validateSessionRequest(
      email,
      req.ip,
      req.get("User-Agent")
    );
    
    if (!validation.valid) {
      await logSecurityEvent(AuditEventType.SRP_INVALID_REQUEST, {
        email,
        reason: validation.reason,
        ipAddress: req.ip,
      });
      
      return res.status(400).json({
        error: "Invalid request",
        message: validation.reason,
      });
    }

    // Check for suspicious activity
    const suspiciousCheck = await securityService.checkSuspiciousActivity(email);
    if (suspiciousCheck.isSuspicious) {
      await logSecurityEvent(AuditEventType.SRP_SUSPICIOUS_ACTIVITY_BLOCKED, {
        email,
        reasons: suspiciousCheck.reasons,
        riskScore: suspiciousCheck.riskScore,
        ipAddress: req.ip,
      });
      
      return res.status(429).json({
        error: "Request blocked",
        message: "Suspicious activity detected, please try again later",
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
    
    // Store server session using session manager
    const sessionId = await srpSessionManager.storeSession({
      email,
      serverSession,
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
    const srpSession = await srpSessionManager.getSession(sessionId);
    if (!srpSession) {
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
      await srpSessionManager.deleteSession(sessionId);
      return res.status(401).json({
        error: "User not found",
        message: "User account not found",
      });
    }

    // Clean up SRP session
    await srpSessionManager.deleteSession(sessionId);

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

/**
 * POST /api/auth/forgot-password
 * Send password reset email with security controls
 */
router.post("/forgot-password", passwordResetRateLimit, async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = forgotPasswordSchema.parse(req.body);

    // Always return 200 to prevent email enumeration
    res.status(200).json({
      message: "If that email exists, a reset link was sent.",
    });

    // Check if user exists (async, after response)
    const user = await findUserByEmail(validatedData.email);
    if (!user) {
      // Log the attempt but don't reveal user doesn't exist
      await logSecurityEvent(AuditEventType.SRP_INVALID_REQUEST, {
        email: validatedData.email,
        reason: "User not found",
        ipAddress: req.ip,
      });
      return;
    }

    // Generate secure reset token
    const rawToken = generateSecureToken(32); // 64-character hex token
    const hashedToken = await hashPassword(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Store token in database
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token: hashedToken,
      expiresAt,
    });

    // TODO: Send email with reset link
    // For now, log the token (in production, this should be sent via email)
    console.log(`Password reset token for ${validatedData.email}: ${rawToken}`);
    
    // Log successful password reset request
    await logAuthEvent(AuditEventType.SRP_INVALID_REQUEST, {
      email: validatedData.email,
      action: "password_reset_requested",
      ipAddress: req.ip,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        message: "Invalid input data",
        details: error.errors,
      });
    }

    console.error("Forgot password error:", error);
    // Don't expose internal errors, but log them
    await logSecurityEvent(AuditEventType.SRP_INVALID_REQUEST, {
      email: req.body.email,
      reason: "Internal server error",
      ipAddress: req.ip,
    });
    
    // Still return 200 to prevent enumeration
    res.status(200).json({
      message: "If that email exists, a reset link was sent.",
    });
  }
});

/**
 * POST /api/auth/reset-password
 * Reset password using valid token
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    // Validate input
    const validatedData = resetPasswordSchema.parse(req.body);

    // Find valid reset token
    const currentTime = new Date();
    const tokenRecords = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, await hashPassword(validatedData.token)),
          gt(passwordResetTokens.expiresAt, currentTime),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(1);

    const tokenRecord = tokenRecords[0];
    if (!tokenRecord) {
      return res.status(400).json({
        error: "Invalid or expired token",
        message: "Please request a new password reset link",
      });
    }

    // Get user
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, tokenRecord.userId))
      .limit(1);

    const userData = user[0];
    if (!userData) {
      return res.status(400).json({
        error: "Invalid token",
        message: "Please request a new password reset link",
      });
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(validatedData.newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: "Weak password",
        message: "Password does not meet security requirements",
        details: passwordValidation.errors,
      });
    }

    // Check if password has been breached
    const isBreached = await checkPasswordBreach(validatedData.newPassword);
    if (isBreached) {
      return res.status(400).json({
        error: "Breached password",
        message: "This password has been found in known data breaches. Please choose a different password.",
      });
    }

    // Hash new password
    const newPasswordHash = await hashPassword(validatedData.newPassword);

    // Update user password
    await db
      .update(users)
      .set({ password: newPasswordHash })
      .where(eq(users.id, userData.id));

    // Mark token as used
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, tokenRecord.id));

    // Log successful password reset
    await logAuthEvent(AuditEventType.SRP_INVALID_REQUEST, {
      email: userData.username,
      action: "password_reset_completed",
      ipAddress: req.ip,
    });

    res.json({
      message: "Password reset successfully",
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        message: "Invalid input data",
        details: error.errors,
      });
    }

    console.error("Reset password error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to reset password",
    });
  }
});

export default router;
