// Family sharing API endpoints for partner relationships and encrypted family libraries.
// Extends the existing sharing infrastructure with family-specific features.

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticateToken } from "./auth";
import {
  familySharingService,
  PartnerStatus,
  PartnerType,
} from "./services/family-sharing";

const router = Router();

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE: All family sharing routes require authentication
// ═══════════════════════════════════════════════════════════
router.use(authenticateToken);

// Input validation schemas
const createInvitationSchema = z.object({
  inviteeEmail: z.string().email().optional(),
  inviteeUserId: z.string().uuid().optional(),
  message: z.string().max(500).optional(),
  partnerType: z.nativeEnum(PartnerType),
  expiresInDays: z.number().min(1).max(30).default(7),
});

const updateRelationshipSchema = z.object({
  privacySettings: z
    .object({
      allowViewAll: z.boolean(),
      allowDownload: z.boolean(),
      allowShare: z.boolean(),
      showMetadata: z.boolean(),
      requireApproval: z.boolean(),
    })
    .optional(),
  isActive: z.boolean().optional(),
});

const createAutoShareRuleSchema = z.object({
  name: z.string().min(1).max(100),
  criteria: z.object({
    contentType: z.enum(["photos", "videos", "all"]).optional(),
    dateRange: z
      .object({
        start: z.string().datetime(),
        end: z.string().datetime(),
      })
      .optional(),
    people: z.array(z.string().uuid()).optional(),
    albums: z.array(z.string().uuid()).optional(),
    tags: z.array(z.string()).optional(),
    minRating: z.number().min(1).max(5).optional(),
    excludeTags: z.array(z.string()).optional(),
    excludeAlbums: z.array(z.string().uuid()).optional(),
  }),
  permissions: z.enum(["view", "edit", "admin"]),
});

