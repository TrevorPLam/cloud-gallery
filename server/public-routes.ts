// AI-META-BEGIN
// AI-META: Public access routes for anonymous album viewing with security features
// OWNERSHIP: server/api
// ENTRYPOINTS: mounted at /public via server/routes.ts (no auth required)
// DEPENDENCIES: express, zod, drizzle queries, ./db, ./services/public-links, ./services/sharing
// DANGER: Public access bypass = unauthorized album access; rate limiting failure = abuse
// CHANGE-SAFETY: Maintain rate limiting, input validation, and security headers
// TESTS: npm run test server/public-routes.test.ts
// AI-META-END

import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "./db";
import { publicLinksService } from "./services/public-links";
import helmet from "helmet";

const router = Router();

// ═══════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE: Apply security headers to all public routes
// ═══════════════════════════════════════════════════════════
router.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// ═══════════════════════════════════════════════════════════
// RATE LIMITING: Simple in-memory rate limiting for public access
// ═══════════════════════════════════════════════════════════
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const rateLimit = (maxRequests: number, windowMs: number) => {
  return (req: Request, res: Response, next: Function) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const tracker = rateLimitMap.get(ip);

    if (!tracker || now > tracker.resetTime) {
      rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (tracker.count >= maxRequests) {
      return res.status(429).json({
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((tracker.resetTime - now) / 1000)
      });
    }

    tracker.count++;
    next();
  };
};

// Apply rate limiting to all public routes
router.use(rateLimit(60, 60000)); // 60 requests per minute per IP

// ═══════════════════════════════════════════════════════════
// ZOD SCHEMAS FOR INPUT VALIDATION
// ═══════════════════════════════════════════════════════════

const createPublicLinkSchema = z.object({
  albumId: z.string().uuid(),
  password: z.string().min(8).max(255).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  allowDownload: z.boolean().default(true),
  showMetadata: z.boolean().default(false),
  customTitle: z.string().max(255).optional(),
  customDescription: z.string().max(1000).optional(),
});

const updatePublicLinkSchema = z.object({
  expiresAt: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  allowDownload: z.boolean().optional(),
  showMetadata: z.boolean().optional(),
  customTitle: z.string().max(255).optional().nullable(),
  customDescription: z.string().max(1000).optional().nullable(),
});

const accessPublicLinkSchema = z.object({
  password: z.string().min(8).max(255).optional(),
});

const paginationSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).default("1"),
});

// ═══════════════════════════════════════════════════════════
// TEMPLATE ENGINE SETUP
// ═══════════════════════════════════════════════════════════

// Set up EJS as template engine (will be configured in main server)
router.set('view engine', 'html');
router.set('views', './templates');

