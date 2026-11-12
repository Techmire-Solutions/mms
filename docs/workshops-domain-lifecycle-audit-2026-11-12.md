# Workshops Domain & Lifecycle Audit — 2026-11-12

**Companion:** completion engine, capacity/waitlist and facilitator/venue subsystems are audited in
[workshops-subsystems-audit-2026-11-12.md](workshops-subsystems-audit-2026-11-12.md).

**API layer:** routes, serialization contracts and error mapping are audited in
[workshops-api-layer-audit-2026-11-12.md](workshops-api-layer-audit-2026-11-12.md).

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

**Scope:** the Workshops domain layer — use-case orchestration, route/controller boundaries, the
workshop lifecycle, participant-registration invariants, completion/certificate rules, and the
transaction boundaries around every write. Companion to
[workshops-schema-persistence-audit-2026-11-12.md](workshops-schema-persistence-audit-2026-11-12.md),
which covers the tables, indexes and soft-delete tiers.

**Method:** read every workshops use case, repository adapter, route handler and contract, the pure
rules in `@mms/shared`, and the precedents the module is supposed to follow
(`sessionTransitions.ts` / `sessionTransitionService.ts`, `examWriteGuards.ts`,
`SYSTEM_ARCHITECTURE.md` §5). Verified behaviour against real PostgreSQL 16 with new DB suites
(lifecycle, cancellation rollback, OCC race, registration-vs-cancel race) and with the existing
workshop suites (45 DB tests total).

**Verdict.** The *plumbing* was sound — thin ts-rest controllers, a real use-case layer, tenant
transactions, row-locked seat arithmetic — but the module had **no lifecycle at all**: no persisted
status, no transition rules, no cancel/complete action. The rules that did exist were scattered
between SQL conditionals in adapters and date checks in the use case, and one operation
(`evaluateCompletion`) spanned three transactions. All of it is addressed in this change set; the
items that need a new feature (facilitators) or a wider surface (OCC on the edit form) are recorded
as deferred with concrete designs.

## 1. Clean Architecture separation — as-is vs target

`SYSTEM_ARCHITECTURE.md` §5 requires `routes → use-cases → ports → adapters → db/repositories (SQL)`.
The as-is state violated the spirit of that chain in five concrete places:

| # | Finding | Evidence | Resolution |
|---|---|---|---|
| A1 | Participant-registration invariants (deadline, duplicate, capacity) lived in the **persistence adapter** as ad-hoc SQL conditionals — invisible to unit tests and bypassable by any future write path | `workshopParticipantsRepository.registerParticipant` | Rule extracted to `evaluateWorkshopRegistration` (`@mms/shared`) and asserted by `workshops/domain/workshopWriteGuards.ts`; the adapter now only locks/reads/counts and calls the guard |
| A2 | The check-in day-window rule and the capacity-vs-active rule were inline adapter branches | `workshopActivityRepository.saveAttendanceDay`, `workshopEventsRepository.updateWorkshop` | Same pattern: `assertWorkshopActivityEditable` / `assertWorkshopDates` / `assertCapacityAboveActive` |
| A3 | `updateWorkshop` validated merged dates in **transaction A** and wrote in **transaction B** (TOCTOU: two concurrent edits could both pass and leave `endDate < startDate`, surfacing the DB CHECK as a 500) | `workshopsUseCases.updateWorkshop` + `workshopEventsRepository.updateWorkshop` | The pre-read is gone; the adapter locks the row, merges the patch with the stored dates and runs `assertWorkshopDates` **inside** the write transaction |
| A4 | The business clock (`today`) was resolved in one transaction and compared in the next | `addParticipant`: `today()` outside, deadline compare inside `registerParticipant` | `workshopToday()` is resolved **inside** the registration/transition/evaluation transactions (`db/repositories/workshopClock.ts`) |
| A5 | Persistence details leaked upward: `23505 → 409` mapped in the use case, `succeeded === 0 → 404` decided in the route | `workshopsUseCases.createWorkshop`, `workshopsContractRouter.deleteWorkshop` | New `deleteWorkshop` use case throws the 404; registration duplicates now raise a typed `already_registered` conflict in the adapter |
| A6 | The metrics route re-bound a tenant that `authenticateTenant` had already bound | `workshopsRoutes.ts` | Removed; `loadMetrics()` uses the request tenant like every other operation |

Target layering now in force:

```
routes/tenant/workshops/*        transport + authorization only (`guarded`)
workshops/use-cases/*            orchestration; owns the transaction where the operation spans
                                 read → decide → write (transition, evaluation, certificates)
workshops/domain/*               pure write guards → typed domain errors (exam precedent)
@mms/shared/workshops/*          pure lifecycle + completion rules (SSOT, unit-tested)
workshops/repository/*Adapter     re-exports the tx primitives (ports & adapters seam)
db/repositories/workshop*        tenant-scoped SQL; no policy branches
```

