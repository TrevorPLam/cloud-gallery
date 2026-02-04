// Secure storage with encryption for sensitive metadata
// Encrypts sensitive photo metadata while keeping basic info accessible

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Photo, Album } from "@/types";

// Storage keys
const PHOTOS_KEY = "@photo_vault_photos";
const ALBUMS_KEY = "@photo_vault_albums";
const ENCRYPTION_KEY = "@photo_vault_encryption_key";
const METADATA_KEY = "@photo_vault_metadata";

// Sensitive fields that should be encrypted
interface SensitivePhotoMetadata {
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
}

interface EncryptedMetadata {
  encrypted: string;
  iv: string;
  authTag: string;
  salt: string;
}

interface SecurePhoto extends Omit<Photo, "albumIds"> {
  albumIds: string[];
  metadata?: EncryptedMetadata; // Encrypted sensitive data
}

interface SecureAlbum extends Album {
  metadata?: EncryptedMetadata; // Encrypted sensitive data
}

// Simple encryption for client-side (not as secure as server-side)
// In production, this should use platform-specific secure storage
class ClientEncryption {
  private key: string | null = null;

  async getKey(): Promise<string> {
    if (!this.key) {
      this.key = await AsyncStorage.getItem(ENCRYPTION_KEY);
      if (!this.key) {
        // Generate a new key for this installation
        this.key = this.generateKey();
        await AsyncStorage.setItem(ENCRYPTION_KEY, this.key);
      }
    }
    return this.key;
  }

  private generateKey(): string {
    // Simple key generation for demo
    // In production, use platform-specific secure key generation
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async encrypt(data: SensitivePhotoMetadata): Promise<EncryptedMetadata> {
    const key = await this.getKey();
    const plaintext = JSON.stringify(data);

    // Simple XOR encryption for demo (NOT SECURE for production)
    // In production, use proper AES encryption via native modules
    const encrypted = this.xorEncrypt(plaintext, key);
    const iv = this.generateKey().substring(0, 24); // Mock IV
    const authTag = this.generateKey().substring(0, 32); // Mock auth tag
    const salt = this.generateKey().substring(0, 32); // Mock salt

    return {
      encrypted,
      iv,
      authTag,
      salt,
    };
  }

  async decrypt(
    encryptedData: EncryptedMetadata,
  ): Promise<SensitivePhotoMetadata> {
    const key = await this.getKey();

    // Simple XOR decryption for demo (NOT SECURE for production)
    const plaintext = this.xorDecrypt(encryptedData.encrypted, key);

    try {
      return JSON.parse(plaintext);
    } catch (error) {
      console.error("Failed to decrypt metadata:", error);
      return {};
    }
  }

  private xorEncrypt(text: string, key: string): string {
    let result = "";
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length),
      );
    }
    return btoa(result); // Base64 encode
  }

  private xorDecrypt(encrypted: string, key: string): string {
    const text = atob(encrypted); // Base64 decode
    let result = "";
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ key.charCodeAt(i % key.length),
      );
    }
    return result;
  }
}

const encryption = new ClientEncryption();

// Extract sensitive metadata from a photo
function extractSensitiveMetadata(
  photo: Partial<Photo>,
): SensitivePhotoMetadata {
  const metadata: SensitivePhotoMetadata = {};

  // Extract location data if present
  if (photo.location) {
    metadata.location = photo.location;
  }

  // Extract camera data if present
  if (photo.camera) {
    metadata.camera = photo.camera;
  }

  // Extract EXIF data if present
  if (photo.exif) {
    metadata.exif = photo.exif;
  }

  // Extract tags if present
  if (photo.tags) {
    metadata.tags = photo.tags;
  }

  // Extract notes if present
  if (photo.notes) {
    metadata.notes = photo.notes;
  }

  // Extract privacy flag if present
  if (photo.isPrivate !== undefined) {
    metadata.isPrivate = photo.isPrivate;
  }

  return metadata;
}

// Create a secure photo object with encrypted metadata
async function createSecurePhoto(photo: Photo): Promise<SecurePhoto> {
  const sensitiveMetadata = extractSensitiveMetadata(photo);

  // Remove sensitive fields from the main photo object
  const securePhoto: SecurePhoto = {
    id: photo.id,
    uri: photo.uri,
    width: photo.width,
    height: photo.height,
    createdAt: photo.createdAt,
    modifiedAt: photo.modifiedAt,
    filename: photo.filename,
    isFavorite: photo.isFavorite,
    albumIds: photo.albumIds,
  };

  // Encrypt sensitive metadata if present
  if (Object.keys(sensitiveMetadata).length > 0) {
    securePhoto.metadata = await encryption.encrypt(sensitiveMetadata);
  }

  return securePhoto;
}

