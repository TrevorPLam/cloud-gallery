// AI-META-BEGIN
// AI-META: Test suite for trash functionality including cleanup, recovery, and secure deletion
// OWNERSHIP: tests/trash
// ENTRYPOINTS: Run via npm test
// DEPENDENCIES: Vitest, trash services, mock API
// DANGER: Tests verify critical deletion functionality
// CHANGE-SAFETY: Add new tests as features are added
// TESTS: All trash operations, edge cases, error scenarios
// AI-META-END

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  calculateDaysUntilDeletion,
  willBeDeletedSoon,
  formatDeletionTime,
  performAutomaticCleanup,
  getCleanupStats,
  isCleanupNeeded,
} from '@/lib/trash/cleanup-service.simple';
import {
  recoverPhoto,
  recoverPhotos,
  getExtendedRecoveryInfo,
  canRecoverPhoto,
  createRecoveryReport,
} from '@/lib/trash/recovery-service';
import {
  generateDeletionProof,
  verifyDeletionProof,
  performSecureDeletion,
  generateDeletionReport,
} from '@/lib/trash/secure-deletion';

// Mock dependencies
vi.mock('@/lib/query-client', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  setItem: vi.fn(),
  getItem: vi.fn(),
}));

describe('Trash Cleanup Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateDaysUntilDeletion', () => {
    it('should calculate correct days until deletion', () => {
      const now = new Date();
      const deletedAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const days = calculateDaysUntilDeletion(deletedAt);
      expect(days).toBe(20); // 30 - 10 = 20 days remaining
    });

    it('should return 0 for already expired items', () => {
      const now = new Date();
      const deletedAt = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000); // 40 days ago
      const days = calculateDaysUntilDeletion(deletedAt);
      expect(days).toBe(0);
    });

    it('should handle string dates', () => {
      const deletedAt = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const days = calculateDaysUntilDeletion(deletedAt);
      expect(days).toBe(25);
    });
  });

  describe('willBeDeletedSoon', () => {
    it('should return true for items deleting in less than 3 days', () => {
      const deletedAt = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000); // 28 days ago
      expect(willBeDeletedSoon(deletedAt)).toBe(true);
    });

    it('should return false for items with more time', () => {
      const deletedAt = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000); // 20 days ago
      expect(willBeDeletedSoon(deletedAt)).toBe(false);
    });
  });

  describe('formatDeletionTime', () => {
    it('should format today correctly', () => {
      const deletedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago = today
      expect(formatDeletionTime(deletedAt)).toBe('Deletes today');
    });

    it('should format tomorrow correctly', () => {
      const deletedAt = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000); // 29 days ago = tomorrow
      expect(formatDeletionTime(deletedAt)).toBe('Deletes tomorrow');
    });

    it('should format days correctly', () => {
      const deletedAt = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000);
      expect(formatDeletionTime(deletedAt)).toBe('Deletes in 5 days');
    });

    it('should format weeks correctly', () => {
      const deletedAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      expect(formatDeletionTime(deletedAt)).toBe('Deletes in 3 weeks');
    });
  });
});

describe('Trash Recovery Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recoverPhoto', () => {
    it('should recover a photo successfully', async () => {
      const { apiRequest } = await import('@/lib/query-client');
      vi.mocked(apiRequest).mockResolvedValue({
        ok: true,
        json: async () => ({ photo: { id: 'photo1', uri: 'test.jpg' } }),
      } as Response);

      const result = await recoverPhoto('photo1');
      
      expect(result.success).toBe(true);
      expect(result.recoveredPhotos).toHaveLength(1);
      expect(result.recoveredPhotos[0].id).toBe('photo1');
    });

    it('should handle recovery failure', async () => {
      const { apiRequest } = await import('@/lib/query-client');
      vi.mocked(apiRequest).mockRejectedValue(new Error('Network error'));

      const result = await recoverPhoto('photo1');
      
      expect(result.success).toBe(false);
      expect(result.failedPhotos).toHaveLength(1);
      expect(result.failedPhotos[0].id).toBe('photo1');
    });
  });

  describe('recoverPhotos', () => {
    it('should recover multiple photos', async () => {
      const { apiRequest } = await import('@/lib/query-client');
      vi.mocked(apiRequest).mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          recoveredPhotos: [
            { id: 'photo1', uri: 'test1.jpg' },
            { id: 'photo2', uri: 'test2.jpg' },
          ],
          failedPhotos: [],
        }),
      } as Response);

      const result = await recoverPhotos(['photo1', 'photo2']);
      
      expect(result.success).toBe(true);
      expect(result.recoveredPhotos).toHaveLength(2);
    });
  });
});

