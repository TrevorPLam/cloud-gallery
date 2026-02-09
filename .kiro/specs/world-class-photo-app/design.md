# World-Class Photo App - Design Document

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   React      │  │   React      │  │   Progressive│      │
│  │   Native     │  │   Native     │  │   Web App    │      │
│  │   (iOS)      │  │   (Android)  │  │   (Web)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Gateway   │
                    │  (Rate Limiting,│
                    │   Auth, CORS)   │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│  Express API   │  │   ML Service    │  │  Worker Queue  │
│   (Node.js)    │  │  (Python/Node)  │  │   (Bull/Redis) │
│                │  │                 │  │                │
│ • Auth         │  │ • Face Detect   │  │ • Async Upload │
│ • Photos CRUD  │  │ • Object Detect │  │ • Image Process│
│ • Albums       │  │ • Scene Detect  │  │ • Thumbnail Gen│
│ • Search       │  │ • OCR           │  │ • ML Analysis  │
│ • Sharing      │  │ • Similarity    │  │ • Backup Sync  │
└───────┬────────┘  └────────┬────────┘  └───────┬────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼────────┐  ┌────────▼────────┐  ┌───────▼────────┐
│   PostgreSQL   │  │     Redis       │  │   S3 Storage   │
│                │  │                 │  │                │
│ • Users        │  │ • Cache         │  │ • Original     │
│ • Photos       │  │ • Sessions      │  │ • Thumbnails   │
│ • Albums       │  │ • Job Queue     │  │ • Edited       │
│ • Face Data    │  │ • Search Index  │  │ • Videos       │
│ • ML Labels    │  │                 │  │                │
└────────────────┘  └─────────────────┘  └────────────────┘
```

### 1.2 Technology Stack

**Frontend:**
- React Native 0.81.5 + Expo SDK 54
- TypeScript 5.9.2 (strict mode)
- React Query v5 (server state management)
- React Navigation v7 (navigation)
- Reanimated v4 (animations)
- Expo Image (optimized image rendering)

**Backend:**
- Node.js + Express 5.0.1
- TypeScript 5.9.2
- Drizzle ORM 0.39.3 + PostgreSQL 8.x
- Redis (caching, job queue)
- Bull (job processing)

**ML/AI:**
- TensorFlow Lite (on-device mobile)
- TensorFlow.js (web)
- Cloud ML APIs (Google Vision, AWS Rekognition) as fallback
- ONNX Runtime (cross-platform inference)

**Storage:**
- AWS S3 (photo storage)
- CloudFront CDN (delivery)
- PostgreSQL (metadata)
- Redis (cache)

**Testing:**
- Vitest 3.0.5
- fast-check 4.5.3 (property-based testing)
- React Testing Library
- Supertest (API testing)


## 2. Database Schema Design

### 2.1 Extended Schema

```typescript
// Extend existing photos table
export const photos = pgTable("photos", {
  // ... existing fields ...
  
  // ML Analysis Results
  mlLabels: jsonb("ml_labels"), // { objects: ["dog", "beach"], scenes: ["outdoor"], confidence: 0.95 }
  mlProcessedAt: timestamp("ml_processed_at"),
  mlVersion: varchar("ml_version", { length: 20 }),
  
  // OCR Results
  ocrText: text("ocr_text"), // Extracted text from image
  ocrLanguage: varchar("ocr_language", { length: 10 }),
  
  // Duplicate Detection
  perceptualHash: varchar("perceptual_hash", { length: 64 }), // pHash for similarity
  duplicateGroupId: varchar("duplicate_group_id"),
  
  // Video Support
  isVideo: boolean("is_video").default(false),
  videoDuration: integer("video_duration"), // seconds
  videoThumbnailUri: text("video_thumbnail_uri"),
  
  // Live Photo Support
  isLivePhoto: boolean("is_live_photo").default(false),
  livePhotoVideoUri: text("live_photo_video_uri"),
  
  // Backup Status
  backupStatus: varchar("backup_status", { length: 20 }).default("pending"), // pending, uploading, completed, failed
  backupCompletedAt: timestamp("backup_completed_at"),
  
  // Storage Optimization
  originalSize: integer("original_size"), // bytes
  compressedSize: integer("compressed_size"),
  thumbnailSizes: jsonb("thumbnail_sizes"), // { small: 150, medium: 500, large: 1024 }
});

