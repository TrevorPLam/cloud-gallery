import { describe, it, expect, beforeEach, vi } from "vitest";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getPhotos,
  savePhotos,
  addPhoto,
  deletePhoto,
  toggleFavorite,
  getAlbums,
  saveAlbums,
  createAlbum,
  deleteAlbum,
  addPhotosToAlbum,
  removePhotoFromAlbum,
  getStorageInfo,
  getUserProfile,
  saveUserProfile,
  clearAllData,
  groupPhotosByDate,
  type UserProfile,
} from "./storage";
import type { Photo, Album } from "../types";

// Helper function to create Photo objects with all required fields
const createPhoto = (overrides: Partial<Photo> = {}): Photo => ({
  id: "1",
  uri: "photo1.jpg",
  width: 100,
  height: 100,
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  filename: "photo1.jpg",
  isFavorite: false,
  albumIds: [],
  ...overrides,
});

describe("Photo Storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPhotos", () => {
    it("should return empty array when no photos exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const photos = await getPhotos();
      expect(photos).toEqual([]);
    });

    it("should return parsed photos from AsyncStorage", async () => {
      const mockPhotos: Photo[] = [createPhoto()];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(mockPhotos),
      );

      const photos = await getPhotos();
      expect(photos).toEqual(mockPhotos);
    });

    it("should return empty array on parse error", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("invalid json");

      const photos = await getPhotos();
      expect(photos).toEqual([]);
    });

    it("should handle AsyncStorage errors", async () => {
      vi.mocked(AsyncStorage.getItem).mockRejectedValue(
        new Error("Storage error"),
      );

      const photos = await getPhotos();
      expect(photos).toEqual([]);
    });
  });

  describe("savePhotos", () => {
    it("should save photos to AsyncStorage", async () => {
      const mockPhotos: Photo[] = [createPhoto()];

      await savePhotos(mockPhotos);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@photo_vault_photos",
        JSON.stringify(mockPhotos),
      );
    });

    it("should save empty array", async () => {
      await savePhotos([]);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@photo_vault_photos",
        "[]",
      );
    });
  });

  describe("addPhoto", () => {
    it("should add photo to beginning of list", async () => {
      const existingPhotos: Photo[] = [
        createPhoto({ id: "1", createdAt: 1000, modifiedAt: 1000 }),
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(existingPhotos),
      );

      const newPhoto: Photo = createPhoto({
        id: "2",
        uri: "photo2.jpg",
        width: 200,
        height: 200,
        createdAt: 2000,
        modifiedAt: 2000,
      });

      await addPhoto(newPhoto);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@photo_vault_photos",
        JSON.stringify([newPhoto, ...existingPhotos]),
      );
    });

    it("should add photo to empty list", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const newPhoto: Photo = createPhoto();

      await addPhoto(newPhoto);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@photo_vault_photos",
        JSON.stringify([newPhoto]),
      );
    });
  });

  describe("deletePhoto", () => {
    it("should remove photo from list", async () => {
      const photos: Photo[] = [
        createPhoto({
          id: "1",
          createdAt: 1000,
          modifiedAt: 1000,
          albumIds: [],
        }),
        createPhoto({
          id: "2",
          uri: "photo2.jpg",
          width: 200,
          height: 200,
          createdAt: 2000,
          modifiedAt: 2000,
          albumIds: [],
        }),
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        if (key === "@photo_vault_albums") {
          return Promise.resolve("[]");
        }
        return Promise.resolve(null);
      });

      await deletePhoto("1");

      const savedPhotosCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_photos");
      expect(savedPhotosCall).toBeDefined();
      const savedPhotos = JSON.parse(savedPhotosCall![1]);
      expect(savedPhotos).toHaveLength(1);
      expect(savedPhotos[0].id).toBe("2");
    });

    it("should remove photo from albums", async () => {
      const photos: Photo[] = [
        createPhoto({
          id: "1",
          createdAt: 1000,
          modifiedAt: 1000,
          albumIds: ["album1"],
        }),
      ];
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: ["1", "2"],
          coverPhotoUri: "photo1.jpg",
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        return Promise.resolve(null);
      });

      await deletePhoto("1");

      const savedAlbumsCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_albums");
      expect(savedAlbumsCall).toBeDefined();
      const savedAlbums = JSON.parse(savedAlbumsCall![1]);
      expect(savedAlbums[0].photoIds).toEqual(["2"]);
    });

    it("should update album cover when deleted photo is cover", async () => {
      const photos: Photo[] = [
        {
          id: "1",
          uri: "photo1.jpg",
          width: 100,
          height: 100,
          createdAt: 1000,
          isFavorite: false,
          albumIds: ["album1"],
        },
        {
          id: "2",
          uri: "photo2.jpg",
          width: 200,
          height: 200,
          createdAt: 2000,
          isFavorite: false,
          albumIds: ["album1"],
        },
      ];
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: ["1", "2"],
          coverPhotoUri: "photo1.jpg",
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        return Promise.resolve(null);
      });

      await deletePhoto("1");

      const savedAlbumsCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_albums");
      const savedAlbums = JSON.parse(savedAlbumsCall![1]);
      expect(savedAlbums[0].coverPhotoUri).toBe("photo2.jpg");
    });

    it("should set cover to null when no photos left", async () => {
      const photos: Photo[] = [
        {
          id: "1",
          uri: "photo1.jpg",
          width: 100,
          height: 100,
          createdAt: 1000,
          isFavorite: false,
          albumIds: ["album1"],
        },
      ];
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: ["1"],
          coverPhotoUri: "photo1.jpg",
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        return Promise.resolve(null);
      });

      await deletePhoto("1");

      const savedAlbumsCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_albums");
      const savedAlbums = JSON.parse(savedAlbumsCall![1]);
      expect(savedAlbums[0].coverPhotoUri).toBe(null);
    });

    it("should not change cover when deleted photo is not cover", async () => {
      const photos: Photo[] = [
        {
          id: "1",
          uri: "photo1.jpg",
          width: 100,
          height: 100,
          createdAt: 1000,
          isFavorite: false,
          albumIds: ["album1"],
        },
        {
          id: "2",
          uri: "photo2.jpg",
          width: 200,
          height: 200,
          createdAt: 2000,
          isFavorite: false,
          albumIds: ["album1"],
        },
      ];
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: ["1", "2"],
          coverPhotoUri: "photo1.jpg",
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        return Promise.resolve(null);
      });

      await deletePhoto("2");

      const savedAlbumsCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_albums");
      const savedAlbums = JSON.parse(savedAlbumsCall![1]);
      expect(savedAlbums[0].coverPhotoUri).toBe("photo1.jpg");
    });
  });

  describe("toggleFavorite", () => {
    it("should toggle photo favorite status", async () => {
      const photos: Photo[] = [
        createPhoto({
          id: "1",
          createdAt: 1000,
          modifiedAt: 1000,
          albumIds: [],
        }),
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(photos));

      const result = await toggleFavorite("1");

      expect(result).not.toBeNull();
      expect(result?.isFavorite).toBe(true);

      const savedPhotosCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const savedPhotos = JSON.parse(savedPhotosCall[1]);
      expect(savedPhotos[0].isFavorite).toBe(true);
    });

    it("should toggle from true to false", async () => {
      const photos: Photo[] = [
        createPhoto({
          id: "1",
          createdAt: 1000,
          modifiedAt: 1000,
          albumIds: [],
          isFavorite: true,
        }),
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(photos));

      const result = await toggleFavorite("1");

      expect(result?.isFavorite).toBe(false);
    });

    it("should return null for non-existent photo", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("[]");

      const result = await toggleFavorite("nonexistent");

      expect(result).toBeNull();
    });
  });
});

