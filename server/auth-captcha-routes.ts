// AI-META-BEGIN
// AI-META: CAPTCHA challenge generation and verification routes for authentication hardening
// OWNERSHIP: server/security
// ENTRYPOINTS: mounted by server/index.ts and security workflows
// DEPENDENCIES: express, zod, ./captcha
// DANGER: Weak validation or permissive attempt tracking can enable brute-force bypasses
// CHANGE-SAFETY: Keep response shape stable for clients and preserve attempt throttling semantics
// TESTS: server/captcha.test.ts
// AI-META-END

// CAPTCHA routes for Cloud Gallery authentication

import { Router, Request, Response } from "express";
import { z } from "zod";
import { generateCaptcha, verifyCaptcha } from "./captcha";

const router = Router();

// Track failed attempts by IP address (in production, use Redis)
const failedAttempts = new Map<
  string,
  { count: number; lastAttempt: number }
>();

// Input validation schemas
const captchaRequestSchema = z.object({
  captchaId: z.string().min(1, "CAPTCHA ID is required"),
  answer: z.number("Answer must be a number"),
});

/**
 * Check if IP requires CAPTCHA
 */
function requiresCaptcha(ip: string): boolean {
  const attempts = failedAttempts.get(ip);
  if (!attempts) return false;

  // Reset count if 15 minutes have passed
  const fifteenMinutesAgo = Date.now() - 15 * 60 * 1000;
  if (attempts.lastAttempt < fifteenMinutesAgo) {
    failedAttempts.delete(ip);
    return false;
  }

  return attempts.count >= 3;
}

/**
 * Record failed authentication attempt
 */
function recordFailedAttempt(ip: string): void {
  const attempts = failedAttempts.get(ip);
  if (attempts) {
    attempts.count++;
    attempts.lastAttempt = Date.now();
  } else {
    failedAttempts.set(ip, {
      count: 1,
      lastAttempt: Date.now(),
    });
  }
}

/**
 * Clear failed attempts on successful authentication
 */
function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

/**
 * GET /api/auth/captcha
 * Generate a new CAPTCHA challenge
 */
router.get("/captcha", (req: Request, res: Response) => {
  try {
    const challenge = generateCaptcha();
    res.json({
      captchaId: challenge.id,
      question: challenge.question,
      expiresAt: challenge.expiresAt,
    });
  } catch (error) {
    console.error("CAPTCHA generation error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to generate CAPTCHA",
    });
  }
});

/**
 * POST /api/auth/captcha/verify
 * Verify a CAPTCHA answer
 */
router.post("/captcha/verify", (req: Request, res: Response) => {
  try {
    const validatedData = captchaRequestSchema.parse(req.body);
    const isValid = verifyCaptcha(
      validatedData.captchaId,
      validatedData.answer,
    );

    if (isValid) {
      res.json({
        valid: true,
        message: "CAPTCHA verified successfully",
      });
    } else {
      res.status(400).json({
        valid: false,
        error: "Invalid CAPTCHA",
        message: "CAPTCHA answer is incorrect or expired",
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        message: "Invalid input data",
        details: error.errors,
      });
    }

    console.error("CAPTCHA verification error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to verify CAPTCHA",
    });
  }
});

/**
 * Middleware to check if CAPTCHA is required
 */
export function checkCaptchaRequirement(
  req: Request,
  res: Response,
  next: any,
): void {
  const ip = req.ip || req.connection.remoteAddress || "unknown";

  if (requiresCaptcha(ip)) {
    return res.status(429).json({
      error: "CAPTCHA required",
      message: "Too many failed attempts. Please complete CAPTCHA to continue.",
      requiresCaptcha: true,
    });
  }

  next();
}

/**
 * Middleware to verify CAPTCHA if provided
 */
export function verifyCaptchaMiddleware(
  req: Request,
  res: Response,
  next: any,
): void {
  const ip = req.ip || req.connection.remoteAddress || "unknown";

  // If CAPTCHA is not required, skip verification
  if (!requiresCaptcha(ip)) {
    return next();
  }

  // If CAPTCHA is required, verify it
  const { captchaId, answer } = req.body;

  if (!captchaId || answer === undefined) {
    return res.status(400).json({
      error: "CAPTCHA required",
      message: "CAPTCHA verification is required",
      requiresCaptcha: true,
    });
  }

  const isValid = verifyCaptcha(captchaId, Number(answer));

  if (!isValid) {
    return res.status(400).json({
      error: "Invalid CAPTCHA",
      message: "CAPTCHA answer is incorrect or expired",
      requiresCaptcha: true,
    });
  }

  next();
}

/**
 * Record failed authentication attempt
 */
export function recordAuthFailure(req: Request): void {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  recordFailedAttempt(ip);
}

/**
 * Record successful authentication attempt
 */
export function recordAuthSuccess(req: Request): void {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  clearFailedAttempts(ip);
}

// Export for testing
export const _testExports = {
  requiresCaptcha,
  recordFailedAttempt,
  clearFailedAttempts,
  clearAllFailedAttempts: () => failedAttempts.clear(),
};

export default router;
