# Workshops Schema & Persistence Audit — 2026-11-12

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

**Scope:** the Workshops persistence layer — Drizzle table definitions, every migration that
touches `workshop_*` (0082 → 0203), foreign keys and cascade rules, the active/trash index tiers,
seat-capacity concurrency, soft-delete trigger coverage, and the repositories/use-cases under
`apps/backend/src/db/repositories/workshop*` and `apps/backend/src/workshops/`.

**Companion:** the domain/lifecycle review is
[workshops-domain-lifecycle-audit-2026-11-12.md](workshops-domain-lifecycle-audit-2026-11-12.md)
(use-case boundaries, the lifecycle state machine added by migration `0245`, registration gates and
transaction atomicity). The specialized completion/capacity/waitlist/venue subsystems are in
[workshops-subsystems-audit-2026-11-12.md](workshops-subsystems-audit-2026-11-12.md).

**Method:** read the schema, all workshop migrations, the `0243` cumulative Drizzle snapshot, both
repositories, the use-cases, the ts-rest contract, the guards (`forbid_hard_delete`,
`guardContactSoftDeleteDependents`, `scripts/check-migration-indexes.mjs`,
`.agent/skills/mms-soft-delete/scripts/verify-soft-delete-schema.sh`), and verified the DDL against
a real PostgreSQL 16 instance (constraint validation state, index definitions, trigger list).
PostgreSQL semantics that matter here: partial-index inference from `WHERE … AND deleted_at IS
NULL`, `SELECT … FOR UPDATE` as a mutex at READ COMMITTED, `ON CONFLICT DO UPDATE` locking rows in
statement order, and `NOT VALID` + `VALIDATE CONSTRAINT` as the safe way to add a constraint to a
table that may hold legacy rows.

**Overall finding:** the *shape* is sound — composite tenant keys everywhere, FORCE RLS on all five
tables, a partial unique index on the right business key, correct `FOR UPDATE` seat serialization,
and the full three-tier soft-delete index set on both soft-deletable tables. The defects sat in the
**seams**: a hard `DELETE` on a table that carries a hard-delete guard, two multi-row upserts that
crash or deadlock on duplicate/out-of-order payloads, a capacity edit that could silently
over-subscribe, child rows that leaked past a withdrawn participant, no CDC/audit on trash, and a
missing active-list index. All of them are fixed in this change set; the deferred items are listed
at the end.

## Brief → code mapping

The request named several objects that do not exist in this schema. The real names and the
consequences:

| Brief | Actual | Note |
|---|---|---|
| `workshops` | `workshop_events` | one table for the workshop/event |
| `workshop_slots` | **does not exist** | no per-session slot/time table |
| `workshop_facilitators` | **does not exist** | no facilitator/staff link; `workshop_events` has no `facilitator_id` |
| `rooms` | **does not exist** | sessions keep `room varchar(100)` (`sessionSections.ts`), not a rooms entity |
| academic sessions | **no FK** | `workshop_events` has no `session_id`; workshops are not term-scoped |
| `students` / `faculty` | **no FK** | participants link to `contacts` only — staff and external attendees are both contacts |
| `tenant_id` | `workspace_subdomain` | composite tenant key + FORCE RLS; every FK is tenant-composite |
| `(tenant, workshop, participant)` unique | `(workspace_subdomain, workshop_id, contact_id) WHERE deleted_at IS NULL` | the **person** is the key, not the participant surrogate id — keying on `participant_id` would permit the same contact twice |
| `(tenant, status, start_date, end_date, deleted_at)` index | **impossible** | `workshop_events` has **no `status` column**; lifecycle is derived from dates (`start/end/deadline`) + `deleted_at` |
| `occWritesDb` | **no such module** | it is a test file (`apps/backend/src/__tests__/db-integration/occWritesDb.integration.test.ts`). The repo's OCC patterns are `x-expected-updated-at` (students/contacts/faculty) and `version int` (attendance). Workshops uses neither — see deferred item D1 |

## Foreign keys and cascade rules

All foreign keys are tenant-composite, so a cross-tenant reference is impossible even with RLS
bypassed.

| Child | Parent | On delete | Rationale |
|---|---|---|---|
| `workshop_events.workspace_subdomain` | `workspaces.subdomain` | CASCADE | tenant teardown |
| `workshop_events (ws, program_id)` | `programs (ws, id)` | RESTRICT | catalog row; soft-delete of a program is an UPDATE and is caught by the write-path guard (F15) |
| `workshop_events (ws, subject_id)` | `subjects (ws, id)` | RESTRICT | same |
| `workshop_participants (ws, workshop_id)` | `workshop_events` | CASCADE | a registration cannot outlive its workshop |
| `workshop_participants (ws, contact_id)` | `contacts` | CASCADE | purge of a person removes their registrations |
| `workshop_attendance (ws, workshop_id)` | `workshop_events` | CASCADE | check-ins die with the workshop |
| `workshop_attendance (ws, participant_id, workshop_id)` | `workshop_participants (ws, id, workshop_id)` | CASCADE | **new** — a mark can only name a participant of the *same* workshop (F9) |
| `workshop_scores (ws, workshop_id)` | `workshop_events` | CASCADE | |
| `workshop_scores (ws, participant_id, workshop_id)` | `workshop_participants (ws, id, workshop_id)` | CASCADE | **new**, same reason |
| `workshop_module_preferences.workspace_subdomain` | `workspaces.subdomain` | CASCADE | one row per workspace |