describe('Secure Deletion Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDeletionProof', () => {
    it('should generate cryptographic proof', async () => {
      const photoId = 'photo123';
      const userId = 'user456';
      const timestamp = '2024-01-01T00:00:00.000Z';

      const proof = await generateDeletionProof(photoId, userId, timestamp);

      expect(proof.photoId).toBe(photoId);
      expect(proof.userId).toBe(userId);
      expect(proof.timestamp).toBe(timestamp);
      expect(proof.deletionHash).toBeDefined();
      expect(proof.proofSignature).toBeDefined();
      expect(proof.verificationMethod).toBe('cryptographic');
    });

    it('should generate different hashes for different inputs', async () => {
      const proof1 = await generateDeletionProof('photo1', 'user1');
      const proof2 = await generateDeletionProof('photo2', 'user1');
      const proof3 = await generateDeletionProof('photo1', 'user2');

      expect(proof1.deletionHash).not.toBe(proof2.deletionHash);
      expect(proof1.deletionHash).not.toBe(proof3.deletionHash);
      expect(proof2.deletionHash).not.toBe(proof3.deletionHash);
    });
  });

  describe('verifyDeletionProof', () => {
    it('should verify valid deletion proof', async () => {
      const photoId = 'photo123';
      const userId = 'user456';
      const proof = await generateDeletionProof(photoId, userId);

      // Mock API requests
      const { apiRequest } = await import('@/lib/query-client');
      vi.mocked(apiRequest).mockResolvedValue({
        ok: true,
        json: async () => ({ verified: true, timestamp: new Date().toISOString() }),
      } as Response);

      const result = await verifyDeletionProof(photoId, proof);

      expect(result.isValid).toBe(true);
      expect(result.deletionConfirmed).toBe(true);
      expect(result.discrepancies).toHaveLength(0);
    });

    it('should detect invalid proof', async () => {
      const photoId = 'photo123';
      const userId = 'user456';
      const proof = await generateDeletionProof(photoId, userId);
      
      // Tamper with the proof
      proof.deletionHash = 'invalid_hash';

      const result = await verifyDeletionProof(photoId, proof);

      expect(result.isValid).toBe(false);
      expect(result.discrepancies).toContain('Hash mismatch');
    });
  });

  describe('performSecureDeletion', () => {
    it('should perform secure deletion successfully', async () => {
      const photoId = 'photo123';
      const userId = 'user456';

      // Mock API requests
      const { apiRequest } = await import('@/lib/query-client');
      vi.mocked(apiRequest).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, verificationUrl: `/api/photos/${photoId}/verify-deletion` }),
      } as Response);

      const result = await performSecureDeletion(photoId, userId);

      expect(result.success).toBe(true);
      expect(result.deletionProof.photoId).toBe(photoId);
      expect(result.verificationUrl).toBeDefined();
    });

    it('should handle deletion failure', async () => {
      const photoId = 'photo123';
      const userId = 'user456';

      // Mock API failure
      const { apiRequest } = await import('@/lib/query-client');
      vi.mocked(apiRequest).mockRejectedValue(new Error('Deletion failed'));

      const result = await performSecureDeletion(photoId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('generateDeletionReport', () => {
    it('should generate comprehensive deletion report', async () => {
      const photoIds = ['photo1', 'photo2', 'photo3'];
      const userId = 'user123';

      // Mock successful verifications
      const { apiRequest } = await import('@/lib/query-client');
      vi.mocked(apiRequest).mockResolvedValue({
        ok: true,
        json: async () => [],
      } as Response);

      const report = await generateDeletionReport(photoIds, userId);

      expect(report.reportId).toBeDefined();
      expect(report.totalPhotos).toBe(3);
      expect(report.generatedAt).toBeDefined();
      expect(['compliant', 'partial', 'non-compliant']).toContain(report.complianceStatus);
    });
  });
});

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle complete trash workflow', async () => {
    const photoId = 'photo123';
    const userId = 'user456';

    // Mock API requests
    const { apiRequest } = await import('@/lib/query-client');
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response);

    // Step 1: Generate deletion proof
    const proof = await generateDeletionProof(photoId, userId);
    expect(proof.photoId).toBe(photoId);

    // Step 2: Perform secure deletion
    const deletionResult = await performSecureDeletion(photoId, userId);
    expect(deletionResult.success).toBe(true);

    // Step 3: Verify deletion
    const verificationResult = await verifyDeletionProof(photoId, proof);
    expect(verificationResult.deletionConfirmed).toBe(true);
  });

  it('should handle recovery workflow', async () => {
    const photoId = 'photo123';

    // Mock API requests
    const { apiRequest } = await import('@/lib/query-client');
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      json: async () => ({
        originalAlbums: [],
        originalMetadata: { filename: 'test.jpg' },
        canRecoverFully: true,
        recoveryRisk: 'low',
      }),
    } as Response);

    // Check recovery possibility
    const canRecover = await canRecoverPhoto(photoId);
    expect(canRecover).toBe(true);

    // Get recovery info
    const recoveryInfo = await getExtendedRecoveryInfo(photoId);
    expect(recoveryInfo.canRecoverFully).toBe(true);
    expect(recoveryInfo.recoveryRisk).toBe('low');

    // Perform recovery
    vi.mocked(apiRequest).mockResolvedValue({
      ok: true,
      json: async () => ({ photo: { id: photoId, uri: 'test.jpg' } }),
    } as Response);

    const recoveryResult = await recoverPhoto(photoId);
    expect(recoveryResult.success).toBe(true);
  });
});