// New table: faces
export const faces = pgTable("faces", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: varchar("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Face Detection
  boundingBox: jsonb("bounding_box").notNull(), // { x, y, width, height }
  landmarks: jsonb("landmarks"), // { leftEye, rightEye, nose, mouth }
  confidence: real("confidence").notNull(),
  
  // Face Recognition
  embedding: vector("embedding", { dimensions: 128 }), // Face embedding vector
  personId: varchar("person_id").references(() => people.id, { onDelete: "set null" }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New table: people (face clusters)
export const people = pgTable("people", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  name: text("name"), // User-assigned name
  coverPhotoId: varchar("cover_photo_id").references(() => photos.id, { onDelete: "set null" }),
  
  faceCount: integer("face_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  modifiedAt: timestamp("modified_at").defaultNow().notNull(),
});

// New table: shared_albums
export const sharedAlbums = pgTable("shared_albums", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  albumId: varchar("album_id").notNull().references(() => albums.id, { onDelete: "cascade" }),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  shareType: varchar("share_type", { length: 20 }).notNull(), // "link", "email", "partner"
  shareToken: varchar("share_token", { length: 64 }).unique(),
  
  permissions: jsonb("permissions").notNull(), // { canView: true, canAdd: true, canEdit: false }
  
  expiresAt: timestamp("expires_at"),
  password: text("password"), // Hashed password for protected links
  
  viewCount: integer("view_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New table: shared_album_collaborators
export const sharedAlbumCollaborators = pgTable("shared_album_collaborators", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sharedAlbumId: varchar("shared_album_id").notNull().references(() => sharedAlbums.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  email: text("email"), // For invited users without accounts
  
  permissions: jsonb("permissions").notNull(),
  
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// New table: photo_edits (edit history)
export const photoEdits = pgTable("photo_edits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  photoId: varchar("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  editType: varchar("edit_type", { length: 50 }).notNull(), // "crop", "filter", "adjust", "enhance"
  editData: jsonb("edit_data").notNull(), // Edit parameters
  
  resultUri: text("result_uri"), // URI of edited photo
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New table: memories
export const memories = pgTable("memories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  memoryType: varchar("memory_type", { length: 50 }).notNull(), // "on_this_day", "highlight", "year_review"
  title: text("title").notNull(),
  description: text("description"),
  
  photoIds: text("photo_ids").array().notNull(),
  coverPhotoId: varchar("cover_photo_id"),
  
  dateRange: jsonb("date_range"), // { start: "2024-01-01", end: "2024-12-31" }
  location: text("location"),
  
  isFavorite: boolean("is_favorite").default(false),
  isHidden: boolean("is_hidden").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New table: smart_albums (auto-generated)
export const smartAlbums = pgTable("smart_albums", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  albumType: varchar("album_type", { length: 50 }).notNull(), // "people", "places", "things", "videos"
  title: text("title").notNull(),
  
  filterCriteria: jsonb("filter_criteria").notNull(), // Query criteria for auto-population
  
  isPinned: boolean("is_pinned").default(false),
  isHidden: boolean("is_hidden").default(false),
  
  photoCount: integer("photo_count").default(0),
  coverPhotoId: varchar("cover_photo_id"),
  
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New table: backup_queue
export const backupQueue = pgTable("backup_queue", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  photoId: varchar("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  
  status: varchar("status", { length: 20 }).notNull().default("pending"), // pending, processing, completed, failed
  priority: integer("priority").default(5), // 1-10, higher = more urgent
  
  retryCount: integer("retry_count").default(0),
  lastError: text("last_error"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

// New table: user_devices
export const userDevices = pgTable("user_devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  deviceName: text("device_name").notNull(),
  deviceType: varchar("device_type", { length: 20 }).notNull(), // "ios", "android", "web"
  deviceId: varchar("device_id", { length: 255 }).notNull().unique(),
  
  lastSyncAt: timestamp("last_sync_at"),
  syncEnabled: boolean("sync_enabled").default(true),
  
  pushToken: text("push_token"), // For notifications
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New table: storage_usage
export const storageUsage = pgTable("storage_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  totalPhotos: integer("total_photos").default(0),
  totalVideos: integer("total_videos").default(0),
  
  originalSize: bigint("original_size", { mode: "number" }).default(0), // bytes
  compressedSize: bigint("compressed_size", { mode: "number" }).default(0),
  
  storageLimit: bigint("storage_limit", { mode: "number" }).default(5368709120), // 5GB default
  
  lastCalculated: timestamp("last_calculated").defaultNow().notNull(),
});
```


## 3. API Design

### 3.1 New API Endpoints

#### ML & Search APIs

```typescript
// POST /api/ml/analyze
// Trigger ML analysis for a photo
Request: { photoId: string }
Response: { 
  labels: { objects: string[], scenes: string[], confidence: number },
  faces: { count: number, boundingBoxes: BoundingBox[] },
  ocrText: string | null
}

// POST /api/search/query
// Natural language search
Request: { 
  query: string, 
  filters?: { dateRange?, location?, people?, albums? },
  limit?: number,
  offset?: number
}
Response: { 
  photos: Photo[],
  totalCount: number,
  suggestions: string[]
}

// GET /api/search/suggestions
// Get search suggestions as user types
Request: { query: string }
Response: { suggestions: string[] }
```

#### Face Recognition APIs

```typescript
// GET /api/faces/people
// Get all people (face clusters)
Response: { 
  people: Array<{
    id: string,
    name: string | null,
    faceCount: number,
    coverPhotoUri: string | null
  }>
}

// PUT /api/faces/people/:id
// Name a person or merge clusters
Request: { name?: string, mergeWithId?: string }
Response: { person: Person }

// GET /api/faces/people/:id/photos
// Get all photos of a specific person
Response: { photos: Photo[] }

// POST /api/faces/detect
// Detect faces in a photo
Request: { photoId: string }
Response: { faces: Face[] }
```

#### Sharing APIs

```typescript
// POST /api/albums/:id/share
// Create a shared album link
Request: { 
  shareType: "link" | "email" | "partner",
  permissions: { canView: boolean, canAdd: boolean, canEdit: boolean },
  expiresAt?: string,
  password?: string,
  emails?: string[] // for email invites
}
Response: { 
  sharedAlbum: SharedAlbum,
  shareUrl: string
}

// GET /api/shared/:token
// Access shared album via token
Response: { album: Album, photos: Photo[], permissions: Permissions }

// POST /api/shared/:token/photos
// Add photo to shared album (if permitted)
Request: { photoId: string }
Response: { success: boolean }

// GET /api/albums/:id/collaborators
// Get album collaborators
Response: { collaborators: Collaborator[] }

// DELETE /api/albums/:id/collaborators/:userId
// Remove collaborator
Response: { success: boolean }
```

#### Backup & Sync APIs

```typescript
// POST /api/backup/queue
// Add photos to backup queue
Request: { photoIds: string[], priority?: number }
Response: { queuedCount: number }

// GET /api/backup/status
// Get backup status
Response: { 
  pending: number,
  completed: number,
  failed: number,
  lastBackup: string | null
}

// POST /api/sync/devices
// Register device for sync
Request: { deviceName: string, deviceType: string, deviceId: string }
Response: { device: UserDevice }

// GET /api/sync/changes
// Get changes since last sync
Request: { since: string, deviceId: string }
Response: { 
  photos: { added: Photo[], updated: Photo[], deleted: string[] },
  albums: { added: Album[], updated: Album[], deleted: string[] }
}
```

#### Editing APIs

```typescript
// POST /api/photos/:id/edit
// Apply edit to photo
Request: { 
  editType: "crop" | "filter" | "adjust" | "enhance",
  editData: object,
  saveAsNew?: boolean
}
Response: { photo: Photo, editId: string }

// GET /api/photos/:id/edits
// Get edit history
Response: { edits: PhotoEdit[] }

// POST /api/photos/:id/enhance
// AI-powered auto-enhance
Request: { enhanceType: "auto" | "sky" | "portrait" | "denoise" }
Response: { photo: Photo }
```

#### Memories & Smart Albums APIs

```typescript
// GET /api/memories
// Get user's memories
Request: { type?: "on_this_day" | "highlight" | "year_review" }
Response: { memories: Memory[] }

// POST /api/memories/:id/favorite
// Favorite or hide memory
Request: { isFavorite?: boolean, isHidden?: boolean }
Response: { memory: Memory }

// GET /api/smart-albums
// Get smart albums
Response: { smartAlbums: SmartAlbum[] }

// PUT /api/smart-albums/:id
// Update smart album settings
Request: { isPinned?: boolean, isHidden?: boolean }
Response: { smartAlbum: SmartAlbum }
```

#### Duplicate Detection APIs

```typescript
// GET /api/photos/duplicates
// Get duplicate photo groups
Response: { 
  groups: Array<{
    groupId: string,
    photos: Photo[],
    bestPhoto: Photo
  }>
}

// POST /api/photos/duplicates/resolve
// Resolve duplicate group (keep/delete)
Request: { groupId: string, keepPhotoIds: string[], deletePhotoIds: string[] }
Response: { success: boolean }
```

#### Storage Management APIs

```typescript
// GET /api/storage/usage
// Get storage usage stats
Response: { 
  totalPhotos: number,
  totalVideos: number,
  usedSpace: number,
  totalSpace: number,
  breakdown: { original: number, compressed: number, thumbnails: number }
}

// POST /api/storage/free-up
// Free up local space (remove local copies of backed-up photos)
Request: { photoIds?: string[] } // If empty, applies to all backed-up photos
Response: { freedSpace: number, photoCount: number }

// POST /api/storage/compress
// Compress photos to save space
Request: { photoIds: string[], quality: "high" | "medium" | "low" }
Response: { savedSpace: number }
```


## 4. ML/AI Architecture

### 4.1 On-Device ML Pipeline

```typescript
// client/lib/ml/photo-analyzer.ts

interface MLAnalysisResult {
  objects: Array<{ label: string; confidence: number }>;
  scenes: Array<{ label: string; confidence: number }>;
  faces: Array<{ boundingBox: BoundingBox; confidence: number }>;
  ocrText: string | null;
  perceptualHash: string;
}

class PhotoAnalyzer {
  private objectDetector: ObjectDetector;
  private faceDetector: FaceDetector;
  private ocrEngine: OCREngine;
  
  async analyzePhoto(photoUri: string): Promise<MLAnalysisResult> {
    // Run models in parallel
    const [objects, scenes, faces, ocrText, pHash] = await Promise.all([
      this.detectObjects(photoUri),
      this.detectScenes(photoUri),
      this.detectFaces(photoUri),
      this.extractText(photoUri),
      this.computePerceptualHash(photoUri),
    ]);
    
    return { objects, scenes, faces, ocrText, perceptualHash: pHash };
  }
  
  private async detectObjects(uri: string): Promise<Array<{ label: string; confidence: number }>> {
    // Use TensorFlow Lite on mobile, TensorFlow.js on web
    // Model: MobileNet v3 or EfficientNet-Lite
    const model = await this.objectDetector.load();
    const predictions = await model.classify(uri);
    return predictions.filter(p => p.confidence > 0.6);
  }
  
  private async detectFaces(uri: string): Promise<Array<{ boundingBox: BoundingBox; confidence: number }>> {
    // Use MediaPipe Face Detection or BlazeFace
    const model = await this.faceDetector.load();
    const faces = await model.detect(uri);
    return faces;
  }
  
  private async extractText(uri: string): Promise<string | null> {
    // Use ML Kit OCR (mobile) or Tesseract.js (web)
    const text = await this.ocrEngine.recognize(uri);
    return text.length > 0 ? text : null;
  }
  
  private async computePerceptualHash(uri: string): Promise<string> {
    // Compute pHash for duplicate detection
    const image = await loadImage(uri);
    const hash = await pHash(image);
    return hash;
  }
}
```

### 4.2 Face Recognition Pipeline

```typescript
// server/ml/face-recognition.ts

interface FaceEmbedding {
  faceId: string;
  embedding: number[]; // 128-dimensional vector
  photoId: string;
  boundingBox: BoundingBox;
}

class FaceRecognitionService {
  private embeddingModel: FaceEmbeddingModel;
  private clusteringAlgorithm: DBSCAN;
  
  async processFaces(photoId: string, faces: Face[]): Promise<void> {
    // Generate embeddings for each face
    const embeddings = await Promise.all(
      faces.map(face => this.generateEmbedding(photoId, face))
    );
    
    // Store embeddings in database
    await this.storeFaceEmbeddings(embeddings);
    
    // Cluster faces to identify people
    await this.clusterFaces(embeddings);
  }
  
  private async generateEmbedding(photoId: string, face: Face): Promise<FaceEmbedding> {
    // Use FaceNet or ArcFace model
    const faceImage = await this.cropFace(photoId, face.boundingBox);
    const embedding = await this.embeddingModel.predict(faceImage);
    
    return {
      faceId: generateId(),
      embedding: Array.from(embedding),
      photoId,
      boundingBox: face.boundingBox,
    };
  }
  
  private async clusterFaces(newEmbeddings: FaceEmbedding[]): Promise<void> {
    // Get all existing embeddings for this user
    const existingEmbeddings = await this.getAllUserEmbeddings();
    
    // Combine with new embeddings
    const allEmbeddings = [...existingEmbeddings, ...newEmbeddings];
    
    // Run DBSCAN clustering
    const clusters = this.clusteringAlgorithm.fit(
      allEmbeddings.map(e => e.embedding),
      { epsilon: 0.6, minPoints: 2 }
    );
    
    // Update person assignments
    await this.updatePersonClusters(clusters, allEmbeddings);
  }
  
  async findSimilarFaces(faceId: string, threshold: number = 0.7): Promise<Face[]> {
    // Find faces with similar embeddings using cosine similarity
    const targetEmbedding = await this.getFaceEmbedding(faceId);
    const similarFaces = await this.vectorSearch(targetEmbedding, threshold);
    return similarFaces;
  }
}
```

### 4.3 Search Index Architecture

```typescript
// server/search/search-service.ts

interface SearchIndex {
  photoId: string;
  userId: string;
  
  // Text fields
  filename: string;
  ocrText: string | null;
  notes: string | null;
  tags: string[];
  
  // ML labels
  objects: string[];
  scenes: string[];
  
  // People
  peopleIds: string[];
  peopleNames: string[];
  
  // Location
  location: {
    latitude: number;
    longitude: number;
    city: string | null;
    country: string | null;
  } | null;
  
  // Temporal
  createdAt: Date;
  year: number;
  month: number;
  day: number;
  
  // Metadata
  isFavorite: boolean;
  isVideo: boolean;
  albumIds: string[];
}

class SearchService {
  private redis: Redis;
  
  async indexPhoto(photo: Photo, mlData: MLAnalysisResult): Promise<void> {
    const searchDoc: SearchIndex = {
      photoId: photo.id,
      userId: photo.userId,
      filename: photo.filename,
      ocrText: mlData.ocrText,
      notes: photo.notes,
      tags: photo.tags || [],
      objects: mlData.objects.map(o => o.label),
      scenes: mlData.scenes.map(s => s.label),
      peopleIds: await this.getPeopleInPhoto(photo.id),
      peopleNames: await this.getPeopleNamesInPhoto(photo.id),
      location: photo.location,
      createdAt: photo.createdAt,
      year: new Date(photo.createdAt).getFullYear(),
      month: new Date(photo.createdAt).getMonth() + 1,
      day: new Date(photo.createdAt).getDate(),
      isFavorite: photo.isFavorite,
      isVideo: photo.isVideo || false,
      albumIds: await this.getPhotoAlbums(photo.id),
    };
    
    // Store in Redis for fast search
    await this.redis.json.set(`search:${photo.id}`, '$', searchDoc);
    
    // Add to full-text search index
    await this.addToFullTextIndex(searchDoc);
  }
  
  async search(query: string, userId: string, filters?: SearchFilters): Promise<Photo[]> {
    // Parse natural language query
    const parsedQuery = await this.parseQuery(query);
    
    // Build search criteria
    const criteria = this.buildSearchCriteria(parsedQuery, filters);
    
    // Execute search
    const results = await this.executeSearch(userId, criteria);
    
    // Rank results by relevance
    const rankedResults = this.rankResults(results, parsedQuery);
    
    return rankedResults;
  }
  
  private async parseQuery(query: string): Promise<ParsedQuery> {
    // Extract entities from query
    // "photos of dogs at the beach last summer"
    // -> { objects: ["dog"], scenes: ["beach"], dateRange: { start: "2025-06-01", end: "2025-08-31" } }
    
    const entities = {
      objects: this.extractObjects(query),
      scenes: this.extractScenes(query),
      people: this.extractPeople(query),
      locations: this.extractLocations(query),
      dateRange: this.extractDateRange(query),
      negations: this.extractNegations(query),
    };
    
    return entities;
  }
}
```


## 5. Client Architecture

### 5.1 State Management Strategy

```typescript
// React Query for server state
// Local state for UI state

// client/hooks/usePhotos.ts
export function usePhotos(filters?: PhotoFilters) {
  return useQuery({
    queryKey: ['photos', filters],
    queryFn: () => fetchPhotos(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
  });
}

// client/hooks/usePhotoUpload.ts
export function usePhotoUpload() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (photo: PhotoUpload) => {
      // 1. Analyze photo locally
      const mlData = await analyzePhotoLocally(photo.uri);
      
      // 2. Upload to server
      const uploadedPhoto = await uploadPhoto(photo, mlData);
      
      // 3. Queue for backup
      await queueForBackup(uploadedPhoto.id);
      
      return uploadedPhoto;
    },
    onMutate: async (newPhoto) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['photos'] });
      const previous = queryClient.getQueryData(['photos']);
      
      queryClient.setQueryData(['photos'], (old: Photo[]) => [
        { ...newPhoto, id: 'temp-' + Date.now() },
        ...old,
      ]);
      
      return { previous };
    },
    onError: (err, newPhoto, context) => {
      queryClient.setQueryData(['photos'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });
}

// client/hooks/useSearch.ts
export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: () => searchPhotos(query),
    enabled: query.length > 2, // Only search if query is meaningful
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// client/hooks/useFaceRecognition.ts
export function usePeople() {
  return useQuery({
    queryKey: ['people'],
    queryFn: fetchPeople,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function usePersonPhotos(personId: string) {
  return useQuery({
    queryKey: ['people', personId, 'photos'],
    queryFn: () => fetchPersonPhotos(personId),
    enabled: !!personId,
  });
}
```

### 5.2 Background Sync Architecture

```typescript
// client/lib/sync/background-sync.ts

class BackgroundSyncService {
  private syncQueue: SyncQueue;
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  
  constructor() {
    // Listen for network changes
    NetInfo.addEventListener(state => {
      this.isOnline = state.isConnected;
      if (this.isOnline) {
        this.startSync();
      }
    });
    
    // Listen for app state changes
    AppState.addEventListener('change', state => {
      if (state === 'active') {
        this.startSync();
      }
    });
  }
  
  async queueUpload(photo: Photo): Promise<void> {
    await this.syncQueue.add({
      type: 'upload',
      photoId: photo.id,
      priority: photo.isFavorite ? 10 : 5,
      data: photo,
    });
    
    this.startSync();
  }
  
  async startSync(): Promise<void> {
    if (this.isSyncing || !this.isOnline) return;
    
    this.isSyncing = true;
    
    try {
      // Check sync settings
      const settings = await this.getSyncSettings();
      
      if (!this.shouldSync(settings)) {
        return;
      }
      
      // Process queue
      while (this.syncQueue.hasItems()) {
        const item = await this.syncQueue.getNext();
        
        try {
          await this.processQueueItem(item);
          await this.syncQueue.markComplete(item.id);
        } catch (error) {
          await this.syncQueue.markFailed(item.id, error);
        }
      }
      
      // Sync changes from server
      await this.syncFromServer();
      
    } finally {
      this.isSyncing = false;
    }
  }
  
  private shouldSync(settings: SyncSettings): boolean {
    // Check WiFi requirement
    if (settings.wifiOnly && !this.isOnWiFi()) {
      return false;
    }
    
    // Check battery requirement
    if (settings.minBattery && this.getBatteryLevel() < settings.minBattery) {
      return false;
    }
    
    // Check charging requirement
    if (settings.chargingOnly && !this.isCharging()) {
      return false;
    }
    
    return true;
  }
  
  private async syncFromServer(): Promise<void> {
    const lastSync = await this.getLastSyncTime();
    const changes = await apiRequest('GET', `/api/sync/changes?since=${lastSync}`);
    
    // Apply changes locally
    await this.applyChanges(changes);
    
    // Update last sync time
    await this.setLastSyncTime(new Date());
  }
}
```

### 5.3 Offline Support

```typescript
// client/lib/offline/offline-manager.ts

class OfflineManager {
  private cache: AsyncStorage;
  
  async cachePhoto(photo: Photo): Promise<void> {
    // Cache photo metadata
    await this.cache.setItem(`photo:${photo.id}`, JSON.stringify(photo));
    
    // Cache thumbnail
    await this.cacheImage(photo.uri, 'thumbnail');
    
    // Optionally cache full resolution
    if (photo.isFavorite) {
      await this.cacheImage(photo.uri, 'full');
    }
  }
  
  async getCachedPhoto(photoId: string): Promise<Photo | null> {
    const cached = await this.cache.getItem(`photo:${photoId}`);
    return cached ? JSON.parse(cached) : null;
  }
  
  async searchOffline(query: string): Promise<Photo[]> {
    // Search cached metadata
    const allPhotos = await this.getAllCachedPhotos();
    
    return allPhotos.filter(photo => {
      const searchText = [
        photo.filename,
        photo.notes,
        ...(photo.tags || []),
        ...(photo.mlLabels?.objects || []),
        ...(photo.mlLabels?.scenes || []),
      ].join(' ').toLowerCase();
      
      return searchText.includes(query.toLowerCase());
    });
  }
  
  async makeAlbumAvailableOffline(albumId: string): Promise<void> {
    const photos = await this.getAlbumPhotos(albumId);
    
    // Cache all photos in album
    await Promise.all(photos.map(photo => this.cachePhoto(photo)));
    
    // Mark album as offline-available
    await this.cache.setItem(`offline:album:${albumId}`, 'true');
  }
}
```

### 5.4 Image Optimization

```typescript
// client/lib/image/image-optimizer.ts

class ImageOptimizer {
  async optimizeForUpload(uri: string, quality: 'high' | 'medium' | 'low'): Promise<string> {
    const qualityMap = {
      high: 0.9,
      medium: 0.7,
      low: 0.5,
    };
    
    // Resize if too large
    const maxDimension = 4096;
    const image = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxDimension } }],
      { compress: qualityMap[quality], format: SaveFormat.JPEG }
    );
    
    return image.uri;
  }
  
  async generateThumbnails(uri: string): Promise<ThumbnailSet> {
    const sizes = [
      { name: 'small', width: 150 },
      { name: 'medium', width: 500 },
      { name: 'large', width: 1024 },
    ];
    
    const thumbnails = await Promise.all(
      sizes.map(async size => {
        const thumb = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: size.width } }],
          { compress: 0.8, format: SaveFormat.JPEG }
        );
        
        return { [size.name]: thumb.uri };
      })
    );
    
    return Object.assign({}, ...thumbnails);
  }
  
  async computePerceptualHash(uri: string): Promise<string> {
    // Resize to 8x8
    const small = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 8, height: 8 } }],
      { format: SaveFormat.PNG }
    );
    
    // Convert to grayscale and compute DCT
    const pixels = await this.getPixels(small.uri);
    const hash = this.dctHash(pixels);
    
    return hash;
  }
}
```


## 6. Feature Implementations

### 6.1 Smart Albums Implementation

```typescript
// server/services/smart-albums-service.ts

class SmartAlbumsService {
  async generateSmartAlbums(userId: string): Promise<void> {
    const albumTypes = [
      { type: 'people', generator: this.generatePeopleAlbums },
      { type: 'places', generator: this.generatePlacesAlbums },
      { type: 'things', generator: this.generateThingsAlbums },
      { type: 'videos', generator: this.generateVideosAlbum },
      { type: 'favorites', generator: this.generateFavoritesAlbum },
      { type: 'screenshots', generator: this.generateScreenshotsAlbum },
    ];
    
    for (const albumType of albumTypes) {
      await albumType.generator.call(this, userId);
    }
  }
  
  private async generatePeopleAlbums(userId: string): Promise<void> {
    const people = await db.select().from(peopleTable).where(eq(peopleTable.userId, userId));
    
    for (const person of people) {
      const filterCriteria = {
        peopleIds: [person.id],
      };
      
      await this.createOrUpdateSmartAlbum({
        userId,
        albumType: 'people',
        title: person.name || 'Unnamed Person',
        filterCriteria,
      });
    }
  }
  
  private async generatePlacesAlbums(userId: string): Promise<void> {
    // Group photos by location
    const photos = await db.select()
      .from(photosTable)
      .where(and(
        eq(photosTable.userId, userId),
        isNotNull(photosTable.location)
      ));
    
    const locationGroups = this.groupByLocation(photos);
    
    for (const [location, photoIds] of Object.entries(locationGroups)) {
      if (photoIds.length < 5) continue; // Minimum 5 photos for a place album
      
      await this.createOrUpdateSmartAlbum({
        userId,
        albumType: 'places',
        title: location,
        filterCriteria: { location },
      });
    }
  }
  
  private async generateThingsAlbums(userId: string): Promise<void> {
    const categories = ['food', 'pets', 'nature', 'architecture', 'art'];
    
    for (const category of categories) {
      const filterCriteria = {
        objects: [category],
      };
      
      await this.createOrUpdateSmartAlbum({
        userId,
        albumType: 'things',
        title: this.capitalize(category),
        filterCriteria,
      });
    }
  }
  
  async getSmartAlbumPhotos(smartAlbumId: string): Promise<Photo[]> {
    const smartAlbum = await db.select()
      .from(smartAlbumsTable)
      .where(eq(smartAlbumsTable.id, smartAlbumId))
      .limit(1);
    
    if (!smartAlbum.length) return [];
    
    const criteria = smartAlbum[0].filterCriteria;
    return await this.queryPhotosByCriteria(smartAlbum[0].userId, criteria);
  }
}
```

### 6.2 Memories Generation

```typescript
// server/services/memories-service.ts

class MemoriesService {
  async generateMemories(userId: string): Promise<void> {
    await Promise.all([
      this.generateOnThisDayMemories(userId),
      this.generateHighlightMemories(userId),
      this.generateYearReviewMemory(userId),
    ]);
  }
  
  private async generateOnThisDayMemories(userId: string): Promise<void> {
    const today = new Date();
    const years = [1, 2, 3, 5, 10]; // Look back 1, 2, 3, 5, 10 years
    
    for (const yearsAgo of years) {
      const targetDate = new Date(today);
      targetDate.setFullYear(today.getFullYear() - yearsAgo);
      
      // Find photos from this day in past years
      const photos = await db.select()
        .from(photosTable)
        .where(and(
          eq(photosTable.userId, userId),
          sql`DATE(created_at) = ${targetDate.toISOString().split('T')[0]}`
        ));
      
      if (photos.length > 0) {
        await this.createMemory({
          userId,
          memoryType: 'on_this_day',
          title: `${yearsAgo} ${yearsAgo === 1 ? 'year' : 'years'} ago today`,
          photoIds: photos.map(p => p.id),
          coverPhotoId: photos[0].id,
          dateRange: {
            start: targetDate.toISOString(),
            end: targetDate.toISOString(),
          },
        });
      }
    }
  }
  
  private async generateHighlightMemories(userId: string): Promise<void> {
    // Generate monthly highlights
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const photos = await db.select()
      .from(photosTable)
      .where(and(
        eq(photosTable.userId, userId),
        sql`DATE(created_at) >= ${lastMonth.toISOString()}`,
        sql`DATE(created_at) < ${new Date().toISOString()}`
      ))
      .orderBy(desc(photosTable.createdAt));
    
    if (photos.length < 10) return; // Need at least 10 photos
    
    // Select best photos (favorites, high quality, diverse)
    const highlights = this.selectHighlights(photos, 20);
    
    await this.createMemory({
      userId,
      memoryType: 'highlight',
      title: `${lastMonth.toLocaleString('default', { month: 'long' })} Highlights`,
      photoIds: highlights.map(p => p.id),
      coverPhotoId: highlights[0].id,
      dateRange: {
        start: lastMonth.toISOString(),
        end: new Date().toISOString(),
      },
    });
  }
  
  private async generateYearReviewMemory(userId: string): Promise<void> {
    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear, 11, 31);
    
    // Get all photos from this year
    const photos = await db.select()
      .from(photosTable)
      .where(and(
        eq(photosTable.userId, userId),
        sql`DATE(created_at) >= ${yearStart.toISOString()}`,
        sql`DATE(created_at) <= ${yearEnd.toISOString()}`
      ));
    
    if (photos.length < 50) return; // Need substantial photos for year review
    
    // Analyze year statistics
    const stats = await this.analyzeYearStats(userId, photos);
    
    // Select best photos from each month
    const highlights = this.selectYearHighlights(photos, 50);
    
    await this.createMemory({
      userId,
      memoryType: 'year_review',
      title: `${currentYear} Year in Review`,
      description: this.generateYearReviewDescription(stats),
      photoIds: highlights.map(p => p.id),
      coverPhotoId: highlights[0].id,
      dateRange: {
        start: yearStart.toISOString(),
        end: yearEnd.toISOString(),
      },
    });
  }
  
  private selectHighlights(photos: Photo[], count: number): Photo[] {
    // Score photos based on multiple factors
    const scored = photos.map(photo => ({
      photo,
      score: this.calculatePhotoScore(photo),
    }));
    
    // Sort by score and select top N
    scored.sort((a, b) => b.score - a.score);
    
    // Ensure diversity (don't pick all photos from same day)
    const diverse = this.ensureDiversity(scored.map(s => s.photo), count);
    
    return diverse;
  }
  
  private calculatePhotoScore(photo: Photo): number {
    let score = 0;
    
    // Favorites get high score
    if (photo.isFavorite) score += 10;
    
    // Photos with faces get bonus
    if (photo.mlLabels?.faces?.length > 0) score += 5;
    
    // High-quality photos (large file size) get bonus
    if (photo.originalSize > 5 * 1024 * 1024) score += 3;
    
    // Photos with location get bonus
    if (photo.location) score += 2;
    
    // Photos in albums get bonus
    if (photo.albumIds?.length > 0) score += 2;
    
    return score;
  }
}
```

### 6.3 Duplicate Detection

```typescript
// server/services/duplicate-detection-service.ts

class DuplicateDetectionService {
  async detectDuplicates(userId: string): Promise<DuplicateGroup[]> {
    const photos = await db.select()
      .from(photosTable)
      .where(eq(photosTable.userId, userId));
    
    // Group by perceptual hash similarity
    const groups = this.groupByHashSimilarity(photos);
    
    // Filter out groups with only one photo
    const duplicateGroups = groups.filter(g => g.photos.length > 1);
    
    // Identify best photo in each group
    for (const group of duplicateGroups) {
      group.bestPhoto = this.selectBestPhoto(group.photos);
    }
    
    return duplicateGroups;
  }
  
  private groupByHashSimilarity(photos: Photo[]): DuplicateGroup[] {
    const groups: Map<string, Photo[]> = new Map();
    
    for (const photo of photos) {
      if (!photo.perceptualHash) continue;
      
      // Find existing group with similar hash
      let foundGroup = false;
      
      for (const [groupHash, groupPhotos] of groups.entries()) {
        const similarity = this.hammingDistance(photo.perceptualHash, groupHash);
        
        // If hash is similar (distance < 5), add to group
        if (similarity < 5) {
          groupPhotos.push(photo);
          foundGroup = true;
          break;
        }
      }
      
      // Create new group if no similar hash found
      if (!foundGroup) {
        groups.set(photo.perceptualHash, [photo]);
      }
    }
    
    return Array.from(groups.entries()).map(([hash, photos]) => ({
      groupId: hash,
      photos,
      bestPhoto: null,
    }));
  }
  
  private hammingDistance(hash1: string, hash2: string): number {
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) distance++;
    }
    return distance;
  }
  
  private selectBestPhoto(photos: Photo[]): Photo {
    // Select photo with highest quality
    return photos.reduce((best, current) => {
      // Prefer favorites
      if (current.isFavorite && !best.isFavorite) return current;
      if (best.isFavorite && !current.isFavorite) return best;
      
      // Prefer larger file size (higher quality)
      if (current.originalSize > best.originalSize) return current;
      
      // Prefer photos in albums
      if ((current.albumIds?.length || 0) > (best.albumIds?.length || 0)) return current;
      
      return best;
    });
  }
  
  async detectBurstSequences(userId: string): Promise<BurstGroup[]> {
    const photos = await db.select()
      .from(photosTable)
      .where(eq(photosTable.userId, userId))
      .orderBy(photosTable.createdAt);
    
    const burstGroups: BurstGroup[] = [];
    let currentBurst: Photo[] = [];
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const nextPhoto = photos[i + 1];
      
      if (nextPhoto) {
        const timeDiff = new Date(nextPhoto.createdAt).getTime() - new Date(photo.createdAt).getTime();
        
        // If photos are within 2 seconds, consider them a burst
        if (timeDiff < 2000) {
          if (currentBurst.length === 0) {
            currentBurst.push(photo);
          }
          currentBurst.push(nextPhoto);
        } else {
          // End of burst sequence
          if (currentBurst.length >= 3) {
            burstGroups.push({
              groupId: generateId(),
              photos: currentBurst,
              bestPhoto: this.selectBestPhoto(currentBurst),
            });
          }
          currentBurst = [];
        }
      }
    }
    
    return burstGroups;
  }
}
```


### 6.4 Sharing Implementation

```typescript
// server/services/sharing-service.ts