Write-only operations that stay adapter-owned (register/withdraw, update, attendance, scores) keep
their transaction in the adapter **because** that is where the row lock lives; the decision itself
is a pure guard call, not a SQL conditional. Multi-step lifecycle operations (transition, completion
evaluation, certificate issuance) are orchestrated by the use cases, which own `withTenant` and use
the tx primitives — the same structure as `sessionTransitionService.ts`.

## 2. Lifecycle state machine

The product vocabulary (Draft, Registration Open, Registration Closed, Ongoing, Completed,
Cancelled, Archived) is larger than the persisted intent, because three of those states are date
facts. The model follows the sessions precedent: **persist the intent, derive the phase**.

| Persisted `status` | Meaning |
|---|---|
| `draft` | being prepared, not registrable |
| `open` | published; registrable until a date/capacity/lifecycle gate closes it |
| `completed` | books closed (terminal; archive via trash) |
| `cancelled` | voided (terminal; archive via trash) |

`archived` is the existing `deleted_at` marker (single source of truth — no second status value).

| Derived phase | Rule |
|---|---|
| `draft` | status draft |
| `registration_open` | open, before start (or dateless), deadline not passed |
| `registration_closed` | open, deadline passed, event not over |
| `ongoing` | open, `start ≤ today ≤ lastDay` |
| `finished` | open, `today > lastDay` (awaiting the completion action) |
| `completed` / `cancelled` | explicit terminal status |
| `archived` | `deleted_at` set (overrides everything) |

**Transition matrix** — `draft → open, cancelled`; `open → draft` (only with zero live
registrations), `open → completed` (only after the last day, and only with a dated workshop),
`open → cancelled` (reason ≥ 3 chars, and no issued certificates); completed/cancelled are terminal.

**Gates introduced:**

- **Registration** (`evaluateWorkshopRegistration`): status must be `open`; `today` must not be past
  the deadline; `today` must not be past the last day; seats must remain. This closes the two holes
  the old code had — registration into a finished workshop with no deadline, and registration after
  a workshop was closed/certified.
- **Structural edits** (`assertWorkshopMutable`): dates, capacity, fee and criteria are read-only
  once the workshop is completed or cancelled.
- **Check-ins/scores** (`assertWorkshopActivityEditable`): blocked on draft and cancelled workshops,
  still allowed on completed ones (post-event corrections stay possible).
- **Withdrawal** (`assertParticipantWithdrawable`): blocked when the workshop is cancelled or the
  participant holds a certificate.
- **Certificates** (`assertCertificatesIssuable`): blocked on cancelled/archived workshops and
  before the last day has passed — this is the "certificate issued on day one" fix.
- **Completion evaluation** is blocked on draft/cancelled workshops and now runs in one locked
  transaction; a certified participant is pinned to `completed`, so a later re-evaluation can no
  longer downgrade issued evidence (the old per-row update could, and the report then disagreed with
  the row).

**Cancellation** is the only transition with side effects: inside the same transaction it archives
every live registration with `deleted_with_cascade = true`, the actor and the reason, emits one
outbox `entity.soft_deleted` per archived registration, and appends the audit row for the workshop
transition. Restoring the workshop does not resurrect cancelled registrations (cancelled is a
deliberate void, not a trash round-trip) — documented and tested.

## 3. Transactional integrity

| Operation | Transaction boundary | Atomic? |
|---|---|---|
| Register participant | one `withTenant`: lock event → duplicate check → seat count → guard → insert → read-back | yes (was already; clock moved in) |
| Withdraw participant | one `withTenant`: lock event → participant read → guard → soft-delete | yes (new: state/certificate guard) |
| Update workshop | one `withTenant`: lock → state/date/capacity guards → update | yes (date validation moved in) |
| Save check-ins / scores | one `withTenant`: lock → state/day guards → sorted upsert | yes |
| Completion evaluation | one `withTenant`: lock → facts read → pure rule → single `UPDATE … FROM VALUES` | **fixed** (was read tx → write tx → read tx) |
| Certificates | one `withTenant`: lock → issuable guard → single conditional `UPDATE` | yes |
| Transition (publish/unpublish/complete/cancel) | one `withTenant`: lock → OCC → guards → CAS status → archive registrations → audit + outbox | new |
| Archive / restore (trash) | one `withTenant` (previous change set) | yes |
| Facilitator assignment | **does not exist** (no table, column, endpoint) | n/a — see deferred D1 |

Post-commit effects are queued with `runAfterCommit`, so a rolled-back transition never broadcasts.
The rollback is proven by a DB test that drives the cancel past its status change and fails the
registration archive (an over-long `deletion_reason` violates `varchar(500)`), then asserts the
status, the registrations and the outbox are untouched.

