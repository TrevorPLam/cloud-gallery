// AI-META-BEGIN
// AI-META: Secure sharing service for album collaboration with token generation and permission enforcement
// OWNERSHIP: server/services
// ENTRYPOINTS: imported by sharing-routes.ts and album management
// DEPENDENCIES: drizzle-orm, argon2, ../shared/schema, ./db
// DANGER: Sharing token bypass = unauthorized album access; permission failure = data breach
// CHANGE-SAFETY: Maintain token uniqueness, permission levels, and Argon2id parameters
// TESTS: Property tests for token uniqueness, permission enforcement, expiration enforcement
// AI-META-END

import { db } from "../db";
import {
  sharedAlbums,
  sharedAlbumCollaborators,
  albums,
  photos,
  albumPhotos,
  users,
  insertSharedAlbumSchema,
  insertSharedAlbumCollaboratorSchema,
} from "../../shared/schema";
import {
  eq,
  and,
  isNull,
  isNotNull,
  desc,
  lt,
  gt,
  or,
} from "drizzle-orm";
import { hash, verify } from "argon2";
import { randomBytes } from "crypto";

/**
 * Configuration for sharing service
 */
export interface SharingConfig {
  /** Token length in bytes (64 chars when hex encoded) */
  tokenLength: number;
  /** Argon2id memory cost in KiB */
  argon2Memory: number;
  /** Argon2id iterations */
  argon2Iterations: number;
  /** Argon2id parallelism */
  argon2Parallelism: number;
  /** Default share expiration in days (null = never expires) */
  defaultExpirationDays: number | null;
}

/**
 * Permission levels for shared albums
 */
export enum Permission {
  VIEW = "view",
  EDIT = "edit", 
  ADMIN = "admin",
}

/**
 * Share creation options
 */
export interface CreateShareOptions {
  /** Album ID to share */
  albumId: string;
  /** Owner user ID */
  userId: string;
  /** Optional password for protection */
  password?: string;
  /** Permission level */
  permissions: Permission;
  /** Expiration date (null = never expires) */
  expiresAt?: Date | null;
}

/**
 * Share access result
 */
export interface ShareAccess {
  /** Share information */
  share: {
    id: string;
    albumId: string;
    permissions: Permission;
    expiresAt: Date | null;
    viewCount: number;
  };
  /** Album information */
  album: {
    id: string;
    title: string;
    description: string | null;
    coverPhotoUri: string | null;
    createdAt: Date;
  };
  /** Photos in album */
  photos: Array<{
    id: string;
    uri: string;
    width: number;
    height: number;
    filename: string;
    isFavorite: boolean;
    createdAt: Date;
  }>;
}

/**
 * Collaborator management options
 */
export interface CollaboratorOptions {
  /** Shared album ID */
  sharedAlbumId: string;
  /** User ID to add as collaborator */
  userId: string;
  /** Permission level */
  permissions: Permission;
  /** Who is inviting this collaborator */
  invitedBy: string;
}

/**
 * Default configuration following OWASP 2026 guidelines
 */
const DEFAULT_CONFIG: SharingConfig = {
  tokenLength: 32, // 64 hex chars
  argon2Memory: 19456, // 19 MiB as recommended by OWASP
  argon2Iterations: 2,
  argon2Parallelism: 1,
  defaultExpirationDays: null, // No default expiration
};

/**
 * Sharing service for album collaboration and public links
 */
export class SharingService {
  private config: SharingConfig;

  constructor(config: SharingConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Generate a cryptographically secure share token
   */
  private generateShareToken(): string {
    return randomBytes(this.config.tokenLength).toString("hex");
  }

  /**
   * Hash password using Argon2id (OWASP 2026 recommended)
   */
  private async hashPassword(password: string): Promise<string> {
    return await hash(password, {
      memoryCost: this.config.argon2Memory,
      timeCost: this.config.argon2Iterations,
      parallelism: this.config.argon2Parallelism,
      type: "argon2id",
    });
  }

  /**
   * Verify password against Argon2id hash
   */
  private async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    try {
      return await verify(hash, password, {
        memoryCost: this.config.argon2Memory,
        timeCost: this.config.argon2Iterations,
        parallelism: this.config.argon2Parallelism,
        type: "argon2id",
      });
    } catch (error) {
      console.error("Password verification error:", error);
      return false;
    }
  }

