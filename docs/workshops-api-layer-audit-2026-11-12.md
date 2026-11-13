# Workshops API Layer, Fastify Routes & Serialization Audit — 2026-11-12

**Security:** tenant isolation, RBAC and audit coverage are audited in
[workshops-security-audit-2026-11-12.md](workshops-security-audit-2026-11-12.md).

**Async pipelines:** queue workers, idempotency and DLQ coverage are audited in
[workshops-async-queues-audit-2026-11-12.md](workshops-async-queues-audit-2026-11-12.md).

**Printables/analytics:** templates, exports and reporting queries are audited in
[workshops-printables-analytics-audit-2026-11-12.md](workshops-printables-analytics-audit-2026-11-12.md).

**Shared contracts:** DTOs, enums and Zod/static alignment are audited in
[workshops-shared-contracts-audit-2026-11-12.md](workshops-shared-contracts-audit-2026-11-12.md).

**Frontend/state:** page hierarchy, query invalidation and form UX are audited in
[workshops-frontend-state-audit-2026-11-12.md](workshops-frontend-state-audit-2026-11-12.md).

**Tests/CI:** coverage, concurrency and ratchets are audited in
[workshops-test-audit-2026-11-12.md](workshops-test-audit-2026-11-12.md).

**Scope:** the Fastify/ts-rest surface of the Workshops module — request contracts (params, query,
body, headers), response contracts and runtime validation, domain error → HTTP mapping, and the
pagination/projection shape of every list and roster read. Fourth in the series; companions:
[schema/persistence](workshops-schema-persistence-audit-2026-11-12.md),
[domain lifecycle](workshops-domain-lifecycle-audit-2026-11-12.md) and
[specialized subsystems](workshops-subsystems-audit-2026-11-12.md).

**Method:** read both contracts, both routers, the route guard, the shared error handler, the
pagination helper, every workshop repository projection and the frontend API hooks; then exercised
the contract with `fastify.inject()` (23 route tests) and the reads against real PostgreSQL.

## 1. Premise corrections

| Brief assumption | Reality |
|---|---|
| Facilitator assignment endpoint | **Does not exist.** Workshops have no facilitator model, table or route (design D1 in the subsystems audit). Nothing to validate |
| Batch completion marking | Completion is `POST /:id/completion/evaluate` (all seated participants in one transaction); certificates are `POST /:id/certificates` (max 500 ids); check-ins are `PUT /:id/attendance` (max 500 marks per day). There is no per-participant batch-completion route |
| Participant cancellation | `DELETE /:id/participants/:participantId` (soft-delete + automatic waitlist promotion) |
| `ScheduleConflict` / `AlreadyCompleted` domain errors | No scheduling data exists, so no schedule conflict can occur. `AlreadyCompleted` has no dedicated code; the state conflicts are `illegal_workshop_transition`, `certificate_issued` and `workshop_not_finished` |

## 2. Route inventory (after this change set)

Every route: `responseValidation: true`, strict params/query/body, canonical error envelope.

| Route | Input | Declared statuses | Response schema |
|---|---|---|---|
| `GET /api/workshops` | strict list query (page, limit 1–100, search, sortDir, sortField allowlist, includeDeleted) | 200/400/403/500 | strict page envelope |
| `GET /api/workshops/:id` | id ≤128 | 200/400/403/404/500 | strict detail |
| `POST /api/workshops` | strict create DTO | 201/400/403/409/500 | `{workshop}` |
| `PATCH /api/workshops/:id` | id + strict patch DTO | 200/400/403/404/409/500 | `{workshop}` |
| `POST /api/workshops/:id/transition` | id + OCC header + strict body | 200/400/403/404/409/428/500 | `{workshop}` |
| `DELETE /api/workshops/:id` | id + optional strict reason | 200/400/403/404/500 | `{success}` |
| `POST /api/workshops/:id/restore` | id + strict empty body | 200/400/403/404/500 | `{success}` |
| `POST /api/workshops/bulk-delete` | strict capped ids | 200/400/403/500 | `{success,succeeded,failed}` |
| `POST /:id/participants` | id + strict contactId | 201/400/403/404/409/500 | participant **summary** |
| `POST /:id/participants/bulk` | id + 1–100 contactIds | 201/400/403/404/409/500 | summaries |
| `DELETE /:id/participants/:participantId` | id + participantId ≤128 | 200/400/403/404/409/500 | `{success, promoted}` summary |
| `PUT /:id/attendance` | id + strict day/marks (≤500) | 200/400/403/404/409/500 | marks |
| `PUT /:id/scores` | id + strict score lines (≤500) | 200/400/403/404/409/500 | score lines |
| `GET /:id/completion` | id | 200/400/403/404/500 | rows |
| `POST /:id/completion/evaluate` | id + strict empty body | 200/400/403/404/409/500 | rows |
| `POST /:id/certificates` | id + strict ids (≤500) | 200/400/403/404/409/500 | `{issued,rows}` |
| `GET /api/workshops/report` | strict empty query | 200/400/403/500 | rows |
| `GET/PUT /api/workshops/setup/preferences` | strict empty query / strict body | 200/400/403/500 | preferences |
| `GET /api/workshops/metrics` | — (Fastify route, not ts-rest) | 200/403/500 | response envelope schema |

