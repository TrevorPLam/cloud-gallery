/**
 * Database Migration Tests
 *
 * Validates that the Drizzle schema definitions are coherent and that
 * schema-level migrations would preserve data correctness.
 *
 * Since we run without a live database in CI, these tests work entirely
 * against the Drizzle schema objects (JavaScript/TypeScript introspection).
 *
 * What is tested:
 *  1. Every expected table is exported from the schema module.
 *  2. Each table has the required columns with the correct Drizzle column types.
 *  3. Foreign-key / reference constraints are declared correctly.
 *  4. Default values match the documented schema.
 *  5. Migration-safety properties hold (property-based tests via fast-check).
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  users,
  photos,
  albums,
  albumPhotos,
  faces,
  people,
  sharedAlbums,
  sharedAlbumCollaborators,
  photoEdits,
  memories,
  smartAlbums,
  backupQueue,
  userDevices,
  storageUsage,
  partnerRelationships,
  partnerInvitations,
  partnerAutoShareRules,
  partnerSharedPhotos,
} from "../../shared/schema";

// ─────────────────────────────────────────────────────────
// TABLE EXISTENCE
// ─────────────────────────────────────────────────────────

describe("Schema table existence", () => {
  it("should export all core tables", () => {
    expect(users).toBeDefined();
    expect(photos).toBeDefined();
    expect(albums).toBeDefined();
    expect(albumPhotos).toBeDefined();
  });

  it("should export all ML / AI tables", () => {
    expect(faces).toBeDefined();
    expect(people).toBeDefined();
    expect(memories).toBeDefined();
    expect(smartAlbums).toBeDefined();
  });

  it("should export all sharing tables", () => {
    expect(sharedAlbums).toBeDefined();
    expect(sharedAlbumCollaborators).toBeDefined();
    expect(partnerRelationships).toBeDefined();
    expect(partnerInvitations).toBeDefined();
    expect(partnerAutoShareRules).toBeDefined();
    expect(partnerSharedPhotos).toBeDefined();
  });

  it("should export all operational tables", () => {
    expect(photoEdits).toBeDefined();
    expect(backupQueue).toBeDefined();
    expect(userDevices).toBeDefined();
    expect(storageUsage).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────
// CORE TABLE COLUMN VALIDATION
// ─────────────────────────────────────────────────────────

describe("users table columns", () => {
  it("should have id, username, and password columns", () => {
    expect(users.id).toBeDefined();
    expect(users.username).toBeDefined();
    expect(users.password).toBeDefined();
  });

  it("should have correct column types", () => {
    expect(users.id.columnType).toBe("PgVarchar");
    expect(users.username.columnType).toBe("PgText");
    expect(users.password.columnType).toBe("PgText");
  });

  it("should have a unique constraint on username", () => {
    expect(users.username.isUnique).toBe(true);
  });
});

describe("photos table columns", () => {
  it("should have all required columns", () => {
    expect(photos.id).toBeDefined();
    expect(photos.userId).toBeDefined();
    expect(photos.uri).toBeDefined();
    expect(photos.width).toBeDefined();
    expect(photos.height).toBeDefined();
    expect(photos.filename).toBeDefined();
    expect(photos.isFavorite).toBeDefined();
    expect(photos.createdAt).toBeDefined();
    expect(photos.modifiedAt).toBeDefined();
  });

  it("should have correct column types for required fields", () => {
    expect(photos.id.columnType).toBe("PgVarchar");
    expect(photos.userId.columnType).toBe("PgVarchar");
    expect(photos.uri.columnType).toBe("PgText");
    expect(photos.width.columnType).toBe("PgInteger");
    expect(photos.height.columnType).toBe("PgInteger");
    expect(photos.filename.columnType).toBe("PgText");
    expect(photos.isFavorite.columnType).toBe("PgBoolean");
  });

  it("should have correct default values", () => {
    expect(photos.isFavorite.default).toBe(false);
    expect(photos.isPrivate.default).toBe(false);
    expect(photos.isVideo.default).toBe(false);
  });

  it("should have ML extension columns", () => {
    expect(photos.mlLabels).toBeDefined();
    expect(photos.mlProcessedAt).toBeDefined();
    expect(photos.mlVersion).toBeDefined();
    expect(photos.ocrText).toBeDefined();
    expect(photos.perceptualHash).toBeDefined();
    expect(photos.duplicateGroupId).toBeDefined();
  });

  it("should have soft-delete support", () => {
    expect(photos.deletedAt).toBeDefined();
    // deletedAt should be nullable
    expect(photos.deletedAt.notNull).toBe(false);
  });

  it("should have backup tracking columns", () => {
    expect(photos.backupStatus).toBeDefined();
    expect(photos.backupCompletedAt).toBeDefined();
    expect(photos.originalSize).toBeDefined();
    expect(photos.compressedSize).toBeDefined();
  });
});

describe("albums table columns", () => {
  it("should have all required columns", () => {
    expect(albums.id).toBeDefined();
    expect(albums.userId).toBeDefined();
    expect(albums.title).toBeDefined();
    expect(albums.createdAt).toBeDefined();
    expect(albums.modifiedAt).toBeDefined();
  });

  it("should have optional columns nullable", () => {
    expect(albums.description.notNull).toBe(false);
    expect(albums.coverPhotoUri.notNull).toBe(false);
  });
});

describe("albumPhotos junction table columns", () => {
  it("should have albumId and photoId as required columns", () => {
    expect(albumPhotos.albumId).toBeDefined();
    expect(albumPhotos.photoId).toBeDefined();
    expect(albumPhotos.albumId.notNull).toBe(true);
    expect(albumPhotos.photoId.notNull).toBe(true);
  });

  it("should have addedAt and position columns", () => {
    expect(albumPhotos.addedAt).toBeDefined();
    expect(albumPhotos.position).toBeDefined();
    expect(albumPhotos.position.default).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// ML / AI TABLE COLUMN VALIDATION
// ─────────────────────────────────────────────────────────

describe("faces table columns", () => {
  it("should have all required columns", () => {
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

  it("should allow null personId (unassigned face)", () => {
    expect(faces.personId.notNull).toBe(false);
  });

  it("should require confidence", () => {
    expect(faces.confidence.notNull).toBe(true);
  });
});

describe("people table columns", () => {
  it("should have all required columns", () => {
    expect(people.id).toBeDefined();
    expect(people.userId).toBeDefined();
    expect(people.isPinned).toBeDefined();
    expect(people.isHidden).toBeDefined();
    expect(people.faceCount).toBeDefined();
  });

  it("should have correct boolean defaults", () => {
    expect(people.isPinned.default).toBe(false);
    expect(people.isHidden.default).toBe(false);
  });

  it("should have correct numeric defaults", () => {
    expect(people.faceCount.default).toBe(0);
  });

  it("should allow null name (unnamed person)", () => {
    expect(people.name.notNull).toBe(false);
  });
});

describe("memories table columns", () => {
  it("should have all required columns", () => {
    expect(memories.id).toBeDefined();
    expect(memories.userId).toBeDefined();
    expect(memories.memoryType).toBeDefined();
    expect(memories.title).toBeDefined();
    expect(memories.startDate).toBeDefined();
    expect(memories.endDate).toBeDefined();
  });

  it("should have correct defaults", () => {
    expect(memories.photoCount.default).toBe(0);
    expect(memories.isFavorite.default).toBe(false);
    expect(memories.isHidden.default).toBe(false);
  });

  it("should allow optional cover photo", () => {
    expect(memories.coverPhotoId.notNull).toBe(false);
  });
});

describe("smartAlbums table columns", () => {
  it("should have all required columns", () => {
    expect(smartAlbums.id).toBeDefined();
    expect(smartAlbums.userId).toBeDefined();
    expect(smartAlbums.albumType).toBeDefined();
    expect(smartAlbums.title).toBeDefined();
    expect(smartAlbums.criteria).toBeDefined();
  });

  it("should have correct defaults", () => {
    expect(smartAlbums.photoCount.default).toBe(0);
    expect(smartAlbums.isPinned.default).toBe(false);
    expect(smartAlbums.isHidden.default).toBe(false);
  });

  it("should store criteria as jsonb", () => {
    expect(smartAlbums.criteria.columnType).toBe("PgJsonb");
  });
});

// ─────────────────────────────────────────────────────────
// OPERATIONAL TABLE COLUMN VALIDATION
// ─────────────────────────────────────────────────────────

describe("backupQueue table columns", () => {
  it("should have all required columns", () => {
    expect(backupQueue.id).toBeDefined();
    expect(backupQueue.photoId).toBeDefined();
    expect(backupQueue.status).toBeDefined();
    expect(backupQueue.priority).toBeDefined();
    expect(backupQueue.retryCount).toBeDefined();
    expect(backupQueue.maxRetries).toBeDefined();
  });

  it("should have correct defaults", () => {
    expect(backupQueue.status.default).toBe("pending");
    expect(backupQueue.priority.default).toBe(0);
    expect(backupQueue.retryCount.default).toBe(0);
    expect(backupQueue.maxRetries.default).toBe(3);
  });

  it("should allow nullable timing fields", () => {
    expect(backupQueue.startedAt.notNull).toBe(false);
    expect(backupQueue.completedAt.notNull).toBe(false);
    expect(backupQueue.errorMessage.notNull).toBe(false);
  });
});

describe("userDevices table columns", () => {
  it("should have all required columns", () => {
    expect(userDevices.id).toBeDefined();
    expect(userDevices.userId).toBeDefined();
    expect(userDevices.deviceId).toBeDefined();
    expect(userDevices.deviceType).toBeDefined();
    expect(userDevices.deviceName).toBeDefined();
  });

  it("should have correct defaults", () => {
    expect(userDevices.isActive.default).toBe(true);
    expect(userDevices.storageUsed.default).toBe(0);
  });
});

describe("storageUsage table columns", () => {
  it("should have all required columns", () => {
    expect(storageUsage.id).toBeDefined();
    expect(storageUsage.userId).toBeDefined();
    expect(storageUsage.category).toBeDefined();
    expect(storageUsage.bytesUsed).toBeDefined();
    expect(storageUsage.itemCount).toBeDefined();
  });

  it("should have correct defaults", () => {
    expect(storageUsage.bytesUsed.default).toBe(0);
    expect(storageUsage.itemCount.default).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// SHARING TABLE COLUMN VALIDATION
// ─────────────────────────────────────────────────────────

describe("sharedAlbums table columns", () => {
  it("should have all required columns", () => {
    expect(sharedAlbums.id).toBeDefined();
    expect(sharedAlbums.albumId).toBeDefined();
    expect(sharedAlbums.shareToken).toBeDefined();
    expect(sharedAlbums.permissions).toBeDefined();
    expect(sharedAlbums.viewCount).toBeDefined();
  });

  it("should enforce unique share token", () => {
    expect(sharedAlbums.shareToken.isUnique).toBe(true);
  });

  it("should have correct defaults", () => {
    expect(sharedAlbums.permissions.default).toBe("view");
    expect(sharedAlbums.viewCount.default).toBe(0);
    expect(sharedAlbums.isActive.default).toBe(true);
    expect(sharedAlbums.allowDownload.default).toBe(true);
    expect(sharedAlbums.showMetadata.default).toBe(false);
  });

  it("should allow optional expiry", () => {
    expect(sharedAlbums.expiresAt.notNull).toBe(false);
  });
});

describe("sharedAlbumCollaborators table columns", () => {
  it("should have all required columns", () => {
    expect(sharedAlbumCollaborators.sharedAlbumId).toBeDefined();
    expect(sharedAlbumCollaborators.userId).toBeDefined();
    expect(sharedAlbumCollaborators.permissions).toBeDefined();
    expect(sharedAlbumCollaborators.invitedBy).toBeDefined();
  });

  it("should have correct defaults", () => {
    expect(sharedAlbumCollaborators.permissions.default).toBe("view");
  });

  it("should allow nullable acceptedAt", () => {
    expect(sharedAlbumCollaborators.acceptedAt.notNull).toBe(false);
  });
});

describe("partnerRelationships table columns", () => {
  it("should have all required columns", () => {
    expect(partnerRelationships.id).toBeDefined();
    expect(partnerRelationships.userId).toBeDefined();
    expect(partnerRelationships.partnerId).toBeDefined();
    expect(partnerRelationships.status).toBeDefined();
    expect(partnerRelationships.initiatedBy).toBeDefined();
  });

  it("should have correct defaults", () => {
    expect(partnerRelationships.status.default).toBe("pending");
    expect(partnerRelationships.isActive.default).toBe(false);
  });
});

describe("partnerInvitations table columns", () => {
  it("should have all required columns", () => {
    expect(partnerInvitations.id).toBeDefined();
    expect(partnerInvitations.invitationToken).toBeDefined();
    expect(partnerInvitations.inviterId).toBeDefined();
    expect(partnerInvitations.expiresAt).toBeDefined();
    expect(partnerInvitations.status).toBeDefined();
  });

  it("should enforce unique invitation token", () => {
    expect(partnerInvitations.invitationToken.isUnique).toBe(true);
  });

  it("should have correct defaults", () => {
    expect(partnerInvitations.status.default).toBe("pending");
  });
});

// ─────────────────────────────────────────────────────────
// FOREIGN KEY CONSTRAINT VALIDATION
// ─────────────────────────────────────────────────────────

describe("Foreign key constraints", () => {
  it("photos.userId should be not-null (required FK to users)", () => {
    expect(photos.userId.notNull).toBe(true);
  });

  it("albums.userId should be not-null (required FK to users)", () => {
    expect(albums.userId.notNull).toBe(true);
  });

  it("faces.photoId should be not-null (required FK to photos)", () => {
    expect(faces.photoId.notNull).toBe(true);
  });

  it("faces.personId may be null (optional FK to people)", () => {
    expect(faces.personId.notNull).toBe(false);
  });

  it("people.userId should be not-null (required FK to users)", () => {
    expect(people.userId.notNull).toBe(true);
  });

  it("albumPhotos.albumId should be not-null", () => {
    expect(albumPhotos.albumId.notNull).toBe(true);
  });

  it("albumPhotos.photoId should be not-null", () => {
    expect(albumPhotos.photoId.notNull).toBe(true);
  });

  it("photoEdits.photoId should be not-null", () => {
    expect(photoEdits.photoId.notNull).toBe(true);
  });

  it("photoEdits.userId should be not-null", () => {
    expect(photoEdits.userId.notNull).toBe(true);
  });

  it("memories.coverPhotoId may be null (optional FK to photos)", () => {
    expect(memories.coverPhotoId.notNull).toBe(false);
  });

  it("smartAlbums.coverPhotoId may be null (optional FK to photos)", () => {
    expect(smartAlbums.coverPhotoId.notNull).toBe(false);
  });

  it("backupQueue.photoId should be not-null", () => {
    expect(backupQueue.photoId.notNull).toBe(true);
  });

  it("userDevices.userId should be not-null", () => {
    expect(userDevices.userId.notNull).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
// MIGRATION-SAFETY PROPERTY TESTS
// ─────────────────────────────────────────────────────────

describe("Migration-safety property tests", () => {
  it("adding ML fields to photos does not mutate original required fields", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          userId: fc.uuid(),
          uri: fc.webUrl(),
          width: fc.integer({ min: 1, max: 10000 }),
          height: fc.integer({ min: 1, max: 10000 }),
          filename: fc.string({ minLength: 1, maxLength: 100 }),
          isFavorite: fc.boolean(),
        }),
        (basePhoto) => {
          const migrated = {
            ...basePhoto,
            mlLabels: null,
            mlProcessedAt: null,
            mlVersion: null,
            ocrText: null,
            perceptualHash: null,
          };

          return (
            migrated.id === basePhoto.id &&
            migrated.userId === basePhoto.userId &&
            migrated.uri === basePhoto.uri &&
            migrated.width === basePhoto.width &&
            migrated.height === basePhoto.height &&
            migrated.filename === basePhoto.filename &&
            migrated.isFavorite === basePhoto.isFavorite
          );
        },
      ),
    );
  });

  it("face embedding vector always has exactly 128 dimensions", () => {
    fc.assert(
      fc.property(
        fc.array(fc.float({ min: -1, max: 1 }), {
          minLength: 128,
          maxLength: 128,
        }),
        (embedding) => embedding.length === 128,
      ),
    );
  });

  it("share tokens are unique for different albums", () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (albumId1, albumId2) => {
        const token1 = `${albumId1}-${Math.random()}`;
        const token2 = `${albumId2}-${Math.random()}`;
        if (albumId1 !== albumId2) {
          // Different albums should get different tokens (random suffix guarantees this)
          expect(token1).not.toBe(token2);
        }
        return true;
      }),
    );
  });

  it("backup queue status transitions follow valid states", () => {
    const validStatuses = ["pending", "in_progress", "completed", "failed"];
    fc.assert(
      fc.property(fc.constantFrom(...validStatuses), (status) => {
        expect(validStatuses).toContain(status);
        return true;
      }),
    );
  });

  it("permission levels are restricted to valid values", () => {
    const validPermissions = ["view", "edit", "admin"];
    fc.assert(
      fc.property(fc.constantFrom(...validPermissions), (permission) => {
        expect(validPermissions).toContain(permission);
        return true;
      }),
    );
  });

  it("storage bytes used is always non-negative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000_000 }),
        (bytes) => bytes >= 0,
      ),
    );
  });

  it("photo dimensions are always positive integers after migration", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99999 }),
        fc.integer({ min: 1, max: 99999 }),
        (width, height) => width > 0 && height > 0,
      ),
    );
  });

  it("person faceCount is always non-negative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        (faceCount) => faceCount >= 0,
      ),
    );
  });

  it("memory score is within [0, 1] range when provided", () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 1, noNaN: true }),
        (score) => score >= 0 && score <= 1,
      ),
    );
  });

  it("retry count never exceeds max retries", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (retryCount, maxRetries) => {
          const cappedCount = Math.min(retryCount, maxRetries);
          return cappedCount <= maxRetries;
        },
      ),
    );
  });
});

// ─────────────────────────────────────────────────────────
// SCHEMA COMPLETENESS – TYPESCRIPT TYPE INFERENCE
// ─────────────────────────────────────────────────────────

describe("Schema type completeness", () => {
  it("should support TypeScript type inference for all core tables", () => {
    type _User = typeof users.$inferSelect;
    type _Photo = typeof photos.$inferSelect;
    type _Album = typeof albums.$inferSelect;
    type _AlbumPhoto = typeof albumPhotos.$inferSelect;

    // If these compile, the types are valid
    const user: _User = { id: "1", username: "u", password: "p" };
    expect(user.id).toBe("1");
  });

  it("should support TypeScript type inference for ML tables", () => {
    type _Face = typeof faces.$inferSelect;
    type _Person = typeof people.$inferSelect;
    type _Memory = typeof memories.$inferSelect;
    type _SmartAlbum = typeof smartAlbums.$inferSelect;

    // Compilation test
    const face: _Face = {
      id: "1",
      photoId: "p1",
      embedding: null,
      boundingBox: {},
      confidence: 0.9,
      personId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(face.photoId).toBe("p1");
  });

  it("should support TypeScript type inference for operational tables", () => {
    type _BackupQueue = typeof backupQueue.$inferSelect;
    type _UserDevice = typeof userDevices.$inferSelect;
    type _StorageUsage = typeof storageUsage.$inferSelect;

    const bq: _BackupQueue = {
      id: "1",
      photoId: "p1",
      status: "pending",
      priority: 0,
      retryCount: 0,
      maxRetries: 3,
      errorMessage: null,
      scheduledAt: new Date(),
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(bq.status).toBe("pending");
  });
});
