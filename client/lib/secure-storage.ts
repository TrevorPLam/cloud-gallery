// Secure storage with AES-256-GCM encryption for sensitive metadata.
// Key is stored in SecureStore when available (iOS/Android), else AsyncStorage.
// Encrypts location, camera, exif, tags, notes, isPrivate at rest.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system";
import { Photo, Album, StorageInfo } from "@/types";
import {
  encryptMetadata,
  decryptMetadata,
  generateEncryptionKeyHex,
} from "./client-crypto";
import { 
  isPhotoEncrypted, 
  downloadAndDecryptPhoto, 
  getOriginalFileExtension,
  generateDecryptedPhotoUri,
  cleanupDecryptedPhotos
} from "./photo-decryption";

const PHOTOS_KEY = "@photo_vault_photos";
const ALBUMS_KEY = "@photo_vault_albums";
const USER_KEY = "@photo_vault_user";
const ENCRYPTION_KEY_STORAGE = "photo_vault_metadata_key";
const METADATA_KEY = "@photo_vault_metadata";

export interface UserProfile {
  name: string;
  email: string;
  avatarUri: string | null;
}

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

/** New format: single base64 blob (nonce + ciphertext + auth tag). */
interface EncryptedMetadata {
  data: string;
}

interface SecurePhoto extends Omit<Photo, "albumIds"> {
  albumIds: string[];
  metadata?: EncryptedMetadata;
}

async function getEncryptionKey(): Promise<string> {
  try {
    let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_STORAGE);
    if (key) return key;
    key = await AsyncStorage.getItem(`@${ENCRYPTION_KEY_STORAGE}`);
    if (key) return key;
    key = generateEncryptionKeyHex();
    try {
      await SecureStore.setItemAsync(ENCRYPTION_KEY_STORAGE, key, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    } catch {
      await AsyncStorage.setItem(`@${ENCRYPTION_KEY_STORAGE}`, key);
    }
    return key;
  } catch (error) {
    console.error("Failed to get encryption key:", error);
    throw error;
  }
}

function extractSensitiveMetadata(
  photo: Partial<Photo>,
): SensitivePhotoMetadata {
  const metadata: SensitivePhotoMetadata = {};
  if (photo.location) metadata.location = photo.location;
  if (photo.camera) metadata.camera = photo.camera;
  if (photo.exif) metadata.exif = photo.exif;
  if (photo.tags) metadata.tags = photo.tags;
  if (photo.notes) metadata.notes = photo.notes;
  if (photo.isPrivate !== undefined) metadata.isPrivate = photo.isPrivate;
  return metadata;
}

async function createSecurePhoto(photo: Photo): Promise<SecurePhoto> {
  const sensitiveMetadata = extractSensitiveMetadata(photo);
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
  if (Object.keys(sensitiveMetadata).length > 0) {
    const key = await getEncryptionKey();
    const plaintext = JSON.stringify(sensitiveMetadata);
    securePhoto.metadata = { data: encryptMetadata(plaintext, key) };
  }
  return securePhoto;
}

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
  if (securePhoto.metadata?.data) {
    try {
      const key = await getEncryptionKey();
      const plaintext = decryptMetadata(securePhoto.metadata.data, key);
      const sensitiveMetadata = JSON.parse(plaintext) as SensitivePhotoMetadata;
      Object.assign(photo, sensitiveMetadata);
    } catch (error) {
      console.error("Failed to decrypt photo metadata:", error);
    }
  }
  return photo;
}

export async function getPhotos(): Promise<Photo[]> {
  try {
    const data = await AsyncStorage.getItem(PHOTOS_KEY);
    if (!data) return [];
    const securePhotos: SecurePhoto[] = JSON.parse(data);
    const photos: Photo[] = [];
    for (const securePhoto of securePhotos) {
      photos.push(await restorePhoto(securePhoto));
    }
    return photos;
  } catch (error) {
    console.error("Failed to get photos:", error);
    return [];
  }
}

