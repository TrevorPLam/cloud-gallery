// AI-META-BEGIN
// AI-META: Duplicate detection API endpoints for finding and resolving duplicate photos
// OWNERSHIP: server/api
// ENTRYPOINTS: mounted at /api/photos/duplicates via server/routes.ts
// DEPENDENCIES: express, zod, drizzle queries, ./auth, ./services/duplicate-detection
// DANGER: Authorization filtering and batch operations protect data integrity
// CHANGE-SAFETY: Maintain API response structures and error handling patterns
// TESTS: npm run check:types, route integration tests
// AI-META-END

import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  findDuplicatePhotos,
  resolveDuplicateGroups,
  DuplicateDetectionConfig,
} from "./services/duplicate-detection";
import { authenticateToken } from "./auth";

const router = Router();

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE: All duplicate routes require authentication
// ═══════════════════════════════════════════════════════════
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════
// GET /api/photos/duplicates - Get duplicate groups for authenticated user
// ═══════════════════════════════════════════════════════════
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Optional query parameters for configuration
    const hammingThreshold = req.query.hammingThreshold
      ? parseInt(req.query.hammingThreshold as string)
      : undefined;
    const burstTimeWindow = req.query.burstTimeWindow
      ? parseInt(req.query.burstTimeWindow as string)
      : undefined;
    const minBurstSize = req.query.minBurstSize
      ? parseInt(req.query.minBurstSize as string)
      : undefined;

    // Build configuration from query parameters
    const config: Partial<DuplicateDetectionConfig> = {};
    if (hammingThreshold !== undefined && !isNaN(hammingThreshold)) {
      config.hammingThreshold = hammingThreshold;
    }
    if (burstTimeWindow !== undefined && !isNaN(burstTimeWindow)) {
      config.burstTimeWindow = burstTimeWindow;
    }
    if (minBurstSize !== undefined && !isNaN(minBurstSize)) {
      config.minBurstSize = minBurstSize;
    }

    const duplicateGroups = await findDuplicatePhotos(userId, config);

    res.json({
      duplicateGroups,
      count: duplicateGroups.length,
      config: {
        hammingThreshold: config.hammingThreshold || 2,
        burstTimeWindow: config.burstTimeWindow || 3,
        minBurstSize: config.minBurstSize || 3,
      },
    });
  } catch (error) {
    console.error("Error fetching duplicate groups:", error);
    res.status(500).json({ error: "Failed to fetch duplicate groups" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/photos/duplicates/resolve - Resolve duplicate groups
// ═══════════════════════════════════════════════════════════
router.post("/resolve", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate request body
    const resolveSchema = z.object({
      resolutions: z.array(
        z.object({
          groupId: z.string().min(1),
          keepPhotoIds: z.array(z.string()),
          deletePhotoIds: z.array(z.string()),
        }),
      ),
    });

    const validatedData = resolveSchema.parse(req.body);

    // Validate each resolution
    for (const resolution of validatedData.resolutions) {
      if (
        resolution.keepPhotoIds.length === 0 &&
        resolution.deletePhotoIds.length === 0
      ) {
        return res.status(400).json({
          error:
            "Each resolution must specify either keepPhotoIds or deletePhotoIds",
          groupId: resolution.groupId,
        });
      }

      if (
        resolution.keepPhotoIds.length > 0 &&
        resolution.deletePhotoIds.length > 0
      ) {
        const hasOverlap = resolution.keepPhotoIds.some((id) =>
          resolution.deletePhotoIds.includes(id),
        );
        if (hasOverlap) {
          return res.status(400).json({
            error: "Photo IDs cannot be in both keep and delete arrays",
            groupId: resolution.groupId,
          });
        }
      }
    }

    const result = await resolveDuplicateGroups(
      userId,
      validatedData.resolutions,
    );

    if (result.errors.length > 0) {
      return res.status(207).json({
        message: "Partial success - some resolutions failed",
        resolved: result.resolved,
        total: validatedData.resolutions.length,
        errors: result.errors,
      });
    }

    res.json({
      message: "All duplicate groups resolved successfully",
      resolved: result.resolved,
      total: validatedData.resolutions.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid resolution data",
        details: error.errors,
      });
    }

    console.error("Error resolving duplicate groups:", error);
    res.status(500).json({ error: "Failed to resolve duplicate groups" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/photos/duplicates/summary - Get summary of duplicate statistics
// ═══════════════════════════════════════════════════════════
router.get("/summary", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const duplicateGroups = await findDuplicatePhotos(userId);

    // Calculate statistics
    const totalDuplicatePhotos = duplicateGroups.reduce(
      (sum, group) => sum + group.photos.length,
      0,
    );
    const totalGroups = duplicateGroups.length;

    const groupTypeCounts = duplicateGroups.reduce(
      (counts, group) => {
        counts[group.groupType] = (counts[group.groupType] || 0) + 1;
        return counts;
      },
      {} as Record<string, number>,
    );

    const averageSimilarity =
      duplicateGroups.length > 0
        ? duplicateGroups.reduce(
            (sum, group) => sum + group.averageSimilarity,
            0,
          ) / duplicateGroups.length
        : 0;

    // Calculate potential space savings (if duplicates were deleted)
    const totalDuplicateSpace = duplicateGroups.reduce((sum, group) => {
      if (group.photos.length > 1) {
        // Keep only the best photo, delete others
        const bestPhoto = group.photos.find((photo) => photo.isBest);
        const duplicateSpace = group.photos
          .filter((photo) => !photo.isBest)
          .reduce((spaceSum, photo) => spaceSum + photo.fileSize, 0);
        return sum + duplicateSpace;
      }
      return sum;
    }, 0);

    res.json({
      summary: {
        totalDuplicatePhotos,
        totalGroups,
        potentialSpaceSavings: totalDuplicateSpace,
        averageSimilarity: Math.round(averageSimilarity * 100) / 100,
        groupTypes: groupTypeCounts,
      },
      groups: duplicateGroups.map((group) => ({
        groupId: group.groupId,
        groupType: group.groupType,
        photoCount: group.photos.length,
        averageSimilarity: Math.round(group.averageSimilarity * 100) / 100,
        potentialSpaceSavings: group.photos
          .filter((photo) => !photo.isBest)
          .reduce((sum, photo) => sum + photo.fileSize, 0),
      })),
    });
  } catch (error) {
    console.error("Error generating duplicate summary:", error);
    res.status(500).json({ error: "Failed to generate duplicate summary" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/photos/duplicates/scan - Trigger duplicate scan for user's photos
// ═══════════════════════════════════════════════════════════
router.post("/scan", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // This would typically be a background job, but for now we'll run it synchronously
    // In a production environment, this should be queued for background processing
    const duplicateGroups = await findDuplicatePhotos(userId);

    res.json({
      message: "Duplicate scan completed",
      scannedAt: new Date().toISOString(),
      duplicateGroupsFound: duplicateGroups.length,
      totalDuplicatePhotos: duplicateGroups.reduce(
        (sum, group) => sum + group.photos.length,
        0,
      ),
    });
  } catch (error) {
    console.error("Error during duplicate scan:", error);
    res.status(500).json({ error: "Failed to complete duplicate scan" });
  }
});

export default router;
