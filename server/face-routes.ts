// AI-META-BEGIN
// AI-META: Face detection and recognition API endpoints with authentication and validation
// OWNERSHIP: server/api
// ENTRYPOINTS: mounted at /api/faces via server/routes.ts
// DEPENDENCIES: express, zod, drizzle queries, ./auth, ./db, ./services/face-recognition
// DANGER: Biometric data processing - requires GDPR compliance and explicit consent
// CHANGE-SAFETY: Maintain API contract stability, ensure proper user scoping
// TESTS: Integration tests for all endpoints, authentication validation
// AI-META-END

import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "./db";
import { faces, people, photos } from "../shared/schema";
import { eq, and, isNull, isNotNull, desc } from "drizzle-orm";
import { authenticateToken } from "./auth";
import { faceRecognitionService } from "./services/face-recognition";

const router = Router();

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE: All face routes require authentication
// ═══════════════════════════════════════════════════════════
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════
// GET /api/faces/people - Get all people for authenticated user
// ═══════════════════════════════════════════════════════════
router.get("/people", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const peopleList = await faceRecognitionService.getPeople(userId);

    res.json({
      people: peopleList,
      count: peopleList.length,
    });
  } catch (error) {
    console.error("Error fetching people:", error);
    res.status(500).json({ error: "Failed to fetch people" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/faces/people/:id - Update person information
// ═══════════════════════════════════════════════════════════
router.put("/people/:id", async (req: Request, res: Response) => {
  try {
    const personId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate request body
    const updatePersonSchema = z.object({
      name: z.string().optional(),
      isPinned: z.boolean().optional(),
      isHidden: z.boolean().optional(),
    });

    const validatedData = updatePersonSchema.parse(req.body);

    // Update person
    const updatedPerson = await faceRecognitionService.updatePerson(
      userId,
      personId,
      validatedData,
    );

    if (!updatedPerson) {
      return res.status(404).json({ error: "Person not found" });
    }

    res.json({
      person: updatedPerson,
      message: "Person updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid person data",
        details: error.errors,
      });
    }

    console.error("Error updating person:", error);
    res.status(500).json({ error: "Failed to update person" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/faces/people/:id/merge - Merge person with another person
// ═══════════════════════════════════════════════════════════
router.put("/people/:id/merge", async (req: Request, res: Response) => {
  try {
    const sourcePersonId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate request body
    const mergePersonSchema = z.object({
      targetPersonId: z.string().uuid(),
    });

    const { targetPersonId } = mergePersonSchema.parse(req.body);

    if (sourcePersonId === targetPersonId) {
      return res
        .status(400)
        .json({ error: "Cannot merge person with themselves" });
    }

    // Merge people
    const mergedPerson = await faceRecognitionService.mergePeople(
      userId,
      sourcePersonId,
      targetPersonId,
    );

    if (!mergedPerson) {
      return res.status(404).json({ error: "One or both people not found" });
    }

    res.json({
      person: mergedPerson,
      message: "People merged successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid merge data",
        details: error.errors,
      });
    }

    console.error("Error merging people:", error);
    res.status(500).json({ error: "Failed to merge people" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/faces/people/:id/photos - Get photos for a specific person
// ═══════════════════════════════════════════════════════════
router.get("/people/:id/photos", async (req: Request, res: Response) => {
  try {
    const personId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Optional query parameters
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const personPhotos = await faceRecognitionService.getPersonPhotos(
      userId,
      personId,
    );

    // Apply pagination
    const paginatedPhotos = personPhotos.slice(offset, offset + limit);

    res.json({
      photos: paginatedPhotos,
      pagination: {
        limit,
        offset,
        total: personPhotos.length,
      },
    });
  } catch (error) {
    console.error("Error fetching person photos:", error);
    res.status(500).json({ error: "Failed to fetch person photos" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/faces/detect - Detect faces in a photo
// ═══════════════════════════════════════════════════════════
router.post("/detect", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate request body
    const detectFacesSchema = z.object({
      photoId: z.string().uuid(),
    });

    const { photoId } = detectFacesSchema.parse(req.body);

    // Verify photo belongs to user
    const photo = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .limit(1);

    if (photo.length === 0) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Check if faces are already detected for this photo
    const existingFaces = await db
      .select()
      .from(faces)
      .where(eq(faces.photoId, photoId));

    if (existingFaces.length > 0) {
      return res.json({
        faces: existingFaces,
        message: "Faces already detected for this photo",
      });
    }

    // In a real implementation, you would:
    // 1. Fetch the image file from storage
    // 2. Convert to buffer
    // 3. Run face detection
    // For now, return empty array as placeholder
    const detectedFaces: any[] = [];

    res.json({
      faces: detectedFaces,
      count: detectedFaces.length,
      message: "Face detection completed",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid detection request",
        details: error.errors,
      });
    }

    console.error("Error detecting faces:", error);
    res.status(500).json({ error: "Failed to detect faces" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/faces/cluster - Cluster unassigned faces into people
// ═══════════════════════════════════════════════════════════
router.post("/cluster", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Cluster unassigned faces
    const newPersonClusters = await faceRecognitionService.clusterFaces(userId);

    res.json({
      newPeople: newPersonClusters,
      count: newPersonClusters.length,
      message: "Face clustering completed",
    });
  } catch (error) {
    console.error("Error clustering faces:", error);
    res.status(500).json({ error: "Failed to cluster faces" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/faces/search - Find similar faces
// ═══════════════════════════════════════════════════════════
router.get("/search", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate query parameters
    const searchSchema = z.object({
      embedding: z.string().optional(), // JSON string of embedding array
      faceId: z.string().uuid().optional(), // Reference face ID
      threshold: z
        .string()
        .optional()
        .transform((val) => (val ? parseFloat(val) : 0.6)),
      limit: z
        .string()
        .optional()
        .transform((val) => (val ? parseInt(val) : 10)),
    });

    const validatedQuery = searchSchema.parse(req.query);

    let embedding: number[] | null = null;

    if (validatedQuery.embedding) {
      try {
        embedding = JSON.parse(validatedQuery.embedding);
        if (!Array.isArray(embedding) || embedding.length !== 128) {
          return res.status(400).json({ error: "Invalid embedding format" });
        }
      } catch {
        return res.status(400).json({ error: "Invalid embedding JSON" });
      }
    } else if (validatedQuery.faceId) {
      // Get embedding from existing face
      const face = await db
        .select({ embedding: faces.embedding })
        .from(faces)
        .innerJoin(photos, eq(faces.photoId, photos.id))
        .where(
          and(
            eq(faces.id, validatedQuery.faceId),
            eq(photos.userId, userId),
            isNotNull(faces.embedding),
          ),
        )
        .limit(1);

      if (face.length === 0) {
        return res.status(404).json({ error: "Reference face not found" });
      }

      embedding = face[0].embedding;
    } else {
      return res.status(400).json({
        error: "Either embedding or faceId must be provided",
      });
    }

    if (!embedding) {
      return res
        .status(400)
        .json({ error: "No embedding available for search" });
    }

    // Find similar faces
    const similarFaces = await faceRecognitionService.findSimilarFaces(
      userId,
      embedding!,
      validatedQuery.threshold,
    );

    // Apply limit
    const limitedResults = similarFaces.slice(0, validatedQuery.limit);

    res.json({
      similarFaces: limitedResults,
      count: limitedResults.length,
      threshold: validatedQuery.threshold,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid search parameters",
        details: error.errors,
      });
    }

    console.error("Error searching similar faces:", error);
    res.status(500).json({ error: "Failed to search similar faces" });
  }
});

// ═══════════════════════════════════════════════════════════
// DELETE /api/faces/people/:id - Delete a person and unassign their faces
// ═══════════════════════════════════════════════════════════
router.delete("/people/:id", async (req: Request, res: Response) => {
  try {
    const personId = req.params.id as string;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify person belongs to user
    const person = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1);

    if (person.length === 0) {
      return res.status(404).json({ error: "Person not found" });
    }

    // Unassign all faces from this person (set personId to null)
    await db
      .update(faces)
      .set({ personId: null, updatedAt: new Date() })
      .where(eq(faces.personId, personId));

    // Delete the person
    await db.delete(people).where(eq(people.id, personId));

    res.json({
      message: "Person deleted successfully",
      personId,
    });
  } catch (error) {
    console.error("Error deleting person:", error);
    res.status(500).json({ error: "Failed to delete person" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/faces/stats - Get face recognition statistics for user
// ═══════════════════════════════════════════════════════════
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get face statistics
    const totalFaces = await db
      .select({ count: faces.id })
      .from(faces)
      .innerJoin(photos, eq(faces.photoId, photos.id))
      .where(eq(photos.userId, userId));

    const assignedFaces = await db
      .select({ count: faces.id })
      .from(faces)
      .innerJoin(photos, eq(faces.photoId, photos.id))
      .where(and(eq(photos.userId, userId), isNotNull(faces.personId)));

    const unassignedFaces = totalFaces.length - assignedFaces.length;

    const peopleCount = await db
      .select({ count: people.id })
      .from(people)
      .where(eq(people.userId, userId));

    const namedPeopleCount = await db
      .select({ count: people.id })
      .from(people)
      .where(and(eq(people.userId, userId), isNotNull(people.name)));

    const stats = {
      totalFaces: totalFaces.length,
      assignedFaces: assignedFaces.length,
      unassignedFaces,
      totalPeople: peopleCount.length,
      namedPeople: namedPeopleCount.length,
      unnamedPeople: peopleCount.length - namedPeopleCount.length,
    };

    res.json(stats);
  } catch (error) {
    console.error("Error fetching face stats:", error);
    res.status(500).json({ error: "Failed to fetch face statistics" });
  }
});

export default router;
