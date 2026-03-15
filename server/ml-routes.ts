// AI-META-BEGIN
// AI-META: ML analysis API endpoints for photo processing with async job queue
// OWNERSHIP: server/api
// ENTRYPOINTS: mounted at /api/ml via server/routes.ts
// DEPENDENCIES: express, zod, drizzle queries, bullmq, ./auth, ./db
// DANGER: ML processing is resource-intensive; proper rate limiting and job queuing required
// CHANGE-SAFETY: Add new ML endpoints by extending the MLAnalysisRequest interface
// TESTS: server/ml-routes.test.ts
// AI-META-END

import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "./db";
import { photos, insertPhotoSchema } from "../shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { authenticateToken } from "./auth";

const router = Router();

// ─────────────────────────────────────────────────────────
// MIDDLEWARE: All ML routes require authentication
// ─────────────────────────────────────────────────────────
router.use(authenticateToken);

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface MLAnalysisRequest {
  photoId: string;
  userId: string;
  analysisTypes: AnalysisType[];
}

export enum AnalysisType {
  OBJECT_DETECTION = "object_detection",
  OCR = "ocr",
  PERCEPTUAL_HASH = "perceptual_hash",
}

export interface MLAnalysisResult {
  photoId: string;
  userId: string;
  objects?: {
    label: string;
    confidence: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];
  ocrText?: string;
  ocrLanguage?: string;
  perceptualHash?: string;
  processingTime: number;
  mlVersion: string;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────

const analysisRequestSchema = z.object({
  photoId: z.string().uuid(),
  analysisTypes: z
    .array(z.enum(["object_detection", "ocr", "perceptual_hash"]))
    .min(1),
});

const updatePhotoMlSchema = z.object({
  mlLabels: z.array(z.string()).optional(),
  ocrText: z.string().optional(),
  ocrLanguage: z.string().optional(),
  perceptualHash: z.string().optional(),
  mlProcessedAt: z.date().optional(),
  mlVersion: z.string().optional(),
});

// ─────────────────────────────────────────────────────────
// POST /api/ml/analyze - Trigger ML analysis for a photo
// ─────────────────────────────────────────────────────────
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Validate request body
    const validatedData = analysisRequestSchema.parse(req.body);
    const { photoId, analysisTypes } = validatedData;

    // Check if photo exists and belongs to user
    const existingPhoto = await db
      .select()
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .limit(1);

    if (existingPhoto.length === 0) {
      return res.status(404).json({ error: "Photo not found" });
    }

    // Create ML analysis request
    const analysisRequest: MLAnalysisRequest = {
      photoId,
      userId,
      analysisTypes: analysisTypes as AnalysisType[],
    };

    // TODO: Add to BullMQ queue for async processing
    // For now, process synchronously as placeholder
    try {
      const result = await processMLAnalysis(analysisRequest);

      // Update photo with ML results
      await updatePhotoWithMLResults(photoId, result);

      res.json({
        message: "ML analysis completed",
        results: result,
      });
    } catch (processingError) {
      console.error("ML processing failed:", processingError);
      res.status(500).json({
        error: "ML processing failed",
        details:
          processingError instanceof Error
            ? processingError.message
            : "Unknown error",
      });
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors,
      });
    }

    console.error("Error in ML analysis endpoint:", error);
    res.status(500).json({ error: "Failed to process ML analysis request" });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/ml/status/:photoId - Get ML analysis status for a photo
// ─────────────────────────────────────────────────────────
router.get("/status/:photoId", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const photoId = req.params.photoId as string;

    // Check if photo exists and belongs to user
    const photo = await db
      .select({
        id: photos.id,
        mlProcessedAt: photos.mlProcessedAt,
        mlVersion: photos.mlVersion,
        mlLabels: photos.mlLabels,
        ocrText: photos.ocrText,
        ocrLanguage: photos.ocrLanguage,
        perceptualHash: photos.perceptualHash,
      })
      .from(photos)
      .where(and(eq(photos.id, photoId), eq(photos.userId, userId)))
      .limit(1);

    if (photo.length === 0) {
      return res.status(404).json({ error: "Photo not found" });
    }

    const photoData = photo[0];

    // Determine analysis status
    const isProcessed = !!photoData.mlProcessedAt;
    const hasResults = !!(
      photoData.mlLabels?.length ||
      photoData.ocrText ||
      photoData.perceptualHash
    );

    res.json({
      photoId,
      status: isProcessed
        ? hasResults
          ? "completed"
          : "processed_no_results"
        : "pending",
      processedAt: photoData.mlProcessedAt,
      mlVersion: photoData.mlVersion,
      results: {
        hasObjectDetection: !!photoData.mlLabels?.length,
        hasOCR: !!photoData.ocrText,
        hasPerceptualHash: !!photoData.perceptualHash,
        objectCount: photoData.mlLabels?.length || 0,
        textLength: photoData.ocrText?.length || 0,
      },
    });
  } catch (error) {
    console.error("Error getting ML status:", error);
    res.status(500).json({ error: "Failed to get ML analysis status" });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/ml/batch - Trigger ML analysis for multiple photos
// ─────────────────────────────────────────────────────────
router.post("/batch", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const batchRequestSchema = z.object({
      photoIds: z.array(z.string().uuid()).min(1).max(50), // Limit batch size
      analysisTypes: z
        .array(z.enum(["object_detection", "ocr", "perceptual_hash"]))
        .min(1),
    });

    const validatedData = batchRequestSchema.parse(req.body);
    const { photoIds, analysisTypes } = validatedData;

    // Verify all photos belong to user
    const userPhotos = await db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.userId, userId), isNull(photos.deletedAt)));

    const userPhotoIds = userPhotos.map((p) => p.id);
    const invalidPhotoIds = photoIds.filter((id) => !userPhotoIds.includes(id));

    if (invalidPhotoIds.length > 0) {
      return res.status(400).json({
        error: "Invalid photo IDs",
        invalidPhotoIds,
      });
    }

    // Create batch analysis requests
    const batchRequests: MLAnalysisRequest[] = photoIds.map((photoId) => ({
      photoId,
      userId,
      analysisTypes: analysisTypes as AnalysisType[],
    }));

    // TODO: Add batch to BullMQ queue for async processing
    // For now, return placeholder response
    res.json({
      message: "Batch analysis queued",
      batchId: `batch_${Date.now()}`,
      photoCount: photoIds.length,
      analysisTypes,
      estimatedTime: photoIds.length * 2, // 2 seconds per photo estimate
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid batch request data",
        details: error.errors,
      });
    }

    console.error("Error in batch ML analysis:", error);
    res.status(500).json({ error: "Failed to process batch ML analysis" });
  }
});

