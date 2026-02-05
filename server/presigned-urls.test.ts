import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  generateDownloadUrl,
  generateUploadUrl,
  validatePresignedUrl,
} from "./presigned-urls";

const VALID_SECRET = "a".repeat(64);

describe("presigned-urls", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.PRESIGNED_URL_SECRET = VALID_SECRET;
    process.env.STORAGE_BASE_URL = "https://storage.example.com";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("generates a valid upload URL and validates signature", () => {
    const { url } = generateUploadUrl("photos/test.jpg", "image/jpeg", 60);
    const parsed = new URL(url);
    const params = parsed.searchParams;

    const key = params.get("key");
    const contentType = params.get("contentType");
    const expires = params.get("expires");
    const signature = params.get("signature");

    expect(key).toBe("photos/test.jpg");
    expect(contentType).toBe("image/jpeg");
    expect(expires).toBeTruthy();
    expect(signature).toBeTruthy();

    const isValid = validatePresignedUrl(
      "PUT",
      key ?? "",
      contentType,
      expires ?? "",
      signature ?? "",
    );

    expect(isValid).toBe(true);
  });

  it("generates a valid download URL and validates signature", () => {
    const { url } = generateDownloadUrl("photos/test.jpg", 60);
    const parsed = new URL(url);
    const params = parsed.searchParams;

    const key = params.get("key");
    const expires = params.get("expires");
    const signature = params.get("signature");

    const isValid = validatePresignedUrl(
      "GET",
      key ?? "",
      null,
      expires ?? "",
      signature ?? "",
    );

    expect(isValid).toBe(true);
  });

  it("rejects expired URLs", () => {
    const isValid = validatePresignedUrl(
      "GET",
      "photos/old.jpg",
      null,
      `${Math.floor(Date.now() / 1000) - 10}`,
      "deadbeef",
    );

    expect(isValid).toBe(false);
  });

  it("rejects tampered signatures", () => {
    const { url } = generateDownloadUrl("photos/test.jpg", 60);
    const parsed = new URL(url);
    const params = parsed.searchParams;

    const isValid = validatePresignedUrl(
      "GET",
      params.get("key") ?? "",
      null,
      params.get("expires") ?? "",
      "invalidsignature",
    );

    expect(isValid).toBe(false);
  });

  it("throws when expiry exceeds maximum", () => {
    expect(() =>
      generateUploadUrl("photos/test.jpg", "image/jpeg", 999999999),
    ).toThrow(/Expiry exceeds maximum/);
  });
});
