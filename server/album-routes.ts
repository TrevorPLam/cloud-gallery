// AI-META-BEGIN
// AI-META: Authenticated album CRUD endpoints with photo management
// OWNERSHIP: server/api
// ENTRYPOINTS: mounted at /api/albums via server/routes.ts
// DEPENDENCIES: express, zod, drizzle queries, ./auth, ./db, ../shared/schema
// DANGER: Authorization filtering protects data isolation; cascade deletes affect album_photos
// CHANGE-SAFETY: Maintain user scoping in queries and stable API response structures
// TESTS: npm run check:types, route integration tests
// AI-META-END

import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "./db";
import { albums, albumPhotos, photos, insertAlbumSchema } from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticateToken } from "./auth";

const router = Router();

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE: All album routes require authentication
// ═══════════════════════════════════════════════════════════
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════
// GET /api/albums - List all albums for authenticated user
// ═══════════════════════════════════════════════════════════
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Fetch all albums for this user
    const userAlbums = await db
      .select()
      .from(albums)
      .where(eq(albums.userId, userId))
      .orderBy(desc(albums.createdAt));

    res.json({ albums: userAlbums });
  } catch (error) {
    console.error("Error fetching albums:", error);
    res.status(500).json({ error: "Failed to fetch albums" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/albums/:id - Get album with photos
// ═══════════════════════════════════════════════════════════
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const albumId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Find album that belongs to this user
    const album = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, albumId), eq(albums.userId, userId)))
      .limit(1);

    if (album.length === 0) {
      return res.status(404).json({ error: "Album not found" });
    }

    // Get photos in this album (ordered by position)
    const albumPhotosList = await db
      .select()
      .from(albumPhotos)
      .where(eq(albumPhotos.albumId, albumId))
      .orderBy(albumPhotos.position);

    // Extract photo IDs
    const photoIds = albumPhotosList.map((ap) => ap.photoId);

    res.json({ 
      album: album[0], 
      photoIds,
    });
  } catch (error) {
    console.error("Error fetching album:", error);
    res.status(500).json({ error: "Failed to fetch album" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/albums - Create album
// ═══════════════════════════════════════════════════════════
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate request body
    const validatedData = insertAlbumSchema.parse({
      ...req.body,
      userId, // Ensure album belongs to authenticated user
    });

    // Insert album into database
    const [newAlbum] = await db
      .insert(albums)
      .values(validatedData)
      .returning();

    res.status(201).json({ album: newAlbum });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid album data",
        details: error.errors,
      });
    }

    console.error("Error creating album:", error);
    res.status(500).json({ error: "Failed to create album" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/albums/:id - Update album
// ═══════════════════════════════════════════════════════════
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const albumId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if album exists and belongs to user
    const existingAlbum = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, albumId), eq(albums.userId, userId)))
      .limit(1);

    if (existingAlbum.length === 0) {
      return res.status(404).json({ error: "Album not found" });
    }

    // Validate update data (partial update allowed)
    const updateSchema = insertAlbumSchema.partial();
    const validatedData = updateSchema.parse(req.body);

    // Don't allow changing userId
    const { userId: _userId, ...updateData } = validatedData;

    // Update album
    const [updatedAlbum] = await db
      .update(albums)
      .set({ ...updateData, modifiedAt: new Date() })
      .where(and(eq(albums.id, albumId), eq(albums.userId, userId)))
      .returning();

    res.json({ album: updatedAlbum });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid album data",
        details: error.errors,
      });
    }

    console.error("Error updating album:", error);
    res.status(500).json({ error: "Failed to update album" });
  }
});

// ═══════════════════════════════════════════════════════════
// DELETE /api/albums/:id - Delete album
// ═══════════════════════════════════════════════════════════
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const albumId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Check if album exists and belongs to user
    const existingAlbum = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, albumId), eq(albums.userId, userId)))
      .limit(1);

    if (existingAlbum.length === 0) {
      return res.status(404).json({ error: "Album not found" });
    }

    // Delete album (cascade will delete album_photos entries)
    await db
      .delete(albums)
      .where(and(eq(albums.id, albumId), eq(albums.userId, userId)));

    res.json({ 
      message: "Album deleted successfully",
      albumId,
    });
  } catch (error) {
    console.error("Error deleting album:", error);
    res.status(500).json({ error: "Failed to delete album" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/albums/:id/photos - Add photo to album
// ═══════════════════════════════════════════════════════════
router.post("/:id/photos", async (req: Request, res: Response) => {
  try {
    const albumId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const userId = req.user?.id;
    const { photoId } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!photoId) {
      return res.status(400).json({ error: "photoId is required" });
    }

    // Verify album belongs to user
    const album = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, albumId), eq(albums.userId, userId)))
      .limit(1);

    if (album.length === 0) {
      return res.status(404).json({ error: "Album not found" });
    }

    // Verify photo belongs to user
    const photo = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .limit(1);

    if (photo.length === 0) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Check if photo is already in album
    const existing = await db
      .select()
      .from(albumPhotos)
      .where(and(eq(albumPhotos.albumId, albumId), eq(albumPhotos.photoId, photoId)))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: "Photo already in album" });
    }

    // Get current max position in album
    const maxPositionResult = await db
      .select()
      .from(albumPhotos)
      .where(eq(albumPhotos.albumId, albumId))
      .orderBy(desc(albumPhotos.position))
      .limit(1);

    const nextPosition = maxPositionResult.length > 0 
      ? maxPositionResult[0].position + 1 
      : 0;

    // Add photo to album
    await db.insert(albumPhotos).values({
      albumId,
      photoId,
      position: nextPosition,
    });

    res.status(201).json({ 
      message: "Photo added to album",
      albumId,
      photoId,
    });
  } catch (error) {
    console.error("Error adding photo to album:", error);
    res.status(500).json({ error: "Failed to add photo to album" });
  }
});

// ═══════════════════════════════════════════════════════════
// DELETE /api/albums/:id/photos/:photoId - Remove photo from album
// ═══════════════════════════════════════════════════════════
router.delete("/:id/photos/:photoId", async (req: Request, res: Response) => {
  try {
    const albumId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const photoId = Array.isArray(req.params.photoId) ? req.params.photoId[0] : req.params.photoId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify album belongs to user
    const album = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, albumId), eq(albums.userId, userId)))
      .limit(1);

    if (album.length === 0) {
      return res.status(404).json({ error: "Album not found" });
    }

    // Check if photo is in album
    const existing = await db
      .select()
      .from(albumPhotos)
      .where(and(eq(albumPhotos.albumId, albumId), eq(albumPhotos.photoId, photoId)))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: "Photo not in album" });
    }

    // Remove photo from album
    await db
      .delete(albumPhotos)
      .where(and(eq(albumPhotos.albumId, albumId), eq(albumPhotos.photoId, photoId)));

    res.json({ 
      message: "Photo removed from album",
      albumId,
      photoId,
    });
  } catch (error) {
    console.error("Error removing photo from album:", error);
    res.status(500).json({ error: "Failed to remove photo from album" });
  }
});

export default router;
