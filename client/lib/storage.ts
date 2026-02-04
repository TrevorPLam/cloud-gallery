import AsyncStorage from "@react-native-async-storage/async-storage";
import { Photo, Album, StorageInfo } from "@/types";

const PHOTOS_KEY = "@photo_vault_photos";
const ALBUMS_KEY = "@photo_vault_albums";
const USER_KEY = "@photo_vault_user";

export interface UserProfile {
  name: string;
  email: string;
  avatarUri: string | null;
}

export async function getPhotos(): Promise<Photo[]> {
  try {
    const data = await AsyncStorage.getItem(PHOTOS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function savePhotos(photos: Photo[]): Promise<void> {
  await AsyncStorage.setItem(PHOTOS_KEY, JSON.stringify(photos));
}

export async function addPhoto(photo: Photo): Promise<void> {
  const photos = await getPhotos();
  photos.unshift(photo);
  await savePhotos(photos);
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

export async function toggleFavorite(photoId: string): Promise<Photo | null> {
  const photos = await getPhotos();
  const photoIndex = photos.findIndex((p) => p.id === photoId);
  if (photoIndex === -1) return null;

  photos[photoIndex].isFavorite = !photos[photoIndex].isFavorite;
  await savePhotos(photos);
  return photos[photoIndex];
}

export async function getAlbums(): Promise<Album[]> {
  try {
    const data = await AsyncStorage.getItem(ALBUMS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export async function saveAlbums(albums: Album[]): Promise<void> {
  await AsyncStorage.setItem(ALBUMS_KEY, JSON.stringify(albums));
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

export async function deleteAlbum(albumId: string): Promise<void> {
  const albums = await getAlbums();
  const filtered = albums.filter((a) => a.id !== albumId);
  await saveAlbums(filtered);
}

export async function addPhotosToAlbum(
  albumId: string,
  photoIds: string[]
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
    if (coverPhoto) {
      albums[albumIndex].coverPhotoUri = coverPhoto.uri;
    }
  }

  await saveAlbums(albums);

  const updatedPhotos = photos.map((photo) => {
    if (newIds.includes(photo.id)) {
      return {
        ...photo,
        albumIds: [...photo.albumIds, albumId],
      };
    }
    return photo;
  });
  await savePhotos(updatedPhotos);
}

export async function removePhotoFromAlbum(
  albumId: string,
  photoId: string
): Promise<void> {
  const albums = await getAlbums();
  const photos = await getPhotos();
  const albumIndex = albums.findIndex((a) => a.id === albumId);
  if (albumIndex === -1) return;

  albums[albumIndex].photoIds = albums[albumIndex].photoIds.filter(
    (id) => id !== photoId
  );
  albums[albumIndex].modifiedAt = Date.now();

  if (
    albums[albumIndex].coverPhotoUri ===
    photos.find((p) => p.id === photoId)?.uri
  ) {
    const newCover = photos.find((p) =>
      albums[albumIndex].photoIds.includes(p.id)
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

  const usedBytes = photos.reduce((acc, photo) => {
    return acc + (photo.width * photo.height * 3) / 10;
  }, 0);

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

export async function clearAllData(): Promise<void> {
  await AsyncStorage.multiRemove([PHOTOS_KEY, ALBUMS_KEY, USER_KEY]);
}

export function groupPhotosByDate(photos: Photo[]): { title: string; data: Photo[] }[] {
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

    if (photoTime >= todayStart) {
      groupTitle = "Today";
    } else if (photoTime >= yesterdayStart) {
      groupTitle = "Yesterday";
    } else if (photoTime >= lastWeekStart) {
      groupTitle = "Last 7 Days";
    } else if (photoTime >= lastMonthStart) {
      groupTitle = "Last Month";
    } else {
      const date = new Date(photoTime);
      groupTitle = date.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }

    if (!groups[groupTitle]) {
      groups[groupTitle] = [];
    }
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