describe("Album Storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAlbums", () => {
    it("should return empty array when no albums exist", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const albums = await getAlbums();
      expect(albums).toEqual([]);
    });

    it("should return parsed albums from AsyncStorage", async () => {
      const mockAlbums: Album[] = [
        {
          id: "1",
          title: "Album 1",
          photoIds: [],
          coverPhotoUri: null,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(mockAlbums),
      );

      const albums = await getAlbums();
      expect(albums).toEqual(mockAlbums);
    });

    it("should return empty array on error", async () => {
      vi.mocked(AsyncStorage.getItem).mockRejectedValue(
        new Error("Storage error"),
      );

      const albums = await getAlbums();
      expect(albums).toEqual([]);
    });
  });

  describe("saveAlbums", () => {
    it("should save albums to AsyncStorage", async () => {
      const mockAlbums: Album[] = [
        {
          id: "1",
          title: "Album 1",
          photoIds: [],
          coverPhotoUri: null,
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];

      await saveAlbums(mockAlbums);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@photo_vault_albums",
        JSON.stringify(mockAlbums),
      );
    });
  });

  describe("createAlbum", () => {
    it("should create new album with generated ID", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("[]");
      const dateSpy = vi.spyOn(Date, "now").mockReturnValue(12345);

      const album = await createAlbum("My Album");

      expect(album.title).toBe("My Album");
      expect(album.id).toBe("12345");
      expect(album.photoIds).toEqual([]);
      expect(album.coverPhotoUri).toBe(null);
      expect(album.createdAt).toBe(12345);
      expect(album.modifiedAt).toBe(12345);

      dateSpy.mockRestore();
    });

    it("should add album to beginning of list", async () => {
      const existing: Album[] = [
        {
          id: "1",
          title: "Existing",
          photoIds: [],
          coverPhotoUri: null,
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(existing),
      );

      await createAlbum("New Album");

      const savedCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const saved = JSON.parse(savedCall[1]);
      expect(saved).toHaveLength(2);
      expect(saved[0].title).toBe("New Album");
      expect(saved[1].title).toBe("Existing");
    });
  });

  describe("deleteAlbum", () => {
    it("should remove album from list", async () => {
      const albums: Album[] = [
        {
          id: "1",
          title: "Album 1",
          photoIds: [],
          coverPhotoUri: null,
          createdAt: 1000,
          modifiedAt: 1000,
        },
        {
          id: "2",
          title: "Album 2",
          photoIds: [],
          coverPhotoUri: null,
          createdAt: 2000,
          modifiedAt: 2000,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(albums));

      await deleteAlbum("1");

      const savedCall = vi.mocked(AsyncStorage.setItem).mock.calls[0];
      const saved = JSON.parse(savedCall[1]);
      expect(saved).toHaveLength(1);
      expect(saved[0].id).toBe("2");
    });
  });

  describe("addPhotosToAlbum", () => {
    it("should add photos to album and update modifiedAt", async () => {
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: [],
          coverPhotoUri: null,
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      const photos: Photo[] = [
        {
          id: "photo1",
          uri: "photo1.jpg",
          width: 100,
          height: 100,
          createdAt: 1000,
          isFavorite: false,
          albumIds: [],
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        return Promise.resolve(null);
      });
      const dateSpy = vi.spyOn(Date, "now").mockReturnValue(5000);

      await addPhotosToAlbum("album1", ["photo1"]);

      const albumsCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_albums");
      const savedAlbums = JSON.parse(albumsCall![1]);
      expect(savedAlbums[0].photoIds).toEqual(["photo1"]);
      expect(savedAlbums[0].modifiedAt).toBe(5000);

      dateSpy.mockRestore();
    });

    it("should set cover photo if album has none", async () => {
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: [],
          coverPhotoUri: null,
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      const photos: Photo[] = [
        {
          id: "photo1",
          uri: "photo1.jpg",
          width: 100,
          height: 100,
          createdAt: 1000,
          isFavorite: false,
          albumIds: [],
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        return Promise.resolve(null);
      });

      await addPhotosToAlbum("album1", ["photo1"]);

      const albumsCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_albums");
      const savedAlbums = JSON.parse(albumsCall![1]);
      expect(savedAlbums[0].coverPhotoUri).toBe("photo1.jpg");
    });

    it("should not add duplicate photos", async () => {
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: ["photo1"],
          coverPhotoUri: "photo1.jpg",
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      const photos: Photo[] = [
        createPhoto({
          id: "photo1",
          createdAt: 1000,
          modifiedAt: 1000,
          albumIds: ["album1"],
        }),
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        return Promise.resolve(null);
      });

      await addPhotosToAlbum("album1", ["photo1"]);

      const albumsCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_albums");
      const savedAlbums = JSON.parse(albumsCall![1]);
      expect(savedAlbums[0].photoIds).toEqual(["photo1"]);
    });

    it("should update photo.albumIds bidirectionally", async () => {
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: [],
          coverPhotoUri: null,
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      const photos: Photo[] = [
        {
          id: "photo1",
          uri: "photo1.jpg",
          width: 100,
          height: 100,
          createdAt: 1000,
          isFavorite: false,
          albumIds: [],
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        return Promise.resolve(null);
      });

      await addPhotosToAlbum("album1", ["photo1"]);

      const photosCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_photos");
      const savedPhotos = JSON.parse(photosCall![1]);
      expect(savedPhotos[0].albumIds).toEqual(["album1"]);
    });

    it("should handle non-existent album", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("[]");

      await addPhotosToAlbum("nonexistent", ["photo1"]);

      // Should not throw, just return without saving
      const setItemCalls = vi.mocked(AsyncStorage.setItem).mock.calls;
      expect(setItemCalls).toHaveLength(0);
    });
  });

  describe("removePhotoFromAlbum", () => {
    it("should remove photo from album", async () => {
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: ["photo1", "photo2"],
          coverPhotoUri: "photo1.jpg",
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      const photos: Photo[] = [
        createPhoto({
          id: "photo1",
          createdAt: 1000,
          modifiedAt: 1000,
          albumIds: ["album1"],
        }),
        createPhoto({
          id: "photo2",
          uri: "photo2.jpg",
          width: 200,
          height: 200,
          createdAt: 2000,
          modifiedAt: 2000,
          albumIds: ["album1"],
        }),
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        return Promise.resolve(null);
      });
      const dateSpy = vi.spyOn(Date, "now").mockReturnValue(5000);

      await removePhotoFromAlbum("album1", "photo1");

      const albumsCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_albums");
      const savedAlbums = JSON.parse(albumsCall![1]);
      expect(savedAlbums[0].photoIds).toEqual(["photo2"]);
      expect(savedAlbums[0].modifiedAt).toBe(5000);

      dateSpy.mockRestore();
    });

    it("should update cover photo when removed photo is cover", async () => {
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: ["photo1", "photo2"],
          coverPhotoUri: "photo1.jpg",
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      const photos: Photo[] = [
        createPhoto({
          id: "photo1",
          createdAt: 1000,
          modifiedAt: 1000,
          albumIds: ["album1"],
        }),
        createPhoto({
          id: "photo2",
          uri: "photo2.jpg",
          width: 200,
          height: 200,
          createdAt: 2000,
          modifiedAt: 2000,
          albumIds: ["album1"],
        }),
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        return Promise.resolve(null);
      });

      await removePhotoFromAlbum("album1", "photo1");

      const albumsCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_albums");
      const savedAlbums = JSON.parse(albumsCall![1]);
      expect(savedAlbums[0].coverPhotoUri).toBe("photo2.jpg");
    });

    it("should set cover to null when no photos remain", async () => {
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: ["photo1"],
          coverPhotoUri: "photo1.jpg",
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      const photos: Photo[] = [
        createPhoto({
          id: "photo1",
          createdAt: 1000,
          modifiedAt: 1000,
          albumIds: ["album1"],
        }),
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        return Promise.resolve(null);
      });

      await removePhotoFromAlbum("album1", "photo1");

      const albumsCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_albums");
      const savedAlbums = JSON.parse(albumsCall![1]);
      expect(savedAlbums[0].coverPhotoUri).toBe(null);
    });

    it("should update photo.albumIds bidirectionally", async () => {
      const albums: Album[] = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: ["photo1"],
          coverPhotoUri: "photo1.jpg",
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      const photos: Photo[] = [
        {
          id: "photo1",
          uri: "photo1.jpg",
          width: 100,
          height: 100,
          createdAt: 1000,
          isFavorite: false,
          albumIds: ["album1", "album2"],
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        return Promise.resolve(null);
      });

      await removePhotoFromAlbum("album1", "photo1");

      const photosCall = vi
        .mocked(AsyncStorage.setItem)
        .mock.calls.find((call) => call[0] === "@photo_vault_photos");
      const savedPhotos = JSON.parse(photosCall![1]);
      expect(savedPhotos[0].albumIds).toEqual(["album2"]);
    });

    it("should handle non-existent album in removePhotoFromAlbum", async () => {
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_albums") {
          return Promise.resolve("[]");
        }
        if (key === "@photo_vault_photos") {
          return Promise.resolve("[]");
        }
        return Promise.resolve(null);
      });

      await removePhotoFromAlbum("nonexistent", "photo1");

      // Should not throw, just return without saving
      const setItemCalls = vi.mocked(AsyncStorage.setItem).mock.calls;
      expect(setItemCalls).toHaveLength(0);
    });
  });
});

