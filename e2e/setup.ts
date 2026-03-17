/**
 * Global E2E test setup configuration.
 *
 * In Detox 20.x the lifecycle is driven by the testEnvironment
 * (detox/runners/jest/testEnvironment), globalSetup, and globalTeardown
 * declared in jest.config.js.  Individual test suites call
 * device.launchApp() in their own beforeAll hooks.
 *
 * This file documents the overall E2E test strategy and can be extended
 * with shared helpers loaded by the testEnvironment.
 */

/**
 * Shared test credentials used across E2E suites.
 * In CI these are overridden by environment variables.
 */
export const TEST_CREDENTIALS = {
  email: process.env.E2E_TEST_EMAIL ?? "e2e-test@photovault.example",
  password: process.env.E2E_TEST_PASSWORD ?? "E2eTestPass123!",
};

/**
 * Standard app launch arguments used across E2E suites.
 * - detoxEnableSynchronization: keep Detox's default idle-wait behaviour
 * - isE2ETest: flag consumed by app code to enable test helpers / mock APIs
 */
export const DEFAULT_LAUNCH_ARGS = {
  detoxEnableSynchronization: 1,
  isE2ETest: 1,
};
