// AI-META-BEGIN
// AI-META: Core TypeScript types for photos, albums, storage, and date grouping
// OWNERSHIP: client/types (type definitions)
// ENTRYPOINTS: Imported throughout app for type safety
// DEPENDENCIES: None - pure TypeScript
// DANGER: Changing these affects entire app; maintain backward compatibility
// CHANGE-SAFETY: Risky - breaking changes require migration; safe to add optional fields
// TESTS: TypeScript compilation validates usage; test with actual data structures
// AI-META-END

export interface Photo {
  id: string;
  uri: string;
  width: number;
  height: number;
  createdAt: number;
  modifiedAt: number;
  filename: string;
  isFavorite: boolean;
  // AI-NOTE: Bidirectional relationship - photo knows which albums contain it
  albumIds: string[];
  // Sensitive metadata (should be encrypted at rest)
  location?: {
    latitude: number;
    longitude: number;
    address?: string;
    city?: string;
    country?: string;
  };
  camera?: {
    make: string;
    model: string;
    iso?: number;
    aperture?: string;
    shutter?: string;
    focalLength?: number;
  };
  exif?: Record<string, unknown>;
  tags?: string[];
  notes?: string;
  isPrivate?: boolean;
}

export interface Album {
  id: string;
  title: string;
  coverPhotoUri: string | null;
  // AI-NOTE: Bidirectional relationship - album knows which photos it contains
  photoIds: string[];
  createdAt: number;
  modifiedAt: number;
}

export interface StorageInfo {
  usedBytes: number;
  totalBytes: number;
  photoCount: number;
  albumCount: number;
}

export type DateGroup = {
  title: string;
  data: Photo[];
};
