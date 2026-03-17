// AI-META-BEGIN
// AI-META: Privacy-first secure deletion with cryptographic proof and audit trail
// OWNERSHIP: client/lib/trash
// ENTRYPOINTS: Used by cleanup service and permanent deletion workflows
// DEPENDENCIES: Crypto libraries, API client, secure storage
// DANGER: Permanent deletion is irreversible
// CHANGE-SAFETY: Critical security component - verify all deletion logic
// TESTS: Cryptographic proof generation, audit trail integrity, secure deletion
// AI-META-END

import { Platform } from "react-native";
import CryptoJS from "crypto-js";
import { apiRequest } from "@/lib/query-client";

export interface DeletionProof {
  photoId: string;
  deletionHash: string;
  timestamp: string;
  userId: string;
  proofSignature: string;
  verificationMethod: "cryptographic" | "audit-trail" | "hybrid";
}

export interface AuditTrailEntry {
  id: string;
  photoId: string;
  userId: string;
  action: "marked_for_deletion" | "permanently_deleted" | "cleanup_executed";
  timestamp: string;
  metadata: {
    originalSize: number;
    originalPath: string;
    deletionReason: "user_action" | "automatic_cleanup" | "storage_cleanup";
    retentionPeriod: number;
    verified: boolean;
  };
  cryptographicProof?: string;
}

export interface SecureDeletionResult {
  success: boolean;
  deletionProof: DeletionProof;
  auditTrailId: string;
  verificationUrl?: string;
  error?: string;
}

export interface DeletionVerificationResult {
  isValid: boolean;
  deletionConfirmed: boolean;
  auditTrailComplete: boolean;
  verificationTimestamp: string;
  discrepancies: string[];
}

/**
 * Generate cryptographic proof of deletion
 */
export async function generateDeletionProof(
  photoId: string,
  userId: string,
  timestamp: string = new Date().toISOString(),
): Promise<DeletionProof> {
  try {
    // Create deletion hash using photo ID, user ID, and timestamp
    const deletionData = `${photoId}:${userId}:${timestamp}:DELETED`;
    const deletionHash = CryptoJS.SHA256(deletionData).toString();

    // Generate signature using a combination of deletion hash and secret
    const signatureData = `${deletionHash}:${timestamp}`;
    const proofSignature = CryptoJS.HmacSHA256(
      signatureData,
      "CLOUD_GALLERY_DELETION_PROOF_KEY",
    ).toString();

    return {
      photoId,
      deletionHash,
      timestamp,
      userId,
      proofSignature,
      verificationMethod: "cryptographic",
    };
  } catch (error) {
    console.error("Failed to generate deletion proof:", error);
    throw new Error("Failed to generate cryptographic deletion proof");
  }
}

/**
 * Create audit trail entry for deletion
 */
export async function createAuditTrailEntry(
  photoId: string,
  userId: string,
  action: DeletionTrailEntry["action"],
  metadata: Partial<AuditTrailEntry["metadata"]>,
): Promise<AuditTrailEntry> {
  try {
    const entry: AuditTrailEntry = {
      id: CryptoJS.UUID().toString(),
      photoId,
      userId,
      action,
      timestamp: new Date().toISOString(),
      metadata: {
        originalSize: 0,
        originalPath: "",
        deletionReason: "user_action",
        retentionPeriod: 30,
        verified: false,
        ...metadata,
      },
    };

    // Add cryptographic proof for permanent deletions
    if (action === "permanently_deleted") {
      const proof = await generateDeletionProof(
        photoId,
        userId,
        entry.timestamp,
      );
      entry.cryptographicProof = proof.deletionHash;
    }

    return entry;
  } catch (error) {
    console.error("Failed to create audit trail entry:", error);
    throw new Error("Failed to create audit trail entry");
  }
}

/**
 * Perform secure permanent deletion with proof generation
 */
