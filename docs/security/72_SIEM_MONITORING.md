# SIEM & Advanced Monitoring

**Status**: ✅ Phase 3 Implemented (Scaffolding)
**Owner**: Security/Engineering Team
**Last Updated**: 2026-02-04

## Overview

This document describes SIEM integration and advanced monitoring for Cloud Gallery.

## Logging Pipeline

- Structured audit events in `server/audit.ts`
- SIEM webhook forwarding via `server/siem.ts`
- Correlation IDs for traceability

## SIEM Integration

### Configuration

- `SIEM_WEBHOOK_URL`: HTTPS endpoint for SIEM ingestion
- `SIEM_ENABLED`: `true` to enable forwarding
- `SIEM_TIMEOUT_MS`: request timeout for SIEM webhook (default 3000ms)

### Data Sent

- Audit event metadata (event type, severity, outcome)
- Redacted details (PII removed)
- Request identifiers for correlation

## Alerting Guidelines

- Security events (auth failures, rate limits, suspicious activity)
- Admin events (data exports, user deletes)
- System errors (encryption/decryption errors)

## Implementation Checklist

- [x] SIEM forwarding scaffold
- [x] Audit event redaction
- [ ] Configure SIEM endpoint in production
- [ ] Add alert rules for critical events

## Evidence & References

- Audit logging: `docs/security/40_AUDIT_AND_LOGGING.md`
- SIEM forwarding: `server/siem.ts`
