// Family sharing service extending the existing sharing infrastructure.
// Provides partner relationship management, encrypted family libraries, and auto-sharing.

import { db } from "../db";
import {
  partnerRelationships,
  partnerInvitations,
  partnerAutoShareRules,
  partnerSharedPhotos,
  users,
  photos,
  albums,
  albumPhotos,
} from "../../shared/schema";
import {
  eq,
  and,
  or,
  isNull,
  isNotNull,
  desc,
  lt,
  gt,
  inArray,
} from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import { sharingService, Permission } from "./sharing";

/**
 * Partner relationship status
 */
export enum PartnerStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  REVOKED = "revoked",
  EXPIRED = "expired",
}

/**
 * Partner relationship type
 */
export enum PartnerType {
  FAMILY = "family",
  FRIEND = "friend",
  COLLEAGUE = "colleague",
  CUSTOM = "custom",
}

/**
 * Auto-share rule criteria
 */
export interface AutoShareCriteria {
  contentType?: "photos" | "videos" | "all";
  dateRange?: {
    start: Date;
    end: Date;
  };
  people?: string[]; // Person IDs
  albums?: string[]; // Album IDs
  tags?: string[];
  minRating?: number; // 1-5 stars
  excludeTags?: string[];
  excludeAlbums?: string[];
}

/**
 * Partner invitation options
 */
export interface CreateInvitationOptions {
  inviteeEmail?: string;
  inviteeUserId?: string;
  message?: string;
  partnerType: PartnerType;
  autoShareRules?: AutoShareCriteria[];
  expiresInDays?: number;
}

/**
 * Partner relationship options
 */
export interface PartnerRelationshipOptions {
  partnerType: PartnerType;
  privacySettings?: {
    allowViewAll: boolean;
    allowDownload: boolean;
    allowShare: boolean;
    showMetadata: boolean;
    requireApproval: boolean;
  };
  autoShareRules?: AutoShareCriteria[];
}

/**
 * Family sharing service
 */
