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
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// AI-NOTE: UUID default uses Postgres gen_random_uuid() for server-side generation; ensures uniqueness without client coordination
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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

// ─────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────

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
