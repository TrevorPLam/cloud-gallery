// AI-META-BEGIN
// AI-META: Forward audit events to a configured SIEM webhook
// OWNERSHIP: server/security
// ENTRYPOINTS: server/audit.ts
// DEPENDENCIES: fetch, AbortController
// DANGER: Misconfigured endpoints can leak audit data offsite
// CHANGE-SAFETY: Safe to adjust timeouts; preserve payload shape
// TESTS: server/audit.test.ts
// AI-META-END

// SIEM forwarding utility for audit events

import type { AuditEvent } from "./audit";

const DEFAULT_TIMEOUT_MS = 3000;

function isSiemEnabled(): boolean {
  return process.env.SIEM_ENABLED === "true";
}

function getSiemEndpoint(): string | undefined {
  return process.env.SIEM_WEBHOOK_URL;
}

function getTimeoutMs(): number {
  const raw = process.env.SIEM_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : DEFAULT_TIMEOUT_MS;
}

export async function forwardAuditEvent(event: AuditEvent): Promise<void> {
  if (!isSiemEnabled()) return;

  const endpoint = getSiemEndpoint();
  if (!endpoint) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "cloud-gallery",
        type: "audit_event",
        event,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    console.warn("SIEM forwarding failed:", error);
  } finally {
    clearTimeout(timeout);
  }
}
