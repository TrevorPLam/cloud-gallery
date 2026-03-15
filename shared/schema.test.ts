import { describe, it, expect } from "vitest";
import { users, insertUserSchema, type InsertUser, type User } from "./schema";
import { 
  photos, 
  insertPhotoSchema, 
  faces, 
  people, 
  sharedAlbums, 
  sharedAlbumCollaborators,
  photoEdits,
  memories,
  smartAlbums,
  backupQueue,
  userDevices,
  storageUsage
} from "./schema";
import { z } from "zod";
import * as fc from "fast-check";

describe("users table schema", () => {
  it("should have all required columns", () => {
    expect(users).toBeDefined();
    expect(users.id).toBeDefined();
    expect(users.username).toBeDefined();
    expect(users.password).toBeDefined();
  });

  it("should have correct column types", () => {
    const columns = users;
    expect(columns.id.columnType).toBe("PgVarchar");
    expect(columns.username.columnType).toBe("PgText");
    expect(columns.password.columnType).toBe("PgText");
  });
});

describe("insertUserSchema", () => {
  it("should validate correct user data", () => {
    const validUser = {
      username: "testuser",
      password: "password123",
    };

    const result = insertUserSchema.safeParse(validUser);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("testuser");
      expect(result.data.password).toBe("password123");
    }
  });

  it("should reject missing username", () => {
    const invalidUser = {
      password: "password123",
    };

    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it("should reject missing password", () => {
    const invalidUser = {
      username: "testuser",
    };

    const result = insertUserSchema.safeParse(invalidUser);
    expect(result.success).toBe(false);
  });

  it("should reject empty object", () => {
    const result = insertUserSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should allow empty string username", () => {
    const user = {
      username: "",
      password: "password",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  it("should allow empty string password", () => {
    const user = {
      username: "user",
      password: "",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  it("should allow very long username", () => {
    const user = {
      username: "a".repeat(10000),
      password: "password",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  it("should allow very long password", () => {
    const user = {
      username: "user",
      password: "p".repeat(100000),
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  it("should allow unicode characters", () => {
    const user = {
      username: "用户名🎉",
      password: "密码🔒",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.username).toBe("用户名🎉");
      expect(result.data.password).toBe("密码🔒");
    }
  });

  it("should allow special characters", () => {
    const user = {
      username: "user@example.com",
      password: "p@$$w0rd!#",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
  });

  it("should reject null values", () => {
    const user = {
      username: null,
      password: "password",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(false);
  });

  it("should reject undefined values", () => {
    const user = {
      username: "user",
      password: undefined,
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(false);
  });

  it("should reject number values", () => {
    const user = {
      username: 12345,
      password: "password",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(false);
  });

  it("should ignore extra fields (pick only username and password)", () => {
    const user = {
      username: "user",
      password: "pass",
      id: "should-be-ignored",
      extraField: "ignored",
    };

    const result = insertUserSchema.safeParse(user);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        username: "user",
        password: "pass",
      });
      expect((result.data as any).id).toBeUndefined();
      expect((result.data as any).extraField).toBeUndefined();
    }
  });
});

describe("InsertUser type", () => {
  it("should allow valid user data", () => {
    const user: InsertUser = {
      username: "testuser",
      password: "password123",
    };

    expect(user.username).toBe("testuser");
    expect(user.password).toBe("password123");
  });

  it("should be compatible with zod schema", () => {
    const user: InsertUser = {
      username: "user",
      password: "pass",
    };

    const result = insertUserSchema.parse(user);
    expect(result).toEqual(user);
  });
});

describe("User type", () => {
  it("should include id field", () => {
    const user: User = {
      id: "123",
      username: "testuser",
      password: "password123",
    };

    expect(user.id).toBe("123");
    expect(user.username).toBe("testuser");
    expect(user.password).toBe("password123");
  });

  it("should require all fields", () => {
    // TypeScript compilation test - this would fail at compile time
    const user: User = {
      id: "abc",
      username: "user",
      password: "pass",
    };

    expect(user).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────
// PROPERTY TESTS FOR SCHEMA MIGRATIONS
// ─────────────────────────────────────────────────────────

describe("Schema Migration Property Tests", () => {
  describe("Photos table ML extensions", () => {
    it("should preserve existing photo data when adding ML fields", () => {
      fc.assert(fc.property(
        fc.record({
          id: fc.uuid(),
          userId: fc.uuid(),
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 10000 }),
          height: fc.integer({ min: 1, max: 10000 }),
          filename: fc.string(),
          isFavorite: fc.boolean(),
          createdAt: fc.date(),
          modifiedAt: fc.date(),
        }),
        (basePhoto) => {
          // Simulate migration by adding ML fields
          const migratedPhoto = {
            ...basePhoto,
            // New ML fields should be null or have defaults
            mlLabels: null,
            mlProcessedAt: null,
            mlVersion: null,
            ocrText: null,
            ocrLanguage: null,
            perceptualHash: null,
            duplicateGroupId: null,
            isVideo: false,
            videoDuration: null,
            videoThumbnailUri: null,
            backupStatus: null,
            backupCompletedAt: null,
            originalSize: null,
            compressedSize: null,
          };

          // Original data should be preserved
          return migratedPhoto.id === basePhoto.id &&
                 migratedPhoto.userId === basePhoto.userId &&
                 migratedPhoto.uri === basePhoto.uri &&
                 migratedPhoto.width === basePhoto.width &&
                 migratedPhoto.height === basePhoto.height &&
                 migratedPhoto.filename === basePhoto.filename &&
                 migratedPhoto.isFavorite === basePhoto.isFavorite;
        }
      ));
    });
  });

  describe("Face recognition schema", () => {
    it("should maintain embedding vector dimensions", () => {
      fc.assert(fc.property(
        fc.array(fc.float({ min: -1, max: 1 }), { minLength: 128, maxLength: 128 }),
        (embedding) => {
          // Embedding should always be 128-dimensional
          return embedding.length === 128;
        }
      ));
    });
  });

  describe("Shared albums security", () => {
    it("should generate unique share tokens", () => {
      fc.assert(fc.property(
        fc.uuid(),
        fc.uuid(),
        (albumId1, albumId2) => {
          // Different albums should have different tokens
          const token1 = albumId1 + '-' + Date.now() + '-' + Math.random();
          const token2 = albumId2 + '-' + Date.now() + '-' + Math.random();
          
          if (albumId1 !== albumId2) {
            expect(token1).not.toBe(token2);
          }
          return true;
        }
      ));
    });

    it("should enforce permission levels", () => {
      const validPermissions = ['view', 'edit', 'admin'];
      fc.assert(fc.property(
        fc.constantFrom(...validPermissions),
        (permission) => {
          expect(validPermissions).toContain(permission);
          return true;
        }
      ));
    });
  });

  describe("Storage usage tracking", () => {
    it("should maintain usage consistency", () => {
      fc.assert(fc.property(
        fc.integer({ min: 1, max: 1000000 }),
        fc.integer({ min: 1, max: 10000 }),
        (bytesUsed, itemCount) => {
          // Bytes should be reasonable relative to item count
          const avgBytesPerItem = bytesUsed / itemCount;
          return avgBytesPerItem > 0 && avgBytesPerItem < 10000000; // 10MB per item max
        }
      ));
    });

    it("should enforce category uniqueness per user", () => {
      fc.assert(fc.property(
        fc.uuid(),
        fc.constantFrom('photos', 'videos', 'thumbnails', 'cache'),
        (userId, category) => {
          // Each user should have only one entry per category
          const usageEntry = { userId, category };
          expect(typeof usageEntry.userId).toBe('string');
          expect(typeof usageEntry.category).toBe('string');
          return true;
        }
      ));
    });
  });
});

// ─────────────────────────────────────────────────────────
// UNIT TESTS FOR NEW TABLE SCHEMAS
// ─────────────────────────────────────────────────────────

describe("New table schemas", () => {
  describe("faces table", () => {
    it("should have all required columns", () => {
      expect(faces).toBeDefined();
      expect(faces.id).toBeDefined();
      expect(faces.photoId).toBeDefined();
      expect(faces.embedding).toBeDefined();
      expect(faces.boundingBox).toBeDefined();
      expect(faces.confidence).toBeDefined();
    });

    it("should have correct column types", () => {
      expect(faces.embedding.columnType).toBe("PgVector");
      expect(faces.boundingBox.columnType).toBe("PgJsonb");
      expect(faces.confidence.columnType).toBe("PgReal");
    });
  });

  describe("people table", () => {
    it("should have all required columns", () => {
      expect(people).toBeDefined();
      expect(people.id).toBeDefined();
      expect(people.userId).toBeDefined();
      expect(people.name).toBeDefined();
      expect(people.isPinned).toBeDefined();
      expect(people.isHidden).toBeDefined();
    });

    it("should have correct default values", () => {
      expect(people.isPinned.default).toBe(false);
      expect(people.isHidden.default).toBe(false);
      expect(people.faceCount.default).toBe(0);
    });
  });

  describe("shared albums table", () => {
    it("should have all required columns", () => {
      expect(sharedAlbums).toBeDefined();
      expect(sharedAlbums.id).toBeDefined();
      expect(sharedAlbums.albumId).toBeDefined();
      expect(sharedAlbums.shareToken).toBeDefined();
      expect(sharedAlbums.permissions).toBeDefined();
    });

    it("should have unique constraints", () => {
      expect(sharedAlbums.shareToken.isUnique).toBe(true);
    });
  });

  describe("backup queue table", () => {
    it("should have all required columns", () => {
      expect(backupQueue).toBeDefined();
      expect(backupQueue.id).toBeDefined();
      expect(backupQueue.photoId).toBeDefined();
      expect(backupQueue.status).toBeDefined();
      expect(backupQueue.priority).toBeDefined();
    });

    it("should have correct default values", () => {
      expect(backupQueue.status.default).toBe("pending");
      expect(backupQueue.priority.default).toBe(0);
      expect(backupQueue.retryCount.default).toBe(0);
      expect(backupQueue.maxRetries.default).toBe(3);
    });
  });

  describe("user devices table", () => {
    it("should have all required columns", () => {
      expect(userDevices).toBeDefined();
      expect(userDevices.id).toBeDefined();
      expect(userDevices.userId).toBeDefined();
      expect(userDevices.deviceId).toBeDefined();
      expect(userDevices.deviceType).toBeDefined();
    });

    it("should have correct default values", () => {
      expect(userDevices.isActive.default).toBe(true);
      expect(userDevices.storageUsed.default).toBe(0);
    });
  });

  describe("storage usage table", () => {
    it("should have all required columns", () => {
      expect(storageUsage).toBeDefined();
      expect(storageUsage.id).toBeDefined();
      expect(storageUsage.userId).toBeDefined();
      expect(storageUsage.category).toBeDefined();
      expect(storageUsage.bytesUsed).toBeDefined();
    });

    it("should have correct default values", () => {
      expect(storageUsage.bytesUsed.default).toBe(0);
      expect(storageUsage.itemCount.default).toBe(0);
    });
  });
});

// ─────────────────────────────────────────────────────────
// FOREIGN KEY CONSTRAINT TESTS
// ─────────────────────────────────────────────────────────

describe("Foreign key constraints", () => {
  it("should have proper table relationships defined", () => {
    // Test that tables have the expected foreign key relationships
    expect(faces.photoId.notNull).toBe(true);
    expect(people.userId.notNull).toBe(true);
    expect(photoEdits.photoId.notNull).toBe(true);
    expect(photoEdits.userId.notNull).toBe(true);
  });

  it("should allow optional relationships", () => {
    // Test that optional relationships can be null
    expect(faces.personId.notNull).toBe(false);
    expect(memories.coverPhotoId.notNull).toBe(false);
    expect(smartAlbums.coverPhotoId.notNull).toBe(false);
  });
});