// Restore full photo object with decrypted metadata
async function restorePhoto(securePhoto: SecurePhoto): Promise<Photo> {
  const photo: Photo = {
    id: securePhoto.id,
    uri: securePhoto.uri,
    width: securePhoto.width,
    height: securePhoto.height,
    createdAt: securePhoto.createdAt,
    modifiedAt: securePhoto.modifiedAt,
    filename: securePhoto.filename,
    isFavorite: securePhoto.isFavorite,
    albumIds: securePhoto.albumIds,
  };

  // Decrypt and restore sensitive metadata if present
  if (securePhoto.metadata) {
    try {
      const sensitiveMetadata = await encryption.decrypt(securePhoto.metadata);

      // Merge sensitive metadata back into photo
      Object.assign(photo, sensitiveMetadata);
    } catch (error) {
      console.error("Failed to decrypt photo metadata:", error);
      // Continue without sensitive metadata
    }
  }

  return photo;
}

// Secure photo operations
export async function getPhotos(): Promise<Photo[]> {
  try {
    const data = await AsyncStorage.getItem(PHOTOS_KEY);
    if (!data) return [];

    const securePhotos: SecurePhoto[] = JSON.parse(data);
    const photos: Photo[] = [];

    for (const securePhoto of securePhotos) {
      const photo = await restorePhoto(securePhoto);
      photos.push(photo);
    }

    return photos;
  } catch (error) {
    console.error("Failed to get photos:", error);
    return [];
  }
}

export async function savePhotos(photos: Photo[]): Promise<void> {
  try {
    const securePhotos: SecurePhoto[] = [];

    for (const photo of photos) {
      const securePhoto = await createSecurePhoto(photo);
      securePhotos.push(securePhoto);
    }

    await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(securePhotos));
  } catch (error) {
    console.error("Failed to save photos:", error);
    throw error;
  }
}

export async function addPhoto(photo: Photo): Promise<void> {
  const photos = await getPhotos();
  photos.unshift(photo);
  await savePhotos(photos);
}

export async function updatePhoto(photo: Photo): Promise<void> {
  const photos = await getPhotos();
  const index = photos.findIndex((p) => p.id === photo.id);
  if (index !== -1) {
    photos[index] = photo;
    await savePhotos(photos);
  }
}

export async function deletePhoto(photoId: string): Promise<void> {
  const photos = await getPhotos();
  const filtered = photos.filter((p) => p.id !== photoId);
  await savePhotos(filtered);

  // Remove photo from all albums
  const albums = await getAlbums();
  const updatedAlbums = albums.map((album) => ({
    ...album,
    photoIds: album.photoIds.filter((id) => id !== photoId),
    coverPhotoUri:
      album.coverPhotoUri && album.photoIds.length === 0
        ? null
        : album.coverPhotoUri,
  }));
  await saveAlbums(updatedAlbums);
}

// Album operations (can be extended with encryption for album metadata)
export async function getAlbums(): Promise<Album[]> {
  try {
    const data = await AsyncStorage.getItem(ALBUMS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to get albums:", error);
    return [];
  }
}

export async function saveAlbums(albums: Album[]): Promise<void> {
  await AsyncStorage.setItem(ALBUMS_KEY, JSON.stringify(albums));
}

export async function addAlbum(album: Album): Promise<void> {
  const albums = await getAlbums();
  albums.unshift(album);
  await saveAlbums(albums);
}

export async function updateAlbum(album: Album): Promise<void> {
  const albums = await getAlbums();
  const index = albums.findIndex((a) => a.id === album.id);
  if (index !== -1) {
    albums[index] = album;
    await saveAlbums(albums);
  }
}

export async function deleteAlbum(albumId: string): Promise<void> {
  const albums = await getAlbums();
  const filtered = albums.filter((a) => a.id !== albumId);
  await saveAlbums(filtered);

  // Remove album from all photos
  const photos = await getPhotos();
  const updatedPhotos = photos.map((photo) => ({
    ...photo,
    albumIds: photo.albumIds.filter((id) => id !== albumId),
  }));
  await savePhotos(updatedPhotos);
}

// Utility functions
export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
    PHOTOS_KEY,
    ALBUMS_KEY,
    METADATA_KEY,
    // Don't remove encryption key - it should persist
  ]);
}

export async function resetEncryption(): Promise<void> {
  // Generate new encryption key and re-encrypt all data
  await AsyncStorage.removeItem(ENCRYPTION_KEY);

  // This would require re-encrypting all existing data
  // For now, just clear metadata
  await AsyncStorage.removeItem(METADATA_KEY);
}
