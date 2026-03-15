// AI-META-BEGIN
// AI-META: Authenticated photo CRUD/list endpoints backed by the database
// OWNERSHIP: server/api
// ENTRYPOINTS: mounted at /api/photos via server/routes.ts
// DEPENDENCIES: express, zod, drizzle queries, ./auth, ./db, ../shared/schema
// DANGER: Authorization filtering and pagination controls protect data isolation/performance
// CHANGE-SAFETY: Maintain user scoping in queries and stable API response structures
// TESTS: npm run check:types, route integration tests
// AI-META-END

import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "./db";
import { photos, insertPhotoSchema } from "../shared/schema";
import { eq, and, desc, isNull, isNotNull } from "drizzle-orm";
import { authenticateToken } from "./auth";
import {
  processMLAnalysis,
  updatePhotoWithMLResults,
  AnalysisType,
} from "./ml-routes";
import { updateDuplicateGroups } from "./services/duplicate-detection";
import { faceRecognitionService } from "./services/face-recognition";

const router = Router();

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE: All photo routes require authentication
// ═══════════════════════════════════════════════════════════
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════
// GET /api/photos - Get all photos for authenticated user
// ═══════════════════════════════════════════════════════════
router.get("/", async (req: Request, res: Response) => {
  try {
    // Get user ID from authenticated request
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Optional query parameters
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const favoritesOnly = req.query.favorites === "true";

    // Build query
    let query = db
      .select()
      .from(photos)
      .where(and(eq(photos.userId, userId), isNull(photos.deletedAt)))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset);

    // Filter by favorites if requested
    if (favoritesOnly) {
      query = db
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.userId, userId),
            eq(photos.isFavorite, true),
            isNull(photos.deletedAt),
          ),
        )
        .orderBy(desc(photos.createdAt))
        .limit(limit)
        .offset(offset);
    }

    const userPhotos = await query;

    res.json({
      photos: userPhotos,
      pagination: {
        limit,
        offset,
        total: userPhotos.length,
      },
    });
  } catch (error) {
    console.error("Error fetching photos:", error);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/photos/:id - Get a specific photo by ID
// ═══════════════════════════════════════════════════════════
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const photoId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Find photo that belongs to this user
    const photo = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .limit(1);

    if (photo.length === 0) {
      return res.status(404).json({ error: "Photo not found" });
    }

    res.json({ photo: photo[0] });
  } catch (error) {
    console.error("Error fetching photo:", error);
    res.status(500).json({ error: "Failed to fetch photo" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/photos - Create a new photo
// ═══════════════════════════════════════════════════════════
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate request body
    const validatedData = insertPhotoSchema.parse({
      ...req.body,
      userId, // Ensure photo belongs to authenticated user
    });

    // Insert photo into database
    const [newPhoto] = await db
      .insert(photos)
      .values(validatedData)
      .returning();

    // Trigger ML analysis asynchronously
    // Don't wait for it to complete to avoid blocking the upload response
    triggerMLAnalysis(newPhoto.id, userId).catch((error: Error) => {
      console.error(
        "Failed to trigger ML analysis for photo:",
        newPhoto.id,
        error,
      );
    });

    res.status(201).json({ photo: newPhoto });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid photo data",
        details: error.errors,
      });
    }

    console.error("Error creating photo:", error);
    res.status(500).json({ error: "Failed to create photo" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/photos/:id - Update a photo
// ═══════════════════════════════════════════════════════════
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const photoId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if photo exists and belongs to user
    const existingPhoto = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .limit(1);

    if (existingPhoto.length === 0) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Validate update data (partial update allowed)
    const updateSchema = insertPhotoSchema.partial();
    const validatedData = updateSchema.parse(req.body);

    // Don't allow changing userId
    const { userId: _userId, ...updateData } = validatedData;

    // Update photo
    const [updatedPhoto] = await db
      .update(photos)
      .set({ ...updateData, modifiedAt: new Date() })
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .returning();

    res.json({ photo: updatedPhoto });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid photo data",
        details: error.errors,
      });
    }

    console.error("Error updating photo:", error);
    res.status(500).json({ error: "Failed to update photo" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/photos/:id/favorite - Toggle favorite status
// ═══════════════════════════════════════════════════════════
router.put("/:id/favorite", async (req: Request, res: Response) => {
  try {
    const photoId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if photo exists and belongs to user
    const existingPhoto = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .limit(1);

    if (existingPhoto.length === 0) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Toggle favorite status
    const newFavoriteStatus = !existingPhoto[0].isFavorite;
    const [updatedPhoto] = await db
      .update(photos)
      .set({
        isFavorite: newFavoriteStatus,
        modifiedAt: new Date(),
      })
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .returning();

    res.json({
      photo: updatedPhoto,
      message: `Photo ${newFavoriteStatus ? "added to" : "removed from"} favorites`,
    });
  } catch (error) {
    console.error("Error toggling favorite:", error);
    res.status(500).json({ error: "Failed to update favorite status" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/photos/trash - Get deleted photos
// ═══════════════════════════════════════════════════════════
router.get("/user/trash", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const trashPhotos = await db
      .select()
      .from(photos)
      .where(and(eq(photos.userId, userId), isNotNull(photos.deletedAt)))
      .orderBy(desc(photos.deletedAt));

    res.json({ photos: trashPhotos });
  } catch (error) {
    console.error("Error fetching trash:", error);
    res.status(500).json({ error: "Failed to fetch trash" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/photos/:id/restore - Restore a deleted photo
// ═══════════════════════════════════════════════════════════
router.put("/:id/restore", async (req: Request, res: Response) => {
  try {
    const photoId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const existingPhoto = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .limit(1);

    if (existingPhoto.length === 0) {
      return res.status(404).json({ error: "Photo not found" });
    }

    const [restoredPhoto] = await db
      .update(photos)
      .set({ deletedAt: null, modifiedAt: new Date() })
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .returning();

    res.json({ photo: restoredPhoto, message: "Photo restored" });
  } catch (error) {
    console.error("Error restoring photo:", error);
    res.status(500).json({ error: "Failed to restore photo" });
  }
});

// ═══════════════════════════════════════════════════════════
// DELETE /api/photos/:id/permanent - Permanently delete a photo
// ═══════════════════════════════════════════════════════════
router.delete("/:id/permanent", async (req: Request, res: Response) => {
  try {
    const photoId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const result = await db
      .delete(photos)
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .returning();

    if (result.length === 0) {
      return res.status(404).json({ error: "Photo not found" });
    }

    res.json({ message: "Photo permanently deleted", photoId });
  } catch (error) {
    console.error("Error permanently deleting photo:", error);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

// ═══════════════════════════════════════════════════════════
// DELETE /api/photos/:id - Soft delete a photo
// ═══════════════════════════════════════════════════════════
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const photoId = req.params.id as string;
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if photo exists and belongs to user
    const existingPhoto = await db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.id, photoId),
          eq(photos.userId, userId),
          isNull(photos.deletedAt),
        ),
      ) // Only soft delete if not already deleted
      .limit(1);

    if (existingPhoto.length === 0) {
      return res
        .status(404)
        .json({ error: "Photo not found or already deleted" });
    }

    // Soft delete photo
    // Set deletedAt timestamp
    await db
      .update(photos)
      .set({ deletedAt: new Date(), modifiedAt: new Date() })
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .returning(); // Added returning() to get the updated photo if needed, though not used here.

    res.json({
      message: "Photo moved to trash",
      photoId,
    });
  } catch (error) {
    console.error("Error deleting photo:", error);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Trigger ML analysis for a newly uploaded photo
 * This function calls the ML analysis functions directly
 */
async function triggerMLAnalysis(
  photoId: string,
  userId: string,
): Promise<void> {
  try {
    // Create ML analysis request
    const analysisRequest = {
      photoId,
      userId,
      analysisTypes: [
        AnalysisType.OBJECT_DETECTION,
        AnalysisType.OCR,
        AnalysisType.PERCEPTUAL_HASH,
      ],
    };

    // Process ML analysis
    const result = await processMLAnalysis(analysisRequest);

    // Update photo with ML results
    await updatePhotoWithMLResults(photoId, result);

    // Update duplicate groups after ML analysis (including perceptual hash)
    await updateDuplicateGroups(userId, photoId);

    // Trigger face detection asynchronously (don't block upload)
    triggerFaceDetection(photoId, userId).catch((error: Error) => {
      console.error(
        "Failed to trigger face detection for photo:",
        photoId,
        error,
      );
    });

    console.log(
      "ML analysis and duplicate detection completed successfully for photo:",
      photoId,
    );
  } catch (error) {
    console.error("Error in ML analysis:", error);
    // Don't throw error to avoid failing the entire upload process
    // ML analysis can be retried later
  }
}

/**
 * Trigger face detection for a photo
 * This runs asynchronously after photo upload and ML analysis
 */
async function triggerFaceDetection(
  photoId: string,
  userId: string,
): Promise<void> {
  try {
    // In a real implementation, you would:
    // 1. Fetch the image file from storage
    // 2. Convert to buffer
    // 3. Run face detection
    // 4. Store detected faces

    // For now, just call the face detection API to trigger the process
    // This would be implemented with actual model integration
    console.log("Face detection triggered for photo:", photoId);

    // Placeholder for actual face detection implementation
    // const detectedFaces = await faceRecognitionService.detectFaces(photoId, imageBuffer);
    // console.log(`Detected ${detectedFaces.length} faces in photo: ${photoId}`);
  } catch (error) {
    console.error("Error in face detection:", error);
    // Don't throw - face detection is non-critical background processing
  }
}

export default router;
