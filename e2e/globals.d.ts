/**
 * Minimal Jest globals for E2E tests.
 *
 * We purposely do NOT import the full @types/jest here because it would
 * shadow Detox's `expect` global (which returns Detox.Expect with
 * `.toBeVisible()`, `.toExist()`, etc.) with Jest's `expect` (which
 * returns JestMatchers and lacks those matchers).
 *
 * Only the lifecycle APIs that Detox doesn't re-declare are listed below.
 */
declare function describe(name: string, fn: () => void): void;
declare function it(name: string, fn: () => Promise<void> | void, timeout?: number): void;
declare function test(name: string, fn: () => Promise<void> | void, timeout?: number): void;
declare function beforeAll(fn: () => Promise<void> | void, timeout?: number): void;
declare function afterAll(fn: () => Promise<void> | void, timeout?: number): void;
declare function beforeEach(fn: () => Promise<void> | void, timeout?: number): void;
declare function afterEach(fn: () => Promise<void> | void, timeout?: number): void;
declare function jest(...args: unknown[]): unknown;