OCC: `POST /api/workshops/:id/transition` requires `x-expected-updated-at` (428 without it, 400 for
a malformed value) and compares it to the locked row's `updatedAt`; a stale token is `409
stale_workshop`. The status write is also a compare-and-set on the from-status, so two concurrent
transitions cannot both commit.

## 4. Edge cases covered

- Drafts cannot be registered into; publishing makes them registrable.
- Un-publishing a workshop that sold seats is refused (`workshop_has_registrations`).
- A workshop past its last day refuses registration even when no deadline is set.
- A dateless open workshop remains registrable (documented) but can be completed only after an end
  date is added.
- Completing before the last day is refused; completing a terminal state is refused.
- Cancelling with issued certificates is refused; cancelling archives live registrations.
- Certificates cannot be issued before the last day, on a cancelled workshop, or for a trashed one.
- A certified participant cannot be withdrawn; a certified participant's standing is pinned on
  re-evaluation and in the report.
- Registration/evaluation/attendance against an archived workshop → 404 (the row lock filters
  `deleted_at`).
- Concurrent register vs cancel → cancel archives the seat or the registration fails closed; no live
  seat survives.
- Concurrent transitions with the same token → exactly one commits, the other gets
  `409 stale_workshop`.
- Restoring a workshop keeps its previous status; if it is open and past its last day the phase is
  `finished` and registration stays blocked.

## 5. Change set

- **Schema/migration**: `workshop_events.status` (`draft | open | completed | cancelled`, default
  `open` for existing rows) + CHECK, migration `0245_workshops_lifecycle.sql` with journal entry and
  snapshot (hand-authored — `drizzle-kit generate` remains blocked by the 0216/0217 snapshot
  collision).
- **Shared**: `workshops/workshopLifecycle.ts` (states, matrix, phase, registration/transition/date
  evaluators) and `workshops/workshopLifecycleSchemas.ts` (status/phase/create/transition/OCC
  schemas); record schema gains `status` + `phase`; create accepts an optional `draft|open`;
  contract gains `POST /api/workshops/:id/transition` with OCC headers and 409/428 responses.
- **Backend domain**: `workshops/domain/workshopWriteGuards.ts` (typed assertion layer).
- **Backend data**: `db/repositories/workshopClock.ts`, `workshopTransitionRepository.ts`,
  `workshopEvaluationRepository.ts`, plus the adapter re-exports; the four existing workshop
  repositories now call the guards instead of embedding policy.
- **Use cases**: new `workshopLifecycleUseCases.ts`; `updateWorkshop` no longer pre-reads;
  `deleteWorkshop` owns its 404; `evaluateCompletion`/`issueCertificates` own their transactions;
  metrics classify by status.
- **Routes**: transition handler, delete handler simplified, metrics route no longer re-binds the
  tenant.
- **Frontend**: `useTransitionWorkshop` (OCC header), phase badge (Work column + drawer), lifecycle
  actions with confirmations and a required cancellation reason, 27 new i18n keys across
  en/ar/ur/fa.
- **Tests**: 20 shared lifecycle tests, 10 domain-guard tests, a 10-test lifecycle DB suite
  (including the rollback and OCC cases), lifecycle route tests, 6 concurrency tests, FE action and
  badge tests, and static 0245 schema/snapshot assertions.

## 6. Verification

```bash
pnpm --filter mms-backend typecheck        # clean
pnpm --filter @mms/shared typecheck       # clean
pnpm --filter mms-frontend typecheck      # clean
pnpm --filter mms-backend test            # 514 files / 3648 tests
pnpm --filter @mms/shared test            # 280 files / 2255 tests
# workshop DB suites (45 tests) and the concurrency suite repeated 5×: green
pnpm run check:code-norms check:backend-structure check:backend-boundaries check:i18n
bash .agent/skills/mms-soft-delete/scripts/verify-soft-delete-schema.sh
```

## 7. Deferred items

- **D1 — Facilitator assignment.** No table/column/endpoint exists, so the brief's transactional
  requirement is unimplementable today. When it is funded, mirror the enrollment/roster shape:
  `workshop_facilitators (workspace_subdomain, id, workshop_id, faculty_id, role, ...)` with the
  soft-delete sextuple, composite FKs to `workshop_events` and `faculty_employments`, a unique
  `(ws, workshop_id, faculty_id, role)` partial index, plus an assignment endpoint whose use case
  locks the workshop, validates the faculty employment is active, and writes inside one
  `withTenant`.
- **D2 — OCC on `PATCH /api/workshops/:id`.** The edit form is still last-write-wins. The lifecycle
  actions now require a token; extending the same header to the edit form touches the shared
  contract, the form controller and its stale-conflict UI.
- **D3 — Future check-in days.** `saveAttendanceDay` accepts any day inside the workshop window,
  including days that have not happened. Completion already ignores them; a `dayOn ≤ today` guard
  would change the existing check-in UX and fixtures and is left for a product decision.
- **D4 — Terminal recovery.** Completed and cancelled are terminal (sessions' model). Recovery from a
  mistaken completion/cancellation is archive + recreate; a "reopen" transition would need a policy
  for already-issued certificates and archived registrations.
- **D5 — Metrics classification duplication.** `aggregateWorkshopsMetrics` expresses the same
  `open/finished` classification in SQL that `deriveWorkshopPhase` expresses in TypeScript. Both are
  small and covered; consolidating them would mean loading workshops into memory or a generated SQL
  expression.
