// AI-META-BEGIN
// AI-META: Presigned URL generation/validation for secure file uploads/downloads.
// OWNERSHIP: server/storage
// ENTRYPOINTS: server/upload-routes.ts
// DEPENDENCIES: crypto (Node.js)
// DANGER: Weak secrets or expired URL validation can enable unauthorized access.
// CHANGE-SAFETY: Safe to add URL types; do not change signature algorithm without migration.
// TESTS: server/presigned-urls.test.ts
// AI-META-END
// Meta: Generate and validate presigned URLs for storage operations.
// Inputs: HTTP method, object key, content type (PUT), expiry seconds.
// Outputs: Signed URLs + expiry timestamps; boolean validation results.
// Invariants: Signatures use HMAC-SHA256 and constant-time comparisons.

import { createHmac, randomBytes } from "crypto";
import { getPresignedConfig } from "./config";

const PRESIGNED_CONFIG = {
  DEFAULT_EXPIRY_SECONDS: 15 * 60,
  MAX_EXPIRY_SECONDS: 7 * 24 * 60 * 60,
  SIGNATURE_ALGORITHM: "sha256",
} as const;

function assertExpiryWithinLimit(expirySeconds: number): void {
  if (expirySeconds > PRESIGNED_CONFIG.MAX_EXPIRY_SECONDS) {
    throw new Error(
      `Expiry exceeds maximum of ${PRESIGNED_CONFIG.MAX_EXPIRY_SECONDS} seconds.`,
    );
  }
}

function getPresignedSecret(): string {
  return getPresignedConfig().secret;
}

function getBaseStorageUrl(): string {
  return getPresignedConfig().storageBaseUrl;
}

/**
 * Generate a presigned URL for uploading a file.
 */
export function generateUploadUrl(
  key: string,
  contentType: string,
  expirySeconds: number = PRESIGNED_CONFIG.DEFAULT_EXPIRY_SECONDS,
): { url: string; expiresAt: Date } {
  assertExpiryWithinLimit(expirySeconds);
  const secret = getPresignedSecret();

  const expiresAt = new Date(Date.now() + expirySeconds * 1000);
  const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

  const dataToSign = `PUT:${key}:${contentType}:${expiresTimestamp}`;
  const signature = createHmac(PRESIGNED_CONFIG.SIGNATURE_ALGORITHM, secret)
    .update(dataToSign)
    .digest("hex");

  const params = new URLSearchParams({
    key,
    contentType,
    expires: expiresTimestamp.toString(),
    signature,
  });

  return {
    url: `${getBaseStorageUrl()}/upload?${params.toString()}`,
    expiresAt,
  };
}

/**
 * Generate a presigned URL for downloading a file.
 */
export function generateDownloadUrl(
  key: string,
  expirySeconds: number = PRESIGNED_CONFIG.DEFAULT_EXPIRY_SECONDS,
): { url: string; expiresAt: Date } {
  assertExpiryWithinLimit(expirySeconds);
  const secret = getPresignedSecret();

  const expiresAt = new Date(Date.now() + expirySeconds * 1000);
  const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);

  const dataToSign = `GET:${key}:${expiresTimestamp}`;
  const signature = createHmac(PRESIGNED_CONFIG.SIGNATURE_ALGORITHM, secret)
    .update(dataToSign)
    .digest("hex");

  const params = new URLSearchParams({
    key,
    expires: expiresTimestamp.toString(),
    signature,
  });

  return {
    url: `${getBaseStorageUrl()}/download?${params.toString()}`,
    expiresAt,
  };
}

/**
 * Validate a presigned URL signature (constant-time comparison).
 */
export function validatePresignedUrl(
  method: "GET" | "PUT",
  key: string,
  contentType: string | null,
  expires: string,
  providedSignature: string,
): boolean {
  const { secret } = getPresignedConfig();

  const expiresTimestamp = Number.parseInt(expires, 10);
  if (
    Number.isNaN(expiresTimestamp) ||
    expiresTimestamp < Math.floor(Date.now() / 1000)
  ) {
    return false;
  }

  const dataToSign =
    method === "PUT"
      ? `${method}:${key}:${contentType}:${expiresTimestamp}`
      : `${method}:${key}:${expiresTimestamp}`;
  const expectedSignature = createHmac(
    PRESIGNED_CONFIG.SIGNATURE_ALGORITHM,
    secret,
  )
    .update(dataToSign)
    .digest("hex");

  if (expectedSignature.length !== providedSignature.length) {
    return false;
  }

  // Constant-time comparison to avoid timing side-channels.
  let result = 0;
  for (let i = 0; i < expectedSignature.length; i += 1) {
    result |= expectedSignature.charCodeAt(i) ^ providedSignature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a secure share token for future sharing workflows.
 */
export function generateShareToken(): string {
  return randomBytes(32).toString("hex");
}