`workshop_attendance` / `workshop_scores` carry **no `deleted_at`**: they are append-only child rows
of an immutable mark, not independently archivable entities. Their lifetime is the FK cascade (or
the workspace purge, which sets `app.allow_hard_purge`). They have no delete path in the application.

## Index inventory

### `workshop_events`

| Index | Columns | Predicate | Role |
|---|---|---|---|
| PK | `workspace_subdomain, id` | — | identity + tenant |
| `workshop_events_workspace_start_date_idx` | ws, `start_date` | — | legacy date ordering (includes archived rows) |
| `workshop_events_workspace_active_dates_idx` | ws, `start_date`, `end_date` | `deleted_at is null` | **new** — Work list ordering + metrics/report scans; index-only for the date comparisons |
| `workshop_events_program_idx` | ws, `program_id` | `program_id IS NOT NULL` | FK lookup |
| `workshop_events_subject_idx` | ws, `subject_id` | `subject_id IS NOT NULL` | FK lookup |
| `workshop_events_workspace_deleted_idx` | ws, `deleted_at` | — | Category A (trash scan) |
| `workshop_events_workspace_active_idx` | ws | `deleted_at is null` | Category B |
| `workshop_events_deleted_records_idx` | ws, `deleted_at` | `deleted_at is not null` | Category C |

### `workshop_participants`

| Index | Columns | Predicate | Role |
|---|---|---|---|
| PK | ws, `id` | — | |
| `workshop_participants_contact_uidx` | ws, `workshop_id`, `contact_id` | `deleted_at is null` | **the integrity index** — one live seat per person per workshop; also serves capacity counts and `ON CONFLICT` for nothing (registration is an insert) |
| `workshop_participants_workshop_scoped_uidx` | ws, `id`, `workshop_id` | — | **new** — FK target for the composite child FKs (logically implied by the PK, required by PostgreSQL) |
| `workshop_participants_workspace_workshop_idx` | ws, `workshop_id` | — | roster reads / FK |
| `workshop_participants_workspace_contact_idx` | ws, `contact_id` | — | contact merge re-point + delete guard |
| Category A / B / C | ws + `deleted_at` variants | | trash tiers |

### `workshop_attendance`

| Index | Columns | Predicate | Role |
|---|---|---|---|
| PK | ws, `id` | — | `id` is `participantId:dayOn` (stable, idempotent save) |
| `workshop_attendance_participant_day_uidx` | ws, `participant_id`, `day_on` | — | **the upsert arbiter** — one mark per participant per day |
| `workshop_attendance_workshop_day_idx` | ws, `workshop_id`, `day_on` | — | roster grid / completion read |

### `workshop_scores`

| Index | Columns | Predicate | Role |
|---|---|---|---|
| PK | ws, `id` | — | |
| `workshop_scores_participant_criterion_uidx` | ws, `participant_id`, `criterion_name` | — | **the upsert arbiter** — one score per criterion |
| `workshop_scores_workspace_workshop_idx` | ws, `workshop_id` | — | report/completion read |
| `workshop_scores_workspace_participant_idx` | ws, `participant_id` | — | FK + per-participant read |

## Seat capacity concurrency

**What was right.** Registration locks the workshop row (`findWorkshopRow(…, { forUpdate: true })`)
and only then counts active participants and inserts, all in one transaction. At the default READ
COMMITTED each statement takes a fresh snapshot, so the count *after* the lock sees every committed
registration. Two registrations for the same workshop therefore serialize; the partial unique index
is the backstop and `23505` maps to `409`. This is the correct pattern and is kept.

**What was missing.**

1. **Capacity edits were not serialized with registrations.** `updateWorkshop` ran a plain `UPDATE`
   with no lock and no comparison to the live seat count, so an administrator could lower the cap
   below the registrations already taken (and could do so while registrations were in flight). The
   edit now takes the same `FOR UPDATE` lock, counts active participants, and refuses with `409`
   when `capacity < active` (`F4`).
2. **Trash/restore and check-in writes did not take the lock.** A registration or a check-in could
   commit after the workshop was archived (the FK still validates because the parent row physically
   exists). `softDeleteWorkshops`, `restoreWorkshop`, `saveAttendanceDay` and `saveScores` now take
   the same event-row lock, which gives one lock order (`event → children`) and closes the
   orphan-child window (`F6`).