describe("Storage Info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getStorageInfo", () => {
    it("should calculate storage from photos", async () => {
      const photos: Photo[] = [
        createPhoto({
          id: "1",
          createdAt: 1000,
          modifiedAt: 1000,
          albumIds: [],
        }),
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        if (key === "@photo_vault_albums") {
          return Promise.resolve("[]");
        }
        return Promise.resolve(null);
      });

      const info = await getStorageInfo();

      expect(info.photoCount).toBe(1);
      expect(info.albumCount).toBe(0);
      expect(info.usedBytes).toBe((100 * 100 * 3) / 10);
      expect(info.totalBytes).toBe(15 * 1024 * 1024 * 1024);
    });

    it("should count multiple photos and albums", async () => {
      const photos: Photo[] = [
        createPhoto({
          id: "1",
          createdAt: 1000,
          modifiedAt: 1000,
          albumIds: [],
        }),
        createPhoto({
          id: "2",
          uri: "photo2.jpg",
          width: 200,
          height: 200,
          createdAt: 2000,
          modifiedAt: 2000,
          albumIds: [],
        }),
      ];
      const albums: Album[] = [
        {
          id: "1",
          title: "Album 1",
          photoIds: [],
          coverPhotoUri: null,
          createdAt: 1000,
          modifiedAt: 1000,
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockImplementation((key) => {
        if (key === "@photo_vault_photos") {
          return Promise.resolve(JSON.stringify(photos));
        }
        if (key === "@photo_vault_albums") {
          return Promise.resolve(JSON.stringify(albums));
        }
        return Promise.resolve(null);
      });

      const info = await getStorageInfo();

      expect(info.photoCount).toBe(2);
      expect(info.albumCount).toBe(1);
    });

    it("should return zeros for empty storage", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const info = await getStorageInfo();

      expect(info.photoCount).toBe(0);
      expect(info.albumCount).toBe(0);
      expect(info.usedBytes).toBe(0);
      expect(info.totalBytes).toBe(15 * 1024 * 1024 * 1024);
    });
  });
});

