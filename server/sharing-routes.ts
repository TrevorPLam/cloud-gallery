// AI-META-BEGIN
// AI-META: Authenticated sharing API endpoints for album collaboration and public links
// OWNERSHIP: server/api
// ENTRYPOINTS: mounted at /api/sharing via server/routes.ts
// DEPENDENCIES: express, zod, drizzle queries, ./auth, ./db, ./services/sharing, ../shared/schema
// DANGER: Sharing token bypass = unauthorized album access; permission failure = data breach
// CHANGE-SAFETY: Maintain authentication middleware, input validation, and permission checking
// TESTS: npm run test server/sharing-routes.test.ts
// AI-META-END

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken } from "./auth";
import { sharingService, Permission } from "./services/sharing";

const router = Router();

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE: All sharing routes require authentication
// ═══════════════════════════════════════════════════════════
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════
// ZOD SCHEMAS FOR INPUT VALIDATION
// ═══════════════════════════════════════════════════════════

const createShareSchema = z.object({
  albumId: z.string().uuid(),
  password: z.string().min(8).max(255).optional(),
  permissions: z.enum(["view", "edit", "admin"]).default("view"),
  expiresAt: z.string().datetime().optional().nullable(),
});

const updateShareSchema = z.object({
  permissions: z.enum(["view", "edit", "admin"]).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
});

const addCollaboratorSchema = z.object({
  userId: z.string().uuid(),
  permissions: z.enum(["view", "edit", "admin"]).default("view"),
});

const accessShareSchema = z.object({
  password: z.string().min(8).max(255).optional(),
});

