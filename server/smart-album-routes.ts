// AI-META-BEGIN
// AI-META: Smart Albums API Routes - RESTful endpoints for smart album management
// OWNERSHIP: server/smart-album-routes
// ENTRYPOINTS: server/routes.ts
// DEPENDENCIES: express, SmartAlbumsService, authentication middleware
// DANGER: Smart album generation can be expensive for large libraries
// CHANGE-SAFETY: Adding new endpoints is safe; changing existing endpoints affects API contracts
// TESTS: server/smart-album-routes.test.ts (integration tests)
// AI-META-END

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticateToken } from "./auth";
import { smartAlbumsService } from "./services/smart-albums";
import { rateLimit } from "express-rate-limit";

// Rate limiting for smart album operations
const smartAlbumsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 requests per windowMs
  message: "Too many smart album requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(smartAlbumsRateLimit);

// Validation schemas
const updateSmartAlbumSchema = z.object({
  isPinned: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

const getSmartAlbumPhotosSchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default("50"),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default("0"),
});

// GET /api/smart-albums - Get all smart albums for user
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get all existing smart albums
    const albums = await smartAlbumsService.generateAllSmartAlbums(userId);
    
    res.json({
      success: true,
      data: {
        albums,
        total: albums.length
      }
    });
  } catch (error) {
    console.error("Error fetching smart albums:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch smart albums",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// POST /api/smart-albums/generate - Generate smart albums for user
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Generate all smart albums
    const albums = await smartAlbumsService.generateAllSmartAlbums(userId);
    
    res.json({
      success: true,
      data: {
        albums,
        total: albums.length,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Error generating smart albums:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate smart albums",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// PUT /api/smart-albums/:id - Update smart album settings
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const albumId = req.params.id;
    
    // Validate request body
    const validatedData = updateSmartAlbumSchema.parse(req.body);
    
    // Update smart album settings
    const updatedAlbum = await smartAlbumsService.updateSmartAlbumSettings(
      userId,
      albumId,
      validatedData
    );
    
    if (!updatedAlbum) {
      return res.status(404).json({
        success: false,
        error: "Smart album not found"
      });
    }
    
    res.json({
      success: true,
      data: {
        album: updatedAlbum
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: error.errors
      });
    }
    
    console.error("Error updating smart album:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update smart album",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// GET /api/smart-albums/:id/photos - Get photos in a smart album
router.get("/:id/photos", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const albumId = req.params.id;
    
    // Validate query parameters
    const { limit, offset } = getSmartAlbumPhotosSchema.parse(req.query);
    
    // Get photos for smart album
    const photos = await smartAlbumsService.getSmartAlbumPhotos(
      userId,
      albumId,
      limit,
      offset
    );
    
    res.json({
      success: true,
      data: {
        photos,
        pagination: {
          limit,
          offset,
          count: photos.length
        }
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid query parameters",
        details: error.errors
      });
    }
    
    console.error("Error fetching smart album photos:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch smart album photos",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// POST /api/smart-albums/update - Update smart albums for new photos
router.post("/update", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { photoIds } = req.body;
    
    // Validate photo IDs
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Invalid photo IDs provided"
      });
    }
    
    // Update smart albums for new photos
    await smartAlbumsService.updateSmartAlbumsForNewPhotos(userId, photoIds);
    
    res.json({
      success: true,
      data: {
        updatedPhotoCount: photoIds.length,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Error updating smart albums:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update smart albums",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// GET /api/smart-albums/stats - Get smart album statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get all smart albums
    const albums = await smartAlbumsService.generateAllSmartAlbums(userId);
    
    // Calculate statistics
    const stats = {
      totalAlbums: albums.length,
      totalPhotos: albums.reduce((sum, album) => sum + album.photoCount, 0),
      albumsByType: albums.reduce((acc, album) => {
        acc[album.albumType] = (acc[album.albumType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      pinnedAlbums: albums.filter(album => album.isPinned).length,
      hiddenAlbums: albums.filter(album => album.isHidden).length,
      averagePhotosPerAlbum: albums.length > 0 
        ? Math.round(albums.reduce((sum, album) => sum + album.photoCount, 0) / albums.length)
        : 0
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error fetching smart album stats:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch smart album statistics",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// DELETE /api/smart-albums/:id - Hide a smart album (soft delete)
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const albumId = req.params.id;
    
    // Hide the smart album
    const updatedAlbum = await smartAlbumsService.updateSmartAlbumSettings(
      userId,
      albumId,
      { isHidden: true }
    );
    
    if (!updatedAlbum) {
      return res.status(404).json({
        success: false,
        error: "Smart album not found"
      });
    }
    
    res.json({
      success: true,
      data: {
        album: updatedAlbum,
        message: "Smart album hidden successfully"
      }
    });
  } catch (error) {
    console.error("Error hiding smart album:", error);
    res.status(500).json({
      success: false,
      error: "Failed to hide smart album",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

export default router;
