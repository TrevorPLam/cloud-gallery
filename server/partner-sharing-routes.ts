// AI-META-BEGIN
// AI-META: Partner sharing API endpoints with authentication, validation, and comprehensive error handling
// OWNERSHIP: server/routes
// ENTRYPOINTS: registered in main routes.ts as /api/partner-sharing
// DEPENDENCIES: express, PartnerSharingService, authentication middleware, validation schemas
// DANGER: Partner access bypass = unauthorized photo access; invitation token exposure = security risk
// CHANGE-SAFETY: Maintain authentication, input validation, and permission checks
// TESTS: Integration tests for all endpoints, authentication validation, error handling
// AI-META-END

import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "./auth";
import {
  partnerSharingService,
  PartnershipStatus,
  InvitationStatus,
  AutoShareRuleType,
} from "./services/partner-sharing";
import {
  selectPartnerRelationshipSchema,
  selectPartnerInvitationSchema,
  selectPartnerAutoShareRuleSchema,
  selectPartnerSharedPhotoSchema,
} from "../../shared/schema";

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════
// VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════

const createInvitationSchema = z.object({
  inviteeEmail: z.string().email().optional(),
  inviteeId: z.string().uuid().optional(),
  message: z.string().max(500).optional(),
  privacySettings: z
    .object({
      includeOtherApps: z.boolean().default(true),
      minQuality: z.number().min(0).max(100).optional(),
      excludeTags: z.array(z.string()).optional(),
      favoritesOnly: z.boolean().default(false),
    })
    .optional(),
  expiresAt: z.string().datetime().optional(),
});

const createAutoShareRuleSchema = z.object({
  partnershipId: z.string().uuid(),
  name: z.string().min(1).max(100),
  ruleType: z.nativeEnum(AutoShareRuleType),
  criteria: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    peopleIds: z.array(z.string().uuid()).optional(),
    contentTypes: z
      .array(z.enum(["camera", "screenshot", "download", "other"]))
      .optional(),
    minQuality: z.number().min(0).max(100).optional(),
    excludeTags: z.array(z.string()).optional(),
    favoritesOnly: z.boolean().default(false),
  }),
  priority: z.number().int().min(0).max(100).default(0),
});

const updatePrivacySettingsSchema = z.object({
  privacySettings: z.object({
    includeOtherApps: z.boolean(),
    minQuality: z.number().min(0).max(100).optional(),
    excludeTags: z.array(z.string()).optional(),
    favoritesOnly: z.boolean(),
  }),
});

const acceptInvitationSchema = z.object({
  invitationToken: z.string().min(1),
});

// ═══════════════════════════════════════════════════════════
// INVITATION ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/partner-sharing/invitations
 * Create a new partner invitation
 */
