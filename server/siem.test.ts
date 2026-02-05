// AI-META-BEGIN
// AI-META: Unit tests for SIEM forwarding behavior and timeout handling
// OWNERSHIP: server/tests
// ENTRYPOINTS: validates forwardAuditEvent in server/siem.ts
// DEPENDENCIES: vitest, global fetch mock
// DANGER: Missing coverage can hide dropped audit events or timeout regressions
// CHANGE-SAFETY: Keep env-var driven branches and payload assertions explicit
// TESTS: server/siem.test.ts
// AI-META-END

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditEventType, AuditSeverity, type AuditEvent } from "./audit";

const baseEvent: AuditEvent = {
  id: "evt-1",
  eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
  severity: AuditSeverity.LOW,
  userId: "user-1",
  action: "login",
  resource: "auth",
  outcome: "SUCCESS",
  details: { ip: "127.0.0.1" },
  timestamp: new Date(),
};

describe("forwardAuditEvent", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("does not call fetch when SIEM is disabled", async () => {
    process.env.SIEM_ENABLED = "false";
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { forwardAuditEvent } = await import("./siem");
    await forwardAuditEvent(baseEvent);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("does not call fetch when endpoint is missing", async () => {
    process.env.SIEM_ENABLED = "true";
    delete process.env.SIEM_WEBHOOK_URL;
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { forwardAuditEvent } = await import("./siem");
    await forwardAuditEvent(baseEvent);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("forwards audit payload to configured endpoint", async () => {
    process.env.SIEM_ENABLED = "true";
    process.env.SIEM_WEBHOOK_URL = "https://siem.example/hook";
    process.env.SIEM_TIMEOUT_MS = "1250";

    const fetchSpy = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchSpy);

    const { forwardAuditEvent } = await import("./siem");
    await forwardAuditEvent(baseEvent);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://siem.example/hook");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });

    const parsed = JSON.parse(init.body as string);
    expect(parsed.source).toBe("cloud-gallery");
    expect(parsed.type).toBe("audit_event");
    expect(parsed.event.userId).toBe("user-1");
    expect(init.signal).toBeDefined();
  });
});
