# Cloud Gallery Shared

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue?logo=typescript)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-0.39.3-blue?logo=drizzle)
![Zod](https://img.shields.io/badge/Zod-3.24.2-blue?logo=zod)

</div>

Shared TypeScript types, database schemas, and validation utilities for Cloud Gallery. This package contains the core data models and business logic used across both client and server applications.

## 🎯 Purpose

The shared package ensures **type safety** and **business logic consistency** across the entire Cloud Gallery ecosystem:

- 🔄 **Single Source of Truth**: All data models in one place
- 🛡️ **Type Safety**: End-to-end TypeScript validation
- ✅ **Runtime Validation**: Zod schemas for API validation
- 🗃️ **Database Schema**: Drizzle ORM definitions
- 📝 **Documentation**: Self-documenting code with JSDoc

## 📁 Package Structure

```
shared/
├── 📝 schema.ts                  # Database schema definitions
├── 🧪 schema.test.ts             # Schema validation tests
├── 📋 types/                     # Additional type definitions (if needed)
└── 📚 README.md                  # This documentation
```

## 🗃️ Database Schema

### Core Entities

#### Users Table
```typescript
export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
```

#### Photos Table
```typescript
export const photos = pgTable("photos", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Foreign key relationship
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  
  // Core photo data
  uri: text("uri").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  filename: text("filename").notNull(),
  
  // User preferences
  isFavorite: boolean("is_favorite").default(false).notNull(),
  isPrivate: boolean("is_private").default(false).notNull(),
  
  // Metadata (JSON fields)
  location: jsonb("location"), // GPS coordinates and address
  camera: jsonb("camera"),     // Camera make, model, settings
  exif: jsonb("exif"),        // Full EXIF data
  tags: text("tags").array(), // User-defined tags
  notes: text("notes"),       // User notes
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  modifiedAt: timestamp("modified_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"), // Soft delete
});

export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;
```

#### Albums Table
```typescript
export const albums = pgTable("albums", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  
  // Foreign key relationship
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  
  // Album data
  title: text("title").notNull(),
  description: text("description"),
  coverPhotoUri: text("cover_photo_uri"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  modifiedAt: timestamp("modified_at").defaultNow().notNull(),
});

export type Album = typeof albums.$inferSelect;
export type InsertAlbum = typeof albums.$inferInsert;
```

#### Album-Photo Junction Table
```typescript
export const albumPhotos = pgTable(
  "album_photos",
  {
    albumId: varchar("album_id")
      .notNull()
      .references(() => albums.id, { onDelete: "cascade" }),
    
    photoId: varchar("photo_id")
      .notNull()
      .references(() => photos.id, { onDelete: "cascade" }),
    
    addedAt: timestamp("added_at").defaultNow().notNull(),
    position: integer("position").default(0).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.albumId, table.photoId] }),
  }),
);

export type AlbumPhoto = typeof albumPhotos.$inferSelect;
export type InsertAlbumPhoto = typeof albumPhotos.$inferInsert;
```

## 🧪 Validation Schemas

### Zod Validation
```typescript
// User validation schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
}).extend({
  username: z.string().min(3).max(50),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  email: z.string().email().optional(),
});

// Photo validation schemas
export const insertPhotoSchema = createInsertSchema(photos).omit({
  id: true,
  createdAt: true,
  modifiedAt: true,
  deletedAt: true,
}).extend({
  uri: z.string().url(),
  width: z.number().min(1),
  height: z.number().min(1),
  filename: z.string().min(1).max(255),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  notes: z.string().max(1000).optional(),
});

// Album validation schemas
export const insertAlbumSchema = createInsertSchema(albums).omit({
  id: true,
  createdAt: true,
  modifiedAt: true,
}).extend({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  coverPhotoUri: z.string().url().optional(),
});
```

### API Request/Response Types
```typescript
// API request types
export interface CreatePhotoRequest {
  uri: string;
  width: number;
  height: number;
  filename: string;
  location?: PhotoLocation;
  camera?: CameraInfo;
  exif?: Record<string, unknown>;
  tags?: string[];
  notes?: string;
  isPrivate?: boolean;
}

export interface UpdatePhotoRequest {
  filename?: string;
  isFavorite?: boolean;
  isPrivate?: boolean;
  location?: PhotoLocation;
  tags?: string[];
  notes?: string;
}

export interface CreateAlbumRequest {
  title: string;
  description?: string;
  coverPhotoUri?: string;
}

export interface AddPhotosToAlbumRequest {
  photoIds: string[];
}

// API response types
export interface PhotoResponse {
  id: string;
  uri: string;
  width: number;
  height: number;
  filename: string;
  isFavorite: boolean;
  isPrivate: boolean;
  location?: PhotoLocation;
  camera?: CameraInfo;
  tags?: string[];
  notes?: string;
  createdAt: string;
  modifiedAt: string;
}

export interface AlbumResponse {
  id: string;
  title: string;
  description?: string;
  coverPhotoUri?: string;
  photoCount: number;
  createdAt: string;
  modifiedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}
```

## 📊 Metadata Types

### Photo Location
```typescript
export interface PhotoLocation {
  latitude: number;    // -90 to 90
  longitude: number;   // -180 to 180
  altitude?: number;   // Meters above sea level
  accuracy?: number;   // GPS accuracy in meters
  address?: string;    // Human-readable address
  city?: string;       // City name
  state?: string;      // State/province
  country?: string;    // Country name
  countryCode?: string; // ISO 3166-1 alpha-2
}
```

### Camera Information
```typescript
export interface CameraInfo {
  make: string;           // Camera manufacturer (e.g., "Apple")
  model: string;          // Camera model (e.g., "iPhone 13 Pro")
  iso?: number;           // ISO sensitivity
  aperture?: string;      // Aperture value (e.g., "f/1.6")
  shutterSpeed?: string;  // Shutter speed (e.g., "1/60")
  focalLength?: number;   // Focal length in mm
  flash?: boolean;        // Flash fired
  lensModel?: string;     // Lens model
  focalLength35mm?: number; // 35mm equivalent focal length
}
```

### EXIF Data
```typescript
export interface EXIFData {
  // Basic EXIF
  dateTime?: string;           // Original capture time
  dateTimeOriginal?: string;    // Original capture time (EXIF format)
  dateTimeDigitized?: string;   // Digitization time
  
  // Camera settings
  exposureTime?: number;        // Exposure time in seconds
  fNumber?: number;            // F-number
  isoSpeedRatings?: number[];  // ISO speed ratings
  focalLength?: number;        // Focal length in mm
  flash?: number;              // Flash mode
  
  // Image properties
  imageWidth?: number;         // Image width
  imageHeight?: number;        // Image height
  orientation?: number;        // Image orientation
  resolutionUnit?: number;      // Resolution unit
  
  // GPS data
  gpsLatitude?: number;         // GPS latitude
  gpsLongitude?: number;        // GPS longitude
  gpsAltitude?: number;         // GPS altitude
  gpsSpeed?: number;           // GPS speed
  
  // Software
  software?: string;           // Software used
  make?: string;               // Camera manufacturer
  model?: string;              // Camera model
  
  // Additional metadata
  [key: string]: unknown;       // Allow additional EXIF fields
}
```

## 🔧 Usage Examples

### Server-Side Usage
```typescript
// In server routes
import { db } from './db';
import { photos, insertPhotoSchema } from '../shared/schema';
import { eq } from 'drizzle-orm';

// Create a new photo
app.post('/api/photos', async (req, res) => {
  try {
    // Validate request body
    const photoData = insertPhotoSchema.parse(req.body);
    
    // Insert into database
    const [photo] = await db.insert(photos)
      .values(photoData)
      .returning();
    
    res.json(photo);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user's photos
app.get('/api/photos', async (req, res) => {
  const userId = req.user.id;
  const userPhotos = await db.select()
    .from(photos)
    .where(eq(photos.userId, userId));
  
  res.json({ photos: userPhotos });
});
```

### Client-Side Usage
```typescript
// In client API calls
import { z } from 'zod';
import { insertPhotoSchema, type Photo } from '@shared/schema';

// Type-safe API call
export async function createPhoto(photoData: unknown): Promise<Photo> {
  // Validate data before sending
  const validatedData = insertPhotoSchema.parse(photoData);
  
  const response = await fetch('/api/photos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(validatedData),
  });
  
  if (!response.ok) {
    throw new Error('Failed to create photo');
  }
  
  return response.json();
}

// Type-safe local storage
export function savePhotosToStorage(photos: Photo[]): void {
  localStorage.setItem('photos', JSON.stringify(photos));
}

export function loadPhotosFromStorage(): Photo[] {
  const data = localStorage.getItem('photos');
  return data ? JSON.parse(data) : [];
}
```

## 🧪 Testing

### Schema Validation Tests
```typescript
// schema.test.ts
import { describe, it, expect } from 'vitest';
import { insertPhotoSchema, insertUserSchema } from './schema';

describe('Schema Validation', () => {
  describe('insertPhotoSchema', () => {
    it('should validate valid photo data', () => {
      const validData = {
        uri: 'https://example.com/photo.jpg',
        width: 1920,
        height: 1080,
        filename: 'photo.jpg',
        userId: 'user-123',
      };
      
      expect(() => insertPhotoSchema.parse(validData)).not.toThrow();
    });

    it('should reject invalid URI', () => {
      const invalidData = {
        uri: 'not-a-url',
        width: 1920,
        height: 1080,
        filename: 'photo.jpg',
        userId: 'user-123',
      };
      
      expect(() => insertPhotoSchema.parse(invalidData)).toThrow();
    });

    it('should accept valid location data', () => {
      const dataWithLocation = {
        uri: 'https://example.com/photo.jpg',
        width: 1920,
        height: 1080,
        filename: 'photo.jpg',
        userId: 'user-123',
        location: {
          latitude: 37.7749,
          longitude: -122.4194,
          city: 'San Francisco',
          country: 'USA',
        },
      };
      
      expect(() => insertPhotoSchema.parse(dataWithLocation)).not.toThrow();
    });
  });

  describe('insertUserSchema', () => {
    it('should validate strong passwords', () => {
      const validData = {
        username: 'testuser',
        password: 'StrongPass123',
        email: 'test@example.com',
      };
      
      expect(() => insertUserSchema.parse(validData)).not.toThrow();
    });

    it('should reject weak passwords', () => {
      const weakPasswordData = {
        username: 'testuser',
        password: 'weak',
        email: 'test@example.com',
      };
      
      expect(() => insertUserSchema.parse(weakPasswordData)).toThrow();
    });
  });
});
```

## 🔄 Database Migration

### Creating Migrations
```bash
# Generate migration
npm run db:generate

# Apply migration
npm run db:push

# Reset database
npm run db:reset
```

### Migration Example
```typescript
// migrations/0001_initial_schema.sql
-- Create users table
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create photos table
CREATE TABLE photos (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  filename TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_private BOOLEAN DEFAULT FALSE,
  location JSONB,
  camera JSONB,
  exif JSONB,
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  modified_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_photos_user_id ON photos(user_id);
CREATE INDEX idx_photos_created_at ON photos(created_at DESC);
CREATE INDEX idx_photos_is_favorite ON photos(is_favorite);
CREATE INDEX idx_photos_deleted_at ON photos(deleted_at);
```

## 📝 Type Generation

### Automatic Type Generation
```typescript
// Types are automatically generated from schema
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;
export type Album = typeof albums.$inferSelect;
export type InsertAlbum = typeof albums.$inferInsert;
```

### Custom Type Extensions
```typescript
// Extend base types for specific use cases
export interface PhotoWithAlbums extends Photo {
  albums: Album[];
}

export interface AlbumWithPhotos extends Album {
  photos: Photo[];
  photoCount: number;
}

export interface UserWithStats extends User {
  photoCount: number;
  albumCount: number;
  storageUsed: number;
}
```

## 🔗 Related Documentation

- **[Main README](../README.md)** - Project overview
- **[Client Documentation](../client/README.md)** - React Native app
- **[Server Documentation](../server/README.md)** - Node.js backend
- **[Database Configuration](../drizzle.config.ts)** - Drizzle config
- **[Architecture](../docs/architecture/00_INDEX.md)** - System design

---

<div align="center">

**Shared Foundation for Cloud Gallery**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-0.39.3-blue?logo=drizzle)](https://orm.drizzle.team/)
[![Zod](https://img.shields.io/badge/Zod-3.24.2-blue?logo=zod)](https://zod.dev/)

</div>