class SharingService {
  async createSharedAlbum(
    albumId: string,
    ownerId: string,
    options: ShareOptions
  ): Promise<SharedAlbum> {
    // Generate unique share token
    const shareToken = this.generateShareToken();
    
    // Hash password if provided
    const hashedPassword = options.password 
      ? await argon2.hash(options.password)
      : null;
    
    const sharedAlbum = await db.insert(sharedAlbumsTable).values({
      albumId,
      ownerId,
      shareType: options.shareType,
      shareToken,
      permissions: options.permissions,
      expiresAt: options.expiresAt,
      password: hashedPassword,
    }).returning();
    
    // Send email invites if provided
    if (options.emails && options.emails.length > 0) {
      await this.sendInviteEmails(sharedAlbum[0], options.emails);
    }
    
    return sharedAlbum[0];
  }
  
  async accessSharedAlbum(
    token: string,
    password?: string
  ): Promise<{ album: Album; photos: Photo[]; permissions: Permissions }> {
    const sharedAlbum = await db.select()
      .from(sharedAlbumsTable)
      .where(eq(sharedAlbumsTable.shareToken, token))
      .limit(1);
    
    if (!sharedAlbum.length) {
      throw new Error('Shared album not found');
    }
    
    const shared = sharedAlbum[0];
    
    // Check expiration
    if (shared.expiresAt && new Date(shared.expiresAt) < new Date()) {
      throw new Error('Share link has expired');
    }
    
    // Verify password if required
    if (shared.password) {
      if (!password) {
        throw new Error('Password required');
      }
      
      const valid = await argon2.verify(shared.password, password);
      if (!valid) {
        throw new Error('Invalid password');
      }
    }
    
    // Increment view count
    await db.update(sharedAlbumsTable)
      .set({ viewCount: sql`${sharedAlbumsTable.viewCount} + 1` })
      .where(eq(sharedAlbumsTable.id, shared.id));
    
    // Get album and photos
    const album = await this.getAlbum(shared.albumId);
    const photos = await this.getAlbumPhotos(shared.albumId);
    
    return {
      album,
      photos,
      permissions: shared.permissions as Permissions,
    };
  }
  
