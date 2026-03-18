// AI-META-BEGIN
// AI-META: Single storage abstraction; delegates to encrypted (secure-storage) or plain AsyncStorage
// OWNERSHIP: client/lib (data persistence)
// ENTRYPOINTS: Imported by all screens and components needing data access
// DEPENDENCIES: @react-native-async-storage/async-storage, @/lib/secure-storage, @/types
// AI-META-END

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Photo, Album, StorageInfo } from "@/types";
import * as secureStorage from "./secure-storage";

const PHOTOS_KEY = "@photo_vault_photos";
const ALBUMS_KEY = "@photo_vault_albums";
const USER_KEY = "@photo_vault_user";

/** Use encrypted storage (AES-256-GCM) for sensitive metadata. Set EXPO_PUBLIC_USE_ENCRYPTED_STORAGE=false for plain only. */
export const USE_ENCRYPTED_STORAGE =
  typeof process !== "undefined" &&
  process.env?.EXPO_PUBLIC_USE_ENCRYPTED_STORAGE === "false"
    ? false
    : true;

export interface UserProfile {
  name: string;
  email: string;
  avatarUri: string | null;
}

// ─── Plain implementation (no encryption) ─────────────────────────────────

async function plainGetPhotos(): Promise<Photo[]> {
  try {
    const data = await AsyncStorage.getItem(PHOTOS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function plainSavePhotos(photos: Photo[]): Promise<void> {
  await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(photos));
}

async function plainGetAlbums(): Promise<Album[]> {
  try {
    const data = await AsyncStorage.getItem(ALBUMS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

async function plainSaveAlbums(albums: Album[]): Promise<void> {
  await AsyncStorage.setItem(ALBUMS_KEY, JSON.stringify(albums));
}

// ─── Public API (delegates to secure or plain) ─────────────────────────────

export async function getPhotos(): Promise<Photo[]> {
  return USE_ENCRYPTED_STORAGE ? secureStorage.getPhotos() : plainGetPhotos();
}

export async function savePhotos(photos: Photo[]): Promise<void> {
  if (USE_ENCRYPTED_STORAGE) {
    await secureStorage.savePhotos(photos);
  } else {
    await plainSavePhotos(photos);
  }
}

export async function addPhoto(photo: Photo): Promise<void> {
  if (USE_ENCRYPTED_STORAGE) {
    await secureStorage.addPhoto(photo);
    return;
  }
  const photos = await plainGetPhotos();
  photos.unshift(photo);
  await plainSavePhotos(photos);
}

export async function deletePhoto(photoId: string): Promise<void> {
  if (USE_ENCRYPTED_STORAGE) {
    await secureStorage.deletePhoto(photoId);
    return;
  }
  const photos = await plainGetPhotos();
  const filtered = photos.filter((p) => p.id !== photoId);
  await plainSavePhotos(filtered);
  const albums = await plainGetAlbums();
  const updatedAlbums = albums.map((album) => ({
    ...album,
    photoIds: album.photoIds.filter((id) => id !== photoId),
    coverPhotoUri:
      album.photoIds[0] === photoId
        ? filtered.find((p) => album.photoIds.includes(p.id))?.uri || null
        : album.coverPhotoUri,
  }));
  await plainSaveAlbums(updatedAlbums);
}

export async function toggleFavorite(photoId: string): Promise<Photo | null> {
  if (USE_ENCRYPTED_STORAGE) return secureStorage.toggleFavorite(photoId);
  const photos = await plainGetPhotos();
  const photoIndex = photos.findIndex((p) => p.id === photoId);
  if (photoIndex === -1) return null;
  photos[photoIndex].isFavorite = !photos[photoIndex].isFavorite;
  await plainSavePhotos(photos);
  return photos[photoIndex];
}

export async function getAlbums(): Promise<Album[]> {
  return USE_ENCRYPTED_STORAGE ? secureStorage.getAlbums() : plainGetAlbums();
}

export async function saveAlbums(albums: Album[]): Promise<void> {
  if (USE_ENCRYPTED_STORAGE) {
    await secureStorage.saveAlbums(albums);
  } else {
    await plainSaveAlbums(albums);
  }
}

export async function createAlbum(title: string): Promise<Album> {
  if (USE_ENCRYPTED_STORAGE) return secureStorage.createAlbum(title);
  const albums = await plainGetAlbums();
  const newAlbum: Album = {
    id: Date.now().toString(),
    title,
    coverPhotoUri: null,
    photoIds: [],
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
  albums.unshift(newAlbum);
  await plainSaveAlbums(albums);
  return newAlbum;
}

export async function deleteAlbum(albumId: string): Promise<void> {
  if (USE_ENCRYPTED_STORAGE) {
    await secureStorage.deleteAlbum(albumId);
    return;
  }
  const albums = await plainGetAlbums();
  const filtered = albums.filter((a) => a.id !== albumId);
  await plainSaveAlbums(filtered);
}

export async function getPhotosByPerceptualHash(perceptualHash: string): Promise<Photo[]> {
  const photos = await getPhotos();
  return photos.filter(photo => photo.perceptualHash === perceptualHash);
}

export async function addPhotosToAlbum(
  albumId: string,
  photoIds: string[],
): Promise<void> {
  if (USE_ENCRYPTED_STORAGE) {
    await secureStorage.addPhotosToAlbum(albumId, photoIds);
    return;
  }
  const albums = await plainGetAlbums();
  const photos = await plainGetPhotos();
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
  await plainSaveAlbums(albums);
  const updatedPhotos = photos.map((photo) =>
    newIds.includes(photo.id)
      ? { ...photo, albumIds: [...photo.albumIds, albumId] }
      : photo,
  );
  await plainSavePhotos(updatedPhotos);
}

export async function removePhotoFromAlbum(
  albumId: string,
  photoId: string,
): Promise<void> {
  if (USE_ENCRYPTED_STORAGE) {
    await secureStorage.removePhotoFromAlbum(albumId, photoId);
    return;
  }
  const albums = await plainGetAlbums();
  const photos = await plainGetPhotos();
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
  await plainSaveAlbums(albums);
  const updatedPhotos = photos.map((photo) =>
    photo.id === photoId
      ? { ...photo, albumIds: photo.albumIds.filter((id) => id !== albumId) }
      : photo,
  );
  await plainSavePhotos(updatedPhotos);
}

export async function getStorageInfo(): Promise<StorageInfo> {
  if (USE_ENCRYPTED_STORAGE) return secureStorage.getStorageInfo();
  const photos = await plainGetPhotos();
  const albums = await plainGetAlbums();
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
  if (USE_ENCRYPTED_STORAGE) return secureStorage.getUserProfile();
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
  if (USE_ENCRYPTED_STORAGE) {
    await secureStorage.saveUserProfile(profile);
  } else {
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(profile));
  }
}

export async function clearAllData(): Promise<void> {
  if (USE_ENCRYPTED_STORAGE) {
    await secureStorage.clearAllData();
  } else {
    await AsyncStorage.multiRemove([PHOTOS_KEY, ALBUMS_KEY, USER_KEY]);
  }
}

export function groupPhotosByDate(
  photos: Photo[],
): { title: string; data: Photo[] }[] {
  if (USE_ENCRYPTED_STORAGE) return secureStorage.groupPhotosByDate(photos);
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
