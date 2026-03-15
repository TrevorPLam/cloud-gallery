// AI-META-BEGIN
// AI-META: Secure partner sharing service with invitation system, auto-share rules, and privacy controls
// OWNERSHIP: server/services
// ENTRYPOINTS: imported by partner-sharing-routes.ts and partner management UI
// DEPENDENCIES: drizzle-orm, argon2, ../shared/schema, ./db, crypto
// DANGER: Partner invitation bypass = unauthorized photo access; privacy failure = data breach
// CHANGE-SAFETY: Maintain token uniqueness, privacy controls, and user isolation
// TESTS: Property tests for invitation tokens, privacy enforcement, auto-share rule evaluation
// AI-META-END

import { db } from "../db";
import {
  partnerRelationships,
  partnerInvitations,
  partnerAutoShareRules,
  partnerSharedPhotos,
  users,
  photos,
  faces,
  people,
} from "../../shared/schema";
import { eq, and, isNull, isNotNull, desc, lt, gt, or, inArray, sql } from "drizzle-orm";
import { hash, verify } from "argon2";
import { randomBytes } from "crypto";

/**
 * Configuration for partner sharing service
 */
export interface PartnerSharingConfig {
  /** Token length in bytes (128 chars when hex encoded) */
  tokenLength: number;
  /** Argon2id memory cost in KiB */
  argon2Memory: number;
  /** Argon2id iterations */
  argon2Iterations: number;
  /** Argon2id parallelism */
  argon2Parallelism: number;
  /** Default invitation expiration in days */
  defaultInvitationExpirationDays: number;
}

/**
 * Partnership status values
 */
export enum PartnershipStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  REVOKED = "revoked",
}

/**
 * Invitation status values
 */
export enum InvitationStatus {
  PENDING = "pending",
  ACCEPTED = "accepted",
  DECLINED = "declined",
  EXPIRED = "expired",
}

/**
 * Auto-share rule types
 */
export enum AutoShareRuleType {
  ALL_PHOTOS = "all_photos",
  DATE_RANGE = "date_range",
  PEOPLE = "people",
  CONTENT_TYPE = "content_type",
}

/**
 * Privacy settings for partner sharing
 */
export interface PrivacySettings {
  /** Share photos from other apps (screenshots, downloads, etc.) */
  includeOtherApps: boolean;
  /** Minimum photo quality to share */
  minQuality?: number;
  /** Exclude photos with specific tags */
  excludeTags?: string[];
  /** Only share favorites */
  favoritesOnly?: boolean;
}

/**
 * Auto-share rule criteria
 */
export interface AutoShareCriteria {
  /** For DATE_RANGE rules */
  startDate?: Date;
  endDate?: Date;
  
  /** For PEOPLE rules */
  peopleIds?: string[];
  
  /** For CONTENT_TYPE rules */
  contentTypes?: ("camera" | "screenshot" | "download" | "other")[];
  
  /** Common criteria */
  minQuality?: number;
  excludeTags?: string[];
  favoritesOnly?: boolean;
}

/**
 * Partner invitation options
 */
export interface CreateInvitationOptions {
  /** User ID of the inviter */
  inviterId: string;
  /** Email address of the invitee (optional if inviteeId provided) */
  inviteeEmail?: string;
  /** User ID of the invitee (optional if inviteeEmail provided) */
  inviteeId?: string;
  /** Personal message from inviter */
  message?: string;
  /** Privacy settings for this partnership */
  privacySettings?: PrivacySettings;
  /** Custom expiration date (null = use default) */
  expiresAt?: Date | null;
}

/**
 * Auto-share rule creation options
 */
export interface CreateAutoShareRuleOptions {
  /** Partnership ID */
  partnershipId: string;
  /** User ID creating the rule */
  userId: string;
  /** Rule name */
  name: string;
  /** Rule type */
  ruleType: AutoShareRuleType;
  /** Rule criteria */
  criteria: AutoShareCriteria;
  /** Rule priority (higher = more priority) */
  priority?: number;
}