export class FamilySharingService {
  /**
   * Create partner invitation
   */
  async createInvitation(
    inviterId: string,
    options: CreateInvitationOptions,
  ): Promise<{
    invitationId: string;
    invitationToken: string;
    expiresAt: Date;
  }> {
    const {
      inviteeEmail,
      inviteeUserId,
      message,
      partnerType,
      autoShareRules,
      expiresInDays = 7,
    } = options;

    // Generate secure invitation token
    const invitationToken = this.generateInvitationToken();
    const expiresAt = new Date(
      Date.now() + expiresInDays * 24 * 60 * 60 * 1000,
    );

    // Create invitation record
    const [invitation] = await db
      .insert(partnerInvitations)
      .values({
        invitationToken,
        inviterId,
        inviteeEmail,
        inviteeId: inviteeUserId,
        message,
        status: PartnerStatus.PENDING,
        expiresAt,
      })
      .returning();

    // Store auto-share rules if provided
    if (autoShareRules && autoShareRules.length > 0) {
      // This would be implemented when the relationship is accepted
      // For now, we could store them in a temporary cache
    }

    return {
      invitationId: invitation.id,
      invitationToken: invitation.invitationToken,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accept partner invitation
   */
  async acceptInvitation(
    invitationToken: string,
    accepteeId: string,
  ): Promise<{
    relationshipId: string;
    partnerId: string;
    partnerType: PartnerType;
  }> {
    // Find and validate invitation
    const invitation = await db
      .select()
      .from(partnerInvitations)
      .where(eq(partnerInvitations.invitationToken, invitationToken))
      .limit(1);

    if (invitation.length === 0) {
      throw new Error("Invitation not found");
    }

    const invitationData = invitation[0];

    // Check if invitation is still valid
    if (invitationData.status !== PartnerStatus.PENDING) {
      throw new Error("Invitation already processed");
    }

    if (invitationData.expiresAt && invitationData.expiresAt < new Date()) {
      throw new Error("Invitation expired");
    }

    // Create partner relationship
    const [relationship] = await db
      .insert(partnerRelationships)
      .values({
        userId: invitationData.inviterId,
        partnerId: accepteeId,
        status: PartnerStatus.ACCEPTED,
        initiatedBy: invitationData.inviterId,
        acceptedAt: new Date(),
        isActive: true,
        privacySettings: {
          allowViewAll: true,
          allowDownload: true,
          allowShare: false,
          showMetadata: false,
          requireApproval: false,
        },
      })
      .returning();

    // Update invitation status
    await db
      .update(partnerInvitations)
      .set({
        status: PartnerStatus.ACCEPTED,
        respondedAt: new Date(),
        inviteeId: accepteeId,
      })
      .where(eq(partnerInvitations.id, invitationData.id));

    // Create reciprocal relationship
    await db
      .insert(partnerRelationships)
      .values({
        userId: accepteeId,
        partnerId: invitationData.inviterId,
        status: PartnerStatus.ACCEPTED,
        initiatedBy: invitationData.inviterId,
        acceptedAt: new Date(),
        isActive: true,
        privacySettings: {
          allowViewAll: true,
          allowDownload: true,
          allowShare: false,
          showMetadata: false,
          requireApproval: false,
        },
      })
      .returning();

    return {
      relationshipId: relationship.id,
      partnerId: invitationData.inviterId,
      partnerType: PartnerType.FAMILY, // Default to family
    };
  }

  /**
   * Decline partner invitation
   */
  async declineInvitation(
    invitationToken: string,
    accepteeId: string,
  ): Promise<void> {
    const invitation = await db
      .select()
      .from(partnerInvitations)
      .where(eq(partnerInvitations.invitationToken, invitationToken))
      .limit(1);

    if (invitation.length === 0) {
      throw new Error("Invitation not found");
    }

    await db
      .update(partnerInvitations)
      .set({
        status: PartnerStatus.DECLINED,
        respondedAt: new Date(),
        inviteeId: accepteeId,
      })
      .where(eq(partnerInvitations.id, invitation[0].id));
  }

  /**
   * Get user's partner relationships
   */
  async getUserPartners(userId: string): Promise<
    {
      id: string;
      partnerId: string;
      partnerName: string;
      partnerEmail: string;
      status: PartnerStatus;
      partnerType: PartnerType;
      isActive: boolean;
      acceptedAt?: Date;
      privacySettings: any;
    }[]
  > {
    const relationships = await db
      .select({
        relationship: partnerRelationships,
        partnerName: users.username,
        partnerEmail: users.username,
      })
      .from(partnerRelationships)
      .innerJoin(users, eq(partnerRelationships.partnerId, users.id))
      .where(eq(partnerRelationships.userId, userId))
      .orderBy(desc(partnerRelationships.acceptedAt));

    return relationships.map(({ relationship, partnerName, partnerEmail }) => ({
      id: relationship.id,
      partnerId: relationship.partnerId,
      partnerName,
      partnerEmail,
      status: relationship.status,
      partnerType: PartnerType.FAMILY, // Default, would be stored in relationship
      isActive: relationship.isActive,
      acceptedAt: relationship.acceptedAt,
      privacySettings: relationship.privacySettings || {},
    }));
  }

  /**
   * Update partner relationship settings
   */
  async updatePartnerRelationship(
    relationshipId: string,
    userId: string,
    updates: {
      privacySettings?: any;
      isActive?: boolean;
    },
  ): Promise<void> {
    // Verify user is part of this relationship
    const relationship = await db
      .select()
      .from(partnerRelationships)
      .where(
        and(
          eq(partnerRelationships.id, relationshipId),
          or(
            eq(partnerRelationships.userId, userId),
            eq(partnerRelationships.partnerId, userId),
          ),
        ),
      )
      .limit(1);

    if (relationship.length === 0) {
      throw new Error("Relationship not found or access denied");
    }

    await db
      .update(partnerRelationships)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(partnerRelationships.id, relationshipId));
  }

  /**
   * Create auto-share rule for partner relationship
   */
  async createAutoShareRule(
    partnershipId: string,
    userId: string,
    rule: {
      name: string;
      criteria: AutoShareCriteria;
      permissions: Permission;
    },
  ): Promise<string> {
    // Verify user is part of this partnership
    const relationship = await db
      .select()
      .from(partnerRelationships)
      .where(
        and(
          eq(partnerRelationships.id, partnershipId),
          or(
            eq(partnerRelationships.userId, userId),
            eq(partnerRelationships.partnerId, userId),
          ),
        ),
      )
      .limit(1);

    if (relationship.length === 0) {
      throw new Error("Partnership not found or access denied");
    }

    // Create auto-share rule
    const [shareRule] = await db
      .insert(partnerAutoShareRules)
      .values({
        partnershipId,
        userId,
        name: rule.name,
        ruleType: this.getRuleTypeFromCriteria(rule.criteria),
        isActive: true,
        criteria: rule.criteria,
        priority: 0,
      })
      .returning();

    return shareRule.id;
  }

  /**
   * Share photo with partner based on auto-share rules
   */
  async autoSharePhoto(photoId: string, userId: string): Promise<string[]> {
    const sharedWith: string[] = [];

    // Get user's active partnerships
    const partnerships = await db
      .select()
      .from(partnerRelationships)
      .where(
        and(
          eq(partnerRelationships.userId, userId),
          eq(partnerRelationships.status, PartnerStatus.ACCEPTED),
          eq(partnerRelationships.isActive, true),
        ),
      );

    // Get photo details for rule evaluation
    const photo = await db
      .select()
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);

    if (photo.length === 0) {
      return sharedWith;
    }

    const photoData = photo[0];

    // Check each partnership for auto-share rules
    for (const partnership of partnerships) {
      const rules = await db
        .select()
        .from(partnerAutoShareRules)
        .where(
          and(
            eq(partnerAutoShareRules.partnershipId, partnership.id),
            eq(partnerAutoShareRules.userId, userId),
            eq(partnerAutoShareRules.isActive, true),
          ),
        );

      // Evaluate each rule
      for (const rule of rules) {
        if (
          this.evaluateAutoShareRule(
            rule.criteria as AutoShareCriteria,
            photoData,
          )
        ) {
          // Share photo with partner
          try {
            await this.sharePhotoWithPartner(
              photoId,
              partnership.id,
              userId,
              rule.id,
            );
            sharedWith.push(partnership.partnerId);
          } catch (error) {
            console.error("Failed to auto-share photo:", error);
          }
        }
      }
    }

    return sharedWith;
  }