// ═══════════════════════════════════════════════════════════
// POST /api/family-sharing/invitations - Create partner invitation
// ═══════════════════════════════════════════════════════════
router.post("/invitations", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const validatedData = createInvitationSchema.parse(req.body);

    // Validate that either email or userId is provided
    if (!validatedData.inviteeEmail && !validatedData.inviteeUserId) {
      return res.status(400).json({
        error: "Either inviteeEmail or inviteeUserId must be provided",
      });
    }

    // Create invitation
    const result = await familySharingService.createInvitation(
      userId,
      validatedData,
    );

    res.status(201).json({
      invitationId: result.invitationId,
      invitationToken: result.invitationToken,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error("Failed to create invitation:", error);
    res.status(500).json({
      error: "Failed to create invitation",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/family-sharing/invitations/:token/accept - Accept invitation
// ═══════════════════════════════════════════════════════════
router.post(
  "/invitations/:token/accept",
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { token } = req.params;

      const result = await familySharingService.acceptInvitation(token, userId);

      res.json({
        relationshipId: result.relationshipId,
        partnerId: result.partnerId,
        partnerType: result.partnerType,
        message: "Partnership established successfully",
      });
    } catch (error) {
      console.error("Failed to accept invitation:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      if (error instanceof Error && error.message.includes("expired")) {
        return res.status(410).json({ error: "Invitation expired" });
      }
      res.status(500).json({
        error: "Failed to accept invitation",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// ═══════════════════════════════════════════════════════════
// POST /api/family-sharing/invitations/:token/decline - Decline invitation
// ═══════════════════════════════════════════════════════════
router.post(
  "/invitations/:token/decline",
  async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { token } = req.params;

      await familySharingService.declineInvitation(token, userId);

      res.json({ message: "Invitation declined" });
    } catch (error) {
      console.error("Failed to decline invitation:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({ error: "Invitation not found" });
      }
      res.status(500).json({
        error: "Failed to decline invitation",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  },
);

// ═══════════════════════════════════════════════════════════
// GET /api/family-sharing/partners - Get user's partners
// ═══════════════════════════════════════════════════════════
router.get("/partners", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const partners = await familySharingService.getUserPartners(userId);

    res.json({ partners });
  } catch (error) {
    console.error("Failed to get partners:", error);
    res.status(500).json({
      error: "Failed to get partners",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/family-sharing/partnerships/:id - Update partnership settings
// ═══════════════════════════════════════════════════════════
router.put("/partnerships/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;
    const validatedData = updateRelationshipSchema.parse(req.body);

    await familySharingService.updatePartnerRelationship(
      id,
      userId,
      validatedData,
    );

    res.json({ message: "Partnership updated successfully" });
  } catch (error) {
    console.error("Failed to update partnership:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ error: "Partnership not found" });
    }
    if (error instanceof Error && error.message.includes("access denied")) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.status(500).json({
      error: "Failed to update partnership",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/family-sharing/auto-share-rules - Create auto-share rule
// ═══════════════════════════════════════════════════════════
router.post("/auto-share-rules", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { partnershipId, name, criteria, permissions } =
      createAutoShareRuleSchema.parse(req.body);

    if (!partnershipId) {
      return res.status(400).json({ error: "partnershipId is required" });
    }

    const ruleId = await familySharingService.createAutoShareRule(
      partnershipId,
      userId,
      {
        name,
        criteria,
        permissions,
      },
    );

    res.status(201).json({
      ruleId,
      message: "Auto-share rule created successfully",
    });
  } catch (error) {
    console.error("Failed to create auto-share rule:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ error: "Partnership not found" });
    }
    if (error instanceof Error && error.message.includes("access denied")) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.status(500).json({
      error: "Failed to create auto-share rule",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/family-sharing/photos/:id/auto-share - Trigger auto-share for photo
// ═══════════════════════════════════════════════════════════
router.post("/photos/:id/auto-share", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;

    const sharedWith = await familySharingService.autoSharePhoto(id, userId);

    res.json({
      photoId: id,
      sharedWith,
      sharedCount: sharedWith.length,
    });
  } catch (error) {
    console.error("Failed to auto-share photo:", error);
    res.status(500).json({
      error: "Failed to auto-share photo",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/family-sharing/shared-photos - Get photos shared with user
// ═══════════════════════════════════════════════════════════
router.get("/shared-photos", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const {
      limit = 50,
      offset = 0,
      partnerId,
    } = req.query as {
      limit?: string;
      offset?: string;
      partnerId?: string;
    };

    const photos = await familySharingService.getSharedPhotos(userId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      partnerId,
    });

    res.json({
      photos,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        count: photos.length,
      },
    });
  } catch (error) {
    console.error("Failed to get shared photos:", error);
    res.status(500).json({
      error: "Failed to get shared photos",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/family-sharing/shared-photos/:id/save - Save shared photo
// ═══════════════════════════════════════════════════════════
router.post("/shared-photos/:id/save", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { id } = req.params;
    const { partnershipId } = req.body;

    if (!partnershipId) {
      return res.status(400).json({ error: "partnershipId is required" });
    }

    await familySharingService.saveSharedPhoto(id, userId, partnershipId);

    res.json({ message: "Photo saved successfully" });
  } catch (error) {
    console.error("Failed to save shared photo:", error);
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ error: "Shared photo not found" });
    }
    res.status(500).json({
      error: "Failed to save shared photo",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/family-sharing/stats - Get sharing statistics
// ═══════════════════════════════════════════════════════════
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const stats = await familySharingService.getSharingStats(userId);

    res.json({
      stats,
      summary: {
        totalPartners: stats.totalPartners,
        activePartners: stats.activePartners,
        photosShared: stats.photosShared,
        photosReceived: stats.photosReceived,
        autoShareRules: stats.autoShareRules,
      },
    });
  } catch (error) {
    console.error("Failed to get sharing stats:", error);
    res.status(500).json({
      error: "Failed to get sharing stats",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
