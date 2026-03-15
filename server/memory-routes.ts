// AI-META-BEGIN
// AI-META: Memory API Routes - RESTful endpoints for memory management
// OWNERSHIP: server/memory-routes
// ENTRYPOINTS: server/routes.ts
// DEPENDENCIES: express, MemoriesService, authentication middleware
// DANGER: Memory generation can be expensive for large libraries
// CHANGE-SAFETY: Adding new endpoints is safe; changing existing endpoints affects API contracts
// TESTS: server/memory-routes.test.ts (integration tests)
// AI-META-END

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticateToken } from "./auth";
import { memoriesService } from "./services/memories";
import { rateLimit } from "express-rate-limit";

// Rate limiting for memory operations
const memoryRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 requests per windowMs
  message: "Too many memory requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// Apply authentication and rate limiting to all routes
router.use(authenticateToken);
router.use(memoryRateLimit);

// Validation schemas
const updateMemorySchema = z.object({
  isFavorite: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

const getMemoriesSchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default("50"),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default("0"),
});

const getMemoryPhotosSchema = z.object({
  limit: z.string().transform(Number).pipe(z.number().min(1).max(100)).default("50"),
  offset: z.string().transform(Number).pipe(z.number().min(0)).default("0"),
});

// GET /api/memories - Get all memories for user
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { limit, offset } = getMemoriesSchema.parse(req.query);
    
    // Get all memories for the user
    const memories = await memoriesService.getUserMemories(userId, limit, offset);
    
    res.json({
      memories,
      pagination: {
        limit,
        offset,
        hasMore: memories.length === limit
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: error.errors
      });
    }
    
    console.error("Error fetching memories:", error);
    res.status(500).json({
      error: "Failed to fetch memories"
    });
  }
});

// POST /api/memories/generate - Generate all memories for user
router.post("/generate", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Generate all memories for the user
    const memories = await memoriesService.generateAllMemories(userId);
    
    res.json({
      memories,
      count: memories.length,
      message: `Generated ${memories.length} memories`
    });
  } catch (error) {
    console.error("Error generating memories:", error);
    res.status(500).json({
      error: "Failed to generate memories"
    });
  }
});

// PUT /api/memories/:id/favorite - Favorite or unfavorite a memory
router.put("/:id/favorite", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const memoryId = req.params.id;
    
    const { isFavorite } = updateMemorySchema.parse(req.body);
    
    const memory = await memoriesService.updateMemory(userId, memoryId, { isFavorite });
    
    if (!memory) {
      return res.status(404).json({
        error: "Memory not found"
      });
    }
    
    res.json({
      memory,
      message: isFavorite ? "Memory favorited" : "Memory unfavorited"
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request body",
        details: error.errors
      });
    }
    
    console.error("Error updating memory favorite status:", error);
    res.status(500).json({
      error: "Failed to update memory"
    });
  }
});

// PUT /api/memories/:id/hide - Hide or unhide a memory
router.put("/:id/hide", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const memoryId = req.params.id;
    
    const { isHidden } = updateMemorySchema.parse(req.body);
    
    const memory = await memoriesService.updateMemory(userId, memoryId, { isHidden });
    
    if (!memory) {
      return res.status(404).json({
        error: "Memory not found"
      });
    }
    
    res.json({
      memory,
      message: isHidden ? "Memory hidden" : "Memory unhidden"
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request body",
        details: error.errors
      });
    }
    
    console.error("Error updating memory visibility:", error);
    res.status(500).json({
      error: "Failed to update memory"
    });
  }
});

// PUT /api/memories/:id - Update memory (general update)
router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const memoryId = req.params.id;
    
    const updates = updateMemorySchema.parse(req.body);
    
    const memory = await memoriesService.updateMemory(userId, memoryId, updates);
    
    if (!memory) {
      return res.status(404).json({
        error: "Memory not found"
      });
    }
    
    res.json({
      memory,
      message: "Memory updated successfully"
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request body",
        details: error.errors
      });
    }
    
    console.error("Error updating memory:", error);
    res.status(500).json({
      error: "Failed to update memory"
    });
  }
});

// GET /api/memories/:id/photos - Get photos in a memory
router.get("/:id/photos", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const memoryId = req.params.id;
    const { limit, offset } = getMemoryPhotosSchema.parse(req.query);
    
    const photos = await memoriesService.getMemoryPhotos(userId, memoryId, limit, offset);
    
    res.json({
      photos,
      pagination: {
        limit,
        offset,
        hasMore: photos.length === limit
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: error.errors
      });
    }
    
    console.error("Error fetching memory photos:", error);
    res.status(500).json({
      error: "Failed to fetch memory photos"
    });
  }
});

// GET /api/memories/types - Get available memory types
router.get("/types", async (req: Request, res: Response) => {
  try {
    const memoryTypes = [
      {
        type: "on_this_day",
        name: "On This Day",
        description: "Photos taken on this day in previous years"
      },
      {
        type: "monthly_highlights",
        name: "Monthly Highlights",
        description: "Best photos from the past month"
      },
      {
        type: "year_in_review",
        name: "Year in Review",
        description: "Top moments from the previous year"
      }
    ];
    
    res.json({ memoryTypes });
  } catch (error) {
    console.error("Error fetching memory types:", error);
    res.status(500).json({
      error: "Failed to fetch memory types"
    });
  }
});

// GET /api/memories/stats - Get memory statistics
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get all memories to calculate stats
    const allMemories = await memoriesService.getUserMemories(userId, 1000, 0);
    
    const stats = {
      totalMemories: allMemories.length,
      favoriteMemories: allMemories.filter(m => m.isFavorite).length,
      hiddenMemories: allMemories.filter(m => m.isHidden).length,
      memoriesByType: {
        on_this_day: allMemories.filter(m => m.memoryType === 'on_this_day').length,
        monthly_highlights: allMemories.filter(m => m.memoryType === 'monthly_highlights').length,
        year_in_review: allMemories.filter(m => m.memoryType === 'year_in_review').length
      },
      totalPhotos: allMemories.reduce((sum, m) => sum + m.photoCount, 0),
      averagePhotosPerMemory: allMemories.length > 0 
        ? Math.round(allMemories.reduce((sum, m) => sum + m.photoCount, 0) / allMemories.length)
        : 0
    };
    
    res.json({ stats });
  } catch (error) {
    console.error("Error fetching memory stats:", error);
    res.status(500).json({
      error: "Failed to fetch memory statistics"
    });
  }
});

export default router;
