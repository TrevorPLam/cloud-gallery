// AI-META-BEGIN
// AI-META: Database schema definitions using Drizzle ORM for user authentication
// OWNERSHIP: shared/schema
// ENTRYPOINTS: imported by server/storage.ts and any DB migration scripts
// DEPENDENCIES: drizzle-orm (schema builder), drizzle-zod (validation), zod
// DANGER: schema changes require database migrations; password field stores plaintext (hash before storing); unique constraint on username prevents duplicates
// CHANGE-SAFETY: adding fields is safe with defaults; removing fields requires migration; changing types is risky
// TESTS: check:types, db:push for schema validation
// AI-META-END

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  decimal,
  real,
  vector,
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// AI-NOTE: UUID default uses Postgres gen_random_uuid() for server-side generation; ensures uniqueness without client coordination
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password"), // Made nullable for SRP migration - will be removed after migration
  srpSalt: text("srp_salt"), // SRP salt for verifier generation
  srpVerifier: text("srp_verifier"), // SRP verifier for authentication
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  srpSalt: true,
  srpVerifier: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─────────────────────────────────────────────────────────
// PASSWORD RESET TOKENS TABLE
// ─────────────────────────────────────────────────────────
// Stores password reset tokens with security controls
// Each token is single-use and expires after 15 minutes