3. **The capacity count materialized the whole roster twice** per registration (with a correlated
   phone subquery per row). It is now a `count(*)` plus one indexed row fetch for the response
   (`F14`).

**Rejected alternative:** a denormalized `registered_count` column on `workshop_events` with a
`CHECK (registered_count <= capacity)`. It needs a dual-write on every insert/withdraw/restore and
drifts on purge/cascade; the row lock is correct and cheap for a module whose writes are
human-paced. Documented here so it is not re-litigated.

## Soft-delete and trigger coverage

| Table | Sextuple | `forbid_hard_delete` | Category A/B/C | RLS |
|---|---|---|---|---|
| `workshop_events` | yes | yes (0178) | yes | FORCE + tenant policy |
| `workshop_participants` | yes | yes (0178) | yes | FORCE + tenant policy |
| `workshop_attendance` | no (append-only child) | no (see note) | n/a | FORCE + tenant policy |
| `workshop_scores` | no (append-only child) | no (see note) | n/a | FORCE + tenant policy |
| `workshop_module_preferences` | n/a (per-workspace row) | n/a | n/a | FORCE + tenant policy |

The guard was doing its job — and that is what exposed **F1**: `reparentContactReferences` deduped
two registrations for the same workshop with a hard `DELETE`, which the trigger rejects with
SQLSTATE `23514` (unmapped → 500). The merge now archives the losing duplicate instead
(`deleted_at`, `deleted_by`, `deletion_reason = 'Merged into <id>'`), preserving history and needing
no privilege escalation. `workshop_attendance` / `workshop_scores` are deliberately outside the
sextuple: no application path deletes them, and their only removal is the FK cascade/purge.

## Findings and resolution

Severity: **P0** broken behaviour, **P1** invariant breach / crash under load, **P2** hardening,
**P3** parity.

| # | Sev | Finding | Resolution |
|---|---|---|---|
| F1 | P0 | Contact merge hit `23514` when both contacts held a registration for the same workshop (hard `DELETE` vs the 0178 trigger) | Merge dedupe is now a soft-delete with provenance; regression test in `contactsMergeDb` |
| F2 | P0 | A repeated participant (or participant+criterion) in one save raised `21000` → 500 | `workshopUpsertPlanning.ts` dedupes by business key (last wins) |
| F3 | P0 | Two staff saving the same roster in different orders could deadlock (`40P01`) on `ON CONFLICT` row locks | Same planner sorts by business key before the insert |
| F4 | P0 | Capacity could be lowered below the active registrations, and raced registration | `updateWorkshop` locks, counts, and returns `409`; contract documents `409` |
| F5 | P1 | Withdrawn participants' check-ins and scores were still returned in the workshop detail | Both readers inner-join active participants |
| F6 | P1 | Trash/check-in races could leave children under an archived workshop | Event-row `FOR UPDATE` in trash, restore, check-in and score writes |
| F7 | P1 | Trash/restore emitted no CDC outbox event and no audit row | `workshopEventsTrash.ts` emits `entity.soft_deleted` / `entity.restored` + audit in the same transaction |
| F8 | P1 | Archiving a contact left active registrations pointing at an archived person (seat silently held, name still rendered) | Restrict Guard `409` in `studentDeleteGuard.ts`; contact join filters `deleted_at` |
| F9 | P1 | A mark could name a participant of a different workshop (`workshop_id` and `participant_id` were independent) | Composite `(ws, participant_id, workshop_id)` FKs + one-time repair (0244) |
| F10 | P1 | No active-list/metrics index; the planner scanned archived rows or sorted | `workshop_events_workspace_active_dates_idx` (0244) |
| F11 | P1 | `ORDER BY start_date` had no tiebreaker → unstable pagination for same-day workshops | `orderByFor` appends `id asc` |
| F12 | P1 | `evaluateCompletion` read the roster from the replica and then persisted the derived status | `loadCompletionInputs({ consistent: true })` on the write path |
| F13 | P2 | No OCC on `PATCH /api/workshops/:id` (stale editor overwrites dates/capacity) | Deferred (D1); F4 removes the dangerous overlap |
| F14 | P2 | Seat check materialized the full roster twice per registration | `count(*)` + single-row read-back |
| F15 | P2 | A workshop could reference an archived program/subject (RESTRICT only covers hard deletes) | `requireActiveCatalogRefs` with `FOR SHARE` |
| F16 | P2 | `registration_deadline` was only validated in Zod, not in the database | `workshop_events_deadline_check` (NOT VALID → validated) |
| F17 | P3 | Soft-delete audit script did not know about `workshops.ts`; `'attended'` status is never produced; manifest `captureDeletionReason: false` while the route persists a reason | Script list extended; the rest recorded as informational |
| F18 | P3 | No seat-capacity concurrency coverage; module absent from the repeated concurrency suite | `workshopsCapacityConcurrencyDb` + suite registration |