describe("User Profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getUserProfile", () => {
    it("should return default profile when none exists", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const profile = await getUserProfile();

      expect(profile).toEqual({
        name: "Guest User",
        email: "guest@example.com",
        avatarUri: null,
      });
    });

    it("should return saved profile", async () => {
      const savedProfile: UserProfile = {
        name: "John Doe",
        email: "john@example.com",
        avatarUri: "avatar.jpg",
      };
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(savedProfile),
      );

      const profile = await getUserProfile();

      expect(profile).toEqual(savedProfile);
    });

    it("should return default on error", async () => {
      vi.mocked(AsyncStorage.getItem).mockRejectedValue(
        new Error("Storage error"),
      );

      const profile = await getUserProfile();

      expect(profile).toEqual({
        name: "Guest User",
        email: "guest@example.com",
        avatarUri: null,
      });
    });
  });

  describe("saveUserProfile", () => {
    it("should save profile to AsyncStorage", async () => {
      const profile: UserProfile = {
        name: "Jane Doe",
        email: "jane@example.com",
        avatarUri: "avatar.jpg",
      };

      await saveUserProfile(profile);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@photo_vault_user",
        JSON.stringify(profile),
      );
    });

    it("should save profile with null avatar", async () => {
      const profile: UserProfile = {
        name: "User",
        email: "user@example.com",
        avatarUri: null,
      };

      await saveUserProfile(profile);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        "@photo_vault_user",
        JSON.stringify(profile),
      );
    });
  });
});