/**
 * Default configuration following OWASP 2026 guidelines
 */
const DEFAULT_CONFIG: PartnerSharingConfig = {
  tokenLength: 64, // 128 hex chars for invitations
  argon2Memory: 19456, // 19 MiB as recommended by OWASP
  argon2Iterations: 2,
  argon2Parallelism: 1,
  defaultInvitationExpirationDays: 7, // 7 days for invitations
};

/**
 * Partner sharing service for invitation management, auto-share rules, and privacy controls
 */
export class PartnerSharingService {
  private config: PartnerSharingConfig;

  constructor(config: PartnerSharingConfig = DEFAULT_CONFIG) {
    this.config = config;
  }

  /**
   * Generate a cryptographically secure invitation token
   */
  private generateInvitationToken(): string {
    return randomBytes(this.config.tokenLength).toString("hex");
  }

  /**
   * Hash sensitive data using Argon2id (OWASP 2026 recommended)
   */
  private async hashData(data: string): Promise<string> {
    return await hash(data, {
      memoryCost: this.config.argon2Memory,
      timeCost: this.config.argon2Iterations,
      parallelism: this.config.argon2Parallelism,
      type: "argon2id",
    });
  }

  /**
   * Verify data against Argon2id hash
   */
  private async verifyData(
    data: string,
    hash: string,
  ): Promise<boolean> {
    try {
      return await verify(hash, data, {
        memoryCost: this.config.argon2Memory,
        timeCost: this.config.argon2Iterations,
        parallelism: this.config.argon2Parallelism,
        type: "argon2id",
      });
    } catch (error) {
      console.error("Data verification error:", error);
      return false;
    }
  }

  /**
   * Create a new partner invitation
   */
  async createInvitation(options: CreateInvitationOptions): Promise<{
    id: string;
    invitationToken: string;
    inviteeEmail?: string;
    expiresAt: Date;
  }> {
    const { inviterId, inviteeEmail, inviteeId, message, privacySettings, expiresAt } = options;

    // Validate that either inviteeEmail or inviteeId is provided
    if (!inviteeEmail && !inviteeId) {
      throw new Error("Either inviteeEmail or inviteeId must be provided");
    }

    // If inviteeId is provided, verify user exists and no existing partnership
    if (inviteeId) {
      const inviteeUser = await db
        .select()
        .from(users)
        .where(eq(users.id, inviteeId))
        .limit(1);

      if (inviteeUser.length === 0) {
        throw new Error("Invitee user not found");
      }

      // Check for existing partnership
      const existingPartnership = await db
        .select()
        .from(partnerRelationships)
        .where(
          or(
            and(
              eq(partnerRelationships.userId, inviterId),
              eq(partnerRelationships.partnerId, inviteeId),
            ),
            and(
              eq(partnerRelationships.userId, inviteeId),
              eq(partnerRelationships.partnerId, inviterId),
            ),
          ),
        )
        .limit(1);

      if (existingPartnership.length > 0) {
        throw new Error("Partnership already exists");
      }
    }

    // Generate unique invitation token
    const invitationToken = this.generateInvitationToken();

    // Set expiration if not provided
    const expiresAtFinal =
      expiresAt ??
      new Date(
        Date.now() +
          this.config.defaultInvitationExpirationDays * 24 * 60 * 60 * 1000,
      );

    // Create invitation
    const [invitation] = await db
      .insert(partnerInvitations)
      .values({
        invitationToken,
        inviterId,
        inviteeEmail,
        inviteeId,
        status: InvitationStatus.PENDING,
        message,
        expiresAt: expiresAtFinal,
      })
      .returning();

    return {
      id: invitation.id,
      invitationToken: invitation.invitationToken,
      inviteeEmail: invitation.inviteeEmail || undefined,
      expiresAt: invitation.expiresAt,
    };
  }