// ═══════════════════════════════════════════════════════════
// POST /api/sharing/create - Create shared album
// ═══════════════════════════════════════════════════════════
router.post("/create", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate request body
    const validatedData = createShareSchema.parse(req.body);

    // Parse expiration date if provided
    const expiresAt = validatedData.expiresAt
      ? new Date(validatedData.expiresAt)
      : null;

    // Create share using service
    const result = await sharingService.createShare({
      albumId: validatedData.albumId,
      userId,
      password: validatedData.password,
      permissions: validatedData.permissions as Permission,
      expiresAt,
    });

    res.status(201).json({
      message: "Shared album created successfully",
      share: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (error.message === "Album not found or access denied") {
        return res.status(404).json({ error: error.message });
      }
    }

    console.error("Error creating shared album:", error);
    res.status(500).json({ error: "Failed to create shared album" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/sharing/access/:token - Access shared album
// ═══════════════════════════════════════════════════════════
router.post("/access/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const validatedData = accessShareSchema.parse(req.body);

    // Access shared album using service
    const result = await sharingService.accessSharedAlbum(
      token,
      validatedData.password,
    );

    res.json({
      message: "Shared album accessed successfully",
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (error.message === "Invalid or expired share token") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === "Password required") {
        return res
          .status(401)
          .json({ error: error.message, passwordRequired: true });
      }
      if (error.message === "Invalid password") {
        return res.status(401).json({ error: error.message });
      }
    }

    console.error("Error accessing shared album:", error);
    res.status(500).json({ error: "Failed to access shared album" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/sharing/validate/:token - Validate share token
// ═══════════════════════════════════════════════════════════
router.get("/validate/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Validate token using service
    const validation = await sharingService.validateShareToken(token);

    res.json({
      valid: validation.valid,
      expired: validation.expired,
      passwordRequired: validation.passwordRequired,
    });
  } catch (error) {
    console.error("Error validating share token:", error);
    res.status(500).json({ error: "Failed to validate share token" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/sharing/my-shares - Get user's shared albums
// ═══════════════════════════════════════════════════════════
router.get("/my-shares", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get user's shared albums using service
    const result = await sharingService.getUserSharedAlbums(userId);

    res.json({
      owned: result.owned,
      collaborated: result.collaborated,
    });
  } catch (error) {
    console.error("Error fetching user shared albums:", error);
    res.status(500).json({ error: "Failed to fetch shared albums" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/sharing/:shareId - Update shared album settings
// ═══════════════════════════════════════════════════════════
router.put("/:shareId", async (req: Request, res: Response) => {
  try {
    const shareId = Array.isArray(req.params.shareId)
      ? req.params.shareId[0]
      : req.params.shareId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate request body
    const validatedData = updateShareSchema.parse(req.body);

    // Parse expiration date if provided
    const expiresAt = validatedData.expiresAt
      ? new Date(validatedData.expiresAt)
      : null;

    // Update share using service
    const result = await sharingService.updateShare(shareId, userId, {
      permissions: validatedData.permissions as Permission,
      expiresAt,
      isActive: validatedData.isActive,
    });

    res.json({
      message: "Shared album updated successfully",
      share: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (error.message === "Share not found or access denied") {
        return res.status(404).json({ error: error.message });
      }
    }

    console.error("Error updating shared album:", error);
    res.status(500).json({ error: "Failed to update shared album" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/sharing/:shareId/collaborators - Add collaborator
// ═══════════════════════════════════════════════════════════
router.post("/:shareId/collaborators", async (req: Request, res: Response) => {
  try {
    const shareId = Array.isArray(req.params.shareId)
      ? req.params.shareId[0]
      : req.params.shareId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate request body
    const validatedData = addCollaboratorSchema.parse(req.body);

    // Add collaborator using service
    const result = await sharingService.addCollaborator({
      sharedAlbumId: shareId,
      userId: validatedData.userId,
      permissions: validatedData.permissions as Permission,
      invitedBy: userId,
    });

    res.status(201).json({
      message: "Collaborator added successfully",
      collaborator: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (error.message === "Shared album not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === "Album not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === "User not found") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === "Insufficient permissions to add collaborators") {
        return res.status(403).json({ error: error.message });
      }
      if (error.message === "User is already a collaborator") {
        return res.status(409).json({ error: error.message });
      }
    }

    console.error("Error adding collaborator:", error);
    res.status(500).json({ error: "Failed to add collaborator" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/sharing/:shareId/collaborators - Get collaborators
// ═══════════════════════════════════════════════════════════
router.get("/:shareId/collaborators", async (req: Request, res: Response) => {
  try {
    const shareId = Array.isArray(req.params.shareId)
      ? req.params.shareId[0]
      : req.params.shareId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get collaborators using service
    const collaborators = await sharingService.getCollaborators(
      shareId,
      userId,
    );

    res.json({ collaborators });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Access denied") {
        return res.status(403).json({ error: error.message });
      }
    }

    console.error("Error fetching collaborators:", error);
    res.status(500).json({ error: "Failed to fetch collaborators" });
  }
});

// ═══════════════════════════════════════════════════════════
// DELETE /api/sharing/:shareId/collaborators/:userId - Remove collaborator
// ═══════════════════════════════════════════════════════════
router.delete(
  "/:shareId/collaborators/:userId",
  async (req: Request, res: Response) => {
    try {
      const shareId = Array.isArray(req.params.shareId)
        ? req.params.shareId[0]
        : req.params.shareId;
      const userIdToRemove = Array.isArray(req.params.userId)
        ? req.params.userId[0]
        : req.params.userId;
      const requestUserId = req.user?.id;

      if (!requestUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Remove collaborator using service
      await sharingService.removeCollaborator(
        shareId,
        userIdToRemove,
        requestUserId,
      );

      res.json({
        message: "Collaborator removed successfully",
        shareId,
        userId: userIdToRemove,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Shared album not found") {
          return res.status(404).json({ error: error.message });
        }
        if (
          error.message === "Insufficient permissions to remove collaborators"
        ) {
          return res.status(403).json({ error: error.message });
        }
        if (error.message === "Cannot remove album owner") {
          return res.status(400).json({ error: error.message });
        }
      }

      console.error("Error removing collaborator:", error);
      res.status(500).json({ error: "Failed to remove collaborator" });
    }
  },
);

// ═══════════════════════════════════════════════════════════
// GET /api/sharing/stats - Get sharing statistics for user
// ═══════════════════════════════════════════════════════════
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get user's shared albums
    const result = await sharingService.getUserSharedAlbums(userId);

    // Calculate statistics
    const totalShares = result.owned.length;
    const activeShares = result.owned.filter((share) => share.isActive).length;
    const expiredShares = result.owned.filter(
      (share) => share.expiresAt && share.expiresAt < new Date(),
    ).length;
    const totalCollaborations = result.collaborated.length;
    const totalViews = result.owned.reduce(
      (sum, share) => sum + share.viewCount,
      0,
    );

    res.json({
      totalShares,
      activeShares,
      expiredShares,
      totalCollaborations,
      totalViews,
      sharesWithPassword: result.owned.filter(
        (share) => share.shareToken && share.shareToken.length > 0, // This would need to be enhanced to check passwordRequired
      ).length,
    });
  } catch (error) {
    console.error("Error fetching sharing statistics:", error);
    res.status(500).json({ error: "Failed to fetch sharing statistics" });
  }
});

export default router;