describe("clearAllData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should remove all data keys", async () => {
    await clearAllData();

    expect(AsyncStorage.multiRemove).toHaveBeenCalledWith([
      "@photo_vault_photos",
      "@photo_vault_albums",
      "@photo_vault_user",
    ]);
  });
});

describe("groupPhotosByDate", () => {
  it("should group photos by Today", () => {
    const now = Date.now();
    const photos: Photo[] = [
      {
        id: "1",
        uri: "photo1.jpg",
        width: 100,
        height: 100,
        createdAt: now,
        isFavorite: false,
        albumIds: [],
      },
    ];

    const groups = groupPhotosByDate(photos);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Today");
    expect(groups[0].data).toHaveLength(1);
  });

  it("should group photos by Yesterday", () => {
    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    const photos: Photo[] = [
      {
        id: "1",
        uri: "photo1.jpg",
        width: 100,
        height: 100,
        createdAt: yesterday,
        isFavorite: false,
        albumIds: [],
      },
    ];

    const groups = groupPhotosByDate(photos);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Yesterday");
  });

  it("should group photos by Last 7 Days", () => {
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000;
    const photos: Photo[] = [
      {
        id: "1",
        uri: "photo1.jpg",
        width: 100,
        height: 100,
        createdAt: fiveDaysAgo,
        isFavorite: false,
        albumIds: [],
      },
    ];

    const groups = groupPhotosByDate(photos);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Last 7 Days");
  });

  it("should group photos by Last Month", () => {
    const twentyDaysAgo = Date.now() - 20 * 24 * 60 * 60 * 1000;
    const photos: Photo[] = [
      {
        id: "1",
        uri: "photo1.jpg",
        width: 100,
        height: 100,
        createdAt: twentyDaysAgo,
        isFavorite: false,
        albumIds: [],
      },
    ];

    const groups = groupPhotosByDate(photos);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Last Month");
  });

  it("should group old photos by month/year", () => {
    const oldDate = new Date(2020, 5, 15).getTime();
    const photos: Photo[] = [
      {
        id: "1",
        uri: "photo1.jpg",
        width: 100,
        height: 100,
        createdAt: oldDate,
        isFavorite: false,
        albumIds: [],
      },
    ];

    const groups = groupPhotosByDate(photos);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("June 2020");
  });

  it("should sort groups in correct order", () => {
    const now = Date.now();
    const yesterday = now - 24 * 60 * 60 * 1000;
    const lastWeek = now - 5 * 24 * 60 * 60 * 1000;
    const lastMonth = now - 20 * 24 * 60 * 60 * 1000;
    const oldDate = new Date(2020, 5, 15).getTime();

    const photos: Photo[] = [
      {
        id: "5",
        uri: "photo5.jpg",
        width: 100,
        height: 100,
        createdAt: oldDate,
        isFavorite: false,
        albumIds: [],
      },
      {
        id: "1",
        uri: "photo1.jpg",
        width: 100,
        height: 100,
        createdAt: now,
        isFavorite: false,
        albumIds: [],
      },
      {
        id: "4",
        uri: "photo4.jpg",
        width: 100,
        height: 100,
        createdAt: lastMonth,
        isFavorite: false,
        albumIds: [],
      },
      {
        id: "2",
        uri: "photo2.jpg",
        width: 100,
        height: 100,
        createdAt: yesterday,
        isFavorite: false,
        albumIds: [],
      },
      {
        id: "3",
        uri: "photo3.jpg",
        width: 100,
        height: 100,
        createdAt: lastWeek,
        isFavorite: false,
        albumIds: [],
      },
    ];

    const groups = groupPhotosByDate(photos);

    expect(groups.map((g) => g.title)).toEqual([
      "Today",
      "Yesterday",
      "Last 7 Days",
      "Last Month",
      "June 2020",
    ]);
  });

  it("should handle empty photo array", () => {
    const groups = groupPhotosByDate([]);
    expect(groups).toEqual([]);
  });

  it("should group multiple photos in same category", () => {
    const now = Date.now();
    const photos: Photo[] = [
      {
        id: "1",
        uri: "photo1.jpg",
        width: 100,
        height: 100,
        createdAt: now,
        isFavorite: false,
        albumIds: [],
      },
      {
        id: "2",
        uri: "photo2.jpg",
        width: 100,
        height: 100,
        createdAt: now - 1000,
        isFavorite: false,
        albumIds: [],
      },
    ];

    const groups = groupPhotosByDate(photos);

    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Today");
    expect(groups[0].data).toHaveLength(2);
  });

  it("should sort old date groups chronologically (newest first)", () => {
    const date1 = new Date(2020, 0, 15).getTime(); // January 2020
    const date2 = new Date(2020, 5, 15).getTime(); // June 2020

    const photos: Photo[] = [
      {
        id: "1",
        uri: "photo1.jpg",
        width: 100,
        height: 100,
        createdAt: date1,
        isFavorite: false,
        albumIds: [],
      },
      {
        id: "2",
        uri: "photo2.jpg",
        width: 100,
        height: 100,
        createdAt: date2,
        isFavorite: false,
        albumIds: [],
      },
    ];

    const groups = groupPhotosByDate(photos);

    expect(groups).toHaveLength(2);
    // Should be sorted with newer month first (June before January)
    expect(groups[0].title).toBe("June 2020");
    expect(groups[1].title).toBe("January 2020");
  });

  it("should handle mix of recent and old groups correctly", () => {
    const now = Date.now();
    const lastWeek = now - 5 * 24 * 60 * 60 * 1000;
    const oldDate1 = new Date(2019, 11, 15).getTime(); // December 2019
    const oldDate2 = new Date(2020, 5, 15).getTime(); // June 2020

    const photos: Photo[] = [
      {
        id: "1",
        uri: "photo1.jpg",
        width: 100,
        height: 100,
        createdAt: now,
        isFavorite: false,
        albumIds: [],
      },
      {
        id: "2",
        uri: "photo2.jpg",
        width: 100,
        height: 100,
        createdAt: lastWeek,
        isFavorite: false,
        albumIds: [],
      },
      {
        id: "3",
        uri: "photo3.jpg",
        width: 100,
        height: 100,
        createdAt: oldDate1,
        isFavorite: false,
        albumIds: [],
      },
      {
        id: "4",
        uri: "photo4.jpg",
        width: 100,
        height: 100,
        createdAt: oldDate2,
        isFavorite: false,
        albumIds: [],
      },
    ];

    const groups = groupPhotosByDate(photos);

    expect(groups).toHaveLength(4);
    expect(groups[0].title).toBe("Today");
    expect(groups[1].title).toBe("Last 7 Days");
    // Old dates should be sorted newest first
    expect(groups[2].title).toBe("June 2020");
    expect(groups[3].title).toBe("December 2019");
  });
});

