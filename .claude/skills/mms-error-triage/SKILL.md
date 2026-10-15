---
name: mms-error-triage
description: Triages a production error report end to end in MMS — Sentry issue to request id to traceparent to the audit row and the responsible code path. Use when investigating a reported bug, an error spike, or a Sentry alert that needs a root cause and an owning fix. Do NOT use for a server that is down right now (use mms-incident-response) or for failing local test suites (use mms-testing-e2e).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Error Triage

**Rules (norms SSOT):** `mms-testing-observability.md` §3–§4 (telemetry fields, correlation, ErrorBoundary) · `mms-api-interface.md` (error envelope and echo headers) · `mms-data-layer.md` §5 (immutable audit event rows). Audit trail workflow → `mms-audit-trail`.

## When to use

- Investigating a reported bug, error spike, or Sentry alert
- Tracing a failure from request → audit/outbox → owning fix

## The correlation chain

Every hop already carries an identifier — use it instead of guessing from timestamps:

| Hop | Identifier | Where to look |
|---|---|---|
| Browser error | Sentry issue + event id | `apps/frontend/src/lib/clientErrorReporting.ts` wiring; tenant tag attached when known |
| API request | `requestId` / `reqId`, `x-request-id`, W3C `traceparent` | Pino logs (`LOG_LEVEL`), Fastify request logging |
| Database audit | `correlation_id` | `audit_trail_events` rows for the same request |
| Tenant | `workspace_subdomain` / `tenant.id` | audit rows, logs, and the platform registry |

The server echoes `x-request-id` and `traceparent` back on responses (`mms-api-interface.md`); if a user-facing error shows a request id, that id is the fastest entry point. For log query patterns and audit trail cross-referencing, see [references/correlation-tracing.md](references/correlation-tracing.md).

## Procedure

1. **Anchor the report.** Establish environment, tenant, time window (server timezone), user role, and the exact action. Reproduce with the real tenant rather than an empty workspace — most MMS bugs are data-shape or permission dependent.
2. **Pull the matching logs** by `requestId`/`tenant.id` rather than by free-text search, then read the response envelope: MMS errors are production-safe `{ type, message }`; a raw SQL/stack string in a response is itself a defect to report.
3. **Follow into the audit trail** with the `correlation_id`/timestamp: the audit row tells you what write actually happened (and with which `real_user_id`), which frequently contradicts what the UI claimed.
4. **Classify before fixing:**
   - **Render crash** → `ErrorBoundary` scope; check whether the boundary wraps the right subtree (`mms-testing-observability.md` §4).
   - **Fetch failure / 4xx-5xx** → Query `isError` path, error mapping, RBAC gate, or RLS context missing in the service (`mms-data-layer.md` §1).
   - **Silent wrong data** → soft-delete leakage, projection mismatch vs the `@mms/shared` DTO, or a stale mirror/column config (`mms-soft-delete`, `mms-fields.md`).
   - **Slow/timeout** → hand off to `mms-db-performance` or `mms-queue-ops` rather than patching a timeout value.
5. **Fix, then prove it.** Add a regression test that fails before the fix and passes after — a bug fix without one is how the same issue returns (`mms-testing-observability.md` §1). For tenant/RLS bugs, the test must assert allow **and** deny with the wrong tenant.
6. **Record the outcome** where the next person will look: the migration/debt register if it is systemic (`mms-migration-status.md`), or the owning rule/skill if a norm was missing. Do not leave the knowledge only in the PR description.

## Escalate rather than guess

If the report indicates cross-tenant data exposure, credential leakage, or destructive data loss, stop triaging and treat it as a security incident: capture evidence (ids, timestamps, audit rows) before touching anything, and do not "clean up" rows that are the evidence.

## Do not

- Log PII, tokens, OTPs, or full payloads while investigating — the logging rules apply to debug sessions too.
- Reproduce against production data with a write path; use a scratch tenant or the local stack.
- Mark an issue resolved because the error stopped appearing: an error rate that drops without a cause is usually traffic, not a fix.

## Related skills

`mms-incident-response` (outage/rollback), `mms-db-performance`, `mms-queue-ops`, `mms-testing-e2e`, `mms-backend-security` (if exposure is suspected).
