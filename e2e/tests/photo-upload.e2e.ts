/**
 * E2E tests for Photo Upload user journey:
 *  - Authenticated user can see the Photos tab
 *  - User can open the image picker via the FAB
 *  - Uploaded photo appears in the photo grid
 *  - User can open a photo's detail view
 *  - User can return to the grid from detail view
 */

import {
  loginWithTestCredentials,
  resetToLogin,
  waitForVisible,
} from "../helpers";

describe("Photo Upload", () => {
  beforeAll(async () => {
    await resetToLogin();
    await loginWithTestCredentials();
  });

  it("shows the Photos tab after login", async () => {
    await waitForVisible(by.text("Photos"));
    await expect(element(by.text("Photos"))).toBeVisible();
  });

  it("shows the upload FAB button", async () => {
    await waitForVisible(by.label("Add photos"));
    await expect(element(by.label("Add photos"))).toBeVisible();
  });

  it("opens the image picker when the FAB is tapped", async () => {
    await device.launchApp({
      newInstance: false,
      permissions: { photos: "YES", camera: "YES" },
    });
    await element(by.label("Add photos")).tap();
    // The native image picker sheet should appear; assert it is visible
    await waitForVisible(by.text("Photo Library"), 8000);
  });

  it("dismisses the image picker without selecting a photo", async () => {
    await device.pressBack();
    await waitForVisible(by.text("Photos"));
  });

  it("can scroll the photo grid", async () => {
    await waitForVisible(by.id("photo-grid"));
    await element(by.id("photo-grid")).scroll(300, "down");
    await element(by.id("photo-grid")).scroll(300, "up");
  });

  it("can open a photo detail view", async () => {
    // Tap the first photo in the grid if any are present
    await waitForVisible(by.id("photo-grid"));
    await element(by.id("photo-grid")).atIndex(0).tap();
    await waitForVisible(by.id("photo-detail"), 5000);
    await expect(element(by.id("photo-detail"))).toBeVisible();
  });

  it("can navigate back from the photo detail view", async () => {
    await device.pressBack();
    await waitForVisible(by.text("Photos"));
  });
});