// ═══════════════════════════════════════════════════════════
// POST /public/create - Create public link (authenticated)
// ═══════════════════════════════════════════════════════════
router.post("/create", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Validate request body
    const validatedData = createPublicLinkSchema.parse(req.body);
    
    // Parse expiration date if provided
    const expiresAt = validatedData.expiresAt ? new Date(validatedData.expiresAt) : null;

    // Create public link using service
    const result = await publicLinksService.createPublicLink({
      albumId: validatedData.albumId,
      userId,
      password: validatedData.password,
      expiresAt,
      allowDownload: validatedData.allowDownload,
      showMetadata: validatedData.showMetadata,
      customTitle: validatedData.customTitle,
      customDescription: validatedData.customDescription,
    });

    res.status(201).json({
      message: "Public link created successfully",
      publicLink: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (error.message === "Album not found or access denied") {
        return res.status(404).json({ error: error.message });
      }
    }

    console.error("Error creating public link:", error);
    res.status(500).json({ error: "Failed to create public link" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /public/:token - View public album (anonymous access)
// ═══════════════════════════════════════════════════════════
router.get("/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Validate pagination
    const { page } = paginationSchema.parse(req.query);

    // First validate the token without incrementing view count
    const validation = await publicLinksService.validatePublicLink(token);
    
    if (!validation.valid) {
      if (validation.expired) {
        return res.status(410).render('public-view.html', {
          passwordRequired: false,
          error: "This public link has expired",
          token,
          albumTitle: "Expired Link",
          customTitle: null,
        });
      }
      
      return res.status(404).render('public-view.html', {
        passwordRequired: false,
        error: "Public link not found",
        token,
        albumTitle: "Not Found",
        customTitle: null,
      });
    }

    // If password is required, show password form
    if (validation.passwordRequired) {
      return res.render('public-view.html', {
        passwordRequired: true,
        token,
        albumTitle: validation.albumTitle || "Protected Album",
        customTitle: validation.customTitle,
        error: null,
      });
    }

    // Access the public link (this will increment view count)
    const publicLinkData = await publicLinksService.accessPublicLink(
      token,
      undefined, // No password needed
      page,
      clientIp
    );

    // Helper function for date formatting
    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    };

    // Render the public view template
    res.render('public-view.html', {
      passwordRequired: false,
      token,
      albumTitle: publicLinkData.album.title,
      customTitle: publicLinkData.share.customTitle,
      customDescription: publicLinkData.share.customDescription,
      photoCount: publicLinkData.album.photoCount,
      photos: publicLinkData.photos,
      pagination: {
        ...publicLinkData.pagination,
        prevPage: Math.max(1, publicLinkData.pagination.page - 1),
        nextPage: Math.min(
          publicLinkData.pagination.totalPages,
          publicLinkData.pagination.page + 1
        ),
      },
      allowDownload: publicLinkData.share.allowDownload,
      showMetadata: publicLinkData.share.showMetadata,
      viewCount: publicLinkData.share.viewCount,
      formatDate,
      error: null,
    });

  } catch (error) {
    console.error("Error accessing public link:", error);
    res.status(500).render('public-view.html', {
      passwordRequired: false,
      error: "Failed to load album",
      token: req.params.token,
      albumTitle: "Error",
      customTitle: null,
    });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /public/:token - Access protected public link (anonymous)
// ═══════════════════════════════════════════════════════════
router.post("/:token", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Validate request body
    const validatedData = accessPublicLinkSchema.parse(req.body);
    
    // Validate pagination
    const { page } = paginationSchema.parse(req.query);

    // Access the public link with password
    const publicLinkData = await publicLinksService.accessPublicLink(
      token,
      validatedData.password,
      page,
      clientIp
    );

    // Helper function for date formatting
    const formatDate = (date: Date) => {
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(date);
    };

    // Render the public view template
    res.render('public-view.html', {
      passwordRequired: false,
      token,
      albumTitle: publicLinkData.album.title,
      customTitle: publicLinkData.share.customTitle,
      customDescription: publicLinkData.share.customDescription,
      photoCount: publicLinkData.album.photoCount,
      photos: publicLinkData.photos,
      pagination: {
        ...publicLinkData.pagination,
        prevPage: Math.max(1, publicLinkData.pagination.page - 1),
        nextPage: Math.min(
          publicLinkData.pagination.totalPages,
          publicLinkData.pagination.page + 1
        ),
      },
      allowDownload: publicLinkData.share.allowDownload,
      showMetadata: publicLinkData.share.showMetadata,
      viewCount: publicLinkData.share.viewCount,
      formatDate,
      error: null,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).render('public-view.html', {
        passwordRequired: true,
        error: "Invalid password format",
        token: req.params.token,
        albumTitle: "Protected Album",
        customTitle: null,
      });
    }

    if (error instanceof Error) {
      if (error.message === "Invalid or expired share token") {
        return res.status(404).render('public-view.html', {
          passwordRequired: false,
          error: "Public link not found or expired",
          token: req.params.token,
          albumTitle: "Not Found",
          customTitle: null,
        });
      }
      
      if (error.message === "Password required") {
        return res.render('public-view.html', {
          passwordRequired: true,
          error: null,
          token: req.params.token,
          albumTitle: "Protected Album",
          customTitle: null,
        });
      }
      
      if (error.message === "Invalid password") {
        return res.status(401).render('public-view.html', {
          passwordRequired: true,
          error: "Incorrect password. Please try again.",
          token: req.params.token,
          albumTitle: "Protected Album",
          customTitle: null,
        });
      }

      if (error.message === "Rate limit exceeded") {
        return res.status(429).render('public-view.html', {
          passwordRequired: false,
          error: "Too many requests. Please try again later.",
          token: req.params.token,
          albumTitle: "Rate Limited",
          customTitle: null,
        });
      }
    }

    console.error("Error accessing public link:", error);
    res.status(500).render('public-view.html', {
      passwordRequired: false,
      error: "Failed to load album",
      token: req.params.token,
      albumTitle: "Error",
      customTitle: null,
    });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /public/:token/validate - Validate public link (API)
// ═══════════════════════════════════════════════════════════
router.get("/:token/validate", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Validate token using service
    const validation = await publicLinksService.validatePublicLink(token);

    res.json({
      valid: validation.valid,
      expired: validation.expired,
      passwordRequired: validation.passwordRequired,
      albumTitle: validation.albumTitle,
      customTitle: validation.customTitle,
    });
  } catch (error) {
    console.error("Error validating public link:", error);
    res.status(500).json({ error: "Failed to validate public link" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /public/:token/download - Download album as ZIP (if allowed)
// ═══════════════════════════════════════════════════════════
router.get("/:token/download", async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

    // Access the public link to check if download is allowed
    const publicLinkData = await publicLinksService.accessPublicLink(
      token,
      undefined,
      1,
      clientIp
    );

    if (!publicLinkData.share.allowDownload) {
      return res.status(403).json({
        error: "Download not allowed",
        message: "The owner of this album has disabled downloads.",
      });
    }

    // For now, return a JSON response with photo URLs
    // In a production implementation, you would generate a ZIP file
    res.json({
      message: "Download links for album photos",
      album: {
        title: publicLinkData.album.title,
        customTitle: publicLinkData.share.customTitle,
        photoCount: publicLinkData.album.photoCount,
      },
      photos: publicLinkData.photos.map(photo => ({
        filename: photo.filename,
        uri: photo.uri,
        size: `${photo.width}x${photo.height}`,
        createdAt: photo.createdAt,
      })),
      note: "This is a placeholder implementation. In production, this would generate a ZIP file.",
    });

  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Invalid or expired share token") {
        return res.status(404).json({ error: error.message });
      }
      if (error.message === "Rate limit exceeded") {
        return res.status(429).json({ error: error.message });
      }
    }

    console.error("Error downloading public album:", error);
    res.status(500).json({ error: "Failed to download album" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /public/:shareId - Update public link settings (authenticated)
// ═══════════════════════════════════════════════════════════
router.put("/:shareId", async (req: Request, res: Response) => {
  try {
    const shareId = Array.isArray(req.params.shareId)
      ? req.params.shareId[0]
      : req.params.shareId;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Validate request body
    const validatedData = updatePublicLinkSchema.parse(req.body);
    
    // Parse expiration date if provided
    const expiresAt = validatedData.expiresAt ? new Date(validatedData.expiresAt) : null;

    // Update public link using service
    const result = await publicLinksService.updatePublicLink(shareId, userId, {
      expiresAt,
      isActive: validatedData.isActive,
      allowDownload: validatedData.allowDownload,
      showMetadata: validatedData.showMetadata,
      customTitle: validatedData.customTitle,
      customDescription: validatedData.customDescription,
    });

    res.json({
      message: "Public link updated successfully",
      publicLink: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request data",
        details: error.errors,
      });
    }

    if (error instanceof Error) {
      if (error.message === "Share not found or access denied") {
        return res.status(404).json({ error: error.message });
      }
    }

    console.error("Error updating public link:", error);
    res.status(500).json({ error: "Failed to update public link" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /public/stats - Get public link statistics (authenticated)
// ═══════════════════════════════════════════════════════════
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get public link statistics using service
    const stats = await publicLinksService.getPublicLinkStats(userId);

    res.json(stats);
  } catch (error) {
    console.error("Error fetching public link statistics:", error);
    res.status(500).json({ error: "Failed to fetch statistics" });
  }
});

export default router;
