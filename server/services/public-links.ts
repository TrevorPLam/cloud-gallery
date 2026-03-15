// AI-META-BEGIN
// AI-META: Public links service for anonymous album access with security features
// OWNERSHIP: server/services
// ENTRYPOINTS: imported by public-routes.ts for public link generation and access
// DEPENDENCIES: drizzle-orm, argon2, ../shared/schema, ./db, ./sharing
// DANGER: Public link bypass = unauthorized album access; weak tokens = brute force vulnerability
// CHANGE-SAFETY: Maintain token entropy, password protection, and rate limiting
// TESTS: Property tests for token uniqueness, access control, view counting
// AI-META-END

import { db } from "../db";
import {
  sharedAlbums,
  albums,
  photos,
  albumPhotos,
  users,
} from "../../shared/schema";
import { eq, and, isNull, isNotNull, desc, lt, gt, or } from "drizzle-orm";
import { randomBytes } from "crypto";
import { sharingService, Permission } from "./sharing";

/**
 * Configuration for public links service
 */
export interface PublicLinksConfig {
  /** Token length in bytes (64 chars when hex encoded) */
  tokenLength: number;
  /** Maximum number of photos to display in public view */
  maxPhotosPerPage: number;
  /** Cache duration for public links in seconds */
  cacheDuration: number;
  /** Rate limit requests per minute per IP */
  rateLimitPerMinute: number;
}

/**
 * Public link creation options
 */
export interface CreatePublicLinkOptions {
  /** Album ID to share publicly */
  albumId: string;
  /** Owner user ID */
  userId: string;
  /** Optional password for protection */
  password?: string;
  /** Expiration date (null = never expires) */
  expiresAt?: Date | null;
  /** Allow downloads */
  allowDownload?: boolean;
  /** Show album metadata */
  showMetadata?: boolean;
  /** Custom title for public view */
  customTitle?: string;
  /** Custom description for public view */
  customDescription?: string;
}

/**
 * Public link access result
 */