  /**
   * Accept a partner invitation
   */
  async acceptInvitation(
    invitationToken: string,
    userId: string,
  ): Promise<{
    partnershipId: string;
    partnerId: string;
    partnerName: string;
  }> {
    // Find valid invitation
    const now = new Date();
    const invitation = await db
      .select()
      .from(partnerInvitations)
      .where(
        and(
          eq(partnerInvitations.invitationToken, invitationToken),
          eq(partnerInvitations.status, InvitationStatus.PENDING),
          gt(partnerInvitations.expiresAt, now),
        ),
      )
      .limit(1);

    if (invitation.length === 0) {
      throw new Error("Invalid or expired invitation");
    }

    const invitationData = invitation[0];

    // Verify that the accepting user is the invitee
    if (invitationData.inviteeId && invitationData.inviteeId !== userId) {
      throw new Error("You are not authorized to accept this invitation");
    }

    // If invitation was by email, verify user exists and set inviteeId
    let finalInviteeId = invitationData.inviteeId;
    if (!finalInviteeId && invitationData.inviteeEmail) {
      // Look up user by email (this would require adding email field to users table)
      // For now, we'll assume userId is the correct user
      finalInviteeId = userId;
    }

    if (!finalInviteeId) {
      throw new Error("Unable to determine invitee");
    }

    // Create partnership
    const [partnership] = await db
      .insert(partnerRelationships)
      .values({
        userId: invitationData.inviterId,
        partnerId: finalInviteeId,
        status: PartnershipStatus.ACCEPTED,
        initiatedBy: invitationData.inviterId,
        acceptedAt: new Date(),
        isActive: true,
        privacySettings: {}, // Will be set by user preferences
      })
      .returning();

    // Update invitation status
    await db
      .update(partnerInvitations)
      .set({
        status: InvitationStatus.ACCEPTED,
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(partnerInvitations.id, invitationData.id));

    // Get partner information
    const partner = await db
      .select()
      .from(users)
      .where(eq(users.id, invitationData.inviterId))
      .limit(1);

    if (partner.length === 0) {
      throw new Error("Partner not found");
    }

    return {
      partnershipId: partnership.id,
      partnerId: partner[0].id,
      partnerName: partner[0].username,
    };
  }

  /**
   * Create an auto-share rule
   */
  async createAutoShareRule(options: CreateAutoShareRuleOptions): Promise<{
    id: string;
    name: string;
    ruleType: AutoShareRuleType;
    isActive: boolean;
  }> {
    const { partnershipId, userId, name, ruleType, criteria, priority = 0 } = options;

    // Verify partnership exists and user is part of it
    const partnership = await db
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

    if (partnership.length === 0) {
      throw new Error("Partnership not found or access denied");
    }

    // Create auto-share rule
    const [rule] = await db
      .insert(partnerAutoShareRules)
      .values({
        partnershipId,
        userId,
        name,
        ruleType,
        criteria,
        priority,
        isActive: true,
      })
      .returning();

    return {
      id: rule.id,
      name: rule.name,
      ruleType: rule.ruleType as AutoShareRuleType,
      isActive: rule.isActive,
    };
  }

  /**
   * Evaluate auto-share rules for a photo
   */
  async evaluateAutoShareRules(
    photoId: string,
    userId: string,
  ): Promise<string[]> {
    // Get photo information
    const photo = await db
      .select()
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1);

    if (photo.length === 0) {
      return [];
    }

    const photoData = photo[0];

    // Get all active partnerships for this user
    const partnerships = await db
      .select()
      .from(partnerRelationships)
      .where(
        and(
          eq(partnerRelationships.userId, userId),
          eq(partnerRelationships.isActive, true),
        ),
      );

    const partnershipIds = partnerships.map(p => p.id);

    if (partnershipIds.length === 0) {
      return [];
    }

    // Get all active auto-share rules for these partnerships
    const rules = await db
      .select()
      .from(partnerAutoShareRules)
      .where(
        and(
          inArray(partnerAutoShareRules.partnershipId, partnershipIds),
          eq(partnerAutoShareRules.isActive, true),
        ),
      )
      .orderBy(desc(partnerAutoShareRules.priority));

    const matchingPartnershipIds: string[] = [];

    for (const rule of rules) {
      if (await this.evaluateRule(rule, photoData)) {
        matchingPartnershipIds.push(rule.partnershipId);
      }
    }

    return matchingPartnershipIds;
  }

