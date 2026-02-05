// Meta: Upload routes for Cloud Gallery.
// Inputs: Authenticated requests with files or presigned URL parameters.
// Outputs: JSON responses for upload metadata or signed URLs.
// Invariants: Auth required for uploads; validation must run before accepting files.

import { Router, Request, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { validateFile, sanitizeFilename, getAllowedFileTypes } from "./file-validation";
import { authenticateToken } from "./auth";
import { generateDownloadUrl, generateUploadUrl } from "./presigned-urls";

const router = Router();

// Configure multer for memory storage (files are validated before saving)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max (individual limits enforced per file type)
    files: 5, // Maximum 5 files per request
  },
  fileFilter: (req, file, cb) => {
    // Basic filename sanitization
    file.originalname = sanitizeFilename(file.originalname);
    cb(null, true);
  },
});

const presignedUploadSchema = z.object({
  key: z.string().min(1),
  contentType: z.string().min(1),
  expiresInSeconds: z.number().int().positive().optional(),
});

const presignedDownloadSchema = z.object({
  key: z.string().min(1),
  expiresInSeconds: z.number().int().positive().optional(),
});

/**
 * GET /api/upload/allowed-types
 * Get list of allowed file types and their limits
 */
router.get("/allowed-types", (req: Request, res: Response) => {
  try {
    const allowedTypes = getAllowedFileTypes();
    res.json({
      allowedTypes,
      maxFilesPerRequest: 5,
      maxFileSize: 20 * 1024 * 1024, // 20MB
    });
  } catch (error) {
    console.error("Error getting allowed types:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to get allowed file types",
    });
  }
});

/**
 * POST /api/upload/presigned/upload
 * Request a presigned upload URL
 */
router.post("/presigned/upload", authenticateToken, (req: Request, res: Response) => {
  try {
    const parsed = presignedUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        message: "key and contentType are required",
        details: parsed.error.flatten(),
      });
    }

    const { key, contentType, expiresInSeconds } = parsed.data;
    const { url, expiresAt } = generateUploadUrl(
      key,
      contentType,
      expiresInSeconds,
    );

    res.json({ url, expiresAt });
  } catch (error) {
    console.error("Presigned upload error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to generate presigned upload URL",
    });
  }
});

/**
 * POST /api/upload/presigned/download
 * Request a presigned download URL
 */
router.post("/presigned/download", authenticateToken, (req: Request, res: Response) => {
  try {
    const parsed = presignedDownloadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Invalid request",
        message: "key is required",
        details: parsed.error.flatten(),
      });
    }

    const { key, expiresInSeconds } = parsed.data;
    const { url, expiresAt } = generateDownloadUrl(key, expiresInSeconds);

    res.json({ url, expiresAt });
  } catch (error) {
    console.error("Presigned download error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to generate presigned download URL",
    });
  }
});

/**
 * POST /api/upload/single
 * Upload a single file with validation
 */
router.post(
  "/single",
  authenticateToken,
  upload.single("file"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: "No file provided",
          message: "Please provide a file to upload",
        });
      }

      // Validate the file
      const validationResult = await validateFile(
        req.file.buffer,
        req.file.originalname,
      );

      if (!validationResult.isValid) {
        return res.status(400).json({
          error: "File validation failed",
          message: "File does not meet security requirements",
          details: validationResult.errors,
          fileInfo: {
            originalName: req.file.originalname,
            size: validationResult.size,
            detectedType: validationResult.mimeType,
          },
        });
      }

      // In a real implementation, you would:
      // 1. Save the file to storage (S3, local filesystem, etc.)
      // 2. Create database record
      // 3. Return file metadata

      const fileMetadata = {
        id: Math.random().toString(36).substr(2, 9), // Temporary ID
        originalName: req.file.originalname,
        sanitizedFilename: sanitizeFilename(req.file.originalname),
        mimeType: validationResult.mimeType,
        extension: validationResult.extension,
        size: validationResult.size,
        hash: validationResult.hash,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.user?.id,
      };

      // Log successful upload
      console.log(`File uploaded successfully: ${fileMetadata.originalName} (${fileMetadata.size} bytes)`);

      res.status(201).json({
        message: "File uploaded successfully",
        file: fileMetadata,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to upload file",
      });
    }
  },
);

/**
 * POST /api/upload/multiple
 * Upload multiple files with validation
 */
router.post(
  "/multiple",
  authenticateToken,
  upload.array("files", 5), // Max 5 files
  async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      
      if (!files || files.length === 0) {
        return res.status(400).json({
          error: "No files provided",
          message: "Please provide files to upload",
        });
      }

      const results = [];
      const errors = [];

      // Validate each file
      for (const file of files) {
        const validationResult = await validateFile(
          file.buffer,
          file.originalname,
        );

        if (validationResult.isValid) {
          const fileMetadata = {
            id: Math.random().toString(36).substr(2, 9), // Temporary ID
            originalName: file.originalname,
            sanitizedFilename: sanitizeFilename(file.originalname),
            mimeType: validationResult.mimeType,
            extension: validationResult.extension,
            size: validationResult.size,
            hash: validationResult.hash,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user?.id,
          };

          results.push(fileMetadata);
        } else {
          errors.push({
            filename: file.originalname,
            errors: validationResult.errors,
            detectedType: validationResult.mimeType,
            size: validationResult.size,
          });
        }
      }

      // Log upload results
      console.log(`Batch upload: ${results.length} successful, ${errors.length} failed`);

      res.status(201).json({
        message: `Upload completed: ${results.length} successful, ${errors.length} failed`,
        uploaded: results,
        failed: errors,
      });
    } catch (error) {
      console.error("Batch upload error:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to upload files",
      });
    }
  },
);

/**
 * POST /api/upload/validate
 * Validate file without uploading (pre-upload check)
 */
router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { filename, size, mimeType } = req.body;

    if (!filename || !size || !mimeType) {
      return res.status(400).json({
        error: "Missing required fields",
        message: "filename, size, and mimeType are required",
      });
    }

    // Basic validation without actual file content
    const allowedTypes = getAllowedFileTypes();
    
    if (!(mimeType in allowedTypes)) {
      return res.status(400).json({
        valid: false,
        error: "File type not allowed",
        message: `${mimeType} is not an allowed file type`,
        allowedTypes: Object.keys(allowedTypes),
      });
    }

    const typeConfig = allowedTypes[mimeType];
    const maxSize = typeConfig.maxSize;

    if (size > maxSize) {
      return res.status(400).json({
        valid: false,
        error: "File too large",
        message: `File size ${(size / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(maxSize / 1024 / 1024).toFixed(2)}MB for ${mimeType}`,
      });
    }

    // Check filename
    const sanitized = sanitizeFilename(filename);
    if (sanitized !== filename) {
      return res.status(400).json({
        valid: false,
        error: "Invalid filename",
        message: "Filename contains invalid characters",
        originalName: filename,
        suggestedName: sanitized,
      });
    }

    res.json({
      valid: true,
      message: "File validation passed",
      allowedSize: maxSize,
      allowedExtension: typeConfig.extension,
    });
  } catch (error) {
    console.error("Validation error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to validate file",
    });
  }
});

export default router;