export const passwordResetTokens = pgTable("password_reset_tokens", {
  // Primary key - unique ID for this token request
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Foreign key - WHICH user this token is for
  // references(() => users.id) = must match a real user
  // onDelete: 'cascade' = if user deleted, delete their tokens too
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Hashed token (never store plaintext tokens)
  // Argon2 hash of the 32-byte random token
  token: text("token").notNull(),

  // Expiration time (15 minutes from creation)
  // Prevents token reuse after expiration window
  expiresAt: timestamp("expires_at").notNull(),

  // Single-use tracking (null until used)
  // Set when token is successfully used for password reset
  usedAt: timestamp("used_at"),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).pick({
  userId: true,
  token: true,
  expiresAt: true,
});

export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// ─────────────────────────────────────────────────────────
// PHOTOS TABLE
// ─────────────────────────────────────────────────────────
// Stores all photos with metadata, linked to users
// Each row = one photo someone uploaded

export const photos = pgTable("photos", {
  // Primary key - unique ID for THIS photo
  // gen_random_uuid() = Postgres generates a UUID automatically
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Foreign key - WHO owns this photo
  // references(() => users.id) = must match a real user
  // onDelete: 'cascade' = if user deleted, delete their photos too
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Storage location for the image file
  // Could be: S3 URL, filesystem path, CDN URL, etc.
  uri: text("uri").notNull(),

  // Image dimensions (for layout calculations)
  width: integer("width").notNull(),
  height: integer("height").notNull(),

  // Display filename (what user sees)
  filename: text("filename").notNull(),

  // Is this a favorite? (for filtering)
  isFavorite: boolean("is_favorite").default(false).notNull(),

  // Timestamps - track when created and last changed
  // defaultNow() = automatically set to current time
  createdAt: timestamp("created_at").defaultNow().notNull(),
  modifiedAt: timestamp("modified_at").defaultNow().notNull(),

  // ─── Optional metadata fields (can be null) ───

  // GPS location data (stored as JSON)
  // Example: { latitude: 37.7749, longitude: -122.4194, city: "SF" }
  location: jsonb("location"),

  // Camera information (stored as JSON)
  // Example: { make: "Apple", model: "iPhone 13", iso: 100 }
  camera: jsonb("camera"),

  // Raw EXIF data from photo (stored as JSON)
  // EXIF = metadata embedded in photo files
  exif: jsonb("exif"),

  // User-added tags (stored as array of strings)
  // Example: ["vacation", "beach", "2024"]
  tags: text("tags").array(),

  // User notes/caption for this photo
  notes: text("notes"),

  // Privacy flag - should this be hidden?
  isPrivate: boolean("is_private").default(false).notNull(),

  // Soft delete timestamp
  deletedAt: timestamp("deleted_at"),

  // ─── ML/AI fields ───

  // Detected objects and scenes from ML analysis
  // Example: ["beach", "ocean", "sunset", "people"]
  mlLabels: text("ml_labels").array(),

  // When ML analysis was last performed
  mlProcessedAt: timestamp("ml_processed_at", {
    mode: "date",
    withTimezone: true,
  }),

  // Version of ML model used for analysis
  mlVersion: varchar("ml_version", { length: 20 }),

  // Extracted text from OCR (for screenshots, documents)
  ocrText: text("ocr_text"),

  // Language detected for OCR text
  ocrLanguage: varchar("ocr_language", { length: 5 }),

  // Perceptual hash for duplicate detection
  perceptualHash: varchar("perceptual_hash", { length: 64 }),

  // Group ID for duplicate photos (photos that are similar)
  duplicateGroupId: varchar("duplicate_group_id"),

  // Is this a video file?
  isVideo: boolean("is_video").default(false).notNull(),

  // Duration in seconds (for videos)
  videoDuration: integer("video_duration"),

  // Thumbnail URI for videos
  videoThumbnailUri: text("video_thumbnail_uri"),

  // Backup status: pending, in_progress, completed, failed
  backupStatus: varchar("backup_status", { length: 20 }),

  // When backup was completed
  backupCompletedAt: timestamp("backup_completed_at", {
    mode: "date",
    withTimezone: true,
  }),

  // Original file size in bytes
  originalSize: integer("original_size"),

  // Compressed file size in bytes
  compressedSize: integer("compressed_size"),

  // ─── Live Photo fields ───

  // Is this a Live Photo (contains motion video)?
  isLivePhoto: boolean("is_live_photo").default(false).notNull(),

  // URI for the motion video component (separate from main photo)
  liveVideoUri: text("live_video_uri"),

  // Presentation timestamp in microseconds (when to show still frame in video)
  livePresentationTimestampUs: integer("live_presentation_timestamp_us"),

  // Live Photo format: "apple", "android", or null
  livePhotoFormat: varchar("live_photo_format", { length: 10 }),

  // Asset identifier that links still and motion components
  liveAssetIdentifier: varchar("live_asset_identifier", { length: 255 }),

  // Video duration for Live Photos (typically 3 seconds)
  liveVideoDuration: integer("live_video_duration"),

  // When Live Photo processing was completed
  liveProcessedAt: timestamp("live_processed_at", {
    mode: "date",
    withTimezone: true,
  }),

  // ─── End-to-End Encryption fields ───

  // Is this photo encrypted on the server?
  encrypted: boolean("encrypted").default(false).notNull(),

  // Encryption metadata (IV, authTag, etc.) - only stored if encrypted=true
  encryptionMetadata: jsonb("encryption_metadata"),

  // ─── Object Storage fields ───

  // Object key in storage (e.g., "userId/uuid.jpg")
  // Used instead of local filesystem paths
  objectKey: text("object_key"),

  // Storage provider: "s3", "b2", "minio", or null for local storage
  storageProvider: varchar("storage_provider", { length: 10 }),

  // Original filename before sanitization
  originalName: text("original_name"),

  // File hash for integrity verification
  fileHash: varchar("file_hash", { length: 64 }),

  // MIME type of the uploaded file
  mimeType: varchar("mime_type", { length: 100 }),

  // File extension
  extension: varchar("extension", { length: 10 }),
});

// ─────────────────────────────────────────────────────────
// VALIDATION SCHEMAS (using Zod)
// ─────────────────────────────────────────────────────────
// These ensure data is correct BEFORE saving to database

// For creating new photos (INSERT operations)
// omit() = don't require these fields (DB generates them)
export const insertPhotoSchema = createInsertSchema(photos).omit({
  id: true, // DB auto-generates UUID
  createdAt: true, // DB auto-sets timestamp
  modifiedAt: true, // DB auto-sets timestamp
});

// For reading photos (SELECT operations)
export const selectPhotoSchema = createSelectSchema(photos);

// ─────────────────────────────────────────────────────────
// TYPESCRIPT TYPES
// ─────────────────────────────────────────────────────────
// Auto-generated types for TypeScript type checking

export type Photo = typeof photos.$inferSelect; // Complete photo from DB
export type InsertPhoto = z.infer<typeof insertPhotoSchema>; // For creating new photo

// ─────────────────────────────────────────────────────────
// ALBUMS TABLE
// ─────────────────────────────────────────────────────────
// Collections/folders of photos organized by user

export const albums = pgTable("albums", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Who created this album
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Album name (e.g., "Summer Vacation 2024")
  title: text("title").notNull(),

  // Optional longer description
  description: text("description"),

  // Cover photo shown as album thumbnail
  // Stores URI (not actual photo ID) for performance
  coverPhotoUri: text("cover_photo_uri"),

  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  modifiedAt: timestamp("modified_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────
// ALBUM_PHOTOS JUNCTION TABLE
// ─────────────────────────────────────────────────────────
// Links photos to albums (many-to-many relationship)
// One photo can be in multiple albums
// One album can contain multiple photos

export const albumPhotos = pgTable(
  "album_photos",
  {
    // Which album?
    albumId: varchar("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),

    // Which photo?
    photoId: varchar("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),

    // When was photo added to this album?
    addedAt: timestamp("added_at").defaultNow().notNull(),

    // Order/position in album (for sorting)
    // Lower number = appears first
    position: integer("position").default(0).notNull(),
  },
  (table) => {
    // Composite primary key = combination of albumId + photoId must be unique
    // Prevents adding same photo to album twice
    return {
      pk: primaryKey({ columns: [table.albumId, table.photoId] }),
    };
  },
);

export const insertAlbumSchema = createInsertSchema(albums).omit({
  id: true,
  createdAt: true,
  modifiedAt: true,
});

export const selectAlbumSchema = createSelectSchema(albums);

// ─────────────────────────────────────────────────────────
// TYPESCRIPT TYPES
// ─────────────────────────────────────────────────────────

export type Album = typeof albums.$inferSelect;
export type InsertAlbum = z.infer<typeof insertAlbumSchema>;
export type AlbumPhoto = typeof albumPhotos.$inferSelect;

// ─────────────────────────────────────────────────────────
// FACES TABLE
// ─────────────────────────────────────────────────────────
// Stores detected faces in photos with embedding vectors

export const faces = pgTable("faces", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Which photo contains this face
  photoId: varchar("photo_id")
    .notNull()
    .references(() => photos.id, { onDelete: "cascade" }),

  // Face embedding vector (128-dimensional for face recognition)
  // Using pgvector extension for similarity search
  embedding: vector("embedding", { dimensions: 128 }),

  // Bounding box of face in photo (stored as JSON)
  // Example: { x: 100, y: 150, width: 200, height: 250 }
  boundingBox: jsonb("bounding_box").notNull(),

  // Confidence score from face detection (0.0 to 1.0)
  confidence: real("confidence").notNull(),

  // Which person this face belongs to (null if unassigned)
  personId: varchar("person_id").references(() => people.id, {
    onDelete: "set null",
  }),

  // Timestamps
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────────────────
// PEOPLE TABLE
// ─────────────────────────────────────────────────────────
// Represents unique individuals (clusters of faces)

export const people = pgTable("people", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Who owns this person entry
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Name given by user (null if unnamed)
  name: text("name"),

  // Is this person pinned/favorite?
  isPinned: boolean("is_pinned").default(false).notNull(),

  // Is this person hidden?
  isHidden: boolean("is_hidden").default(false).notNull(),

  // Cluster quality score (0.0 to 1.0, higher = better clustering)
  clusterQuality: real("cluster_quality"),

  // Number of faces in this cluster
  faceCount: integer("face_count").default(0).notNull(),

  // Timestamps
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────────────────
// SHARED ALBUMS TABLE
// ─────────────────────────────────────────────────────────
// Albums shared with other users

export const sharedAlbums = pgTable("shared_albums", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Which album is being shared
  albumId: varchar("album_id")
    .notNull()
    .references(() => albums.id, { onDelete: "cascade" }),

  // Unique token for accessing shared album
  shareToken: varchar("share_token", { length: 64 }).notNull().unique(),

  // Optional password for protected sharing
  passwordHash: varchar("password_hash", { length: 255 }),

  // Share permissions: view, edit, admin
  permissions: varchar("permissions", { length: 20 }).default("view").notNull(),

  // When share expires (null = never expires)
  expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),

  // Number of times this shared album was viewed
  viewCount: integer("view_count").default(0).notNull(),

  // Is this share currently active?
  isActive: boolean("is_active").default(true).notNull(),

  // Public link specific settings
  // Allow downloads from public link
  allowDownload: boolean("allow_download").default(true).notNull(),

  // Show photo metadata in public view
  showMetadata: boolean("show_metadata").default(false).notNull(),

  // Custom title for public view (overrides album title)
  customTitle: varchar("custom_title", { length: 255 }),

  // Custom description for public view
  customDescription: text("custom_description"),

  // Timestamps
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────────────────
// SHARED ALBUM COLLABORATORS TABLE
// ─────────────────────────────────────────────────────────
// Users who collaborate on shared albums

export const sharedAlbumCollaborators = pgTable(
  "shared_album_collaborators",
  {
    // Which shared album
    sharedAlbumId: varchar("shared_album_id")
      .notNull()
      .references(() => sharedAlbums.id, { onDelete: "cascade" }),

    // Which user is the collaborator
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Permissions: view, edit, admin
    permissions: varchar("permissions", { length: 20 })
      .default("view")
      .notNull(),

    // Who invited this collaborator
    invitedBy: varchar("invited_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // When invitation was accepted
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.sharedAlbumId, table.userId] }),
    };
  },
);

// ─────────────────────────────────────────────────────────
// PHOTO EDITS TABLE
// ─────────────────────────────────────────────────────────
// History of photo edits for undo/redo functionality

export const photoEdits = pgTable("photo_edits", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Which photo was edited
  photoId: varchar("photo_id")
    .notNull()
    .references(() => photos.id, { onDelete: "cascade" }),

  // Who made this edit
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Type of edit: crop, filter, adjustment, etc.
  editType: varchar("edit_type", { length: 50 }).notNull(),

  // Edit parameters (stored as JSON)
  // Example: { brightness: 1.2, contrast: 1.1, saturation: 0.9 }
  parameters: jsonb("parameters").notNull(),

  // Edit version (for ordering)
  version: integer("version").notNull(),

  // Thumbnail of edited version
  thumbnailUri: text("thumbnail_uri"),

  // Timestamps
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────────────────
// MEMORIES TABLE
// ─────────────────────────────────────────────────────────
// Auto-generated memories (On this day, highlights, etc.)

export const memories = pgTable("memories", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Who this memory belongs to
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Memory type: on_this_day, monthly_highlights, year_in_review
  memoryType: varchar("memory_type", { length: 50 }).notNull(),

  // Memory title (auto-generated)
  title: text("title").notNull(),

  // Memory description
  description: text("description"),

  // Date range for memory
  startDate: timestamp("start_date", {
    mode: "date",
    withTimezone: true,
  }).notNull(),
  endDate: timestamp("end_date", {
    mode: "date",
    withTimezone: true,
  }).notNull(),

  // Cover photo for memory
  coverPhotoId: varchar("cover_photo_id").references(() => photos.id, {
    onDelete: "set null",
  }),

  // Number of photos in memory
  photoCount: integer("photo_count").default(0).notNull(),

  // Memory score (0.0 to 1.0, higher = better memory)
  score: real("score"),

  // Is this memory favorited by user?
  isFavorite: boolean("is_favorite").default(false).notNull(),

  // Is this memory hidden?
  isHidden: boolean("is_hidden").default(false).notNull(),

  // Timestamps
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────────────────
// SMART ALBUMS TABLE
// ─────────────────────────────────────────────────────────
// Auto-generated albums based on ML analysis

export const smartAlbums = pgTable("smart_albums", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Who this smart album belongs to
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Smart album type: people, places, things, special
  albumType: varchar("album_type", { length: 50 }).notNull(),

  // Album title (auto-generated)
  title: text("title").notNull(),

  // Album description
  description: text("description"),

  // Filter criteria (stored as JSON)
  // Example: { labels: ["beach", "ocean"], dateRange: { start: "2024-01-01", end: "2024-12-31" } }
  criteria: jsonb("criteria").notNull(),

  // Cover photo for smart album
  coverPhotoId: varchar("cover_photo_id").references(() => photos.id, {
    onDelete: "set null",
  }),

  // Number of photos in smart album
  photoCount: integer("photo_count").default(0).notNull(),

  // Is this smart album pinned?
  isPinned: boolean("is_pinned").default(false).notNull(),

  // Is this smart album hidden?
  isHidden: boolean("is_hidden").default(false).notNull(),

  // When smart album was last updated
  lastUpdatedAt: timestamp("last_updated_at", {
    mode: "date",
    withTimezone: true,
  }),

  // Timestamps
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────────────────
// BACKUP QUEUE TABLE
// ─────────────────────────────────────────────────────────
// Queue for managing backup operations

export const backupQueue = pgTable("backup_queue", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Which photo is queued for backup
  photoId: varchar("photo_id")
    .notNull()
    .references(() => photos.id, { onDelete: "cascade" }),

  // Backup status: pending, in_progress, completed, failed
  status: varchar("status", { length: 20 }).default("pending").notNull(),

  // Priority level (lower number = higher priority)
  priority: integer("priority").default(0).notNull(),

  // Number of retry attempts
  retryCount: integer("retry_count").default(0).notNull(),

  // Maximum retry attempts
  maxRetries: integer("max_retries").default(3).notNull(),

  // Error message (if failed)
  errorMessage: text("error_message"),

  // When this backup was scheduled
  scheduledAt: timestamp("scheduled_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),

  // When this backup was started
  startedAt: timestamp("started_at", { mode: "date", withTimezone: true }),

  // When this backup was completed
  completedAt: timestamp("completed_at", { mode: "date", withTimezone: true }),

  // Timestamps
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────────────────
// USER DEVICES TABLE
// ─────────────────────────────────────────────────────────
// Track user devices for multi-device sync

export const userDevices = pgTable(
  "user_devices",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Which user owns this device
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Device identifier (unique per user)
    deviceId: varchar("device_id", { length: 255 }).notNull(),

    // Device type: phone, tablet, web, desktop
    deviceType: varchar("device_type", { length: 20 }).notNull(),

    // Device name (user-friendly)
    deviceName: varchar("device_name", { length: 100 }).notNull(),

    // Last sync timestamp
    lastSyncAt: timestamp("last_sync_at", { mode: "date", withTimezone: true }),

    // Is this device currently active?
    isActive: boolean("is_active").default(true).notNull(),

    // Storage used on this device (in bytes)
    storageUsed: integer("storage_used").default(0).notNull(),

    // App version on this device
    appVersion: varchar("app_version", { length: 20 }),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      // Unique constraint on userId + deviceId
      userIdDeviceIdUnique: sql`UNIQUE(user_id, device_id)`,
    };
  },
);

// ─────────────────────────────────────────────────────────
// PARTNER RELATIONSHIPS TABLE
// ─────────────────────────────────────────────────────────
// Partner relationships between users for photo sharing

export const partnerRelationships = pgTable(
  "partner_relationships",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // User who initiated the partnership
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // User who is the partner
    partnerId: varchar("partner_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Partnership status: pending, accepted, declined, revoked
    status: varchar("status", { length: 20 }).default("pending").notNull(),

    // Who initiated this partnership request
    initiatedBy: varchar("initiated_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // When the partnership was accepted
    acceptedAt: timestamp("accepted_at", { mode: "date", withTimezone: true }),

    // When the partnership ends (optional)
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }),

    // Whether partnership is currently active
    isActive: boolean("is_active").default(false).notNull(),

    // Privacy settings for this partnership
    privacySettings: jsonb("privacy_settings"),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      // Unique constraint on user + partner (prevents duplicate partnerships)
      userIdPartnerIdUnique: sql`UNIQUE(user_id, partner_id)`,
      // Check that user cannot partner with themselves
      userIdNotPartnerId: sql`CHECK(user_id != partner_id)`,
    };
  },
);

// ─────────────────────────────────────────────────────────
// PARTNER INVITATIONS TABLE
// ─────────────────────────────────────────────────────────
// Partner invitations with secure tokens

export const partnerInvitations = pgTable("partner_invitations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Unique invitation token
  invitationToken: varchar("invitation_token", { length: 128 })
    .notNull()
    .unique(),

  // User who sent the invitation
  inviterId: varchar("inviter_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Email of the invited partner (if not yet a user)
  inviteeEmail: text("invitee_email"),

  // User ID of the invited partner (if already a user)
  inviteeId: varchar("invitee_id").references(() => users.id, {
    onDelete: "cascade",
  }),

  // Invitation status: pending, accepted, declined, expired
  status: varchar("status", { length: 20 }).default("pending").notNull(),

  // Invitation message from inviter
  message: text("message"),

  // When the invitation expires
  expiresAt: timestamp("expires_at", {
    mode: "date",
    withTimezone: true,
  }).notNull(),

  // When the invitation was responded to
  respondedAt: timestamp("responded_at", { mode: "date", withTimezone: true }),

  // Timestamps
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────────────────
// PARTNER AUTO-SHARE RULES TABLE
// ─────────────────────────────────────────────────────────
// Auto-share rules for partner relationships

export const partnerAutoShareRules = pgTable("partner_auto_share_rules", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),

  // Which partnership this rule belongs to
  partnershipId: varchar("partnership_id")
    .notNull()
    .references(() => partnerRelationships.id, { onDelete: "cascade" }),

  // User who created this rule
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  // Rule name for identification
  name: varchar("name", { length: 100 }).notNull(),

  // Rule type: all_photos, date_range, people, content_type
  ruleType: varchar("rule_type", { length: 20 }).notNull(),

  // Whether this rule is currently active
  isActive: boolean("is_active").default(true).notNull(),

  // Rule criteria (stored as JSON)
  criteria: jsonb("criteria").notNull(),

  // Priority of this rule (higher = more priority)
  priority: integer("priority").default(0).notNull(),

  // Timestamps
  createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ─────────────────────────────────────────────────────────
// PARTNER SHARED PHOTOS TABLE
// ─────────────────────────────────────────────────────────
// Track which photos are shared with which partners

export const partnerSharedPhotos = pgTable(
  "partner_shared_photos",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Which photo is being shared
    photoId: varchar("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),

    // Partnership this sharing belongs to
    partnershipId: varchar("partnership_id")
      .notNull()
      .references(() => partnerRelationships.id, { onDelete: "cascade" }),

    // User who shared this photo
    sharedBy: varchar("shared_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Which rule triggered this share (if any)
    ruleId: varchar("rule_id").references(() => partnerAutoShareRules.id, {
      onDelete: "set null",
    }),

    // Whether the partner has saved this photo
    isSavedByPartner: boolean("is_saved_by_partner").default(false).notNull(),

    // When the partner saved this photo
    savedAt: timestamp("saved_at", { mode: "date", withTimezone: true }),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      // Unique constraint on photo + partnership (prevents duplicate sharing)
      photoPartnershipUnique: sql`UNIQUE(photo_id, partnership_id)`,
    };
  },
);

// ─────────────────────────────────────────────────────────
// STORAGE USAGE TABLE
// ─────────────────────────────────────────────────────────
// Track storage usage by category

export const storageUsage = pgTable(
  "storage_usage",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),

    // Which user this usage belongs to
    userId: varchar("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    // Usage category: photos, videos, thumbnails, cache
    category: varchar("category", { length: 20 }).notNull(),

    // Storage used in bytes
    bytesUsed: integer("bytes_used").default(0).notNull(),

    // Number of items in this category
    itemCount: integer("item_count").default(0).notNull(),

    // Last calculated timestamp
    calculatedAt: timestamp("calculated_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    // Timestamps
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => {
    return {
      // Unique constraint on userId + category
      userIdCategoryUnique: sql`UNIQUE(user_id, category)`,
    };
  },
);

// ─────────────────────────────────────────────────────────
// VALIDATION SCHEMAS FOR NEW TABLES
// ─────────────────────────────────────────────────────────

export const insertFaceSchema = createInsertSchema(faces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
} as const);

export const selectFaceSchema = createSelectSchema(faces);

export const insertPersonSchema = createInsertSchema(people).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
} as const);

export const selectPersonSchema = createSelectSchema(people);

export const insertSharedAlbumSchema = createInsertSchema(sharedAlbums).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
} as const);

export const selectSharedAlbumSchema = createSelectSchema(sharedAlbums);

export const insertSharedAlbumCollaboratorSchema = createInsertSchema(
  sharedAlbumCollaborators,
).omit({
  sharedAlbumId: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
} as const);

export const selectSharedAlbumCollaboratorSchema = createSelectSchema(
  sharedAlbumCollaborators,
);

export const insertPhotoEditSchema = createInsertSchema(photoEdits).omit({
  id: true,
  createdAt: true,
} as const);

export const selectPhotoEditSchema = createSelectSchema(photoEdits);

export const insertMemorySchema = createInsertSchema(memories).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
} as const);

export const selectMemorySchema = createSelectSchema(memories);

export const insertSmartAlbumSchema = createInsertSchema(smartAlbums).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
} as const);