  async addCollaborator(
    sharedAlbumId: string,
    userId: string,
    permissions: Permissions
  ): Promise<void> {
    await db.insert(sharedAlbumCollaboratorsTable).values({
      sharedAlbumId,
      userId,
      permissions,
    });
    
    // Send notification to collaborator
    await this.notifyCollaborator(userId, sharedAlbumId);
  }
  
  private generateShareToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
```

### 6.5 Advanced Editing Implementation

```typescript
// client/lib/editing/photo-editor.ts

interface EditOperation {
  type: 'crop' | 'filter' | 'adjust' | 'enhance' | 'markup';
  data: any;
}

class PhotoEditor {
  private editHistory: EditOperation[] = [];
  private currentIndex: number = -1;
  
  async applyCrop(
    uri: string,
    cropData: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ crop: cropData }],
      { format: SaveFormat.JPEG, compress: 0.9 }
    );
    
    this.addToHistory({ type: 'crop', data: cropData });
    return result.uri;
  }
  
  async applyFilter(uri: string, filterName: string, intensity: number = 1.0): Promise<string> {
    const filter = this.getFilter(filterName);
    
    // Apply filter using image processing library
    const result = await this.processImage(uri, (image) => {
      return filter.apply(image, intensity);
    });
    
    this.addToHistory({ type: 'filter', data: { filterName, intensity } });
    return result;
  }
  
  async applyAdjustments(uri: string, adjustments: Adjustments): Promise<string> {
    const operations = [];
    
    // Build manipulation operations
    if (adjustments.brightness !== 0) {
      operations.push({ brightness: adjustments.brightness });
    }
    if (adjustments.contrast !== 0) {
      operations.push({ contrast: adjustments.contrast });
    }
    if (adjustments.saturation !== 0) {
      operations.push({ saturation: adjustments.saturation });
    }
    
    const result = await ImageManipulator.manipulateAsync(
      uri,
      operations,
      { format: SaveFormat.JPEG, compress: 0.9 }
    );
    
    this.addToHistory({ type: 'adjust', data: adjustments });
    return result.uri;
  }
  
  async autoEnhance(uri: string): Promise<string> {
    // Analyze image
    const analysis = await this.analyzeImage(uri);
    
    // Determine optimal adjustments
    const adjustments = this.calculateAutoAdjustments(analysis);
    
    // Apply adjustments
    const result = await this.applyAdjustments(uri, adjustments);
    
    this.addToHistory({ type: 'enhance', data: { auto: true } });
    return result;
  }
  
  async undo(): Promise<string | null> {
    if (this.currentIndex <= 0) return null;
    
    this.currentIndex--;
    return await this.reconstructImage();
  }
  
  async redo(): Promise<string | null> {
    if (this.currentIndex >= this.editHistory.length - 1) return null;
    
    this.currentIndex++;
    return await this.reconstructImage();
  }
  
  private async reconstructImage(): Promise<string> {
    // Replay all edits up to current index
    let currentUri = this.originalUri;
    
    for (let i = 0; i <= this.currentIndex; i++) {
      const operation = this.editHistory[i];
      currentUri = await this.applyOperation(currentUri, operation);
    }
    
    return currentUri;
  }
  
  private getFilter(name: string): ImageFilter {
    const filters: Record<string, ImageFilter> = {
      vivid: new VividFilter(),
      dramatic: new DramaticFilter(),
      bw: new BlackAndWhiteFilter(),
      vintage: new VintageFilter(),
      warm: new WarmFilter(),
      cool: new CoolFilter(),
      // ... more filters
    };
    
    return filters[name] || filters.vivid;
  }
}

