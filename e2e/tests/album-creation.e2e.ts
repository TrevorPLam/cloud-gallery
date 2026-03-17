/**
 * E2E tests for Album Creation user journey:
 *  - Authenticated user can see the Albums tab
 *  - User can open the Create Album modal
 *  - User can create a new album with a valid name
 *  - Created album appears in the album list
 *  - User can open an album's detail view
 *  - User can long-press an album to delete it
 */

import {
  loginWithTestCredentials,
  resetToLogin,
  waitForVisible,
  waitForGone,
} from "../helpers";

const TEST_ALBUM_NAME = `E2E Album ${Date.now()}`;

describe("Album Creation", () => {
  beforeAll(async () => {
    await resetToLogin();
    await loginWithTestCredentials();
    // Navigate to the Albums tab
    await element(by.text("Albums")).tap();
    await waitForVisible(by.text("Albums"));
  });

  it("shows the Albums tab", async () => {
    await expect(element(by.text("Albums"))).toBeVisible();
  });

  it("shows the create album button", async () => {
    await waitForVisible(by.label("Create album"));
    await expect(element(by.label("Create album"))).toBeVisible();
  });

  it("opens the Create Album modal", async () => {
    await element(by.label("Create album")).tap();
    await waitForVisible(by.text("New Album"));
    await expect(element(by.text("New Album"))).toBeVisible();
  });

  it("shows a validation error when album name is empty", async () => {
    await element(by.text("Create")).tap();
    await waitForVisible(by.text("Please enter an album name."));
    await element(by.text("OK")).tap();
  });

  it("creates a new album with a valid name", async () => {
    await element(by.traits(["none"]).and(by.label("Album name"))).typeText(
      TEST_ALBUM_NAME,
    );
    await element(by.text("Create")).tap();
    await waitForGone(by.text("New Album"), 8000);
    await waitForVisible(by.text(TEST_ALBUM_NAME));
    await expect(element(by.text(TEST_ALBUM_NAME))).toBeVisible();
  });

  it("can open the new album detail view", async () => {
    await element(by.text(TEST_ALBUM_NAME)).tap();
    await waitForVisible(by.text(TEST_ALBUM_NAME));
    // Album detail screen shows the album name in the header
    await expect(element(by.text(TEST_ALBUM_NAME))).toBeVisible();
  });

  it("can navigate back to the albums list", async () => {
    await device.pressBack();
    await waitForVisible(by.text("Albums"));
  });

  it("can delete the test album via long-press", async () => {
    await element(by.text(TEST_ALBUM_NAME)).longPress();
    await waitForGone(by.text(TEST_ALBUM_NAME), 5000);
  });
});