  /**
   * Get photos shared with user by partners
   */
  async getSharedPhotos(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      partnerId?: string;
    } = {},
  ): Promise<
    {
      id: string;
      uri: string;
      filename: string;
      width: number;
      height: number;
      createdAt: Date;
      sharedBy: string;
      sharedByName: string;
      ruleId?: string;
      isSaved: boolean;
      savedAt?: Date;
    }[]
  > {
    const { limit = 50, offset = 0, partnerId } = options;

    let query = db
      .select({
        sharedPhoto: partnerSharedPhotos,
        photo: photos,
        sharerName: users.username,
      })
      .from(partnerSharedPhotos)
      .innerJoin(photos, eq(partnerSharedPhotos.photoId, photos.id))
      .innerJoin(users, eq(partnerSharedPhotos.sharedBy, users.id))
      .where(eq(partnerSharedPhotos.isSavedByPartner, false)) // Only show unsaved photos by default
      .orderBy(desc(partnerSharedPhotos.createdAt))
      .limit(limit)
      .offset(offset);

    // Filter by specific partner if requested
    if (partnerId) {
      const partnership = await db
        .select()
        .from(partnerRelationships)
        .where(
          and(
            eq(partnerRelationships.partnerId, partnerId),
            eq(partnerRelationships.userId, userId),
          ),
        )
        .limit(1);

      if (partnership.length > 0) {
        query = query.where(
          eq(partnerSharedPhotos.partnershipId, partnership[0].id),
        );
      }
    }

    const results = await query;

    return results.map(({ sharedPhoto, photo, sharerName }) => ({
      id: photo.id,
      uri: photo.uri,
      filename: photo.filename,
      width: photo.width,
      height: photo.height,
      createdAt: photo.createdAt,
      sharedBy: sharedPhoto.sharedBy,
      sharedByName: sharerName,
      ruleId: sharedPhoto.ruleId || undefined,
      isSaved: sharedPhoto.isSavedByPartner,
      savedAt: sharedPhoto.savedAt || undefined,
    }));
  }

  /**
   * Save shared photo to user's library
   */
  async saveSharedPhoto(
    photoId: string,
    userId: string,
    partnershipId: string,
  ): Promise<void> {
    // Find the shared photo record
    const sharedPhoto = await db
      .select()
      .from(partnerSharedPhotos)
      .where(
        and(
          eq(partnerSharedPhotos.photoId, photoId),
          eq(partnerSharedPhotos.partnershipId, partnershipId),
        ),
      )
      .limit(1);

    if (sharedPhoto.length === 0) {
      throw new Error("Shared photo not found");
    }

    // Mark as saved
    await db
      .update(partnerSharedPhotos)
      .set({
        isSavedByPartner: true,
        savedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(partnerSharedPhotos.id, sharedPhoto[0].id));

    // In a real implementation, this would also create a copy or reference
    // in the user's own photo collection
  }

  /**
   * Get sharing statistics for user
   */
  async getSharingStats(userId: string): Promise<{
    totalPartners: number;
    activePartners: number;
    photosShared: number;
    photosReceived: number;
    autoShareRules: number;
  }> {
    // Get partner stats
    const partnerStats = await db
      .select({
        total: db
          .select()
          .from(partnerRelationships)
          .where(eq(partnerRelationships.userId, userId))
          .as("total"),
        active: db
          .select()
          .from(partnerRelationships)
          .where(
            and(
              eq(partnerRelationships.userId, userId),
              eq(partnerRelationships.isActive, true),
            ),
          )
          .as("active"),
      })
      .from(partnerRelationships)
      .where(eq(partnerRelationships.userId, userId));

    // Get sharing stats
    const photosShared = await db
      .select()
      .from(partnerSharedPhotos)
      .where(eq(partnerSharedPhotos.sharedBy, userId));

    const photosReceived = await db
      .select()
      .from(partnerSharedPhotos)
      .innerJoin(
        partnerRelationships,
        eq(partnerSharedPhotos.partnershipId, partnerRelationships.id),
      )
      .where(eq(partnerRelationships.partnerId, userId));

    const autoShareRules = await db
      .select()
      .from(partnerAutoShareRules)
      .where(eq(partnerAutoShareRules.userId, userId));

    return {
      totalPartners: partnerStats.length,
      activePartners: partnerStats.filter((p) => p.isActive).length,
      photosShared: photosShared.length,
      photosReceived: photosReceived.length,
      autoShareRules: autoShareRules.length,
    };
  }

  // Private helper methods

  private generateInvitationToken(): string {
    return randomBytes(64).toString("hex");
  }

  private getRuleTypeFromCriteria(criteria: AutoShareCriteria): string {
    if (criteria.contentType === "photos") return "photos_only";
    if (criteria.contentType === "videos") return "videos_only";
    if (criteria.dateRange) return "date_range";
    if (criteria.people && criteria.people.length > 0) return "people_based";
    if (criteria.albums && criteria.albums.length > 0) return "album_based";
    return "all_photos";
  }

  private evaluateAutoShareRule(
    criteria: AutoShareCriteria,
    photo: any,
  ): boolean {
    // Check content type
    if (criteria.contentType === "photos" && photo.isVideo) return false;
    if (criteria.contentType === "videos" && !photo.isVideo) return false;

    // Check date range
    if (criteria.dateRange) {
      const photoDate = photo.createdAt;
      if (
        photoDate < criteria.dateRange.start ||
        photoDate > criteria.dateRange.end
      ) {
        return false;
      }
    }

    // Check tags
    if (criteria.tags && criteria.tags.length > 0) {
      const photoTags = photo.tags || [];
      const hasMatchingTag = criteria.tags.some((tag) =>
        photoTags.includes(tag),
      );
      if (!hasMatchingTag) return false;
    }

    // Check exclude tags
    if (criteria.excludeTags && criteria.excludeTags.length > 0) {
      const photoTags = photo.tags || [];
      const hasExcludedTag = criteria.excludeTags.some((tag) =>
        photoTags.includes(tag),
      );
      if (hasExcludedTag) return false;
    }

    // Check rating (if implemented)
    if (criteria.minRating && photo.rating) {
      if (photo.rating < criteria.minRating) return false;
    }

    return true;
  }

  private async sharePhotoWithPartner(
    photoId: string,
    partnershipId: string,
    userId: string,
    ruleId?: string,
  ): Promise<void> {
    // Check if already shared
    const existing = await db
      .select()
      .from(partnerSharedPhotos)
      .where(
        and(
          eq(partnerSharedPhotos.photoId, photoId),
          eq(partnerSharedPhotos.partnershipId, partnershipId),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return; // Already shared
    }

    // Create shared photo record
    await db.insert(partnerSharedPhotos).values({
      photoId,
      partnershipId,
      sharedBy: userId,
      ruleId,
      isSavedByPartner: false,
    });
  }
}

// Export singleton instance
export const familySharingService = new FamilySharingService();
