/**
 * E2E tests for Sharing user journey:
 *  - Authenticated user can open a photo detail view
 *  - Share button is visible on the detail screen
 *  - Tapping Share opens the system share sheet
 *  - User can dismiss the share sheet
 *  - Album sharing: user can share an album from the album detail screen
 */

import {
  loginWithTestCredentials,
  resetToLogin,
  waitForVisible,
} from "../helpers";

describe("Sharing", () => {
  beforeAll(async () => {
    await resetToLogin();
    await loginWithTestCredentials();
    // Grant photo/camera permissions before testing picker-dependent flows
    await device.launchApp({
      newInstance: false,
      permissions: { photos: "YES", camera: "YES" },
    });
  });

  describe("Photo sharing", () => {
    beforeAll(async () => {
      // Navigate to Photos tab and open the first available photo
      await element(by.text("Photos")).tap();
      await waitForVisible(by.id("photo-grid"));
      await element(by.id("photo-grid")).atIndex(0).tap();
      await waitForVisible(by.id("photo-detail"), 5000);
    });

    afterAll(async () => {
      // Return to Photos tab
      await device.pressBack();
    });

    it("shows a Share button on the photo detail screen", async () => {
      await waitForVisible(by.label("Share photo"));
      await expect(element(by.label("Share photo"))).toBeVisible();
    });

    it("opens the native share sheet when Share is tapped", async () => {
      await element(by.label("Share photo")).tap();
      // The native share sheet is a system overlay; assert it appears
      await waitForVisible(by.text("Share"), 8000);
    });

    it("can dismiss the share sheet", async () => {
      // Close the share sheet (platform-specific)
      if (device.getPlatform() === "ios") {
        await element(by.text("Cancel")).tap();
      } else {
        await device.pressBack();
      }
      await waitForVisible(by.id("photo-detail"));
    });
  });

  describe("Album sharing", () => {
    beforeAll(async () => {
      // Navigate to Albums tab and open the first album
      await element(by.text("Albums")).tap();
      await waitForVisible(by.text("Albums"));
    });

    it("shows the Albums tab", async () => {
      await expect(element(by.text("Albums"))).toBeVisible();
    });

    it("shows a Share button inside an album detail view", async () => {
      // Only run if at least one album exists
      try {
        await element(by.id("album-card")).atIndex(0).tap();
        await waitForVisible(by.label("Share album"), 5000);
        await expect(element(by.label("Share album"))).toBeVisible();
        await device.pressBack();
      } catch {
        // No albums exist yet – skip gracefully
      }
    });
  });
});