export const selectSmartAlbumSchema = createSelectSchema(smartAlbums);

export const insertBackupQueueSchema = createInsertSchema(backupQueue).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
} as const);

export const selectBackupQueueSchema = createSelectSchema(backupQueue);

export const insertUserDeviceSchema = createInsertSchema(userDevices).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
} as const);

export const selectUserDeviceSchema = createSelectSchema(userDevices);

export const insertStorageUsageSchema = createInsertSchema(storageUsage).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
} as const);

export const selectStorageUsageSchema = createSelectSchema(storageUsage);

// ─────────────────────────────────────────────────────────
// VALIDATION SCHEMAS FOR PARTNER SHARING TABLES
// ─────────────────────────────────────────────────────────
// Note: Validation schemas temporarily disabled due to Drizzle ORM type issues
// These can be re-enabled once the Drizzle ORM types are resolved

// export const insertPartnerRelationshipSchema = createInsertSchema(partnerRelationships).omit({
//   id: true,
//   createdAt: true,
//   updatedAt: true,
// });

export const selectPartnerRelationshipSchema =
  createSelectSchema(partnerRelationships);

// export const insertPartnerInvitationSchema = createInsertSchema(partnerInvitations).omit({
//   id: true,
//   invitationToken: true,
//   createdAt: true,
//   updatedAt: true,
// });