## 3. Findings and remediation

### 3.1 Contract completeness

| # | Severity | Finding | Status |
|---|---|---|---|
| A1 | **P1** | **Response validation was off on both workshop routers**, so a handler could leak extra fields or drift from the declared schema without any runtime failure. Ten other contract routers already opt in | **Fixed** — `responseValidation: true` on both routers; every declared success schema is strict, so an unexpected field is a loud 500 rather than a silent leak |
| A2 | P1 | **Undeclared statuses:** `evaluateCompletion`, `issueCertificates`, `saveAttendanceDay`, `saveScores` and `removeParticipant` can return `409` but did not declare it; `400` was missing on routes whose params/body/query can fail validation; only the transition declared `428` | **Fixed** — `400` on every route with input, `409` on the five conflict routes, `428` kept transition-only (asserted by a contract-coverage test) |
| A3 | **P1** | The list query was a **passthrough** that advertised `afterId`/`skipCount` the repository never read, and `sortField` was unvalidated (unknown values silently fell back to `startDate`); non-list routes had no query schema, so unknown query keys were accepted | **Fixed** — `workshopListQuerySchema` is strict, allowlists `title/startDate/endDate/registrationDeadline/capacity/updatedAt`, and drops the unimplemented cursor/count flags; every route now has a query schema (strict empty where nothing is accepted) |
| A4 | P2 | Params were `min(1)` only, inline empty bodies (`restore`, `evaluate`, `removeParticipant`) were non-strict, and the page/success/error envelopes were loose | **Fixed** — `max(128)` + strict params, strict empty bodies, strict page/success envelopes, canonical `apiErrorResponseSchema` (the shared `{type,message,details?,violations?}`) |
| A5 | **P1** | The metrics endpoint had **no response schema** and its catch-all flattened domain errors to 500 | **Fixed** — `workshopsCommandMetricsResponseSchema` is passed as the Fastify response schema; the route factory maps domain errors first |

Fastify's default `maxParamLength` (100) answers `414` before a 129-char id reaches the contract; the
128-char schema cap is defence-in-depth for a server configured with a larger limit (covered by test).

### 3.2 Domain error mapping & serialization

| # | Severity | Finding | Status |
|---|---|---|---|
| B1 | **P1** | **The route guard dropped the structured error payload.** `handleContractError` forwards `details`/`violations`, but `guarded` converted every `HttpDomainError` to `{type,message}`. Capacity blockers, transition violations, conflicting ids and capacity numbers never reached the client — the envelope did not match the documented `{type,message,details}` | **Fixed** — `guarded` forwards `details` and `violations`; route test asserts a refused transition returns `details.from/to/blockers` |
| B2 | P2 | Duplicate errors were inconsistent: pre-checks used `already_registered`, the `23505` fallbacks used the default `conflict` | **Fixed** — `addParticipant`/`addParticipants` always `already_registered`; workshop id collision is `workshop_exists` |
| B3 | P2 | Zod/body/query faults return **400 `validation_error`**, while `mms-api-interface` §2 classifies request-body faults as `422` | **Documented, not changed** — the handler is shared by the whole API; changing it is a global taxonomy decision (D5) |
| B4 | — | Error types are strings without a shared registry | **Documented** — the mapping table below is the authoritative list; no `422` and no schedule-conflict type exists |

### Error → HTTP mapping (workshops)

| Status | `type` | Trigger | `details` / `violations` |
|---|---|---|---|
| 400 | `validation_error` | params/query/body/header schema, malformed OCC header, date-rule violation | message lists the failing paths |
| 403 | `forbidden` | RBAC/collection access | — |
| 404 | `not_found` | workshop/participant not found or archived | — |
| 409 | `capacity_full` | full workshop without a waitlist | `{id, blockers}` |
| 409 | `deadline_passed` / `workshop_ended` / `workshop_not_open` | registration gate | `{id, blockers}` |
| 409 | `already_registered` | duplicate contact (pre-check or `23505`) | `{id}` |
| 409 | `workshop_exists` | duplicate workshop id (`23505`) | — |
| 409 | `workshop_read_only` / `capacity_below_active` / `certificate_issued` / `workshop_not_finished` | write guards | capacity context where applicable |
| 409 | `illegal_workshop_transition` | lifecycle matrix refusal | `violations: [...]`, `from`/`to` |
| 409 | `stale_workshop` | OCC mismatch | — |
| 428 | `stale_workshop` | transition without an OCC token | — |
| 500 | `server_error` | unexpected failure | — |

