// AI-META-BEGIN
// AI-META: Authenticated upload endpoints with file validation and multipart handling
// OWNERSHIP: server/uploads
// ENTRYPOINTS: mounted at /api/upload via server/routes.ts
// DEPENDENCIES: express, multer, ./file-validation, ./auth
// DANGER: File handling paths are security-sensitive and can be abused for DoS/malware upload
// CHANGE-SAFETY: Preserve multer limits, validation checks, and sanitized filename behavior
// TESTS: server/file-validation.test.ts, integration tests for upload flows
// AI-META-END

// Upload routes for Cloud Gallery
// Provides secure file upload with comprehensive validation

import { Router, Request, Response } from "express";
import multer from "multer";
import {
  validateFile,
  sanitizeFilename,
  getAllowedFileTypes,
} from "./file-validation";
import { authenticateToken } from "./auth";
import * as fs from "fs";
import * as path from "path";

const router = Router();

// Configure multer for memory storage (files are validated before saving)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max (individual limits enforced per file type)
    files: 5, // Maximum 5 files per request
    fields: 10, // Maximum 10 fields per request
    fieldSize: 1024 * 1024, // Maximum 1MB per field
  },
  fileFilter: (req, file, cb) => {
    // Basic filename sanitization
    file.originalname = sanitizeFilename(file.originalname);
    
    // Additional security checks
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.js', '.vbs', '.jar', '.ps1'];
    const fileExt = path.extname(file.originalname).toLowerCase();
    
    if (dangerousExtensions.includes(fileExt)) {
      return cb(new Error(`Dangerous file extension not allowed: ${fileExt}`), false);
    }
    
    // Check for double extensions (e.g., file.jpg.exe)
    if (file.originalname.split('.').length > 2) {
      return cb(new Error('Files with multiple extensions are not allowed'), false);
    }
    
    cb(null, true);
  },
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

      // Check if this is an encrypted upload
      const isEncrypted = req.body.encrypted === "true";
      const iv = req.body.iv;
      const authTag = req.body.authTag;
      const algorithm = req.body.algorithm;
      let metadata = {};

      // Parse metadata if provided
      if (req.body.metadata) {
        try {
          metadata = JSON.parse(req.body.metadata);
        } catch (error) {
          console.warn("Failed to parse metadata:", error);
        }
      }

      // For encrypted files, validate encryption metadata
      let validationResult;
      if (isEncrypted) {
        // Validate required encryption fields
        if (!iv || !authTag) {
          return res.status(400).json({
            error: "Missing encryption metadata",
            message: "Encrypted uploads must include IV and authTag",
            details: {
              required: ["iv", "authTag"],
              provided: {
                iv: !!iv,
                authTag: !!authTag,
                algorithm,
              },
            },
          });
        }

        // Validate IV format (should be hex string, 48 chars for 24 bytes)
        if (!/^[0-9a-fA-F]{48}$/.test(iv)) {
          return res.status(400).json({
            error: "Invalid IV format",
            message: "IV must be a 48-character hex string (24 bytes)",
            details: {
              received: iv ? `${iv.length} characters` : "missing",
              expected: "48 characters (hex)",
            },
          });
        }

        // Validate authTag format (should be hex string, 32 chars for 16 bytes)
        if (!/^[0-9a-fA-F]{32}$/.test(authTag)) {
          return res.status(400).json({
            error: "Invalid authTag format",
            message: "authTag must be a 32-character hex string (16 bytes)",
            details: {
              received: authTag ? `${authTag.length} characters` : "missing",
              expected: "32 characters (hex)",
            },
          });
        }

        // Validate algorithm
        const supportedAlgorithms = ["XChaCha20-Poly1305"];
        if (algorithm && !supportedAlgorithms.includes(algorithm)) {
          return res.status(400).json({
            error: "Unsupported encryption algorithm",
            message: `Algorithm '${algorithm}' is not supported`,
            details: {
              supported: supportedAlgorithms,
              received: algorithm,
            },
          });
        }

        // Basic validation for encrypted files (server can't validate content)
        validationResult = {
          isValid: true,
          mimeType: "application/octet-stream", // Encrypted files are binary
          extension: path.extname(req.file.originalname),
          size: req.file.buffer.length,
          hash: "", // Can't hash encrypted content meaningfully
          errors: [],
        };

        console.log(`Processing encrypted upload: ${req.file.originalname} (${validationResult.size} bytes)`);
      } else {
        // Regular file validation for unencrypted uploads
        validationResult = await validateFile(
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
      }

      // Upload to object storage instead of local filesystem
      const { initializeObjectStorage, generateObjectKey } = await import('./services/object-storage');
      
      try {
        const storage = initializeObjectStorage();
        const objectKey = generateObjectKey(req.user!.id, req.file.originalname);
        
        const uploadResult = await storage.uploadObject(
          objectKey,
          req.file.buffer,
          isEncrypted ? "application/octet-stream" : validationResult.mimeType,
          req.user!.id
        );

        console.log(`File uploaded to object storage: ${uploadResult.key} (${req.file.buffer.length} bytes)${isEncrypted ? " [ENCRYPTED]" : ""}`);

        // Build file metadata with object storage information
        const fileMetadata: any = {
          id: uploadResult.key.split('/').pop(), // Use UUID part as ID
          originalName: req.file.originalname,
          objectKey: uploadResult.key, // Store object key instead of local path
          mimeType: isEncrypted ? "application/octet-stream" : validationResult.mimeType,
          extension: validationResult.extension,
          size: validationResult.size,
          hash: validationResult.hash,
          uploadedAt: new Date().toISOString(),
          uploadedBy: req.user?.id,
          uri: uploadResult.key, // Store object key as URI for now
          encrypted: isEncrypted,
          storageProvider: storage.getProviderInfo().provider,
        };

      // Add encryption metadata for encrypted files
        if (isEncrypted) {
          fileMetadata.encryptionMetadata = {
            iv,
            authTag,
            algorithm: algorithm || "XChaCha20-Poly1305",
            encryptedAt: new Date().toISOString(),
          };

          // Validate that encryption metadata is properly included in file metadata
          if (!fileMetadata.encryptionMetadata.iv || !fileMetadata.encryptionMetadata.authTag) {
            throw new Error("Encryption metadata validation failed after processing");
          }
        }

        // Log successful upload (without sensitive data)
        console.log(
          `File uploaded successfully: ${fileMetadata.originalName} (${fileMetadata.size} bytes) -> ${fileMetadata.objectKey}${isEncrypted ? " [ENCRYPTED]" : ""}`,
        );

        res.status(201).json({
          message: "File uploaded successfully",
          file: fileMetadata,
        });
      } catch (storageError) {
        console.error("Object storage upload error:", storageError);
        res.status(500).json({
          error: "Storage upload failed",
          message: "Failed to upload file to object storage",
          details: storageError instanceof Error ? storageError.message : "Unknown storage error",
        });
        return;
      }
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
      console.log(
        `Batch upload: ${results.length} successful, ${errors.length} failed`,
      );

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