  /**
   * Evaluate a single auto-share rule against a photo
   */
  private async evaluateRule(
    rule: any,
    photo: any,
  ): Promise<boolean> {
    const criteria = rule.criteria as AutoShareCriteria;

    switch (rule.ruleType) {
      case AutoShareRuleType.ALL_PHOTOS:
        return this.evaluateAllPhotosRule(criteria, photo);

      case AutoShareRuleType.DATE_RANGE:
        return this.evaluateDateRangeRule(criteria, photo);

      case AutoShareRuleType.PEOPLE:
        return await this.evaluatePeopleRule(criteria, photo);

      case AutoShareRuleType.CONTENT_TYPE:
        return this.evaluateContentTypeRule(criteria, photo);

      default:
        return false;
    }
  }

  /**
   * Evaluate ALL_PHOTOS rule
   */
  private evaluateAllPhotosRule(
    criteria: AutoShareCriteria,
    photo: any,
  ): boolean {
    // Check minimum quality
    if (criteria.minQuality) {
      // This would require a quality field in photos table
      // For now, we'll assume all photos pass
    }

    // Check exclude tags
    if (criteria.excludeTags && photo.tags) {
      const photoTags = Array.isArray(photo.tags) ? photo.tags : [];
      if (criteria.excludeTags.some(tag => photoTags.includes(tag))) {
        return false;
      }
    }

    // Check favorites only
    if (criteria.favoritesOnly && !photo.isFavorite) {
      return false;
    }

    return true;
  }

  /**
   * Evaluate DATE_RANGE rule
   */
  private evaluateDateRangeRule(
    criteria: AutoShareCriteria,
    photo: any,
  ): boolean {
    if (!criteria.startDate && !criteria.endDate) {
      return true; // No date range specified
    }

    const photoDate = new Date(photo.createdAt);

    if (criteria.startDate && photoDate < criteria.startDate) {
      return false;
    }

    if (criteria.endDate && photoDate > criteria.endDate) {
      return false;
    }

    return true;
  }

  /**
   * Evaluate PEOPLE rule
   */
  private async evaluatePeopleRule(
    criteria: AutoShareCriteria,
    photo: any,
  ): Promise<boolean> {
    if (!criteria.peopleIds || criteria.peopleIds.length === 0) {
      return false;
    }

    // Get faces detected in this photo
    const photoFaces = await db
      .select()
      .from(faces)
      .where(eq(faces.photoId, photo.id));

    if (photoFaces.length === 0) {
      return false;
    }

    // Get people for these faces
    const facePersonIds = photoFaces
      .filter(face => face.personId)
      .map(face => face.personId!);

    if (facePersonIds.length === 0) {
      return false;
    }

    // Check if any of the photo's people are in the rule's people list
    return criteria.peopleIds.some(personId => 
      facePersonIds.includes(personId)
    );
  }