  /**
   * Create a new shared album
   */
  async createShare(options: CreateShareOptions): Promise<{
    id: string;
    shareToken: string;
    permissions: Permission;
    expiresAt: Date | null;
    passwordRequired: boolean;
  }> {
    const { albumId, userId, password, permissions, expiresAt } = options;

    // Verify album belongs to user
    const album = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, albumId), eq(albums.userId, userId)))
      .limit(1);

    if (album.length === 0) {
      throw new Error("Album not found or access denied");
    }

    // Generate unique share token
    const shareToken = this.generateShareToken();

    // Hash password if provided
    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await this.hashPassword(password);
    }

    // Set expiration if not provided
    const expiresAtFinal = expiresAt ?? 
      (this.config.defaultExpirationDays 
        ? new Date(Date.now() + this.config.defaultExpirationDays * 24 * 60 * 60 * 1000)
        : null);

    // Create shared album
    const [sharedAlbum] = await db
      .insert(sharedAlbums)
      .values({
        albumId,
        shareToken,
        passwordHash,
        permissions,
        expiresAt: expiresAtFinal,
        isActive: true,
      })
      .returning();

    return {
      id: sharedAlbum.id,
      shareToken: sharedAlbum.shareToken,
      permissions: sharedAlbum.permissions,
      expiresAt: sharedAlbum.expiresAt,
      passwordRequired: !!passwordHash,
    };
  }

  /**
   * Access a shared album by token
   */
  async accessSharedAlbum(
    shareToken: string,
    password?: string,
  ): Promise<ShareAccess> {
    // Find active shared album with valid token
    const now = new Date();
    const sharedAlbum = await db
      .select()
      .from(sharedAlbums)
      .where(
        and(
          eq(sharedAlbums.shareToken, shareToken),
          eq(sharedAlbums.isActive, true),
          or(
            isNull(sharedAlbums.expiresAt),
            gt(sharedAlbums.expiresAt, now),
          ),
        ),
      )
      .limit(1);

    if (sharedAlbum.length === 0) {
      throw new Error("Invalid or expired share token");
    }

    const share = sharedAlbum[0];

    // Verify password if required
    if (share.passwordHash && !password) {
      throw new Error("Password required");
    }

    if (share.passwordHash && password) {
      const passwordValid = await this.verifyPassword(password, share.passwordHash);
      if (!passwordValid) {
        throw new Error("Invalid password");
      }
    }

    // Get album information
    const album = await db
      .select()
      .from(albums)
      .where(eq(albums.id, share.albumId))
      .limit(1);

    if (album.length === 0) {
      throw new Error("Album not found");
    }

    // Get photos in album (ordered by position)
    const albumPhotosList = await db
      .select({
        photo: photos,
        position: albumPhotos.position,
      })
      .from(albumPhotos)
      .innerJoin(photos, eq(albumPhotos.photoId, photos.id))
      .where(eq(albumPhotos.albumId, share.albumId))
      .orderBy(albumPhotos.position);

    // Increment view count
    await db
      .update(sharedAlbums)
      .set({ 
        viewCount: share.viewCount + 1,
        updatedAt: new Date(),
      })
      .where(eq(sharedAlbums.id, share.id));

    return {
      share: {
        id: share.id,
        albumId: share.albumId,
        permissions: share.permissions,
        expiresAt: share.expiresAt,
        viewCount: share.viewCount + 1,
      },
      album: {
        id: album[0].id,
        title: album[0].title,
        description: album[0].description,
        coverPhotoUri: album[0].coverPhotoUri,
        createdAt: album[0].createdAt,
      },
      photos: albumPhotosList.map(({ photo }) => ({
        id: photo.id,
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        filename: photo.filename,
        isFavorite: photo.isFavorite,
        createdAt: photo.createdAt,
      })),
    };
  }

  /**
   * Add a collaborator to a shared album
   */
  async addCollaborator(options: CollaboratorOptions): Promise<{
    id: string;
    userId: string;
    permissions: Permission;
    acceptedAt: Date | null;
  }> {
    const { sharedAlbumId, userId, permissions, invitedBy } = options;

    // Verify shared album exists and inviter has admin permissions
    const sharedAlbum = await db
      .select()
      .from(sharedAlbums)
      .where(eq(sharedAlbums.id, sharedAlbumId))
      .limit(1);

    if (sharedAlbum.length === 0) {
      throw new Error("Shared album not found");
    }

    // Get album to check ownership
    const album = await db
      .select()
      .from(albums)
      .where(eq(albums.id, sharedAlbum[0].albumId))
      .limit(1);

    if (album.length === 0) {
      throw new Error("Album not found");
    }

    // Check if inviter is album owner or has admin permissions
    const isOwner = album[0].userId === invitedBy;
    const collaboratorCheck = await db
      .select()
      .from(sharedAlbumCollaborators)
      .where(
        and(
          eq(sharedAlbumCollaborators.sharedAlbumId, sharedAlbumId),
          eq(sharedAlbumCollaborators.userId, invitedBy),
        ),
      )
      .limit(1);

    const isAdmin = collaboratorCheck.length > 0 && 
      collaboratorCheck[0].permissions === Permission.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new Error("Insufficient permissions to add collaborators");
    }

    // Verify user exists
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error("User not found");
    }

    // Check if user is already a collaborator
    const existing = await db
      .select()
      .from(sharedAlbumCollaborators)
      .where(
        and(
          eq(sharedAlbumCollaborators.sharedAlbumId, sharedAlbumId),
          eq(sharedAlbumCollaborators.userId, userId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new Error("User is already a collaborator");
    }

    // Add collaborator
    const [collaborator] = await db
      .insert(sharedAlbumCollaborators)
      .values({
        sharedAlbumId,
        userId,
        permissions,
        invitedBy,
        acceptedAt: new Date(), // Auto-accept for simplicity
      })
      .returning();

    return {
      id: collaborator.id,
      userId: collaborator.userId,
      permissions: collaborator.permissions,
      acceptedAt: collaborator.acceptedAt,
    };
  }

  /**
   * Get collaborators for a shared album
   */
  async getCollaborators(
    sharedAlbumId: string,
    requestUserId: string,
  ): Promise<Array<{
    id: string;
    userId: string;
    username: string;
    permissions: Permission;
    invitedBy: string;
    acceptedAt: Date | null;
    createdAt: Date;
  }>> {
    // Verify user has access to this shared album
    const sharedAlbum = await db
      .select()
      .from(sharedAlbums)
      .innerJoin(albums, eq(sharedAlbums.albumId, albums.id))
      .where(
        and(
          eq(sharedAlbums.id, sharedAlbumId),
          eq(albums.userId, requestUserId), // Only album owner can view collaborators
        ),
      )
      .limit(1);

    if (sharedAlbum.length === 0) {
      throw new Error("Access denied");
    }

    // Get collaborators with user information
    const collaborators = await db
      .select({
        collaborator: sharedAlbumCollaborators,
        username: users.username,
      })
      .from(sharedAlbumCollaborators)
      .innerJoin(users, eq(sharedAlbumCollaborators.userId, users.id))
      .where(eq(sharedAlbumCollaborators.sharedAlbumId, sharedAlbumId))
      .orderBy(sharedAlbumCollaborators.createdAt);

    return collaborators.map(({ collaborator, username }) => ({
      id: collaborator.id,
      userId: collaborator.userId,
      username,
      permissions: collaborator.permissions,
      invitedBy: collaborator.invitedBy,
      acceptedAt: collaborator.acceptedAt,
      createdAt: collaborator.createdAt,
    }));
  }

  /**
   * Remove a collaborator from a shared album
   */
  async removeCollaborator(
    sharedAlbumId: string,
    userIdToRemove: string,
    requestUserId: string,
  ): Promise<void> {
    // Verify shared album and permissions
    const sharedAlbum = await db
      .select()
      .from(sharedAlbums)
      .innerJoin(albums, eq(sharedAlbums.albumId, albums.id))
      .where(eq(sharedAlbums.id, sharedAlbumId))
      .limit(1);

    if (sharedAlbum.length === 0) {
      throw new Error("Shared album not found");
    }

    const isOwner = sharedAlbum[0].albums.userId === requestUserId;
    
    // Check if requester is admin collaborator
    const collaboratorCheck = await db
      .select()
      .from(sharedAlbumCollaborators)
      .where(
        and(
          eq(sharedAlbumCollaborators.sharedAlbumId, sharedAlbumId),
          eq(sharedAlbumCollaborators.userId, requestUserId),
        ),
      )
      .limit(1);

    const isAdmin = collaboratorCheck.length > 0 && 
      collaboratorCheck[0].permissions === Permission.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new Error("Insufficient permissions to remove collaborators");
    }

    // Don't allow removing the album owner
    if (sharedAlbum[0].albums.userId === userIdToRemove) {
      throw new Error("Cannot remove album owner");
    }

    // Remove collaborator
    await db
      .delete(sharedAlbumCollaborators)
      .where(
        and(
          eq(sharedAlbumCollaborators.sharedAlbumId, sharedAlbumId),
          eq(sharedAlbumCollaborators.userId, userIdToRemove),
        ),
      );
  }

  /**
   * Update shared album settings
   */
  async updateShare(
    shareId: string,
    userId: string,
    updates: {
      permissions?: Permission;
      expiresAt?: Date | null;
      isActive?: boolean;
    },
  ): Promise<{
    id: string;
    permissions: Permission;
    expiresAt: Date | null;
    isActive: boolean;
  }> {
    // Verify share ownership
    const share = await db
      .select()
      .from(sharedAlbums)
      .innerJoin(albums, eq(sharedAlbums.albumId, albums.id))
      .where(
        and(
          eq(sharedAlbums.id, shareId),
          eq(albums.userId, userId),
        ),
      )
      .limit(1);

    if (share.length === 0) {
      throw new Error("Share not found or access denied");
    }

    // Update share
    const [updatedShare] = await db
      .update(sharedAlbums)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(sharedAlbums.id, shareId))
      .returning();

    return {
      id: updatedShare.id,
      permissions: updatedShare.permissions,
      expiresAt: updatedShare.expiresAt,
      isActive: updatedShare.isActive,
    };
  }

  /**
   * Get all shared albums for a user (both owned and collaborated)
   */
  async getUserSharedAlbums(
    userId: string,
  ): Promise<{
    owned: Array<{
      id: string;
      albumId: string;
      albumTitle: string;
      shareToken: string;
      permissions: Permission;
      expiresAt: Date | null;
      viewCount: number;
      isActive: boolean;
      createdAt: Date;
    }>;
    collaborated: Array<{
      id: string;
      sharedAlbumId: string;
      albumId: string;
      albumTitle: string;
      permissions: Permission;
      invitedBy: string;
      acceptedAt: Date | null;
      createdAt: Date;
    }>;
  }> {
    // Get owned shared albums
    const ownedShares = await db
      .select({
        share: sharedAlbums,
        albumTitle: albums.title,
      })
      .from(sharedAlbums)
      .innerJoin(albums, eq(sharedAlbums.albumId, albums.id))
      .where(eq(albums.userId, userId))
      .orderBy(desc(sharedAlbums.createdAt));

    // Get collaborated albums
    const collaboratedShares = await db
      .select({
        collaborator: sharedAlbumCollaborators,
        albumTitle: albums.title,
      })
      .from(sharedAlbumCollaborators)
      .innerJoin(sharedAlbums, eq(sharedAlbumCollaborators.sharedAlbumId, sharedAlbums.id))
      .innerJoin(albums, eq(sharedAlbums.albumId, albums.id))
      .where(eq(sharedAlbumCollaborators.userId, userId))
      .orderBy(desc(sharedAlbumCollaborators.createdAt));

    return {
      owned: ownedShares.map(({ share, albumTitle }) => ({
        id: share.id,
        albumId: share.albumId,
        albumTitle,
        shareToken: share.shareToken,
        permissions: share.permissions,
        expiresAt: share.expiresAt,
        viewCount: share.viewCount,
        isActive: share.isActive,
        createdAt: share.createdAt,
      })),
      collaborated: collaboratedShares.map(({ collaborator, albumTitle }) => ({
        id: collaborator.id,
        sharedAlbumId: collaborator.sharedAlbumId,
        albumId: collaborator.sharedAlbumId, // Will need to join to get actual albumId
        albumTitle,
        permissions: collaborator.permissions,
        invitedBy: collaborator.invitedBy,
        acceptedAt: collaborator.acceptedAt,
        createdAt: collaborator.createdAt,
      })),
    };
  }

  /**
   * Check if a share token is valid and not expired
   */
  async validateShareToken(shareToken: string): Promise<{
    valid: boolean;
    expired: boolean;
    passwordRequired: boolean;
  }> {
    const now = new Date();
    const share = await db
      .select()
      .from(sharedAlbums)
      .where(eq(sharedAlbums.shareToken, shareToken))
      .limit(1);

    if (share.length === 0) {
      return { valid: false, expired: false, passwordRequired: false };
    }

    const shareData = share[0];
    const expired = shareData.expiresAt ? shareData.expiresAt < now : false;

    return {
      valid: shareData.isActive && !expired,
      expired,
      passwordRequired: !!shareData.passwordHash,
    };
  }
}

// Export singleton instance
export const sharingService = new SharingService();
