# Cloud Gallery Shared - AI Agent Instructions

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.9.2-blue?logo=typescript)
![Drizzle ORM](https://img.shields.io/badge/Drizzle-0.39.3-blue?logo=drizzle)
![Zod](https://img.shields.io/badge/Zod-3.24.2-blue?logo=zod)

</div>

AI-optimized documentation for shared TypeScript types, schemas, and validation in Cloud Gallery.

## 🎯 Shared Overview

TypeScript definitions, database schemas, and validation utilities shared across client and server applications. Ensures type safety and business logic consistency.

**One-Liner**: Shared TypeScript types, Drizzle ORM schemas, and Zod validation for Cloud Gallery.

## 🏗️ Shared Architecture

```
shared/
├── schema.ts                  # Database schema definitions
├── schema.test.ts             # Schema validation tests
└── (future shared utilities)
```

### Key Dependencies
- **TypeScript 5.9.2**: Type-safe JavaScript
- **Drizzle ORM 0.39.3**: Type-safe database access
- **Zod 3.24.2**: Runtime type validation

## 🗃️ Database Schema

### Core Tables
```typescript
// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Photos table
export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  uri: text("uri").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  filename: text("filename").notNull(),
  isFavorite: boolean("is_favorite").default(false).notNull(),
  isPrivate: boolean("is_private").default(false).notNull(),
  location: jsonb("location"),
  camera: jsonb("camera"),
  exif: jsonb("exif"),
  tags: text("tags").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  modifiedAt: timestamp("modified_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

// Albums table
export const albums = pgTable("albums", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  coverPhotoUri: text("cover_photo_uri"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  modifiedAt: timestamp("modified_at").defaultNow().notNull(),
});

// Album-Photo junction table
export const albumPhotos = pgTable("album_photos", {
  albumId: varchar("album_id").notNull().references(() => albums.id, { onDelete: "cascade" }),
  photoId: varchar("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  position: integer("position").default(0).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.albumId, table.photoId] }),
}));
```

### Type Inference
```typescript
// Infer types from schema
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Photo = typeof photos.$inferSelect;
export type InsertPhoto = typeof photos.$inferInsert;
export type Album = typeof albums.$inferSelect;
export type InsertAlbum = typeof albums.$inferInsert;
export type AlbumPhoto = typeof albumPhotos.$inferSelect;
export type InsertAlbumPhoto = typeof albumPhotos.$inferInsert;
```

## 🧪 Validation Schemas

### Zod Integration
```typescript
// Use Drizzle's createInsertSchema for base validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
}).extend({
  username: z.string().min(3).max(50),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  email: z.string().email().optional(),
});

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

### Custom Types
```typescript
// Define custom types for complex data
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

export interface CameraInfo {
  make: string;           // Camera manufacturer
  model: string;          // Camera model
  iso?: number;           // ISO sensitivity
  aperture?: string;      // Aperture value (e.g., "f/1.6")
  shutterSpeed?: string;  // Shutter speed (e.g., "1/60")
  focalLength?: number;   // Focal length in mm
  flash?: boolean;        // Flash fired
  lensModel?: string;     // Lens model
  focalLength35mm?: number; // 35mm equivalent focal length
}

export interface EXIFData {
  dateTime?: string;           // Original capture time
  dateTimeOriginal?: string;    // EXIF format capture time
  dateTimeDigitized?: string;   // Digitization time
  exposureTime?: number;        // Exposure time in seconds
  fNumber?: number;            // F-number
  isoSpeedRatings?: number[];  // ISO speed ratings
  focalLength?: number;        // Focal length in mm
  flash?: number;              // Flash mode
  imageWidth?: number;         // Image width
  imageHeight?: number;        // Image height
  orientation?: number;        // Image orientation
  resolutionUnit?: number;      // Resolution unit
  gpsLatitude?: number;         // GPS latitude
  gpsLongitude?: number;        // GPS longitude
  gpsAltitude?: number;         // GPS altitude
  gpsSpeed?: number;           // GPS speed
  software?: string;           // Software used
  make?: string;               // Camera manufacturer
  model?: string;              // Camera model
  [key: string]: unknown;       // Allow additional EXIF fields
}
```

## 🔧 Usage Patterns

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
```

### Type-Safe Storage
```typescript
// Use shared types for local storage
export function savePhotosToStorage(photos: Photo[]): void {
  localStorage.setItem('photos', JSON.stringify(photos));
}

export function loadPhotosFromStorage(): Photo[] {
  const data = localStorage.getItem('photos');
  return data ? JSON.parse(data) : [];
}
```

## 🧪 Testing Patterns

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

### Type Safety Tests
```typescript
// Test type inference
describe('Type Inference', () => {
  it('should infer correct types from schema', () => {
    const user: User = {
      id: 'user-123',
      username: 'testuser',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const insertUser: InsertUser = {
      username: 'newuser',
      password: 'hashedpassword',
      email: 'newuser@example.com',
    };
    
    expect(user.id).toBeDefined();
    expect(insertUser.username).toBeDefined();
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
```sql
-- migrations/0001_initial_schema.sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

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

## 🔧 Development Commands

### Testing
```bash
# Run shared tests
npm run test shared/

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Type Checking
```bash
# Check TypeScript types
npm run check:types

# Generate types (if needed)
npm run db:generate
```

## 📋 Shared-Specific Gotchas

### Schema Changes
- **Breaking Changes**: Must update both client and server
- **Migration Safety**: Always backup before running migrations
- **Type Consistency**: Keep Zod schemas in sync with Drizzle schemas

### Validation Rules
- **Runtime vs. Compile-Time**: Zod validates at runtime, TypeScript at compile-time
- **Performance**: Zod validation adds overhead, use judiciously
- **Error Messages**: Customize Zod error messages for better UX

### Type Safety
- **Any Type**: Never use `any` in shared types
- **Optional Fields**: Use `| null | undefined` for nullable fields
- **Array Types**: Be explicit about array contents

## 🔍 External Dependencies

### Database
- **PostgreSQL**: Primary database with JSONB support
- **Drizzle Kit**: Migration and schema management

### Validation
- **Zod**: Runtime type validation
- **TypeScript**: Compile-time type checking

## 📚 Documentation References

### Schema Documentation
- `@shared/schema.ts` - Complete schema definitions
- `@docs/data/00_INDEX.md` - Data layer documentation

### API Documentation
- `@docs/api/00_INDEX.md` - API endpoint documentation
- Type examples in each route file

### Testing
- `@docs/testing/00_INDEX.md` - Testing strategy
- Test examples in `shared/schema.test.ts`

## 🚨 Agent Behavior Guidelines

### What to Do
- Keep schemas in sync with database
- Use TypeScript strict mode
- Validate all external inputs with Zod
- Use proper TypeScript types
- Write comprehensive tests for schemas

### What to Avoid
- Don't use `any` types
- Avoid breaking changes without migration
- Don't skip validation for external data
- Avoid circular type dependencies
- Don't expose internal schema details in API responses

### Verification Steps
1. Run `npm run check:types` - No TypeScript errors
2. Run `npm run test shared/` - All shared tests pass
3. Validate schema changes don't break existing code
4. Test Zod validation with edge cases
5. Verify database migrations work correctly

---

*Last updated: March 2026 | Compatible with: AGENTS.md standard v1.0*
