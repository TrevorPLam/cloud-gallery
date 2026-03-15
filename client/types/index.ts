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
  // ML/AI fields
  mlLabels?: string[];
  mlProcessedAt?: string;
  mlVersion?: string;
  ocrText?: string;
  ocrLanguage?: string;
  perceptualHash?: string;
  duplicateGroupId?: string;
  isVideo?: boolean;
  videoDuration?: number;
  videoThumbnailUri?: string;
  backupStatus?: string;
  backupCompletedAt?: string;
  originalSize?: number;
  compressedSize?: number;
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

// Shared Albums types
export type SharedAlbum = {
  id: string;
  albumId: string;
  albumTitle: string;
  shareToken: string;
  permissions: "view" | "edit" | "admin";
  expiresAt: string | null;
  viewCount: number;
  isActive: boolean;
  createdAt: string;
};

export type CollaboratedAlbum = {
  id: string;
  sharedAlbumId: string;
  albumId: string;
  albumTitle: string;
  permissions: "view" | "edit" | "admin";
  invitedBy: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type Collaborator = {
  id: string;
  userId: string;
  username: string;
  permissions: "view" | "edit" | "admin";
  invitedBy: string;
  acceptedAt: string | null;
  createdAt: string;
};

export type ShareSettings = {
  permissions: "view" | "edit" | "admin";
  password?: string;
  expiresAt?: string | null;
};

// Partner Sharing types
export type PartnerRelationship = {
  id: string;
  partnerId: string;
  partnerName: string;
  status: "pending" | "accepted" | "declined" | "revoked";
  acceptedAt: string | null;
  privacySettings: {
    includeOtherApps: boolean;
    minQuality?: number;
    excludeTags?: string[];
    favoritesOnly?: boolean;
  };
};

export type PartnerInvitation = {
  id: string;
  invitationToken: string;
  inviteeEmail?: string;
  expiresAt: string;
  message?: string;
  status: "pending" | "accepted" | "declined" | "expired";
};

export type AutoShareRule = {
  id: string;
  partnershipId: string;
  name: string;
  ruleType: "all_photos" | "date_range" | "people" | "content_type";
  criteria: {
    startDate?: string;
    endDate?: string;
    peopleIds?: string[];
    contentTypes?: ("camera" | "screenshot" | "download" | "other")[];
    minQuality?: number;
    excludeTags?: string[];
    favoritesOnly?: boolean;
  };
  isActive: boolean;
  priority: number;
};

export type PartnerSharedPhoto = {
  id: string;
  uri: string;
  width: number;
  height: number;
  filename: string;
  isFavorite: boolean;
  createdAt: string;
  sharedBy: string;
  isSavedByPartner: boolean;
};

export type PartnerSharingStats = {
  activePartnerships: number;
  pendingInvitations: number;
  sharedPhotos: number;
  autoShareRules: number;
};