export interface PublicLinkAccess {
  /** Share information */
  share: {
    id: string;
    albumId: string;
    expiresAt: Date | null;
    viewCount: number;
    allowDownload: boolean;
    showMetadata: boolean;
    customTitle: string | null;
    customDescription: string | null;
  };
  /** Album information */
  album: {
    id: string;
    title: string;
    description: string | null;
    coverPhotoUri: string | null;
    createdAt: Date;
    photoCount: number;
  };
  /** Photos in album (paginated) */
  photos: {
    id: string;
    uri: string;
    width: number;
    height: number;
    filename: string;
    isFavorite: boolean;
    createdAt: Date;
  }[];
  /** Pagination info */
  pagination: {
    page: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Default configuration with security best practices
 */
const DEFAULT_CONFIG: PublicLinksConfig = {
  tokenLength: 32, // 64 hex chars
  maxPhotosPerPage: 50,
  cacheDuration: 300, // 5 minutes
  rateLimitPerMinute: 60,
};

/**
 * Public links service for anonymous album access
 */
export class PublicLinksService {
  private config: PublicLinksConfig;
  private rateLimitTracker = new Map<
    string,
    { count: number; resetTime: number }
  >();

  constructor(config: PublicLinksConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Generate a cryptographically secure public link token
   */
  private generatePublicToken(): string {
    return randomBytes(this.config.tokenLength).toString("hex");
  }

  /**
   * Check rate limiting for IP address
   */
  private checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const tracker = this.rateLimitTracker.get(ip);

    if (!tracker || now > tracker.resetTime) {
      // Reset or create tracker
      this.rateLimitTracker.set(ip, {
        count: 1,
        resetTime: now + 60000, // 1 minute from now
      });
      return true;
    }

    if (tracker.count >= this.config.rateLimitPerMinute) {
      return false;
    }

    tracker.count++;
    return true;
  }

  /**
   * Create a new public link for an album
   */
  async createPublicLink(options: CreatePublicLinkOptions): Promise<{
    id: string;
    publicToken: string;
    expiresAt: Date | null;
    passwordRequired: boolean;
    allowDownload: boolean;
    showMetadata: boolean;
    url: string;
  }> {
    const {
      albumId,
      userId,
      password,
      expiresAt,
      allowDownload = true,
      showMetadata = false,
    } = options;

    // Verify album belongs to user
    const album = await db
      .select()
      .from(albums)
      .where(and(eq(albums.id, albumId), eq(albums.userId, userId)))
      .limit(1);

    if (album.length === 0) {
      throw new Error("Album not found or access denied");
    }

    // Generate unique public token
    const publicToken = this.generatePublicToken();

    // Use existing sharing service to create the share with VIEW permissions
    const shareResult = await sharingService.createShare({
      albumId,
      userId,
      password,
      permissions: Permission.VIEW,
      expiresAt,
    });

    // Update share with public link specific settings
    await db
      .update(sharedAlbums)
      .set({
        allowDownload,
        showMetadata,
        customTitle: options.customTitle || null,
        customDescription: options.customDescription || null,
        updatedAt: new Date(),
      })
      .where(eq(sharedAlbums.id, shareResult.id));

    return {
      id: shareResult.id,
      publicToken: shareResult.shareToken,
      expiresAt: shareResult.expiresAt,
      passwordRequired: shareResult.passwordRequired,
      allowDownload,
      showMetadata,
      url: `/public/${shareResult.shareToken}`,
    };
  }

  /**
   * Access a public link by token
   */
  async accessPublicLink(
    publicToken: string,
    password?: string,
    page: number = 1,
    clientIp: string = "unknown",
  ): Promise<PublicLinkAccess> {
    // Check rate limiting
    if (!this.checkRateLimit(clientIp)) {
      throw new Error("Rate limit exceeded. Please try again later.");
    }

    // Validate page number
    if (page < 1) page = 1;

    // Use existing sharing service to access the album
    const shareAccess = await sharingService.accessSharedAlbum(
      publicToken,
      password,
    );

    // Calculate pagination
    const totalPhotos = shareAccess.photos.length;
    const totalPages = Math.ceil(totalPhotos / this.config.maxPhotosPerPage);
    const offset = (page - 1) * this.config.maxPhotosPerPage;
    const limit = Math.min(this.config.maxPhotosPerPage, totalPhotos - offset);

    // Get paginated photos
    const paginatedPhotos = shareAccess.photos.slice(offset, offset + limit);

    // Get share details for public link settings
    const shareDetails = await db
      .select()
      .from(sharedAlbums)
      .where(eq(sharedAlbums.shareToken, publicToken))
      .limit(1);

    if (shareDetails.length === 0) {
      throw new Error("Public link not found");
    }

    const share = shareDetails[0];

    return {
      share: {
        id: share.id,
        albumId: share.albumId,
        expiresAt: share.expiresAt,
        viewCount: shareAccess.share.viewCount,
        allowDownload: share.allowDownload ?? true,
        showMetadata: share.showMetadata ?? false,
        customTitle: share.customTitle,
        customDescription: share.customDescription,
      },
      album: {
        ...shareAccess.album,
        photoCount: totalPhotos,
      },
      photos: paginatedPhotos,
      pagination: {
        page,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  /**
   * Validate a public link token without incrementing view count
   */
  async validatePublicLink(publicToken: string): Promise<{
    valid: boolean;
    expired: boolean;
    passwordRequired: boolean;
    albumTitle?: string;
    customTitle?: string;
  }> {
    // Use existing sharing service validation
    const validation = await sharingService.validateShareToken(publicToken);

    if (!validation.valid) {
      return {
        valid: false,
        expired: validation.expired,
        passwordRequired: false,
      };
    }

    // Get album information for display
    const shareDetails = await db
      .select({
        album: albums,
        customTitle: sharedAlbums.customTitle,
      })
      .from(sharedAlbums)
      .innerJoin(albums, eq(sharedAlbums.albumId, albums.id))
      .where(eq(sharedAlbums.shareToken, publicToken))
      .limit(1);

    if (shareDetails.length === 0) {
      return {
        valid: false,
        expired: false,
        passwordRequired: false,
      };
    }

    const { album, customTitle } = shareDetails[0];

    return {
      valid: validation.valid,
      expired: validation.expired,
      passwordRequired: validation.passwordRequired,
      albumTitle: album.title,
      customTitle: customTitle || undefined,
    };
  }

  /**
   * Get public link statistics for user
   */
  async getPublicLinkStats(userId: string): Promise<{
    totalPublicLinks: number;
    activePublicLinks: number;
    expiredPublicLinks: number;
    totalViews: number;
    protectedLinks: number;
  }> {
    // Get user's shared albums
    const userShares = await db
      .select()
      .from(sharedAlbums)
      .innerJoin(albums, eq(sharedAlbums.albumId, albums.id))
      .where(eq(albums.userId, userId));

    const now = new Date();
    const totalPublicLinks = userShares.length;
    const activePublicLinks = userShares.filter(
      (share) =>
        share.shared_albums.isActive &&
        (!share.shared_albums.expiresAt || share.shared_albums.expiresAt > now),
    ).length;
    const expiredPublicLinks = userShares.filter(
      (share) =>
        share.shared_albums.expiresAt && share.shared_albums.expiresAt < now,
    ).length;
    const totalViews = userShares.reduce(
      (sum, share) => sum + share.shared_albums.viewCount,
      0,
    );
    const protectedLinks = userShares.filter(
      (share) => share.shared_albums.passwordHash,
    ).length;

    return {
      totalPublicLinks,
      activePublicLinks,
      expiredPublicLinks,
      totalViews,
      protectedLinks,
    };
  }

  /**
   * Update public link settings
   */
  async updatePublicLink(
    shareId: string,
    userId: string,
    updates: {
      expiresAt?: Date | null;
      isActive?: boolean;
      allowDownload?: boolean;
      showMetadata?: boolean;
      customTitle?: string | null;
      customDescription?: string | null;
    },
  ): Promise<{
    id: string;
    expiresAt: Date | null;
    isActive: boolean;
    allowDownload: boolean;
    showMetadata: boolean;
    customTitle: string | null;
    customDescription: string | null;
  }> {
    // Update share using existing sharing service
    const shareUpdate = await sharingService.updateShare(shareId, userId, {
      expiresAt: updates.expiresAt,
      isActive: updates.isActive,
    });

    // Update public link specific settings
    const publicUpdates = {
      allowDownload: updates.allowDownload,
      showMetadata: updates.showMetadata,
      customTitle: updates.customTitle,
      customDescription: updates.customDescription,
      updatedAt: new Date(),
    };

    // Remove undefined values
    Object.keys(publicUpdates).forEach((key) => {
      if (publicUpdates[key] === undefined) {
        delete publicUpdates[key];
      }
    });

    if (Object.keys(publicUpdates).length > 0) {
      await db
        .update(sharedAlbums)
        .set(publicUpdates)
        .where(eq(sharedAlbums.id, shareId));
    }

    // Get updated share details
    const updatedShare = await db
      .select()
      .from(sharedAlbums)
      .where(eq(sharedAlbums.id, shareId))
      .limit(1);

    if (updatedShare.length === 0) {
      throw new Error("Public link not found");
    }

    const share = updatedShare[0];

    return {
      id: share.id,
      expiresAt: share.expiresAt,
      isActive: share.isActive,
      allowDownload: share.allowDownload ?? true,
      showMetadata: share.showMetadata ?? false,
      customTitle: share.customTitle,
      customDescription: share.customDescription,
    };
  }

  /**
   * Clean up expired rate limit entries
   */
  cleanupRateLimit(): void {
    const now = Date.now();
    for (const [ip, tracker] of this.rateLimitTracker.entries()) {
      if (now > tracker.resetTime) {
        this.rateLimitTracker.delete(ip);
      }
    }
  }
}

// Export singleton instance
export const publicLinksService = new PublicLinksService();

// Clean up rate limits every 5 minutes
setInterval(
  () => {
    publicLinksService.cleanupRateLimit();
  },
  5 * 60 * 1000,
);