// Filter implementations
class VividFilter implements ImageFilter {
  apply(image: ImageData, intensity: number): ImageData {
    // Increase saturation and contrast
    return this.adjustSaturation(
      this.adjustContrast(image, 1.2 * intensity),
      1.3 * intensity
    );
  }
}

class BlackAndWhiteFilter implements ImageFilter {
  apply(image: ImageData, intensity: number): ImageData {
    // Convert to grayscale
    const pixels = image.data;
    
    for (let i = 0; i < pixels.length; i += 4) {
      const gray = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      const blended = pixels[i] * (1 - intensity) + gray * intensity;
      
      pixels[i] = blended;     // R
      pixels[i + 1] = blended; // G
      pixels[i + 2] = blended; // B
    }
    
    return image;
  }
}
```

### 6.6 Backup Queue Implementation

```typescript
// server/services/backup-service.ts

class BackupService {
  private queue: Bull.Queue;
  
  constructor() {
    this.queue = new Bull('backup-queue', {
      redis: redisConfig,
    });
    
    this.queue.process(async (job) => {
      return await this.processBackup(job.data);
    });
  }
  
  async queueBackup(photoId: string, userId: string, priority: number = 5): Promise<void> {
    await this.queue.add(
      { photoId, userId },
      { priority, attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
    );
    
    await db.insert(backupQueueTable).values({
      photoId,
      userId,
      status: 'pending',
      priority,
    });
  }
  
  private async processBackup(data: { photoId: string; userId: string }): Promise<void> {
    const { photoId, userId } = data;
    
    try {
      // Update status to processing
      await db.update(backupQueueTable)
        .set({ status: 'processing' })
        .where(eq(backupQueueTable.photoId, photoId));
      
      // Get photo
      const photo = await this.getPhoto(photoId);
      
      // Upload to S3
      const s3Uri = await this.uploadToS3(photo.uri, userId, photoId);
      
      // Generate thumbnails
      const thumbnails = await this.generateAndUploadThumbnails(photo.uri, userId, photoId);
      
      // Update photo record
      await db.update(photosTable)
        .set({
          uri: s3Uri,
          thumbnailSizes: thumbnails,
          backupStatus: 'completed',
          backupCompletedAt: new Date(),
        })
        .where(eq(photosTable.id, photoId));
      
      // Update queue status
      await db.update(backupQueueTable)
        .set({ status: 'completed', processedAt: new Date() })
        .where(eq(backupQueueTable.photoId, photoId));
      
      // Update storage usage
      await this.updateStorageUsage(userId);
      
    } catch (error) {
      // Update queue with error
      await db.update(backupQueueTable)
        .set({
          status: 'failed',
          lastError: error.message,
          retryCount: sql`${backupQueueTable.retryCount} + 1`,
        })
        .where(eq(backupQueueTable.photoId, photoId));
      
      throw error;
    }
  }
  
  private async uploadToS3(localUri: string, userId: string, photoId: string): Promise<string> {
    const s3 = new S3Client({ region: process.env.AWS_REGION });
    
    const fileStream = fs.createReadStream(localUri);
    const key = `users/${userId}/photos/${photoId}/original.jpg`;
    
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: fileStream,
      ContentType: 'image/jpeg',
      ServerSideEncryption: 'AES256',
    }));
    
    return `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
  }
  
  private async generateAndUploadThumbnails(
    localUri: string,
    userId: string,
    photoId: string
  ): Promise<Record<string, string>> {
    const sizes = [
      { name: 'small', width: 150 },
      { name: 'medium', width: 500 },
      { name: 'large', width: 1024 },
    ];
    
    const thumbnails: Record<string, string> = {};
    
    for (const size of sizes) {
      const thumbnail = await this.generateThumbnail(localUri, size.width);
      const s3Uri = await this.uploadToS3(thumbnail, userId, `${photoId}/${size.name}`);
      thumbnails[size.name] = s3Uri;
    }
    
    return thumbnails;
  }
}
```