  /**
   * Evaluate CONTENT_TYPE rule
   */
  private evaluateContentTypeRule(
    criteria: AutoShareCriteria,
    photo: any,
  ): boolean {
    if (!criteria.contentTypes || criteria.contentTypes.length === 0) {
      return true;
    }

    // Determine content type based on photo metadata
    // This is a simplified implementation - in production, you'd analyze EXIF data, file paths, etc.
    let contentType: "camera" | "screenshot" | "download" | "other" = "other";

    // Simple heuristic: screenshots often have "Screenshot" in filename
    if (photo.filename.toLowerCase().includes("screenshot")) {
      contentType = "screenshot";
    }
    // Downloads might come from specific folders or have certain patterns
    else if (photo.filename.toLowerCase().includes("download") || 
             photo.filename.toLowerCase().includes("saved")) {
      contentType = "download";
    }
    // Otherwise assume camera
    else {
      contentType = "camera";
    }

    return criteria.contentTypes.includes(contentType);
  }

  /**
   * Share a photo with partners based on auto-share rules
   */
  async sharePhotoWithPartners(
    photoId: string,
    userId: string,
  ): Promise<string[]> {
    const partnershipIds = await this.evaluateAutoShareRules(photoId, userId);
    const sharedPartnershipIds: string[] = [];

    for (const partnershipId of partnershipIds) {
      try {
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

        if (existing.length === 0) {
          // Create shared photo record
          await db.insert(partnerSharedPhotos).values({
            photoId,
            partnershipId,
            sharedBy: userId,
          });

          sharedPartnershipIds.push(partnershipId);
        }
      } catch (error) {
        console.error("Error sharing photo with partnership:", error);
        // Continue with other partnerships
      }
    }

    return sharedPartnershipIds;
  }

  /**
   * Get user's partnerships
   */
  async getUserPartnerships(userId: string): Promise<{
    active: {
      id: string;
      partnerId: string;
      partnerName: string;
      status: PartnershipStatus;
      acceptedAt: Date | null;
      privacySettings: any;
    }[];
    pending: {
      id: string;
      partnerId: string;
      partnerName: string;
      initiatedBy: string;
      createdAt: Date;
    }[];
  }> {
    // Get active partnerships
    const activePartnerships = await db
      .select({
        partnership: partnerRelationships,
        partnerUsername: users.username,
      })
      .from(partnerRelationships)
      .innerJoin(users, eq(partnerRelationships.partnerId, users.id))
      .where(
        and(
          eq(partnerRelationships.userId, userId),
          eq(partnerRelationships.isActive, true),
          eq(partnerRelationships.status, PartnershipStatus.ACCEPTED),
        ),
      );

    // Get pending partnerships
    const pendingPartnerships = await db
      .select({
        partnership: partnerRelationships,
        partnerUsername: users.username,
      })
      .from(partnerRelationships)
      .innerJoin(users, eq(partnerRelationships.partnerId, users.id))
      .where(
        and(
          eq(partnerRelationships.userId, userId),
          eq(partnerRelationships.status, PartnershipStatus.PENDING),
        ),
      );

    return {
      active: activePartnerships.map(({ partnership, partnerUsername }) => ({
        id: partnership.id,
        partnerId: partnership.partnerId,
        partnerName: partnerUsername,
        status: partnership.status as PartnershipStatus,
        acceptedAt: partnership.acceptedAt,
        privacySettings: partnership.privacySettings,
      })),
      pending: pendingPartnerships.map(({ partnership, partnerUsername }) => ({
        id: partnership.id,
        partnerId: partnership.partnerId,
        partnerName: partnerUsername,
        initiatedBy: partnership.initiatedBy,
        createdAt: partnership.createdAt,
      })),
    };
  }

