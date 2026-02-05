// Meta: Environment configuration validation helpers for server modules.
// Inputs: process.env values for presigned URL signing.
// Outputs: Parsed configuration objects with defaults applied.
// Invariants: Presigned URL secret must be 64 hex characters when required.

import { z } from "zod";

const presignedSchema = z.object({
  PRESIGNED_URL_SECRET: z
    .string()
    .length(64, "PRESIGNED_URL_SECRET must be 64 hex characters."),
  STORAGE_BASE_URL: z.string().min(1).default("/api/storage"),
});

export type PresignedConfig = {
  secret: string;
  storageBaseUrl: string;
};

/**
 * Validate and return presigned URL configuration.
 */
export function getPresignedConfig(): PresignedConfig {
  const parsed = presignedSchema.safeParse({
    PRESIGNED_URL_SECRET: process.env.PRESIGNED_URL_SECRET,
    STORAGE_BASE_URL: process.env.STORAGE_BASE_URL ?? "/api/storage",
  });

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(issue => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Presigned URL configuration invalid:\n${issues}`);
  }

  return {
    secret: parsed.data.PRESIGNED_URL_SECRET,
    storageBaseUrl: parsed.data.STORAGE_BASE_URL,
  };
}