// Edge case and boundary condition tests
describe("Storage Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Photo Boundary Conditions", () => {
    it("should handle photos with extreme dimensions", async () => {
      const extremePhotos = [
        {
          id: "extreme1",
          uri: "photo1.jpg",
          width: 1,
          height: 1,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          filename: "photo1.jpg",
          isFavorite: false,
          albumIds: [],
        },
        {
          id: "extreme2",
          uri: "photo2.jpg",
          width: 10000,
          height: 10000,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          filename: "photo2.jpg",
          isFavorite: false,
          albumIds: [],
        },
      ];

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await savePhotos(extremePhotos);

      // Mock the retrieval to return the saved photos
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(extremePhotos),
      );

      const retrieved = await getPhotos();

      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].width).toBe(1);
      expect(retrieved[1].width).toBe(10000);
    });

    it("should handle empty photo arrays gracefully", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("[]");
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await savePhotos([]);
      const retrieved = await getPhotos();

      expect(retrieved).toEqual([]);
      expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledWith(
        "@photo_vault_photos",
        "[]",
      );
    });

    it("should handle malformed photo data", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("invalid json");
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      const retrieved = await getPhotos();

      expect(retrieved).toEqual([]);
    });
  });

  describe("Album Boundary Conditions", () => {
    it("should handle albums with edge case titles", async () => {
      const edgeCaseAlbums = [
        {
          id: "album1",
          title: "",
          photoIds: [],
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          coverPhotoUri: null,
        },
        {
          id: "album2",
          title: "A".repeat(1000),
          photoIds: [],
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          coverPhotoUri: null,
        },
        {
          id: "album3",
          title: "📸🎨🎭🎪🎨📸",
          photoIds: [],
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          coverPhotoUri: null,
        },
      ];

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await saveAlbums(edgeCaseAlbums);

      // Mock the retrieval to return the saved albums
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(edgeCaseAlbums),
      );

      const retrieved = await getAlbums();

      expect(retrieved).toHaveLength(3);
      expect(retrieved[0].title).toBe("");
      expect(retrieved[1].title).toHaveLength(1000);
      expect(retrieved[2].title).toBe("📸🎨🎭🎪🎨📸");
    });

    it("should handle albums with no photos", async () => {
      const emptyAlbum = {
        id: "empty-album",
        title: "Empty Album",
        photoIds: [],
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        coverPhotoUri: null,
      };

      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      await createAlbum(emptyAlbum.title);

      // Mock the retrieval to return the created album
      const createdAlbums = [
        {
          ...emptyAlbum,
          id: expect.any(String), // Created album will have generated ID
        },
      ];
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(createdAlbums),
      );

      const retrieved = await getAlbums();

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].photoIds).toEqual([]);
      expect(retrieved[0].coverPhotoUri).toBeNull();
    });
  });

  describe("User Profile Edge Cases", () => {
    it("should handle user profiles with edge case data", async () => {
      const edgeCaseProfiles = [
        { name: "", email: "", avatarUri: null, createdAt: Date.now() },
        {
          name: "a".repeat(100),
          email: "test@example.com",
          avatarUri: null,
          createdAt: Date.now(),
        },
        {
          name: "👤 User",
          email: "user@example.com",
          avatarUri: "file://avatar.jpg",
          createdAt: Date.now(),
        },
      ];

      for (const profile of edgeCaseProfiles) {
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
        vi.mocked(AsyncStorage.setItem).mockResolvedValue();

        await saveUserProfile(profile);

        // Mock the retrieval to return the saved profile
        vi.mocked(AsyncStorage.getItem).mockResolvedValue(
          JSON.stringify(profile),
        );

        const retrieved = await getUserProfile();
        expect(retrieved).toEqual(profile);
      }
    });

    it("should handle missing user profile gracefully", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      const retrieved = await getUserProfile();

      // getUserProfile returns a default profile when none exists
      expect(retrieved).toEqual({
        name: "Guest User",
        email: "guest@example.com",
        avatarUri: null,
      });
    });
  });

  describe("Storage Info Edge Cases", () => {
    it("should calculate storage info for empty datasets", async () => {
      vi.mocked(AsyncStorage.getItem)
        .mockResolvedValueOnce("[]") // photos
        .mockResolvedValueOnce("[]"); // albums

      const info = await getStorageInfo();

      expect(info.usedBytes).toBe(0);
      expect(info.photoCount).toBe(0);
      expect(info.albumCount).toBe(0);
      expect(info.totalBytes).toBeGreaterThan(0);
    });

    it("should handle large datasets without overflow", async () => {
      // Create a large dataset
      const largePhotoSet = Array.from({ length: 1000 }, (_, i) => ({
        id: `photo_${i}`,
        uri: `photo_${i}.jpg`,
        width: 1920,
        height: 1080,
        createdAt: Date.now() - i * 1000,
        modifiedAt: Date.now() - i * 1000,
        filename: `photo_${i}.jpg`,
        isFavorite: i % 10 === 0,
        albumIds: [],
      }));

      vi.mocked(AsyncStorage.getItem)
        .mockResolvedValueOnce(JSON.stringify(largePhotoSet))
        .mockResolvedValueOnce("[]");

      const info = await getStorageInfo();

      expect(info.photoCount).toBe(1000);
      expect(info.usedBytes).toBeGreaterThan(0);
      // Should not overflow
      expect(info.usedBytes).toBeLessThan(Number.MAX_SAFE_INTEGER);
    });
  });

  describe("Data Consistency Edge Cases", () => {
    it("should handle orphaned photo references", async () => {
      const albumsWithOrphanedRefs = [
        {
          id: "album1",
          title: "Album 1",
          photoIds: ["nonexistent1", "nonexistent2"],
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          coverPhotoUri: null,
        },
      ];

      const photos = [
        {
          id: "photo1",
          uri: "photo1.jpg",
          width: 100,
          height: 100,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          filename: "photo1.jpg",
          isFavorite: false,
          albumIds: [],
        },
      ];

      vi.mocked(AsyncStorage.getItem)
        .mockResolvedValueOnce(JSON.stringify(albumsWithOrphanedRefs))
        .mockResolvedValueOnce(JSON.stringify(photos));

      const retrievedAlbums = await getAlbums();
      const retrievedPhotos = await getPhotos();

      expect(retrievedAlbums[0].photoIds).toBeDefined();
      expect(retrievedAlbums[0].photoIds).toEqual(
        expect.arrayContaining(["nonexistent1"]),
      );
      expect(retrievedPhotos[0].albumIds).toEqual([]);
    });

    it("should handle concurrent operations gracefully", async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue("[]");
      vi.mocked(AsyncStorage.setItem).mockResolvedValue();

      // Simulate concurrent photo additions
      const concurrentOperations = Array.from({ length: 10 }, (_, i) =>
        addPhoto({
          id: `concurrent_${i}`,
          uri: `photo_${i}.jpg`,
          width: 100,
          height: 100,
          createdAt: Date.now(),
          modifiedAt: Date.now(),
          filename: `photo_${i}.jpg`,
          isFavorite: false,
          albumIds: [],
        }),
      );

      await Promise.all(concurrentOperations);

      // Mock retrieval to return all added photos
      const allPhotos = Array.from({ length: 10 }, (_, i) => ({
        id: `concurrent_${i}`,
        uri: `photo_${i}.jpg`,
        width: 100,
        height: 100,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
        filename: `photo_${i}.jpg`,
        isFavorite: false,
        albumIds: [],
      }));
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(
        JSON.stringify(allPhotos),
      );

      const retrieved = await getPhotos();

      expect(retrieved).toHaveLength(10);
      expect(vi.mocked(AsyncStorage.setItem)).toHaveBeenCalledTimes(10);
    });
  });
});
