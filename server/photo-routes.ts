import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "./db";
import { photos, insertPhotoSchema } from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticateToken } from "./auth";

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
      .where(eq(photos.userId, userId))
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset);

    // Filter by favorites if requested
    if (favoritesOnly) {
      query = db
        .select()
        .from(photos)
        .where(and(eq(photos.userId, userId), eq(photos.isFavorite, true)))
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
    const photoId = req.params.id;
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
    const photoId = req.params.id;
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
    const photoId = req.params.id;
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
// DELETE /api/photos/:id - Delete a photo
// ═══════════════════════════════════════════════════════════
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const photoId = req.params.id;
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

    // Delete photo
    await db
      .delete(photos)
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)));

    res.json({ 
      message: "Photo deleted successfully",
      photoId,
    });
  } catch (error) {
    console.error("Error deleting photo:", error);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

export default router;