// ─────────────────────────────────────────────────────────
// GET /api/ml/stats - Get ML processing statistics for user
// ─────────────────────────────────────────────────────────
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Get user's photos with ML data
    const userPhotos = await db
      .select({
        id: photos.id,
        mlProcessedAt: photos.mlProcessedAt,
        mlLabels: photos.mlLabels,
        ocrText: photos.ocrText,
        perceptualHash: photos.perceptualHash,
      })
      .from(photos)
      .where(and(eq(photos.userId, userId), isNull(photos.deletedAt)));

    // Calculate statistics
    const totalPhotos = userPhotos.length;
    const processedPhotos = userPhotos.filter((p) => !!p.mlProcessedAt).length;
    const photosWithObjects = userPhotos.filter(
      (p) => p.mlLabels && p.mlLabels.length > 0,
    ).length;
    const photosWithText = userPhotos.filter(
      (p) => p.ocrText && p.ocrText.length > 0,
    ).length;
    const photosWithHash = userPhotos.filter((p) => !!p.perceptualHash).length;

    // Count total objects detected
    const totalObjects = userPhotos.reduce(
      (sum, p) => sum + (p.mlLabels?.length || 0),
      0,
    );

    // Find most common objects
    const objectCounts: { [key: string]: number } = {};
    userPhotos.forEach((p) => {
      if (p.mlLabels) {
        p.mlLabels.forEach((label) => {
          objectCounts[label] = (objectCounts[label] || 0) + 1;
        });
      }
    });

    const commonObjects = Object.entries(objectCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([label, count]) => ({ label, count }));

    res.json({
      totalPhotos,
      processedPhotos,
      processingRate:
        totalPhotos > 0 ? (processedPhotos / totalPhotos) * 100 : 0,
      photosWithObjects,
      photosWithText,
      photosWithHash,
      totalObjects,
      averageObjectsPerPhoto:
        processedPhotos > 0 ? totalObjects / processedPhotos : 0,
      commonObjects,
    });
  } catch (error) {
    console.error("Error getting ML stats:", error);
    res.status(500).json({ error: "Failed to get ML processing statistics" });
  }
});

// ─────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────

/**
 * Process ML analysis (placeholder implementation)
 * In production, this would be handled by BullMQ workers
 */
async function processMLAnalysis(
  request: MLAnalysisRequest,
): Promise<MLAnalysisResult> {
  const startTime = Date.now();

  // Placeholder implementation
  // In production, this would:
  // 1. Load the photo from storage
  // 2. Run ML models based on analysisTypes
  // 3. Return structured results

  const result: MLAnalysisResult = {
    photoId: request.photoId,
    userId: request.userId,
    processingTime: Date.now() - startTime,
    mlVersion: "1.0.0",
    timestamp: new Date(),
  };

  // Add placeholder results based on requested analysis types
  if (request.analysisTypes.includes(AnalysisType.OBJECT_DETECTION)) {
    result.objects = [
      {
        label: "person",
        confidence: 0.85,
        boundingBox: { x: 10, y: 10, width: 100, height: 150 },
      },
      {
        label: "outdoor",
        confidence: 0.92,
        boundingBox: { x: 0, y: 0, width: 200, height: 200 },
      },
    ];
  }

  if (request.analysisTypes.includes(AnalysisType.OCR)) {
    result.ocrText = "Sample extracted text";
    result.ocrLanguage = "en";
  }

  if (request.analysisTypes.includes(AnalysisType.PERCEPTUAL_HASH)) {
    result.perceptualHash = "placeholder_hash_value";
  }

  return result;
}

/**
 * Update photo record with ML analysis results
 */
async function updatePhotoWithMLResults(
  photoId: string,
  results: MLAnalysisResult,
): Promise<void> {
  try {
    const updateData: any = {
      mlProcessedAt: results.timestamp,
      mlVersion: results.mlVersion,
    };

    if (results.objects) {
      updateData.mlLabels = results.objects.map((obj) => obj.label);
    }

    if (results.ocrText) {
      updateData.ocrText = results.ocrText;
      updateData.ocrLanguage = results.ocrLanguage;
    }

    if (results.perceptualHash) {
      updateData.perceptualHash = results.perceptualHash;
    }

    await db.update(photos).set(updateData).where(eq(photos.id, photoId));
  } catch (error) {
    console.error("Failed to update photo with ML results:", error);
    throw error;
  }
}

// Export helper functions for use in other routes
export { processMLAnalysis, updatePhotoWithMLResults };

export default router;
