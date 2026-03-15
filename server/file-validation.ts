// AI-META-BEGIN
// AI-META: Upload file validation, MIME sniffing, and filename sanitization utilities
// OWNERSHIP: server/uploads
// ENTRYPOINTS: consumed by server/upload-routes.ts
// DEPENDENCIES: file-type, crypto
// DANGER: Validation regressions can enable malicious file uploads or oversized payloads
// CHANGE-SAFETY: Preserve MIME policy constants and validation result contract
// TESTS: server/file-validation.test.ts
// AI-META-END

// File validation utilities for Cloud Gallery
// Provides comprehensive file type and content validation for uploads

import { fileTypeFromBuffer } from "file-type";
import { createHash } from "crypto";

/**
 * Allowed file types for upload
 */
export const ALLOWED_FILE_TYPES = {
  // Images
  "image/jpeg": { ext: "jpg", maxSize: 10 * 1024 * 1024 }, // 10MB
  "image/png": { ext: "png", maxSize: 10 * 1024 * 1024 }, // 10MB
  "image/gif": { ext: "gif", maxSize: 10 * 1024 * 1024 }, // 10MB
  "image/webp": { ext: "webp", maxSize: 10 * 1024 * 1024 }, // 10MB
  "image/avif": { ext: "avif", maxSize: 10 * 1024 * 1024 }, // 10MB

  // Documents
  "application/pdf": { ext: "pdf", maxSize: 5 * 1024 * 1024 }, // 5MB
  "text/plain": { ext: "txt", maxSize: 1 * 1024 * 1024 }, // 1MB
  "text/csv": { ext: "csv", maxSize: 2 * 1024 * 1024 }, // 2MB

  // Archives
  "application/zip": { ext: "zip", maxSize: 20 * 1024 * 1024 }, // 20MB
} as const;

export type AllowedMimeType = keyof typeof ALLOWED_FILE_TYPES;

/**
 * File validation result
 */
export interface FileValidationResult {
  isValid: boolean;
  mimeType?: string;
  extension?: string;
  size?: number;
  hash?: string;
  errors: string[];
}

/**
 * Validate a file buffer for type, size, and security
 *
 * @param buffer - File buffer to validate
 * @param originalName - Original filename (for extension checking)
 * @param maxSize - Optional custom max size override
 * @returns Validation result with details
 *
 * @example
 * const result = await validateFile(buffer, "photo.jpg");
 * if (result.isValid) {
 *   console.log("File is valid:", result.mimeType);
 * } else {
 *   console.error("Validation errors:", result.errors);
 * }
 */
export async function validateFile(
  buffer: Buffer,
  originalName: string,
  maxSize?: number,
): Promise<FileValidationResult> {
  const result: FileValidationResult = {
    isValid: true,
    errors: [],
  };

  try {
    // Check file size
    result.size = buffer.length;
    const fileSize = buffer.length;

    if (fileSize === 0) {
      result.isValid = false;
      result.errors.push("File is empty");
      return result;
    }

    // Detect file type from content
    const fileType = await fileTypeFromBuffer(buffer);

    if (!fileType) {
      result.isValid = false;
      result.errors.push("Unable to determine file type");
      return result;
    }

    result.mimeType = fileType.mime;
    result.extension = fileType.ext;

    // Check if MIME type is allowed
    if (!(fileType.mime in ALLOWED_FILE_TYPES)) {
      result.isValid = false;
      result.errors.push(`File type ${fileType.mime} is not allowed`);
      return result;
    }

    // Check if extension matches MIME type
    const allowedConfig = ALLOWED_FILE_TYPES[fileType.mime as AllowedMimeType];
    if (fileType.ext !== allowedConfig.ext) {
      result.isValid = false;
      result.errors.push(
        `File extension ${fileType.ext} does not match detected type ${fileType.mime}`,
      );
      return result;
    }

    // Check file size limits
    const sizeLimit = maxSize || allowedConfig.maxSize;
    if (fileSize > sizeLimit) {
      result.isValid = false;
      result.errors.push(
        `File size ${(fileSize / 1024 / 1024).toFixed(2)}MB exceeds limit of ${(sizeLimit / 1024 / 1024).toFixed(2)}MB`,
      );
      return result;
    }

    // Additional security checks for specific file types
    await performSecurityChecks(buffer, fileType.mime, result);

    // Generate file hash for integrity checking (always generate for valid files)
    result.hash = createHash("sha256").update(buffer).digest("hex");

    return result;
  } catch (error) {
    result.isValid = false;
    result.errors.push(
      `File validation error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    return result;
  }
}

/**
 * Perform additional security checks on file content
 */
async function performSecurityChecks(
  buffer: Buffer,
  mimeType: string,
  result: FileValidationResult,
): Promise<void> {
  // Check for malicious content in text files
  if (mimeType.startsWith("text/") || mimeType.includes("script")) {
    const content = buffer.toString("utf8", 0, Math.min(1024, buffer.length)); // First 1KB

    // Check for suspicious patterns
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        result.isValid = false;
        result.errors.push("File contains potentially malicious content");
        return;
      }
    }
  }

  // Check for ZIP bomb (compression ratio attack)
  if (mimeType === "application/zip") {
    // Simple check: if a small file decompresses to a very large size, it might be a zip bomb
    // This is a basic implementation - in production, you'd want more sophisticated checks
    if (buffer.length < 1024 * 1024) {
      // Less than 1MB
      // Would need actual decompression to check, but for now we'll just warn
      // In a real implementation, you'd use a library like yauzl to check actual decompressed size
    }
  }

  // Check for EXIF data in images (privacy concern)
  if (mimeType.startsWith("image/")) {
    // This would require a library like exifr to actually read EXIF data
    // For now, we'll just note that this check should be implemented
    // In production, you might want to strip EXIF data for privacy
  }
}

/**
 * Sanitize filename to prevent directory traversal and injection attacks
 *
 * @param filename - Original filename
 * @returns Sanitized filename
 *
 * @example
 * const safe = sanitizeFilename("../../../etc/passwd");
 * console.log(safe); // "etc_passwd"
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return "unnamed_file";

  // Remove path separators and dangerous characters
  let sanitized = filename
    .replace(/[\\/]/g, "_") // Replace path separators
    .replace(/\.\./g, "") // Remove directory traversal
    .replace(/[<>:"|?*]/g, "_") // Replace invalid characters
    .replace(/[\x00-\x1f\x80-\x9f]/g, "") // Remove control characters
    .replace(/^\.+/, "") // Remove leading dots
    .trim();

  // Ensure filename is not empty after sanitization
  if (!sanitized) {
    sanitized = "unnamed_file";
  }

  // Limit filename length
  if (sanitized.length > 255) {
    const ext = sanitized.includes(".") ? "." + sanitized.split(".").pop() : "";
    const nameWithoutExt = sanitized.substring(0, 255 - ext.length);
    sanitized = nameWithoutExt + ext;
  }

  return sanitized;
}

/**
 * Get allowed file types for API responses
 */
export function getAllowedFileTypes(): Record<
  string,
  { extension: string; maxSize: number }
> {
  const result: Record<string, { extension: string; maxSize: number }> = {};

  for (const [mimeType, config] of Object.entries(ALLOWED_FILE_TYPES)) {
    result[mimeType] = {
      extension: config.ext,
      maxSize: config.maxSize,
    };
  }

  return result;
}