## 7. UI/UX Design Specifications

### 7.1 New Screens

#### People Screen
```typescript
// client/screens/PeopleScreen.tsx

/**
 * Shows all detected people (face clusters) with photo counts
 * 
 * Layout:
 * - Grid of circular avatars (3 columns)
 * - Name below each avatar (or "Unnamed")
 * - Photo count badge
 * - Tap to see all photos of that person
 * - Long press to rename or merge
 */

interface PersonCard {
  id: string;
  name: string | null;
  coverPhotoUri: string;
  photoCount: number;
}

// Design tokens
const AVATAR_SIZE = 100;
const GRID_COLUMNS = 3;
const SPACING = Spacing.lg;
```

#### Smart Albums Screen
```typescript
// client/screens/SmartAlbumsScreen.tsx

/**
 * Shows auto-generated smart albums
 * 
 * Categories:
 * - People (one album per person)
 * - Places (one album per location)
 * - Things (Food, Pets, Nature, etc.)
 * - Videos
 * - Favorites
 * - Screenshots
 * 
 * Layout:
 * - Grouped by category
 * - Album cards with cover photo
 * - Photo count
 * - Pin/hide options
 */
```

#### Memories Screen
```typescript
// client/screens/MemoriesScreen.tsx

/**
 * Shows curated memories
 * 
 * Types:
 * - On This Day (1, 2, 3, 5, 10 years ago)
 * - Monthly Highlights
 * - Year in Review
 * 
 * Layout:
 * - Card-based design
 * - Large cover photo
 * - Title and date range
 * - Tap to view full memory
 * - Favorite/hide actions
 */
```

#### Shared Albums Screen
```typescript
// client/screens/SharedAlbumsScreen.tsx

/**
 * Shows albums shared with user and albums user has shared
 * 
 * Sections:
 * - Shared with me
 * - Shared by me
 * 
 * Features:
 * - Activity feed (who added what)
 * - Collaborator list
 * - Share settings
 * - Leave/remove collaborators
 */
```

#### Duplicates Screen
```typescript
// client/screens/DuplicatesScreen.tsx

/**
 * Shows duplicate photo groups for review
 * 
 * Layout:
 * - Groups of similar photos
 * - Best photo highlighted
 * - Select photos to keep/delete
 * - Batch actions
 * 
 * Features:
 * - Side-by-side comparison
 * - Quick delete non-best
 * - Keep all option
 */
```

### 7.2 Enhanced Existing Screens

#### Photos Screen Enhancements
```typescript
// Add to existing PhotosScreen.tsx

/**
 * New features:
 * - Smart grouping (not just by date, but by event/location)
 * - "Memories" section at top
 * - "On This Day" banner
 * - Backup status indicator
 * - Storage usage bar
 */

interface PhotoGroup {
  type: 'date' | 'event' | 'location';
  title: string;
  subtitle?: string;
  photos: Photo[];
}
```

#### Search Screen Enhancements
```typescript
// Add to existing SearchScreen.tsx

/**
 * New features:
 * - Natural language search
 * - Search suggestions (objects, people, places)
 * - Recent searches
 * - Filter chips (date, location, people, albums)
 * - Visual search (search by photo)
 */

interface SearchSuggestion {
  type: 'object' | 'person' | 'place' | 'date';
  label: string;
  icon: string;
  count: number;
}
```

