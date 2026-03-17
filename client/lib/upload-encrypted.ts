// Encrypted upload helper for Cloud Gallery end-to-end encryption
// Encrypts photos client-side before upload to ensure zero-knowledge storage

import { encryptData } from "./encryption";
import { retrieveMasterKey } from "./key-derivation";
import * as FileSystem from "expo-file-system";
import { api } from "./api";
import { generateVideoThumbnail, isVideoFile } from "./video-thumbnail";

export interface EncryptionMetadata {
  iv: string; // Initialization vector (hex)
  authTag: string; // Authentication tag (hex)
  algorithm: string; // Encryption algorithm used
  keyDerivation: {
    salt: string; // Key derivation salt
    iterations: number; // Argon2id iterations
    memory: number; // Memory cost in KiB
    parallelism: number; // Parallelism factor
  };
}

export interface EncryptedUploadResult {
  success: boolean;
  file?: {
    id: string;
    originalName: string;
    sanitizedFilename: string;
    mimeType: string;
    extension: string;
    size: number;
    hash: string;
    uploadedAt: string;
    uploadedBy: string;
    uri: string;
    encrypted: boolean;
    encryptionMetadata?: EncryptionMetadata;
  };
  error?: string;
}

export interface PhotoMetadata {
  width: number;
  height: number;
  filename: string;
  mimeType?: string;
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    country?: string;
  };
  camera?: {
    make: string;
    model: string;
    iso?: number;
    aperture?: string;
    shutter?: string;
    focalLength?: number;
  };
  exif?: Record<string, unknown>;
  tags?: string[];
  notes?: string;
  isPrivate?: boolean;
  // Video-specific fields
  isVideo?: boolean;
  videoDuration?: number;
  videoThumbnailUri?: string;
}

/**
 * Encrypt and upload a video file with thumbnail generation to the server
 * @param videoUri - Local URI of the video to encrypt and upload
 * @param metadata - Video metadata to include with the upload
 * @param onProgress - Optional progress callback (0-100)
 * @returns Upload result with file information including thumbnail URI
 */
export async function encryptAndUploadVideo(
  videoUri: string,
  metadata: PhotoMetadata,
  onProgress?: (progress: number) => void
): Promise<EncryptedUploadResult> {
  try {
    // Validate this is a video file
    if (!isVideoFile(videoUri, metadata.mimeType)) {
      return {
        success: false,
        error: "File is not a supported video format",
      };
    }

    // Generate video thumbnail before upload
    onProgress?.(5);
    let thumbnailUri: string | undefined;
    
    try {
      thumbnailUri = await generateVideoThumbnail(videoUri, 1); // Generate thumbnail at 1 second
      onProgress?.(15);
    } catch (thumbnailError) {
      console.warn("Failed to generate video thumbnail:", thumbnailError);
      // Continue without thumbnail - it's not critical for upload
    }

    // Update metadata with thumbnail URI
    const videoMetadata = {
      ...metadata,
      isVideo: true,
      videoThumbnailUri: thumbnailUri,
    };

    // Use the existing encryptAndUpload function for the actual video file
    return await encryptAndUpload(videoUri, videoMetadata, (progress) => {
      // Adjust progress to account for thumbnail generation (0-15% already used)
      const adjustedProgress = Math.round((progress / 100) * 85 + 15);
      onProgress?.(adjustedProgress);
    });
  } catch (error) {
    console.error("Video upload failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Video upload failed",
    };
  }
}

/**
 * Encrypt and upload a photo file to the server
 * @param photoUri - Local URI of the photo to encrypt and upload
 * @param metadata - Photo metadata to include with the upload
 * @param onProgress - Optional progress callback (0-100)
 * @returns Upload result with file information
 */
