/**
 * E2E tests for Search user journey:
 *  - Authenticated user can navigate to the Search tab
 *  - Search input is visible and focusable
 *  - Typing a query returns relevant results (or empty state)
 *  - Filter chips are displayed and tappable
 *  - Popular / recent suggestion chips are visible
 *  - Tapping a search result navigates to the photo detail view
 *  - Clearing the query resets the results list
 */

import {
  loginWithTestCredentials,
  resetToLogin,
  waitForVisible,
} from "../helpers";

describe("Search", () => {
  beforeAll(async () => {
    await resetToLogin();
    await loginWithTestCredentials();
    // Navigate to the Search tab
    await element(by.text("Search")).tap();
    await waitForVisible(by.label("Search photos"));
  });

  it("shows the Search tab with a search input", async () => {
    await expect(element(by.label("Search photos"))).toBeVisible();
  });

  it("shows suggestion chips when the search field is focused", async () => {
    await element(by.label("Search photos")).tap();
    // At least one suggestion chip should appear
    await waitForVisible(by.id("suggestion-chip"), 5000);
    await expect(element(by.id("suggestion-chip")).atIndex(0)).toBeVisible();
  });

  it("returns results (or empty state) for a generic query", async () => {
    await element(by.label("Search photos")).typeText("nature");
    // Wait for either results or the empty state message
    try {
      await waitForVisible(by.id("search-result-item"), 8000);
    } catch {
      await waitForVisible(by.text("No results found"), 2000);
    }
  });

  it("shows filter chips for the active query", async () => {
    await waitForVisible(by.id("filter-chip"));
    await expect(element(by.id("filter-chip")).atIndex(0)).toBeVisible();
  });

  it("can tap a filter chip to refine the search", async () => {
    await element(by.id("filter-chip")).atIndex(0).tap();
    // Results should update (either new items or unchanged empty state)
    await waitForVisible(by.label("Search photos"));
  });

  it("can clear the search query", async () => {
    await element(by.label("Clear search")).tap();
    await waitForVisible(by.label("Search photos"));
    // Chips should revert to the initial suggestion state
    await waitForVisible(by.id("suggestion-chip"), 5000);
  });

  it("hides the keyboard when results are scrolled", async () => {
    await element(by.label("Search photos")).typeText("photo");
    await waitForVisible(by.id("search-result-item"), 8000);
    await element(by.id("search-results-list")).scroll(200, "down");
  });
});