#### Edit Screen Enhancements
```typescript
// Replace existing EditPhotoScreen.tsx

/**
 * New features:
 * - Crop with aspect ratios
 * - Filters with intensity slider
 * - Adjustments (brightness, contrast, saturation, etc.)
 * - AI enhancements (auto, sky, portrait)
 * - Drawing and markup tools
 * - Before/after comparison
 * - Save as new or overwrite
 */

interface EditTool {
  id: string;
  name: string;
  icon: string;
  component: React.ComponentType;
}

const EDIT_TOOLS: EditTool[] = [
  { id: 'crop', name: 'Crop', icon: 'crop', component: CropTool },
  { id: 'filters', name: 'Filters', icon: 'image', component: FiltersTool },
  { id: 'adjust', name: 'Adjust', icon: 'sliders', component: AdjustTool },
  { id: 'enhance', name: 'Enhance', icon: 'zap', component: EnhanceTool },
  { id: 'markup', name: 'Markup', icon: 'edit-3', component: MarkupTool },
];
```

### 7.3 New Components

#### PersonAvatar Component
```typescript
// client/components/PersonAvatar.tsx

interface PersonAvatarProps {
  person: Person;
  size?: number;
  showName?: boolean;
  showCount?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
}

/**
 * Circular avatar with person's cover photo
 * Optional name label below
 * Optional photo count badge
 */
```

#### MemoryCard Component
```typescript
// client/components/MemoryCard.tsx

interface MemoryCardProps {
  memory: Memory;
  onPress?: () => void;
  onFavorite?: () => void;
  onHide?: () => void;
}

/**
 * Card showing memory with:
 * - Large cover photo
 * - Title and date
 * - Photo count
 * - Favorite/hide actions
 */
```

#### SmartAlbumCard Component
```typescript
// client/components/SmartAlbumCard.tsx

interface SmartAlbumCardProps {
  smartAlbum: SmartAlbum;
  onPress?: () => void;
  onPin?: () => void;
  onHide?: () => void;
}

/**
 * Album card with:
 * - Cover photo
 * - Title and category icon
 * - Photo count
 * - Pin/hide actions
 */
```

#### FilterSlider Component
```typescript
// client/components/FilterSlider.tsx

interface FilterSliderProps {
  filter: ImageFilter;
  intensity: number;
  onIntensityChange: (value: number) => void;
  previewUri: string;
}

/**
 * Horizontal slider with:
 * - Filter preview thumbnails
 * - Intensity slider (0-100%)
 * - Before/after toggle
 */
```

#### AdjustmentSlider Component
```typescript
// client/components/AdjustmentSlider.tsx

interface AdjustmentSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  onReset: () => void;
}

/**
 * Labeled slider with:
 * - Adjustment name
 * - Numeric value display
 * - Slider (-100 to +100 typically)
 * - Reset button
 */
```

#### DuplicateGroup Component
```typescript
// client/components/DuplicateGroup.tsx

interface DuplicateGroupProps {
  group: DuplicateGroup;
  onKeep: (photoIds: string[]) => void;
  onDelete: (photoIds: string[]) => void;
  onCompare: (photo1: Photo, photo2: Photo) => void;
}

/**
 * Shows group of duplicate photos with:
 * - Horizontal scroll of photos
 * - Best photo indicator
 * - Select checkboxes
 * - Quick actions (keep best, keep all, compare)
 */
```

#### BackupStatusBanner Component
```typescript
// client/components/BackupStatusBanner.tsx

interface BackupStatusBannerProps {
  status: 'idle' | 'uploading' | 'completed' | 'paused' | 'error';
  progress?: number;
  pendingCount?: number;
  onPress?: () => void;
}

/**
 * Banner showing backup status:
 * - Icon and status text
 * - Progress bar (if uploading)
 * - Pending count
 * - Tap to see details
 */
```

### 7.4 Design System Updates

#### New Color Tokens
```typescript
// client/constants/theme.ts

export const Colors = {
  light: {
    // ... existing colors ...
    
    // New colors for features
    aiAccent: '#7C3AED', // Purple for AI features
    memoryAccent: '#F59E0B', // Amber for memories
    sharedAccent: '#10B981', // Green for shared content
    duplicateWarning: '#EF4444', // Red for duplicates
    
    // Status colors
    backupPending: '#6B7280',
    backupActive: '#3B82F6',
    backupComplete: '#10B981',
    backupError: '#EF4444',
  },
  dark: {
    // ... corresponding dark mode colors ...
  },
};
```

#### New Spacing Tokens
```typescript
export const Spacing = {
  // ... existing spacing ...
  
  // New spacing for features
  avatarSize: 100,
  avatarSizeSmall: 60,
  avatarSizeLarge: 150,
  
  memoryCardHeight: 300,
  smartAlbumCardHeight: 200,
  
  filterPreviewSize: 80,
  adjustmentSliderHeight: 60,
};
```

#### Animation Presets
```typescript
// client/constants/animations.ts

export const Animations = {
  // Smooth spring for interactive elements
  spring: {
    damping: 15,
    stiffness: 200,
  },
  
  // Quick fade for overlays
  fade: {
    duration: 200,
  },
  
  // Slide for modals
  slide: {
    duration: 300,
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  },
  
  // Bounce for success actions
  bounce: {
    damping: 10,
    stiffness: 100,
  },
};
```


## 8. Testing Strategy

### 8.1 Unit Tests

```typescript
// server/services/face-recognition.test.ts

describe('FaceRecognitionService', () => {
  describe('generateEmbedding', () => {
    it('should generate 128-dimensional embedding', async () => {
      const service = new FaceRecognitionService();
      const embedding = await service.generateEmbedding(photoId, face);
      
      expect(embedding.embedding).toHaveLength(128);
      expect(embedding.embedding.every(v => typeof v === 'number')).toBe(true);
    });
  });
  
  describe('clusterFaces', () => {
    it('should group similar faces together', async () => {
      const service = new FaceRecognitionService();
      const embeddings = generateTestEmbeddings(10); // 10 faces, 2 people
      
      const clusters = await service.clusterFaces(embeddings);
      
      expect(clusters).toHaveLength(2);
      expect(clusters[0].faces.length).toBeGreaterThan(1);
    });
  });
});

// server/services/search-service.test.ts

describe('SearchService', () => {
  describe('parseQuery', () => {
    it('should extract objects from query', async () => {
      const service = new SearchService();
      const parsed = await service.parseQuery('photos of dogs at the beach');
      
      expect(parsed.objects).toContain('dog');
      expect(parsed.scenes).toContain('beach');
    });
    
    it('should extract date ranges', async () => {
      const service = new SearchService();
      const parsed = await service.parseQuery('photos from last summer');
      
      expect(parsed.dateRange).toBeDefined();
      expect(parsed.dateRange.start).toMatch(/2025-06/);
      expect(parsed.dateRange.end).toMatch(/2025-08/);
    });
  });
});

// server/services/duplicate-detection.test.ts

describe('DuplicateDetectionService', () => {
  describe('hammingDistance', () => {
    it('should calculate correct distance', () => {
      const service = new DuplicateDetectionService();
      
      expect(service.hammingDistance('abcd', 'abcd')).toBe(0);
      expect(service.hammingDistance('abcd', 'abce')).toBe(1);
      expect(service.hammingDistance('abcd', 'efgh')).toBe(4);
    });
  });
  
  describe('selectBestPhoto', () => {
    it('should prefer favorites', () => {
      const service = new DuplicateDetectionService();
      const photos = [
        { id: '1', isFavorite: false, originalSize: 5000000 },
        { id: '2', isFavorite: true, originalSize: 3000000 },
      ];
      
      const best = service.selectBestPhoto(photos);
      expect(best.id).toBe('2');
    });
    
    it('should prefer larger file size when no favorites', () => {
      const service = new DuplicateDetectionService();
      const photos = [
        { id: '1', isFavorite: false, originalSize: 3000000 },
        { id: '2', isFavorite: false, originalSize: 5000000 },
      ];
      
      const best = service.selectBestPhoto(photos);
      expect(best.id).toBe('2');
    });
  });
});
```

### 8.2 Property-Based Tests

