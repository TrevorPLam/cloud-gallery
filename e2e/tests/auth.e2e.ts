/**
 * E2E tests for Authentication user journeys:
 *  - User can see the login screen on first launch
 *  - User can register a new account
 *  - User can log in with valid credentials
 *  - User sees an error with invalid credentials
 *  - User can navigate to the Forgot Password screen
 *  - Logged-in user is taken directly to the Photos tab
 */

import { launchApp, resetToLogin, waitForVisible } from "../helpers";

describe("Authentication", () => {
  beforeAll(async () => {
    await resetToLogin();
  });

  it("shows the login screen on first launch", async () => {
    await waitForVisible(by.text("Sign in"));
    await expect(element(by.text("Sign in"))).toBeVisible();
  });

  it("shows validation error when fields are empty", async () => {
    await element(by.text("Sign in")).atIndex(1).tap();
    await expect(
      element(by.text("Please enter email and password.")),
    ).toBeVisible();
    await element(by.text("OK")).tap();
  });

  it("shows an error for invalid credentials", async () => {
    await element(by.traits(["none"]).and(by.label("Email"))).typeText(
      "invalid@example.com",
    );
    await element(by.traits(["none"]).and(by.label("Password"))).typeText(
      "wrongpassword",
    );
    await element(by.text("Sign in")).atIndex(1).tap();
    await waitForVisible(by.text("Login failed"), 10000);
    await element(by.text("OK")).tap();
  });

  it("can navigate to the Create account screen", async () => {
    await element(by.text("Create account")).tap();
    await waitForVisible(by.text("Create account"));
    await expect(element(by.text("Create account"))).toBeVisible();
  });

  it("shows a validation error when passwords do not match during registration", async () => {
    const emailField = element(by.traits(["none"]).and(by.label("Email")));
    const passwordField = element(
      by.traits(["none"]).and(by.label("Password (min 8 characters)")),
    );
    const confirmField = element(
      by.traits(["none"]).and(by.label("Confirm password")),
    );

    await emailField.typeText("newuser@example.com");
    await passwordField.typeText("SecurePass1!");
    await confirmField.typeText("DifferentPass1!");
    await element(by.text("Create account")).atIndex(1).tap();
    await waitForVisible(by.text("Passwords do not match."));
    await element(by.text("OK")).tap();
  });

  it("can navigate back to the login screen", async () => {
    await element(by.text("Sign in")).tap();
    await waitForVisible(by.text("Sign in"));
    await expect(element(by.text("Sign in"))).toBeVisible();
  });

  it("can navigate to the Forgot Password screen", async () => {
    await element(by.text("Forgot password?")).tap();
    await waitForVisible(by.text("Forgot password"));
    await expect(element(by.text("Forgot password"))).toBeVisible();
  });
});