router.post("/invitations", async (req, res) => {
  try {
    const userId = req.user!.id;
    const validatedData = createInvitationSchema.parse(req.body);

    const invitation = await partnerSharingService.createInvitation({
      inviterId: userId,
      ...validatedData,
      expiresAt: validatedData.expiresAt
        ? new Date(validatedData.expiresAt)
        : undefined,
    });

    res.status(201).json({
      success: true,
      data: invitation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (error.message.includes("already exists")) {
        return res.status(409).json({
          success: false,
          error: error.message,
        });
      }
    }

    console.error("Error creating invitation:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * POST /api/partner-sharing/invitations/accept
 * Accept a partner invitation
 */
router.post("/invitations/accept", async (req, res) => {
  try {
    const userId = req.user!.id;
    const validatedData = acceptInvitationSchema.parse(req.body);

    const partnership = await partnerSharingService.acceptInvitation(
      validatedData.invitationToken,
      userId,
    );

    res.json({
      success: true,
      data: partnership,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (error.message.includes("Invalid or expired")) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
      if (error.message.includes("not authorized")) {
        return res.status(403).json({
          success: false,
          error: error.message,
        });
      }
    }

    console.error("Error accepting invitation:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ═══════════════════════════════════════════════════════════
// PARTNERSHIP ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/partner-sharing/partnerships
 * Get user's partnerships (active and pending)
 */
router.get("/partnerships", async (req, res) => {
  try {
    const userId = req.user!.id;

    const partnerships =
      await partnerSharingService.getUserPartnerships(userId);

    res.json({
      success: true,
      data: partnerships,
    });
  } catch (error) {
    console.error("Error getting partnerships:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * PUT /api/partner-sharing/partnerships/:id/privacy
 * Update privacy settings for a partnership
 */
router.put("/partnerships/:id/privacy", async (req, res) => {
  try {
    const userId = req.user!.id;
    const partnershipId = req.params.id;
    const validatedData = updatePrivacySettingsSchema.parse(req.body);

    const result = await partnerSharingService.updatePrivacySettings(
      partnershipId,
      userId,
      validatedData.privacySettings,
    );

    res.json({
      success: true,
      message: "Privacy settings updated",
      data: {
        partnershipId,
        privacySettings: validatedData.privacySettings,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("access denied")
      ) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
    }

    console.error("Error updating privacy settings:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * DELETE /api/partner-sharing/partnerships/:id
 * End a partnership
 */
router.delete("/partnerships/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const partnershipId = req.params.id;

    const result = await partnerSharingService.endPartnership(
      partnershipId,
      userId,
    );

    res.json({
      success: true,
      message: "Partnership ended",
      data: { partnershipId },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("access denied")
      ) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
    }

    console.error("Error ending partnership:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ═══════════════════════════════════════════════════════════
// AUTO-SHARE RULES ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * POST /api/partner-sharing/rules
 * Create a new auto-share rule
 */
router.post("/rules", async (req, res) => {
  try {
    const userId = req.user!.id;
    const validatedData = createAutoShareRuleSchema.parse(req.body);

    const rule = await partnerSharingService.createAutoShareRule({
      partnershipId: validatedData.partnershipId,
      userId,
      name: validatedData.name,
      ruleType: validatedData.ruleType,
      criteria: {
        ...validatedData.criteria,
        startDate: validatedData.criteria.startDate
          ? new Date(validatedData.criteria.startDate)
          : undefined,
        endDate: validatedData.criteria.endDate
          ? new Date(validatedData.criteria.endDate)
          : undefined,
      },
      priority: validatedData.priority,
    });

    res.status(201).json({
      success: true,
      data: rule,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("access denied")
      ) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
    }

    console.error("Error creating auto-share rule:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * GET /api/partner-sharing/rules/:partnershipId
 * Get auto-share rules for a partnership
 */
router.get("/rules/:partnershipId", async (req, res) => {
  try {
    const userId = req.user!.id;
    const partnershipId = req.params.id;

    const rules = await partnerSharingService.getAutoShareRules(
      partnershipId,
      userId,
    );

    res.json({
      success: true,
      data: {
        partnershipId,
        rules,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("access denied")
      ) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
    }

    console.error("Error getting auto-share rules:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * PUT /api/partner-sharing/rules/:id
 * Update an auto-share rule
 */
router.put("/rules/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const ruleId = req.params.id;
    const validatedData = createAutoShareRuleSchema.partial().parse(req.body);

    const result = await partnerSharingService.updateAutoShareRule(
      ruleId,
      userId,
      {
        name: validatedData.name,
        criteria: validatedData.criteria,
        priority: validatedData.priority,
        isActive: validatedData.isActive,
      },
    );

    res.json({
      success: true,
      message: "Auto-share rule updated",
      data: { ruleId },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("access denied")
      ) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
    }

    console.error("Error updating auto-share rule:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * DELETE /api/partner-sharing/rules/:id
 * Delete an auto-share rule
 */
router.delete("/rules/:id", async (req, res) => {
  try {
    const userId = req.user!.id;
    const ruleId = req.params.id;

    const result = await partnerSharingService.deleteAutoShareRule(
      ruleId,
      userId,
    );

    res.json({
      success: true,
      message: "Auto-share rule deleted",
      data: { ruleId },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("access denied")
      ) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
    }

    console.error("Error deleting auto-share rule:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ═══════════════════════════════════════════════════════════
// SHARED PHOTOS ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/partner-sharing/shared-photos/:partnershipId
 * Get shared photos for a partnership
 */
router.get("/shared-photos/:partnershipId", async (req, res) => {
  try {
    const userId = req.user!.id;
    const partnershipId = req.params.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const sharedPhotos = await partnerSharingService.getSharedPhotos(
      partnershipId,
      userId,
      page,
      limit,
    );

    res.json({
      success: true,
      data: sharedPhotos,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("access denied")
      ) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
    }

    console.error("Error getting shared photos:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * POST /api/partner-sharing/shared-photos/:photoId/share
 * Manually share a photo with partners
 */
router.post("/shared-photos/:photoId/share", async (req, res) => {
  try {
    const userId = req.user!.id;
    const photoId = req.params.id;

    const partnershipIds = await partnerSharingService.sharePhotoWithPartners(
      photoId,
      userId,
    );

    res.json({
      success: true,
      data: {
        photoId,
        sharedWithPartnerships: partnershipIds,
      },
    });
  } catch (error) {
    console.error("Error sharing photo:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

/**
 * PUT /api/partner-sharing/shared-photos/:photoId/save
 * Save a shared photo to user's library
 */
router.put("/shared-photos/:photoId/save", async (req, res) => {
  try {
    const userId = req.user!.id;
    const photoId = req.params.id;
    const { partnershipId } = req.body;

    if (!partnershipId) {
      return res.status(400).json({
        success: false,
        error: "Partnership ID is required",
      });
    }

    const result = await partnerSharingService.saveSharedPhoto(
      photoId,
      partnershipId,
      userId,
    );

    res.json({
      success: true,
      message: "Photo saved to library",
      data: { photoId, partnershipId },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes("not found") ||
        error.message.includes("access denied")
      ) {
        return res.status(404).json({
          success: false,
          error: error.message,
        });
      }
    }

    console.error("Error saving shared photo:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// ═══════════════════════════════════════════════════════════
// UTILITY ENDPOINTS
// ═══════════════════════════════════════════════════════════

/**
 * GET /api/partner-sharing/stats
 * Get partner sharing statistics for a user
 */
router.get("/stats", async (req, res) => {
  try {
    const userId = req.user!.id;

    const stats = await partnerSharingService.getPartnerSharingStats(userId);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error getting partner sharing stats:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

export default router;