export const selectPartnerInvitationSchema =
  createSelectSchema(partnerInvitations);

// export const insertPartnerAutoShareRuleSchema = createInsertSchema(partnerAutoShareRules).omit({
//   id: true,
//   partnershipId: true,
//   createdAt: true,
//   updatedAt: true,
// });

export const selectPartnerAutoShareRuleSchema = createSelectSchema(
  partnerAutoShareRules,
);

// export const insertPartnerSharedPhotoSchema = createInsertSchema(partnerSharedPhotos).omit({
//   id: true,
//   createdAt: true,
//   updatedAt: true,
// });

export const selectPartnerSharedPhotoSchema =
  createSelectSchema(partnerSharedPhotos);

// ─────────────────────────────────────────────────────────
// TYPESCRIPT TYPES FOR NEW TABLES
// ─────────────────────────────────────────────────────────

export type Face = typeof faces.$inferSelect;
export type InsertFace = z.infer<typeof insertFaceSchema>;
export type Person = typeof people.$inferSelect;
export type InsertPerson = z.infer<typeof insertPersonSchema>;
export type SharedAlbum = typeof sharedAlbums.$inferSelect;
export type InsertSharedAlbum = z.infer<typeof insertSharedAlbumSchema>;
export type SharedAlbumCollaborator =
  typeof sharedAlbumCollaborators.$inferSelect;