`422` is not emitted by the workshops surface (no policy-refusal errors exist there); the only
`422`-class rule deviation is the shared Zod handler (B3).

### 3.3 Pagination, projections and N+1

| # | Severity | Finding | Status |
|---|---|---|---|
| C1 | **P1** | **The detail endpoint is an unbounded nested dump:** all seated participants (name + phone), the waitlist, all attendance marks (participants × days) and all scores in one response; `getCompletion` and `getReport` are also unpaginated | **Deferred (D2)** with a concrete paged design — truncating the current payload would silently break the check-in grid and "issue all certificates", so it needs coordinated frontend paging |
| C2 | P1 | The **frontend list ignores pagination**: it always requests `limit=100`, never sends `page`/`sortField`, and ignores `hasMore`/`total`; >100 workshops silently disappear | **Deferred (D3)** — the API is already bounded; the fix is a Work-tier pager |
| C3 | P2 | Participant phone was returned by every mutation response and resolved by a **correlated subquery per participant row** | **Fixed** — mutation responses use `workshopParticipantSummarySchema` (no `contactPhone`); reads use a `LEFT JOIN LATERAL … ORDER BY is_primary DESC, sort_order LIMIT 1` matching `contact_phones_workspace_contact_priority_idx` (DB test covers primary + fallback) |
| C4 | — | Positive: list uses `runListPage` (offset, clamp 1–100, count only when requested, one grouped count query); no application-level N+1; the roster's attendance/scores are bounded by the workshop window (≤62 days) | — |

## 4. Change set

- **Shared contracts:** `workshopListQuerySchema` (strict, sort allowlist), strict empty
  query/body schemas on every route, params `max(128)`, missing `400`/`409` declarations,
  `apiErrorResponseSchema` in both contracts, strict success/page envelopes,
  `workshopParticipantSummarySchema` + `toWorkshopParticipantSummary`,
  `workshopsCommandMetricsResponseSchema`.
- **Routers:** `responseValidation: true` on both; mutation responses mapped to participant
  summaries; metrics route receives its response schema.
- **Route guard:** forwards `details`/`violations` (structured error envelope).
- **Error codes:** `already_registered` everywhere for duplicates; `workshop_exists` for id
  collisions.
- **Data layer:** participant reads use a lateral primary-phone join instead of a correlated
  subquery; no schema or migration change.
- **Metrics:** domain errors keep their status; response serialized by schema.
- **Tests:** 23 route tests (strict query/sort, unknown body key, oversized id, structured 409
  details, metrics envelope, summary-without-phone), 5 contract-coverage tests (400 on every input
  route, query schema everywhere, 409 coverage, 428 transition-only, success status), DB assertion
  for the lateral phone projection.

## 5. Verification

```bash
pnpm --filter mms-backend typecheck && pnpm --filter @mms/shared typecheck && pnpm --filter mms-frontend typecheck
pnpm --filter mms-backend test     # 515 files / 3663 tests
pnpm --filter @mms/shared test     # 280 files / 2268 tests
pnpm --filter mms-frontend test    # 1206 files / 4534 passed (2 skipped)
# workshop DB suites: 54 tests (incl. 48 rerun after the lateral join)
pnpm run check:code-norms check:backend-structure check:backend-boundaries check:i18n check:migration-indexes
```

## 6. Deferred

- **D1 — facilitator assignment endpoint + schedule conflicts.** Feature/model absent (see the
  subsystems audit for the target design); there is no route to validate yet.
- **D2 — paged roster/attendance/scores/completion/report.** Proposed contract:
  `GET /:id/participants?page&limit&queue=seated|waitlisted` →
  `{participants,total,page,limit,hasMore}`; `GET /:id/attendance?page&limit&dayOn?` and
  `GET /:id/scores?page&limit`; `getCompletion`/`getReport` gain `page/limit/total/hasMore`. The
  detail endpoint keeps only the workshop + counts. Requires a coordinated check-in-grid paging
  change and a completion/certificate UI that can act on a page (or keep acting server-side on all).
- **D3 — frontend list pagination.** Wire `page`/`hasMore` into the Work-tier directory (currently
  capped at 100 with no pager).
- **D4 — cursor pagination.** Not needed at workshop volumes; the response has no cursor field and
  offset is bounded. Revisit only if a tenant exceeds a few thousand workshops.
- **D5 — repo-wide `422` alignment** for Zod/request faults (`mms-api-interface` §2). A shared
  handler/taxonomy change, not a workshop-local one.