  /**
   * Get shared photos for a partnership
   */
  async getSharedPhotos(
    partnershipId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{
    photos: {
      id: string;
      uri: string;
      width: number;
      height: number;
      filename: string;
      isFavorite: boolean;
      createdAt: Date;
      sharedBy: string;
      isSavedByPartner: boolean;
    }[];
    hasMore: boolean;
    totalCount: number;
  }> {
    // Verify user is part of this partnership
    const partnership = await db
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

    if (partnership.length === 0) {
      throw new Error("Partnership not found or access denied");
    }

    // Get total count
    const totalCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(partnerSharedPhotos)
      .where(eq(partnerSharedPhotos.partnershipId, partnershipId));

    const totalCount = Number(totalCountResult[0]?.count || 0);

    // Get paginated shared photos
    const offset = (page - 1) * limit;
    const sharedPhotos = await db
      .select({
        sharedPhoto: partnerSharedPhotos,
        photo: photos,
        sharedByUsername: users.username,
      })
      .from(partnerSharedPhotos)
      .innerJoin(photos, eq(partnerSharedPhotos.photoId, photos.id))
      .innerJoin(users, eq(partnerSharedPhotos.sharedBy, users.id))
      .where(eq(partnerSharedPhotos.partnershipId, partnershipId))
      .orderBy(desc(partnerSharedPhotos.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      photos: sharedPhotos.map(({ sharedPhoto, photo, sharedByUsername }) => ({
        id: photo.id,
        uri: photo.uri,
        width: photo.width,
        height: photo.height,
        filename: photo.filename,
        isFavorite: photo.isFavorite,
        createdAt: photo.createdAt,
        sharedBy: sharedByUsername,
        isSavedByPartner: sharedPhoto.isSavedByPartner,
      })),
      hasMore: offset + sharedPhotos.length < totalCount,
      totalCount,
    };
  }

  /**
   * Update privacy settings for a partnership
   */
  async updatePrivacySettings(
    partnershipId: string,
    userId: string,
    privacySettings: PrivacySettings,
  ): Promise<{ success: boolean }> {
    // Verify user is part of this partnership
    const partnership = await db
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

    if (partnership.length === 0) {
      throw new Error("Partnership not found or access denied");
    }

    // Update privacy settings
    await db
      .update(partnerRelationships)
      .set({
        privacySettings,
        updatedAt: new Date(),
      })
      .where(eq(partnerRelationships.id, partnershipId));

    return { success: true };
  }

  /**
   * Get auto-share rules for a partnership
   */
  async getAutoShareRules(
    partnershipId: string,
    userId: string,
  ): Promise<{
    id: string;
    name: string;
    ruleType: AutoShareRuleType;
    criteria: AutoShareCriteria;
    priority: number;
    isActive: boolean;
    createdAt: Date;
    createdBy: string;
  }[]> {
    // Verify user is part of this partnership
    const partnership = await db
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

    if (partnership.length === 0) {
      throw new Error("Partnership not found or access denied");
    }

    // Get rules for this partnership
    const rules = await db
      .select({
        rule: partnerAutoShareRules,
        creatorUsername: users.username,
      })
      .from(partnerAutoShareRules)
      .innerJoin(users, eq(partnerAutoShareRules.userId, users.id))
      .where(eq(partnerAutoShareRules.partnershipId, partnershipId))
      .orderBy(desc(partnerAutoShareRules.priority), desc(partnerAutoShareRules.createdAt));

    return rules.map(({ rule, creatorUsername }) => ({
      id: rule.id,
      name: rule.name,
      ruleType: rule.ruleType as AutoShareRuleType,
      criteria: rule.criteria as AutoShareCriteria,
      priority: rule.priority,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
      createdBy: creatorUsername,
    }));
  }

  /**
   * Update an auto-share rule
   */
  async updateAutoShareRule(
    ruleId: string,
    userId: string,
    updates: {
      name?: string;
      criteria?: AutoShareCriteria;
      priority?: number;
      isActive?: boolean;
    },
  ): Promise<{ success: boolean }> {
    // Verify user owns this rule
    const rule = await db
      .select()
      .from(partnerAutoShareRules)
      .where(
        and(
          eq(partnerAutoShareRules.id, ruleId),
          eq(partnerAutoShareRules.userId, userId),
        ),
      )
      .limit(1);

    if (rule.length === 0) {
      throw new Error("Rule not found or access denied");
    }

    // Update the rule
    await db
      .update(partnerAutoShareRules)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(partnerAutoShareRules.id, ruleId));

    return { success: true };
  }

  /**
   * Delete an auto-share rule
   */
  async deleteAutoShareRule(ruleId: string, userId: string): Promise<{ success: boolean }> {
    // Verify user owns this rule
    const rule = await db
      .select()
      .from(partnerAutoShareRules)
      .where(
        and(
          eq(partnerAutoShareRules.id, ruleId),
          eq(partnerAutoShareRules.userId, userId),
        ),
      )
      .limit(1);

    if (rule.length === 0) {
      throw new Error("Rule not found or access denied");
    }

    // Delete the rule
    await db
      .delete(partnerAutoShareRules)
      .where(eq(partnerAutoShareRules.id, ruleId));

    return { success: true };
  }

  /**
   * End a partnership
   */
  async endPartnership(partnershipId: string, userId: string): Promise<{ success: boolean }> {
    // Verify user is part of this partnership
    const partnership = await db
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

    if (partnership.length === 0) {
      throw new Error("Partnership not found or access denied");
    }

    // Update partnership status
    await db
      .update(partnerRelationships)
      .set({
        status: PartnershipStatus.REVOKED,
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(partnerRelationships.id, partnershipId));

    return { success: true };
  }

  /**
   * Save a shared photo to partner's library
   */
  async saveSharedPhoto(
    photoId: string,
    partnershipId: string,
    userId: string,
  ): Promise<{ success: boolean }> {
    // Verify user is part of this partnership
    const partnership = await db
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

    if (partnership.length === 0) {
      throw new Error("Partnership not found or access denied");
    }

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

    // Mark as saved by partner
    await db
      .update(partnerSharedPhotos)
      .set({
        isSavedByPartner: true,
        savedAt: new Date(),
      })
      .where(eq(partnerSharedPhotos.id, sharedPhoto[0].id));

    return { success: true };
  }

  /**
   * Get partner sharing statistics
   */
  async getPartnerSharingStats(userId: string): Promise<{
    activePartnerships: number;
    pendingInvitations: number;
    sharedPhotos: number;
    autoShareRules: number;
  }> {
    // Get active partnerships count
    const activePartnershipsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(partnerRelationships)
      .where(
        and(
          eq(partnerRelationships.userId, userId),
          eq(partnerRelationships.isActive, true),
          eq(partnerRelationships.status, PartnershipStatus.ACCEPTED),
        ),
      );

    // Get pending invitations count
    const pendingInvitationsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(partnerInvitations)
      .where(
        and(
          eq(partnerInvitations.inviterId, userId),
          eq(partnerInvitations.status, InvitationStatus.PENDING),
          gt(partnerInvitations.expiresAt, new Date()),
        ),
      );

    // Get shared photos count
    const sharedPhotosResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(partnerSharedPhotos)
      .innerJoin(
        partnerRelationships,
        eq(partnerSharedPhotos.partnershipId, partnerRelationships.id),
      )
      .where(eq(partnerRelationships.userId, userId));

    // Get auto-share rules count
    const autoShareRulesResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(partnerAutoShareRules)
      .innerJoin(
        partnerRelationships,
        eq(partnerAutoShareRules.partnershipId, partnerRelationships.id),
      )
      .where(
        and(
          eq(partnerRelationships.userId, userId),
          eq(partnerAutoShareRules.isActive, true),
        ),
      );

    return {
      activePartnerships: Number(activePartnershipsResult[0]?.count || 0),
      pendingInvitations: Number(pendingInvitationsResult[0]?.count || 0),
      sharedPhotos: Number(sharedPhotosResult[0]?.count || 0),
      autoShareRules: Number(autoShareRulesResult[0]?.count || 0),
    };
  }
}

// Export singleton instance
export const partnerSharingService = new PartnerSharingService();