export async function encryptAndUpload(
  photoUri: string,
  metadata: PhotoMetadata,
  onProgress?: (progress: number) => void
): Promise<EncryptedUploadResult> {
  try {
    // Get encryption key from secure storage
    const masterKey = await retrieveMasterKey(false);
    if (!masterKey) {
      return {
        success: false,
        error: "Encryption key not available. Please set up encryption first.",
      };
    }

    // Read file as base64
    onProgress?.(10);
    const fileData = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to bytes
    onProgress?.(20);
    const fileBytes = Uint8Array.from(atob(fileData), (c) => c.charCodeAt(0));

    // Encrypt the file data
    onProgress?.(30);
    const encryptedData = encryptData(fileBytes, masterKey);

    // Extract IV and authTag from encrypted data
    onProgress?.(40);
    const iv = Buffer.from(encryptedData.slice(0, 24)).toString("hex");
    const ciphertext = encryptedData.slice(24, -16);
    const authTag = Buffer.from(encryptedData.slice(-16)).toString("hex");

    // Create encryption metadata
    const encryptionMetadata: EncryptionMetadata = {
      iv,
      authTag,
      algorithm: "XChaCha20-Poly1305",
      keyDerivation: {
        salt: "stored_in_secure_store", // Actual salt is managed by key-derivation.ts
        iterations: 3,
        memory: 64 * 1024, // 64MB
        parallelism: 2,
      },
    };

    // Create FormData for upload
    onProgress?.(50);
    const formData = new FormData();

    // Append encrypted file as blob
    const encryptedBlob = new Blob([ciphertext], { type: "application/octet-stream" });
    formData.append("file", encryptedBlob, metadata.filename);

    // Append encryption metadata
    formData.append("encrypted", "true");
    formData.append("iv", iv);
    formData.append("authTag", authTag);
    formData.append("algorithm", encryptionMetadata.algorithm);

    // Append photo metadata
    formData.append("metadata", JSON.stringify({
      ...metadata,
      encrypted: true,
      encryptionMetadata,
    }));

    // Upload to server
    onProgress?.(60);
    const response = await api.post("/api/upload/single", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const progress = Math.round(
            (progressEvent.loaded / progressEvent.total) * 40 + 60
          );
          onProgress?.(progress);
        }
      },
    });

    onProgress?.(100);
    return {
      success: true,
      file: {
        ...response.data.file,
        encrypted: true,
        encryptionMetadata,
      },
    };
  } catch (error) {
    console.error("Encrypted upload failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Check if encryption is available and set up
 * @returns True if encryption key is available
 */
export async function isEncryptionAvailable(): Promise<boolean> {
  try {
    const masterKey = await retrieveMasterKey(false);
    return !!masterKey;
  } catch (error) {
    console.error("Failed to check encryption availability:", error);
    return false;
  }
}

/**
 * Get file info for an encrypted photo
 * @param photoUri - Local URI of the photo
 * @returns File information including size for encryption planning
 */
export async function getFileInfo(photoUri: string): Promise<{
  size: number;
  exists: boolean;
  isDirectory: boolean;
}> {
  try {
    const info = await FileSystem.getInfoAsync(photoUri);
    return {
      size: info.size || 0,
      exists: info.exists,
      isDirectory: info.isDirectory || false,
    };
  } catch (error) {
    console.error("Failed to get file info:", error);
    return {
      size: 0,
      exists: false,
      isDirectory: false,
    };
  }
}

/**
 * Validate photo metadata before encryption and upload
 * @param metadata - Photo metadata to validate
 * @returns True if metadata is valid
 */
export function validatePhotoMetadata(metadata: PhotoMetadata): boolean {
  try {
    // Required fields
    if (!metadata.width || !metadata.height || !metadata.filename) {
      return false;
    }

    // Validate dimensions
    if (
      metadata.width <= 0 ||
      metadata.height <= 0 ||
      metadata.width > 100000 ||
      metadata.height > 100000
    ) {
      return false;
    }

    // Validate filename
    if (metadata.filename.length === 0 || metadata.filename.length > 255) {
      return false;
    }

    // Validate optional fields
    if (metadata.tags && (!Array.isArray(metadata.tags) || metadata.tags.length > 50)) {
      return false;
    }

    if (metadata.notes && metadata.notes.length > 1000) {
      return false;
    }

    return true;
  } catch (error) {
    console.error("Metadata validation error:", error);
    return false;
  }
}

/**
 * Estimate encrypted file size for progress calculation
 * @param originalSize - Original file size in bytes
 * @returns Estimated encrypted file size
 */
export function estimateEncryptedSize(originalSize: number): number {
  // XChaCha20-Poly1305 adds 24-byte IV + 16-byte authTag
  // So encrypted size = original size + 40 bytes
  return originalSize + 40;
}

/**
 * Format file size for display
 * @param bytes - Size in bytes
 * @returns Formatted size string
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