/**
 * Get decrypted photos for display, handling both local and server-stored encrypted photos
 * @param includeServerPhotos - Whether to include server-stored photos
 * @returns Array of photos with decrypted URIs
 */
export async function getDecryptedPhotos(includeServerPhotos: boolean = false): Promise<Photo[]> {
  try {
    // Get local photos first
    const localPhotos = await getPhotos();
    
    if (!includeServerPhotos) {
      return localPhotos;
    }

    // TODO: Integrate with server API to get server-stored photos
    // For now, return local photos
    return localPhotos;
  } catch (error) {
    console.error("Failed to get decrypted photos:", error);
    return [];
  }
}

/**
 * Get a decrypted photo URI for display
 * @param photo - Photo object (can be encrypted or unencrypted)
 * @returns Local URI of the decrypted photo
 */
export async function getDecryptedPhotoUri(photo: Photo): Promise<string> {
  try {
    // If photo is not encrypted, return original URI
    if (!isPhotoEncrypted(photo)) {
      return photo.uri;
    }

    // For encrypted photos, check if we already have a decrypted version
    const originalExtension = getOriginalFileExtension(photo);
    const decryptedUri = generateDecryptedPhotoUri(photo.id, originalExtension);
    
    // Check if decrypted version already exists
    const info = await FileSystem.getInfoAsync(decryptedUri);
    if (info.exists) {
      return decryptedUri;
    }

    // Download and decrypt the photo
    return await downloadAndDecryptPhoto(
      {
        id: photo.id,
        uri: photo.uri,
        encrypted: photo.encrypted || false,
        encryptionMetadata: photo.encryptionMetadata,
        originalMimeType: photo.mimeType,
      },
      decryptedUri
    );
  } catch (error) {
    console.error("Failed to get decrypted photo URI:", error);
    throw error;
  }
}

export async function savePhotos(photos: Photo[]): Promise<void> {
  const securePhotos: SecurePhoto[] = [];
  for (const photo of photos) {
    securePhotos.push(await createSecurePhoto(photo));
  }
  await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(securePhotos));
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
  const albums = await getAlbums();
  const updatedAlbums = albums.map((album) => ({
    ...album,
    photoIds: album.photoIds.filter((id) => id !== photoId),
    coverPhotoUri:
      album.photoIds[0] === photoId
        ? filtered.find((p) => album.photoIds.includes(p.id))?.uri || null
        : album.coverPhotoUri,
  }));
  await saveAlbums(updatedAlbums);
}

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
  const photos = await getPhotos();
  const updatedPhotos = photos.map((photo) => ({
    ...photo,
    albumIds: photo.albumIds.filter((id) => id !== albumId),
  }));
  await savePhotos(updatedPhotos);
}

export async function toggleFavorite(photoId: string): Promise<Photo | null> {
  const photos = await getPhotos();
  const photoIndex = photos.findIndex((p) => p.id === photoId);
  if (photoIndex === -1) return null;
  photos[photoIndex].isFavorite = !photos[photoIndex].isFavorite;
  await savePhotos(photos);
  return photos[photoIndex];
}