```typescript
// server/services/search-service.property.test.ts

import fc from 'fast-check';

describe('SearchService - Property Tests', () => {
  it('search results should always belong to the user', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // query
        fc.uuid(), // userId
        async (query, userId) => {
          const service = new SearchService();
          const results = await service.search(query, userId);
          
          // Property: All results must belong to the requesting user
          return results.every(photo => photo.userId === userId);
        }
      )
    );
  });
  
  it('search with empty query should return all photos', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        async (userId) => {
          const service = new SearchService();
          const allPhotos = await service.getAllUserPhotos(userId);
          const searchResults = await service.search('', userId);
          
          // Property: Empty search returns all photos
          return searchResults.length === allPhotos.length;
        }
      )
    );
  });
});

// server/services/face-recognition.property.test.ts

describe('FaceRecognitionService - Property Tests', () => {
  it('face embeddings should be deterministic', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // photoId
        fc.record({ boundingBox: fc.record({ x: fc.nat(), y: fc.nat(), width: fc.nat(), height: fc.nat() }) }),
        async (photoId, face) => {
          const service = new FaceRecognitionService();
          
          const embedding1 = await service.generateEmbedding(photoId, face);
          const embedding2 = await service.generateEmbedding(photoId, face);
          
          // Property: Same input produces same embedding
          return JSON.stringify(embedding1) === JSON.stringify(embedding2);
        }
      )
    );
  });
  
  it('similar faces should have similar embeddings', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({ embedding: fc.array(fc.float(), { minLength: 128, maxLength: 128 }) }), { minLength: 2 }),
        async (faces) => {
          const service = new FaceRecognitionService();
          
          // Property: Cosine similarity between embeddings should be high for same person
          const similarity = service.cosineSimilarity(faces[0].embedding, faces[1].embedding);
          
          return similarity >= -1 && similarity <= 1; // Valid range
        }
      )
    );
  });
});

// client/lib/ml/photo-analyzer.property.test.ts

describe('PhotoAnalyzer - Property Tests', () => {
  it('perceptual hash should be consistent', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // photoUri
        async (photoUri) => {
          const analyzer = new PhotoAnalyzer();
          
          const hash1 = await analyzer.computePerceptualHash(photoUri);
          const hash2 = await analyzer.computePerceptualHash(photoUri);
          
          // Property: Same image produces same hash
          return hash1 === hash2;
        }
      )
    );
  });
  
  it('ML labels should have valid confidence scores', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string(), // photoUri
        async (photoUri) => {
          const analyzer = new PhotoAnalyzer();
          const result = await analyzer.analyzePhoto(photoUri);
          
          // Property: All confidence scores between 0 and 1
          const allValid = [
            ...result.objects,
            ...result.scenes,
          ].every(item => item.confidence >= 0 && item.confidence <= 1);
          
          return allValid;
        }
      )
    );
  });
});
```

### 8.3 Integration Tests

```typescript
// server/routes/ml-routes.test.ts

describe('ML API Integration Tests', () => {
  let authToken: string;
  let testPhotoId: string;
  
  beforeAll(async () => {
    // Setup test user and photo
    authToken = await createTestUser();
    testPhotoId = await uploadTestPhoto(authToken);
  });
  
  describe('POST /api/ml/analyze', () => {
    it('should analyze photo and return labels', async () => {
      const response = await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ photoId: testPhotoId })
        .expect(200);
      
      expect(response.body.labels).toBeDefined();
      expect(response.body.labels.objects).toBeInstanceOf(Array);
      expect(response.body.labels.scenes).toBeInstanceOf(Array);
      expect(response.body.faces).toBeDefined();
    });
    
    it('should reject unauthorized requests', async () => {
      await request(app)
        .post('/api/ml/analyze')
        .send({ photoId: testPhotoId })
        .expect(401);
    });
  });
  
  describe('POST /api/search/query', () => {
    it('should search photos by natural language', async () => {
      const response = await request(app)
        .post('/api/search/query')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ query: 'photos of dogs' })
        .expect(200);
      
      expect(response.body.photos).toBeInstanceOf(Array);
      expect(response.body.totalCount).toBeGreaterThanOrEqual(0);
    });
  });
});

// server/routes/sharing-routes.test.ts

describe('Sharing API Integration Tests', () => {
  let authToken: string;
  let albumId: string;
  
  beforeAll(async () => {
    authToken = await createTestUser();
    albumId = await createTestAlbum(authToken);
  });
  
  describe('POST /api/albums/:id/share', () => {
    it('should create shared album link', async () => {
      const response = await request(app)
        .post(`/api/albums/${albumId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shareType: 'link',
          permissions: { canView: true, canAdd: false, canEdit: false },
        })
        .expect(200);
      
      expect(response.body.sharedAlbum).toBeDefined();
      expect(response.body.shareUrl).toMatch(/^https?:\/\//);
    });
    
    it('should create password-protected link', async () => {
      const response = await request(app)
        .post(`/api/albums/${albumId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shareType: 'link',
          permissions: { canView: true, canAdd: false, canEdit: false },
          password: 'test123',
        })
        .expect(200);
      
      expect(response.body.sharedAlbum.password).toBeDefined();
    });
  });
  
  describe('GET /api/shared/:token', () => {
    it('should access shared album with valid token', async () => {
      const shareResponse = await createSharedAlbum(authToken, albumId);
      const token = shareResponse.body.sharedAlbum.shareToken;
      
      const response = await request(app)
        .get(`/api/shared/${token}`)
        .expect(200);
      
      expect(response.body.album).toBeDefined();
      expect(response.body.photos).toBeInstanceOf(Array);
      expect(response.body.permissions).toBeDefined();
    });
    
    it('should reject invalid token', async () => {
      await request(app)
        .get('/api/shared/invalid-token')
        .expect(404);
    });
    
    it('should require password for protected links', async () => {
      const shareResponse = await createSharedAlbum(authToken, albumId, { password: 'test123' });
      const token = shareResponse.body.sharedAlbum.shareToken;
      
      await request(app)
        .get(`/api/shared/${token}`)
        .expect(401);
      
      await request(app)
        .get(`/api/shared/${token}`)
        .send({ password: 'test123' })
        .expect(200);
    });
  });
});
```

### 8.4 E2E Tests

```typescript
// e2e/photo-upload-and-analysis.test.ts

describe('Photo Upload and Analysis E2E', () => {
  it('should upload photo, analyze it, and make it searchable', async () => {
    // 1. Upload photo
    const photo = await uploadPhoto('test-dog-beach.jpg');
    expect(photo.id).toBeDefined();
    
    // 2. Wait for ML analysis
    await waitForAnalysis(photo.id, { timeout: 30000 });
    
    // 3. Verify labels were detected
    const analyzedPhoto = await getPhoto(photo.id);
    expect(analyzedPhoto.mlLabels.objects).toContain('dog');
    expect(analyzedPhoto.mlLabels.scenes).toContain('beach');
    
    // 4. Search for photo
    const searchResults = await searchPhotos('dog at beach');
    expect(searchResults.some(p => p.id === photo.id)).toBe(true);
  });
});

// e2e/face-recognition-workflow.test.ts

describe('Face Recognition Workflow E2E', () => {
  it('should detect faces, cluster them, and allow naming', async () => {
    // 1. Upload photos with faces
    const photo1 = await uploadPhoto('person-a-1.jpg');
    const photo2 = await uploadPhoto('person-a-2.jpg');
    const photo3 = await uploadPhoto('person-b-1.jpg');
    
    // 2. Wait for face detection
    await waitForFaceDetection([photo1.id, photo2.id, photo3.id]);
    
    // 3. Get detected people
    const people = await getPeople();
    expect(people.length).toBeGreaterThanOrEqual(2);
    
    // 4. Name a person
    const person = people[0];
    await namePerson(person.id, 'John Doe');
    
    // 5. Verify name appears
    const updatedPerson = await getPerson(person.id);
    expect(updatedPerson.name).toBe('John Doe');
    
    // 6. Get photos of person
    const personPhotos = await getPersonPhotos(person.id);
    expect(personPhotos.length).toBeGreaterThanOrEqual(2);
  });
});

// e2e/sharing-workflow.test.ts

describe('Sharing Workflow E2E', () => {
  it('should share album and allow collaborator to add photos', async () => {
    // 1. Create album
    const album = await createAlbum('Vacation 2025');
    await addPhotosToAlbum(album.id, [photo1.id, photo2.id]);
    
    // 2. Share album
    const share = await shareAlbum(album.id, {
      shareType: 'link',
      permissions: { canView: true, canAdd: true, canEdit: false },
    });
    
    // 3. Access shared album (as different user)
    const sharedAlbum = await accessSharedAlbum(share.shareToken);
    expect(sharedAlbum.album.id).toBe(album.id);
    expect(sharedAlbum.photos.length).toBe(2);
    
    // 4. Add photo to shared album
    const newPhoto = await uploadPhoto('new-photo.jpg');
    await addPhotoToSharedAlbum(share.shareToken, newPhoto.id);
    
    // 5. Verify photo was added
    const updatedAlbum = await getAlbum(album.id);
    expect(updatedAlbum.photoIds).toContain(newPhoto.id);
  });
});
```