export type InsertSharedAlbumCollaborator = z.infer<
  typeof insertSharedAlbumCollaboratorSchema
>;
export type PhotoEdit = typeof photoEdits.$inferSelect;
export type InsertPhotoEdit = z.infer<typeof insertPhotoEditSchema>;
export type Memory = typeof memories.$inferSelect;
export type InsertMemory = z.infer<typeof insertMemorySchema>;
export type SmartAlbum = typeof smartAlbums.$inferSelect;
export type InsertSmartAlbum = z.infer<typeof insertSmartAlbumSchema>;
export type BackupQueue = typeof backupQueue.$inferSelect;
export type InsertBackupQueue = z.infer<typeof insertBackupQueueSchema>;
export type UserDevice = typeof userDevices.$inferSelect;
export type InsertUserDevice = z.infer<typeof insertUserDeviceSchema>;
export type StorageUsage = typeof storageUsage.$inferSelect;
export type InsertStorageUsage = z.infer<typeof insertStorageUsageSchema>;

// Partner sharing types
export type PartnerRelationship = typeof partnerRelationships.$inferSelect;
export type InsertPartnerRelationship = any; // Temporarily any due to schema issues
export type PartnerInvitation = typeof partnerInvitations.$inferSelect;
export type InsertPartnerInvitation = any; // Temporarily any due to schema issues
export type PartnerAutoShareRule = typeof partnerAutoShareRules.$inferSelect;
export type InsertPartnerAutoShareRule = any; // Temporarily any due to schema issues
export type PartnerSharedPhoto = typeof partnerSharedPhotos.$inferSelect;
export type InsertPartnerSharedPhoto = any; // Temporarily any due to schema issues