export async function createAlbum(title: string): Promise<Album> {
  const albums = await getAlbums();
  const newAlbum: Album = {
    id: Date.now().toString(),
    title,
    coverPhotoUri: null,
    photoIds: [],
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
  albums.unshift(newAlbum);
  await saveAlbums(albums);
  return newAlbum;
}

export async function addPhotosToAlbum(
  albumId: string,
  photoIds: string[],
): Promise<void> {
  const albums = await getAlbums();
  const photos = await getPhotos();
  const albumIndex = albums.findIndex((a) => a.id === albumId);
  if (albumIndex === -1) return;
  const existingIds = new Set(albums[albumIndex].photoIds);
  const newIds = photoIds.filter((id) => !existingIds.has(id));
  albums[albumIndex].photoIds = [...albums[albumIndex].photoIds, ...newIds];
  albums[albumIndex].modifiedAt = Date.now();
  if (!albums[albumIndex].coverPhotoUri && newIds.length > 0) {
    const coverPhoto = photos.find((p) => p.id === newIds[0]);
    if (coverPhoto) albums[albumIndex].coverPhotoUri = coverPhoto.uri;
  }
  await saveAlbums(albums);
  const updatedPhotos = photos.map((photo) => {
    if (newIds.includes(photo.id)) {
      return { ...photo, albumIds: [...photo.albumIds, albumId] };
    }
    return photo;
  });
  await savePhotos(updatedPhotos);
}

export async function removePhotoFromAlbum(
  albumId: string,
  photoId: string,
): Promise<void> {
  const albums = await getAlbums();
  const photos = await getPhotos();
  const albumIndex = albums.findIndex((a) => a.id === albumId);
  if (albumIndex === -1) return;
  albums[albumIndex].photoIds = albums[albumIndex].photoIds.filter(
    (id) => id !== photoId,
  );
  albums[albumIndex].modifiedAt = Date.now();
  if (
    albums[albumIndex].coverPhotoUri ===
    photos.find((p) => p.id === photoId)?.uri
  ) {
    const newCover = photos.find((p) =>
      albums[albumIndex].photoIds.includes(p.id),
    );
    albums[albumIndex].coverPhotoUri = newCover?.uri || null;
  }
  await saveAlbums(albums);
  const updatedPhotos = photos.map((photo) => {
    if (photo.id === photoId) {
      return {
        ...photo,
        albumIds: photo.albumIds.filter((id) => id !== albumId),
      };
    }
    return photo;
  });
  await savePhotos(updatedPhotos);
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const photos = await getPhotos();
  const albums = await getAlbums();
  const usedBytes = photos.reduce(
    (acc, photo) => acc + (photo.width * photo.height * 3) / 10,
    0,
  );
  return {
    usedBytes,
    totalBytes: 15 * 1024 * 1024 * 1024,
    photoCount: photos.length,
    albumCount: albums.length,
  };
}

export async function getUserProfile(): Promise<UserProfile> {
  try {
    const data = await AsyncStorage.getItem(USER_KEY);
    return data
      ? JSON.parse(data)
      : { name: "Guest User", email: "guest@example.com", avatarUri: null };
  } catch {
    return { name: "Guest User", email: "guest@example.com", avatarUri: null };
  }
}

export async function saveUserProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(profile));
}

export function groupPhotosByDate(
  photos: Photo[],
): { title: string; data: Photo[] }[] {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStart = yesterday.getTime();
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastWeekStart = lastWeek.getTime();
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const lastMonthStart = lastMonth.getTime();
  const groups: Record<string, Photo[]> = {};
  photos.forEach((photo) => {
    let groupTitle: string;
    const photoTime = photo.createdAt;
    if (photoTime >= todayStart) groupTitle = "Today";
    else if (photoTime >= yesterdayStart) groupTitle = "Yesterday";
    else if (photoTime >= lastWeekStart) groupTitle = "Last 7 Days";
    else if (photoTime >= lastMonthStart) groupTitle = "Last Month";
    else {
      const date = new Date(photoTime);
      groupTitle = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    if (!groups[groupTitle]) groups[groupTitle] = [];
    groups[groupTitle].push(photo);
  });
  const order = ["Today", "Yesterday", "Last 7 Days", "Last Month"];
  return Object.entries(groups)
    .sort(([a], [b]) => {
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return b.localeCompare(a);
    })
    .map(([title, data]) => ({ title, data }));
}

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([
    PHOTOS_KEY,
    ALBUMS_KEY,
    METADATA_KEY,
    USER_KEY,
  ]);
}

export async function resetEncryption(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ENCRYPTION_KEY_STORAGE);
  } catch {
    // ignore
  }
  await AsyncStorage.removeItem(`@${ENCRYPTION_KEY_STORAGE}`);
  await AsyncStorage.removeItem(METADATA_KEY);
}
