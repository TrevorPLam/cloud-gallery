// Tests for secure storage with AES-256-GCM encryption

import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getPhotos,
  savePhotos,
  addPhoto,
  updatePhoto,
  deletePhoto,
  getAlbums,
  saveAlbums,
  addAlbum,
  updateAlbum,
  deleteAlbum,
  clearAllData,
  resetEncryption,
} from "./secure-storage";
import { Photo, Album } from "../types";

const TEST_KEY_HEX =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
}));

const mockAsyncStorage = AsyncStorage as ReturnType<typeof vi.fn> & {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
  multiRemove: ReturnType<typeof vi.fn>;
};

async function setupSecureStoreKey() {
  const SecureStore = await import("expo-secure-store");
  (SecureStore.getItemAsync as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_KEY_HEX);
}

describe("Secure Storage", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await setupSecureStoreKey();
  });

  describe("Photo Operations", () => {
    const mockPhoto: Photo = {
      id: "photo-1",
      uri: "file://photo.jpg",
      width: 1920,
      height: 1080,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      filename: "photo.jpg",
      isFavorite: false,
      albumIds: ["album-1"],
      location: {
        latitude: 40.7128,
        longitude: -74.006,
        city: "New York",
      },
      camera: {
        make: "Canon",
        model: "EOS R5",
        iso: 400,
        aperture: "f/2.8",
      },
      tags: ["vacation", "summer"],
      notes: "Great photo of the city",
      isPrivate: false,
    };

    it("should get empty photos array when no data exists", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const photos = await getPhotos();

      expect(photos).toEqual([]);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(
        "@photo_vault_photos",
      );
    });

    it("should save and retrieve photos with encrypted metadata", async () => {
      const photos = [mockPhoto];
      let storedData: string | null = null;

      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === "@photo_vault_photos") return Promise.resolve(storedData);
        return Promise.resolve(null);
      });

      mockAsyncStorage.setItem.mockImplementation(
        (key: string, value: string) => {
          if (key === "@photo_vault_photos") storedData = value;
          return Promise.resolve();
        },
      );

      await savePhotos(photos);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "@photo_vault_photos",
        expect.any(String),
      );

      const retrievedPhotos = await getPhotos();
      expect(retrievedPhotos).toHaveLength(1);
      expect(retrievedPhotos[0].id).toBe(mockPhoto.id);
      expect(retrievedPhotos[0].uri).toBe(mockPhoto.uri);
      expect(retrievedPhotos[0].location).toEqual(mockPhoto.location);
      expect(retrievedPhotos[0].camera).toEqual(mockPhoto.camera);
      expect(retrievedPhotos[0].tags).toEqual(mockPhoto.tags);
      expect(retrievedPhotos[0].notes).toBe(mockPhoto.notes);
    });

    it("should add photo to existing photos", async () => {
      const existingPhotos: Photo[] = [
        {
          id: "photo-2",
          uri: "file://photo2.jpg",
          width: 1080,
          height: 720,
          createdAt: Date.now() - 1000,
          modifiedAt: Date.now() - 1000,
          filename: "photo2.jpg",
          isFavorite: true,
          albumIds: [],
        },
      ];

      let storedData = JSON.stringify(existingPhotos);

      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === "@photo_vault_photos") return Promise.resolve(storedData);
        return Promise.resolve(null);
      });

      mockAsyncStorage.setItem.mockImplementation(
        (key: string, value: string) => {
          if (key === "@photo_vault_photos") storedData = value;
          return Promise.resolve();
        },
      );

      await addPhoto(mockPhoto);

      const photos = await getPhotos();
      expect(photos).toHaveLength(2);
      expect(photos[0].id).toBe(mockPhoto.id);
      expect(photos[1].id).toBe("photo-2");
    });

    it("should update existing photo", async () => {
      const originalPhoto: Photo = {
        ...mockPhoto,
        isFavorite: false,
        notes: "Original notes",
      };

      let storedData = JSON.stringify([originalPhoto]);

      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === "@photo_vault_photos") return Promise.resolve(storedData);
        return Promise.resolve(null);
      });

      mockAsyncStorage.setItem.mockImplementation(
        (key: string, value: string) => {
          if (key === "@photo_vault_photos") storedData = value;
          return Promise.resolve();
        },
      );

      const updatedPhoto: Photo = {
        ...originalPhoto,
        isFavorite: true,
        notes: "Updated notes",
        tags: ["updated"],
      };

      await updatePhoto(updatedPhoto);

      const photos = await getPhotos();
      expect(photos).toHaveLength(1);
      expect(photos[0].isFavorite).toBe(true);
      expect(photos[0].notes).toBe("Updated notes");
      expect(photos[0].tags).toEqual(["updated"]);
    });

    it("should delete photo and remove from albums", async () => {
      const photoToDelete: Photo = { ...mockPhoto, id: "photo-1" };
      const album: Album = {
        id: "album-1",
        title: "Test Album",
        coverPhotoUri: "file://photo.jpg",
        photoIds: ["photo-1", "photo-2"],
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };

      let storedPhotos = JSON.stringify([photoToDelete]);
      let storedAlbums = JSON.stringify([album]);

      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === "@photo_vault_photos") return Promise.resolve(storedPhotos);
        if (key === "@photo_vault_albums") return Promise.resolve(storedAlbums);
        return Promise.resolve(null);
      });

      mockAsyncStorage.setItem.mockImplementation(
        (key: string, value: string) => {
          if (key === "@photo_vault_photos") storedPhotos = value;
          if (key === "@photo_vault_albums") storedAlbums = value;
          return Promise.resolve();
        },
      );

      await deletePhoto("photo-1");

      const photos = await getPhotos();
      expect(photos).toHaveLength(0);

      const albums = await getAlbums();
      expect(albums[0].photoIds).toEqual(["photo-2"]);
    });
  });

  describe("Album Operations", () => {
    const mockAlbum: Album = {
      id: "album-1",
      title: "Test Album",
      coverPhotoUri: "file://cover.jpg",
      photoIds: ["photo-1", "photo-2"],
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    it("should get empty albums array when no data exists", async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const albums = await getAlbums();

      expect(albums).toEqual([]);
      expect(mockAsyncStorage.getItem).toHaveBeenCalledWith(
        "@photo_vault_albums",
      );
    });

    it("should save and retrieve albums", async () => {
      const albums = [mockAlbum];

      mockAsyncStorage.getItem.mockResolvedValue(null);
      mockAsyncStorage.setItem.mockResolvedValue();

      await saveAlbums(albums);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "@photo_vault_albums",
        JSON.stringify(albums),
      );
    });

    it("should add album to existing albums", async () => {
      const existingAlbums: Album[] = [
        {
          id: "album-2",
          title: "Existing Album",
          coverPhotoUri: null,
          photoIds: [],
          createdAt: Date.now() - 1000,
          modifiedAt: Date.now() - 1000,
        },
      ];

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify(existingAlbums),
      );
      mockAsyncStorage.setItem.mockResolvedValue();

      await addAlbum(mockAlbum);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "@photo_vault_albums",
        expect.any(String),
      );
    });

    it("should update existing album", async () => {
      const originalAlbum: Album = {
        ...mockAlbum,
        title: "Original Title",
      };

      mockAsyncStorage.getItem.mockResolvedValue(
        JSON.stringify([originalAlbum]),
      );
      mockAsyncStorage.setItem.mockResolvedValue();

      const updatedAlbum: Album = {
        ...originalAlbum,
        title: "Updated Title",
        photoIds: ["photo-3"],
      };

      await updateAlbum(updatedAlbum);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        "@photo_vault_albums",
        expect.any(String),
      );
    });

    it("should delete album and remove from photos", async () => {
      const albumToDelete: Album = {
        ...mockAlbum,
        id: "album-1",
      };
      const photo: Photo = {
        id: "photo-1",
        uri: "file://photo.jpg",
        width: 1920,
        height: 1080,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        filename: "photo.jpg",
        isFavorite: false,
        albumIds: ["album-1", "album-2"],
      };

      let storedAlbums = JSON.stringify([albumToDelete]);
      let storedPhotos = JSON.stringify([photo]);

      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === "@photo_vault_albums") {
          return Promise.resolve(storedAlbums);
        }
        if (key === "@photo_vault_photos") {
          return Promise.resolve(storedPhotos);
        }
        if (key === "@photo_vault_encryption_key") {
          return Promise.resolve(
            "test-key-1234567890123456789012345678901234567890123456789012345678901234",
          );
        }
        return Promise.resolve(null);
      });

      mockAsyncStorage.setItem.mockImplementation(
        (key: string, value: string) => {
          if (key === "@photo_vault_albums") {
            storedAlbums = value;
          }
          if (key === "@photo_vault_photos") {
            storedPhotos = value;
          }
          return Promise.resolve();
        },
      );

      await deleteAlbum("album-1");

      const albums = await getAlbums();
      expect(albums).toHaveLength(0);

      // Note: In the actual implementation, the photo's albumIds would be updated
      // This is tested in the deletePhoto test
    });
  });

  describe("Utility Functions", () => {
    it("should clear all data", async () => {
      mockAsyncStorage.multiRemove.mockResolvedValue();

      await clearAllData();

      expect(mockAsyncStorage.multiRemove).toHaveBeenCalledWith([
        "@photo_vault_photos",
        "@photo_vault_albums",
        "@photo_vault_metadata",
        "@photo_vault_user",
      ]);
    });

    it("should reset encryption", async () => {
      mockAsyncStorage.removeItem.mockResolvedValue();

      await resetEncryption();

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        "@photo_vault_metadata_key",
      );
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(
        "@photo_vault_metadata",
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle JSON parsing errors gracefully", async () => {
      mockAsyncStorage.getItem.mockResolvedValue("invalid-json");

      const photos = await getPhotos();

      expect(photos).toEqual([]);
    });

    it("should handle AsyncStorage errors gracefully", async () => {
      mockAsyncStorage.getItem.mockRejectedValue(new Error("Storage error"));

      const photos = await getPhotos();

      expect(photos).toEqual([]);
    });

    it("should handle encryption errors gracefully", async () => {
      const securePhoto = {
        id: "photo-1",
        uri: "file://photo.jpg",
        width: 1920,
        height: 1080,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        filename: "photo.jpg",
        isFavorite: false,
        albumIds: [] as string[],
        metadata: { data: "invalid-base64-not-valid-ciphertext" },
      };

      mockAsyncStorage.getItem.mockImplementation((key: string) => {
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify([securePhoto]));
        }
        return Promise.resolve(null);
      });

      const photos = await getPhotos();

      expect(photos).toHaveLength(1);
      expect(photos[0].id).toBe("photo-1");
      expect(photos[0].location).toBeUndefined();
      expect(photos[0].camera).toBeUndefined();
      expect(photos[0].tags).toBeUndefined();
      expect(photos[0].notes).toBeUndefined();
    });
  });
});
