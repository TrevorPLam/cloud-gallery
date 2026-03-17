import { DEFAULT_LAUNCH_ARGS, TEST_CREDENTIALS } from "../setup";

/**
 * Launch the app with standard E2E flags and optional extra arguments.
 */
export async function launchApp(
  extraArgs: Record<string, string | number> = {},
): Promise<void> {
  await device.launchApp({
    newInstance: true,
    launchArgs: { ...DEFAULT_LAUNCH_ARGS, ...extraArgs },
  });
}

/**
 * Relaunch the app without clearing state (simulates app resume).
 */
export async function relaunchApp(): Promise<void> {
  await device.launchApp({ newInstance: false });
}

/**
 * Terminate the running app instance.
 */
export async function terminateApp(): Promise<void> {
  await device.terminateApp();
}

/**
 * Navigate to the Login screen by terminating and relaunching.
 * Useful to reset auth state between tests.
 */
export async function resetToLogin(): Promise<void> {
  await device.launchApp({
    newInstance: true,
    permissions: { photos: "YES", camera: "YES" },
    launchArgs: { ...DEFAULT_LAUNCH_ARGS, clearAsyncStorage: 1 },
  });
}

/**
 * Perform the standard login flow using the shared test credentials.
 */
export async function loginWithTestCredentials(): Promise<void> {
  const { email, password } = TEST_CREDENTIALS;
  await element(by.text("Sign in")).tap();
  const emailField = element(by.traits(["none"]).and(by.label("Email")));
  await emailField.clearText();
  await emailField.typeText(email);
  const passwordField = element(by.traits(["none"]).and(by.label("Password")));
  await passwordField.clearText();
  await passwordField.typeText(password);
  await element(by.text("Sign in")).atIndex(1).tap();
  await waitFor(element(by.text("Photos")))
    .toBeVisible()
    .withTimeout(10000);
}

/**
 * Wait for an element matching the given matcher to be visible.
 * Throws if the element is not visible within the timeout.
 */
export async function waitForVisible(
  matcher: Detox.NativeMatcher,
  timeoutMs = 5000,
): Promise<void> {
  await waitFor(element(matcher)).toBeVisible().withTimeout(timeoutMs);
}

/**
 * Wait for an element matching the given matcher to disappear.
 */
export async function waitForGone(
  matcher: Detox.NativeMatcher,
  timeoutMs = 5000,
): Promise<void> {
  await waitFor(element(matcher)).not.toBeVisible().withTimeout(timeoutMs);
}

export { TEST_CREDENTIALS };