## Change set

- **Migration** `0244_workshops_integrity.sql` (+ journal entry, + `0244` snapshot). Hand-authored
  by exception: `drizzle-kit generate` aborts on a pre-existing snapshot collision
  (`0216`/`0217` point at the same parent) and reports several `meta/*_snapshot.json` files as
  malformed. The snapshot was derived from `0243` with the same definitions.
- **Schema** `apps/backend/src/db/schema/workshops.ts` (+ `workshopActivityTables.ts`, split for the
  300-line band) — new index, all CHECKs mirrored from raw SQL, scoped unique index, 3-column child
  FKs, lowercase partial-index predicates. The platform ERD domain registry includes both modules.
- **Repositories** `workshopEventListQuery.ts` (new), `workshopUpsertPlanning.ts` (new),
  `workshopEventsTrash.ts` (new), `workshopCatalogGuard.ts` (new), `workshopEventsRepository.ts`,
  `workshopParticipantsRepository.ts`, `workshopActivityRepository.ts`,
  `workshopCompletionRepository.ts`, `contactRepositoryDuplicateReparent.ts`, `studentDeleteGuard.ts`.
- **Use-case / port / contract** `workshopsCompletionUseCases.ts`, `workshopsRepository.ts`,
  `packages/shared/src/contracts/workshops.contract.ts`.
- **Tests** `workshopsUpsertPlan.test.ts`, `workshopsSchema.test.ts`,
  `workshopsCapacityConcurrencyDb.integration.test.ts` (registered in
  `scripts/ci/run-concurrency-suite.mjs`), plus additions to `workshopsDb.integration.test.ts` and
  `contactsMergeDb.integration.test.ts`.
- **Standards/docs** soft-delete auditor now checks `workshops.ts`; this document;
  `docs/soft-delete.md` §2.9.

## Verification (run for this change set)

```bash
pnpm --filter mms-backend typecheck                       # clean
pnpm --filter @mms/shared typecheck                       # clean
pnpm --filter mms-backend exec vitest run \
  src/__tests__/workshopsUpsertPlan.test.ts \
  src/__tests__/workshopsSchema.test.ts \
  src/__tests__/contactRepositoryDuplicates.test.ts       # 19 passed
pnpm --filter mms-backend exec vitest run --config vitest.db.config.ts \
  src/__tests__/db-integration/workshopsDb.integration.test.ts \
  src/__tests__/db-integration/workshopsCompletionDb.integration.test.ts \
  src/__tests__/db-integration/contactsMergeDb.integration.test.ts   # 29 passed
# capacity concurrency, repeated 5×: 4 passed each run
bash .agent/skills/mms-soft-delete/scripts/verify-soft-delete-schema.sh   # passes
```

Post-migration database state (local PostgreSQL 16): `workshop_events_workspace_active_dates_idx`
present with `WHERE (deleted_at IS NULL)`; `workshop_events_deadline_check`,
`workshop_attendance_participant_fk` and `workshop_scores_participant_fk` present and
`convalidated = true`; the pre-0244 two-column participant FK on `workshop_scores` is gone; both
`forbid_hard_delete` triggers still attached.

## Deferred / open items

- **D1 — OCC on workshop edits.** `PATCH /api/workshops/:id` is last-write-wins. Adding
  `x-expected-updated-at` (400/409 contract entries, FE stale-conflict UX) is a separate change set
  touching the form modal; the capacity guard above closes the only data-loss-adjacent overlap.
- **D2 — migration 0203 operational check.** `0203` performs the same hard `DELETE FROM
  workshop_participants` dedupe that F1 fixed at runtime. If it has already applied everywhere,
  nothing to do; if it is pending in an environment that holds duplicate registrations, it will abort
  on the trigger. Query `drizzle.__drizzle_migrations`, and if it is unapplied, run it with
  `app.allow_hard_purge = 'true'` for that session (documented forward-only exception).
- **D3 — `'attended'` participant status** is accepted by the CHECK and the shared union but nothing
  ever writes it; completion writes `'completed'`. Either derive it from check-ins or drop it.
- **D4 — no Drizzle `relations()` for workshop tables.** The repositories use explicit joins, so
  nothing is broken; relations are a parity item only.
- **D5 — rooms / facilitators / academic-session linkage.** Product gaps, not schema defects. Each
  needs a product decision (and a table) before any FK work.
- **D6 — workshop retention.** `purgeExpiredArchivedRecords` does not include workshop tables
  (`retentionDays: null` in the manifest), so archived workshops are never hard-purged. Intentional
  today; revisit with the retention policy.
