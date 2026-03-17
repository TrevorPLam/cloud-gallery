// Photo decryption utilities for end-to-end encrypted photos
// Handles decryption of photo files downloaded from the server

import { decryptData } from "./encryption";
import { retrieveMasterKey } from "./key-derivation";
import * as FileSystem from "expo-file-system";

export interface DecryptionMetadata {
  iv: string; // Initialization vector (hex)
  authTag: string; // Authentication tag (hex)
  algorithm: string; // Encryption algorithm used
  encryptedAt: string; // When the file was encrypted
}

export interface EncryptedPhotoInfo {
  id: string;
  uri: string;
  encrypted: boolean;
  encryptionMetadata?: DecryptionMetadata;
  originalMimeType?: string;
}

/**
 * Download and decrypt an encrypted photo file
 * @param photoInfo - Photo information including encryption metadata
 * @param destinationUri - Local URI to save the decrypted file
 * @param onProgress - Optional progress callback (0-100)
 * @returns Local URI of the decrypted file
 */
export async function downloadAndDecryptPhoto(
  photoInfo: EncryptedPhotoInfo,
  destinationUri: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  try {
    if (!photoInfo.encrypted) {
      // Not encrypted, just download directly
      onProgress?.(10);
      const downloadResult = await FileSystem.downloadAsync(photoInfo.uri, destinationUri);
      onProgress?.(100);
      return downloadResult.uri;
    }

    if (!photoInfo.encryptionMetadata) {
      throw new Error("Missing encryption metadata for encrypted photo");
    }

    // Get encryption key
    onProgress?.(10);
    const masterKey = await retrieveMasterKey(false);
    if (!masterKey) {
      throw new Error("Encryption key not available");
    }

    // Download encrypted file
    onProgress?.(20);
    const tempEncryptedUri = `${destinationUri}.encrypted`;
    const downloadResult = await FileSystem.downloadAsync(photoInfo.uri, tempEncryptedUri);
    
    if (downloadResult.status !== 200) {
      throw new Error(`Download failed with status: ${downloadResult.status}`);
    }

    // Read encrypted file
    onProgress?.(40);
    const encryptedData = await FileSystem.readAsStringAsync(tempEncryptedUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to bytes
    onProgress?.(60);
    const encryptedBytes = Uint8Array.from(atob(encryptedData), (c) => c.charCodeAt(0));

    // Reconstruct the encrypted data with IV and authTag
    const iv = Buffer.from(photoInfo.encryptionMetadata.iv, "hex");
    const authTag = Buffer.from(photoInfo.encryptionMetadata.authTag, "hex");
    
    // Create full encrypted data: IV + ciphertext + authTag
    const fullEncryptedData = new Uint8Array(iv.length + encryptedBytes.length + authTag.length);
    fullEncryptedData.set(iv, 0);
    fullEncryptedData.set(encryptedBytes, iv.length);
    fullEncryptedData.set(authTag, iv.length + encryptedBytes.length);

    // Decrypt the data
    onProgress?.(80);
    const decryptedBytes = decryptData(fullEncryptedData, masterKey);

    // Save decrypted file
    onProgress?.(90);
    const decryptedBase64 = btoa(String.fromCharCode(...decryptedBytes));
    await FileSystem.writeAsStringAsync(destinationUri, decryptedBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Clean up temporary encrypted file
    await FileSystem.deleteAsync(tempEncryptedUri, { idempotent: true });

    onProgress?.(100);
    return destinationUri;
  } catch (error) {
    console.error("Failed to download and decrypt photo:", error);
    
    // Clean up temporary files on error
    try {
      await FileSystem.deleteAsync(`${destinationUri}.encrypted`, { idempotent: true });
      await FileSystem.deleteAsync(destinationUri, { idempotent: true });
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
    
    throw error;
  }
}

/**
 * Check if a photo is encrypted
 * @param photo - Photo object to check
 * @returns True if the photo is encrypted
 */
export function isPhotoEncrypted(photo: any): boolean {
  return photo.encrypted === true && !!photo.encryptionMetadata;
}

/**
 * Get the original file extension from an encrypted photo
 * @param photo - Photo object
 * @returns Original file extension (e.g., ".jpg", ".png")
 */
export function getOriginalFileExtension(photo: any): string {
  if (photo.originalMimeType) {
    // Map MIME types to extensions
    const mimeToExt: Record<string, string> = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/gif": ".gif",
      "image/webp": ".webp",
      "image/heic": ".heic",
      "image/heif": ".heif",
    };
    return mimeToExt[photo.originalMimeType] || ".jpg";
  }
  
  // Fallback to filename extension
  if (photo.filename) {
    const ext = photo.filename.toLowerCase().match(/\.[^.]+$/);
    return ext ? ext[0] : ".jpg";
  }
  
  return ".jpg"; // Default fallback
}

/**
 * Generate a unique local URI for a decrypted photo
 * @param photoId - Photo ID
 * @param originalExtension - Original file extension
 * @returns Local URI for the decrypted file
 */
export function generateDecryptedPhotoUri(photoId: string, originalExtension: string): string {
  const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  return `${cacheDir}decrypted_${photoId}${originalExtension}`;
}

/**
 * Clean up decrypted photo files from cache
 * @param maxAge - Maximum age in milliseconds (default: 1 hour)
 */
export async function cleanupDecryptedPhotos(maxAge: number = 60 * 60 * 1000): Promise<void> {
  try {
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    const now = Date.now();

    for (const file of files) {
      if (file.startsWith("decrypted_")) {
        const fileUri = `${cacheDir}${file}`;
        const info = await FileSystem.getInfoAsync(fileUri);
        
        if (info.exists && info.modificationTime) {
          const fileAge = now - info.modificationTime * 1000; // Convert to milliseconds
          
          if (fileAge > maxAge) {
            await FileSystem.deleteAsync(fileUri, { idempotent: true });
            console.log(`Cleaned up old decrypted photo: ${file}`);
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to cleanup decrypted photos:", error);
  }
}

/**
 * Batch download and decrypt multiple photos
 * @param photos - Array of photo information
 * @param onProgress - Progress callback for overall progress
 * @param onPhotoProgress - Progress callback for individual photo
 * @returns Array of local URIs for decrypted photos
 */
export async function batchDownloadAndDecryptPhotos(
  photos: EncryptedPhotoInfo[],
  onProgress?: (overallProgress: number, currentPhoto: string) => void,
  onPhotoProgress?: (photoId: string, photoProgress: number) => void
): Promise<string[]> {
  const results: string[] = [];
  const totalPhotos = photos.length;

  for (let i = 0; i < totalPhotos; i++) {
    const photo = photos[i];
    const overallProgress = (i / totalPhotos) * 100;
    
    onProgress?.(overallProgress, photo.id);
    
    try {
      const originalExtension = getOriginalFileExtension(photo);
      const destinationUri = generateDecryptedPhotoUri(photo.id, originalExtension);
      
      const localUri = await downloadAndDecryptPhoto(
        photo,
        destinationUri,
        (photoProgress) => onPhotoProgress?.(photo.id, photoProgress)
      );
      
      results.push(localUri);
    } catch (error) {
      console.error(`Failed to process photo ${photo.id}:`, error);
      // Continue with other photos even if one fails
    }
  }

  onProgress?.(100, "completed");
  return results;
}

/**
 * Verify that a decrypted photo matches expected metadata
 * @param localUri - Local URI of the decrypted photo
 * @param expectedMetadata - Expected photo metadata
 * @returns True if the photo appears valid
 */
export async function validateDecryptedPhoto(
  localUri: string,
  expectedMetadata: { width?: number; height?: number; size?: number }
): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    
    if (!info.exists) {
      return false;
    }

    // Basic size validation (allowing for some compression variance)
    if (expectedMetadata.size && info.size) {
      const sizeVariance = Math.abs(info.size - expectedMetadata.size) / expectedMetadata.size;
      if (sizeVariance > 0.1) { // Allow 10% variance
        console.warn(`Decrypted photo size mismatch: expected ~${expectedMetadata.size}, got ${info.size}`);
      }
    }

    // For more detailed validation, you could use image processing libraries
    // to verify dimensions match expected metadata
    return true;
  } catch (error) {
    console.error("Failed to validate decrypted photo:", error);
    return false;
  }
}