export async function performSecureDeletion(
  photoId: string,
  userId: string,
  deletionReason:
    | "user_action"
    | "automatic_cleanup"
    | "storage_cleanup" = "user_action",
): Promise<SecureDeletionResult> {
  try {
    // Step 1: Generate cryptographic proof
    const deletionProof = await generateDeletionProof(photoId, userId);

    // Step 2: Create audit trail entry
    const auditEntry = await createAuditTrailEntry(
      photoId,
      userId,
      "permanently_deleted",
      {
        deletionReason,
      },
    );

    // Step 3: Call secure deletion endpoint
    const res = await apiRequest(
      "DELETE",
      `/api/photos/${photoId}/secure-delete`,
      {
        deletionProof,
        auditTrail: auditEntry,
      },
    );

    if (!res.ok) {
      throw new Error(`Secure deletion failed: ${res.statusText}`);
    }

    const data = await res.json();

    return {
      success: true,
      deletionProof,
      auditTrailId: auditEntry.id,
      verificationUrl: data.verificationUrl,
    };
  } catch (error) {
    console.error("Secure deletion failed:", error);
    return {
      success: false,
      deletionProof: await generateDeletionProof(photoId, userId), // Still generate proof for audit
      auditTrailId: "",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Verify deletion proof
 */
export async function verifyDeletionProof(
  photoId: string,
  deletionProof: DeletionProof,
): Promise<DeletionVerificationResult> {
  try {
    // Step 1: Verify cryptographic proof
    const expectedHash = CryptoJS.SHA256(
      `${photoId}:${deletionProof.userId}:${deletionProof.timestamp}:DELETED`,
    ).toString();

    const hashValid = expectedHash === deletionProof.deletionHash;

    // Step 2: Verify signature
    const expectedSignature = CryptoJS.HmacSHA256(
      `${deletionProof.deletionHash}:${deletionProof.timestamp}`,
      "CLOUD_GALLERY_DELETION_PROOF_KEY",
    ).toString();

    const signatureValid = expectedSignature === deletionProof.proofSignature;

    // Step 3: Check audit trail
    const auditTrailValid = await verifyAuditTrail(
      photoId,
      deletionProof.userId,
    );

    // Step 4: Check with server for final confirmation
    const res = await apiRequest("POST", "/api/photos/verify-deletion", {
      photoId,
      deletionProof,
    });

    let serverConfirmed = false;
    if (res.ok) {
      const data = await res.json();
      serverConfirmed = data.verified;
    }

    const isValid =
      hashValid && signatureValid && auditTrailValid && serverConfirmed;
    const discrepancies: string[] = [];

    if (!hashValid) discrepancies.push("Hash mismatch");
    if (!signatureValid) discrepancies.push("Signature invalid");
    if (!auditTrailValid) discrepancies.push("Audit trail incomplete");
    if (!serverConfirmed) discrepancies.push("Server verification failed");

    return {
      isValid,
      deletionConfirmed: serverConfirmed,
      auditTrailComplete: auditTrailValid,
      verificationTimestamp: new Date().toISOString(),
      discrepancies,
    };
  } catch (error) {
    console.error("Deletion proof verification failed:", error);
    return {
      isValid: false,
      deletionConfirmed: false,
      auditTrailComplete: false,
      verificationTimestamp: new Date().toISOString(),
      discrepancies: ["Verification process failed"],
    };
  }
}

/**
 * Verify audit trail completeness
 */
export async function verifyAuditTrail(
  photoId: string,
  userId: string,
): Promise<boolean> {
  try {
    const res = await apiRequest("GET", `/api/photos/${photoId}/audit-trail`);

    if (!res.ok) {
      return false;
    }

    const auditTrail: AuditTrailEntry[] = await res.json();

    // Check for required entries
    const hasMarkedForDeletion = auditTrail.some(
      (entry) =>
        entry.action === "marked_for_deletion" && entry.userId === userId,
    );

    const hasPermanentDeletion = auditTrail.some(
      (entry) =>
        entry.action === "permanently_deleted" && entry.userId === userId,
    );

    return hasMarkedForDeletion && hasPermanentDeletion;
  } catch (error) {
    console.error("Audit trail verification failed:", error);
    return false;
  }
}

/**
 * Get audit trail for a photo
 */
export async function getAuditTrail(
  photoId: string,
): Promise<AuditTrailEntry[]> {
  try {
    const res = await apiRequest("GET", `/api/photos/${photoId}/audit-trail`);

    if (!res.ok) {
      throw new Error(`Failed to get audit trail: ${res.statusText}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Failed to get audit trail:", error);
    return [];
  }
}

/**
 * Generate deletion report for compliance
 */
export async function generateDeletionReport(
  photoIds: string[],
  userId: string,
): Promise<{
  reportId: string;
  generatedAt: string;
  totalPhotos: number;
  verifiedDeletions: number;
  failedVerifications: {
    photoId: string;
    reason: string;
  }[];
  complianceStatus: "compliant" | "partial" | "non-compliant";
}> {
  try {
    const verificationResults = await Promise.all(
      photoIds.map(async (photoId) => {
        try {
          // Get audit trail
          const auditTrail = await getAuditTrail(photoId);

          // Find permanent deletion entry
          const deletionEntry = auditTrail.find(
            (entry) => entry.action === "permanently_deleted",
          );

          if (!deletionEntry) {
            return {
              photoId,
              success: false,
              reason: "No permanent deletion record",
            };
          }

          // Verify deletion proof if available
          if (deletionEntry.cryptographicProof) {
            const deletionProof: DeletionProof = {
              photoId,
              deletionHash: deletionEntry.cryptographicProof,
              timestamp: deletionEntry.timestamp,
              userId,
              proofSignature: "", // Would need to be stored separately
              verificationMethod: "cryptographic",
            };

            const verification = await verifyDeletionProof(
              photoId,
              deletionProof,
            );
            return {
              photoId,
              success: verification.isValid,
              reason: verification.isValid
                ? "Verified"
                : "Proof verification failed",
            };
          }

          return { photoId, success: true, reason: "Audit trail only" };
        } catch (error) {
          return {
            photoId,
            success: false,
            reason: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }),
    );

    const verifiedDeletions = verificationResults.filter(
      (r) => r.success,
    ).length;
    const failedVerifications = verificationResults.filter((r) => !r.success);

    const complianceStatus =
      verifiedDeletions === photoIds.length
        ? "compliant"
        : verifiedDeletions > 0
          ? "partial"
          : "non-compliant";

    return {
      reportId: CryptoJS.UUID().toString(),
      generatedAt: new Date().toISOString(),
      totalPhotos: photoIds.length,
      verifiedDeletions,
      failedVerifications,
      complianceStatus,
    };
  } catch (error) {
    console.error("Failed to generate deletion report:", error);
    throw new Error("Failed to generate deletion report");
  }
}

/**
 * Secure cleanup with proof generation for batch operations
 */
export async function performSecureBatchDeletion(
  photoIds: string[],
  userId: string,
  deletionReason: "automatic_cleanup" | "storage_cleanup" = "automatic_cleanup",
): Promise<{
  success: boolean;
  results: SecureDeletionResult[];
  batchProof: string;
  auditTrailIds: string[];
}> {
  try {
    // Generate batch proof
    const batchData = `${photoIds.join(",")}:${userId}:${new Date().toISOString()}:BATCH_DELETE`;
    const batchProof = CryptoJS.SHA256(batchData).toString();

    const results = await Promise.all(
      photoIds.map((photoId) =>
        performSecureDeletion(photoId, userId, deletionReason),
      ),
    );

    const auditTrailIds = results
      .filter((result) => result.success)
      .map((result) => result.auditTrailId);

    return {
      success: results.some((result) => result.success),
      results,
      batchProof,
      auditTrailIds,
    };
  } catch (error) {
    console.error("Secure batch deletion failed:", error);
    throw new Error("Failed to perform secure batch deletion");
  }
}

/**
 * Get deletion statistics for compliance reporting
 */
export async function getDeletionStats(userId: string): Promise<{
  totalDeletions: number;
  verifiedDeletions: number;
  automaticCleanups: number;
  userInitiatedDeletions: number;
  averageRetentionDays: number;
  complianceScore: number; // 0-100
}> {
  try {
    const res = await apiRequest("GET", `/api/users/${userId}/deletion-stats`);

    if (!res.ok) {
      throw new Error(`Failed to get deletion stats: ${res.statusText}`);
    }

    return await res.json();
  } catch (error) {
    console.error("Failed to get deletion stats:", error);
    return {
      totalDeletions: 0,
      verifiedDeletions: 0,
      automaticCleanups: 0,
      userInitiatedDeletions: 0,
      averageRetentionDays: 0,
      complianceScore: 0,
    };
  }
}
