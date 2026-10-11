# Faculty domain implementation plan

## Baseline and architecture decision

The checkout already migrated teachers to faculty through migrations 0112,
0119–0124 and 0130. Migration 0122 removed the compatibility view. Departments
and multi-role assignments were added in 0131 and 0132. Do not recreate the
teachers table or replay a second migration against a nonexistent source.

The requested UUID model differs from the deployed model: workspaces.id and
contacts.id are text, domain keys include workspace_subdomain, and 0076 uses
app.current_tenant. A UUID workspace_id foreign key cannot reference the current
text workspace primary key. Following the instruction to continue, implementation preserves the existing tenant model. The alternatives considered were:

- Harden the existing Faculty domain while preserving its public contracts.
- Introduce the exact UUID model with explicit identity mapping and a staged
  migration of workspace/contact references and all coupled consumers.

This plan was written before schema or service changes. The exact UUID redesign remains outside this implementation.

## Phase 1 — Schema and integrity

1. Inventory Faculty, department, designation, assignment, contact and workspace
   tables, shared DTOs, relations, backup/restore, exports and soft-delete flows.
2. Keep personal data in contacts and its normalized child tables. Faculty stores
   employment attributes; assignments own department/designation/reporting tenure.
3. Enforce tenant-scoped composite foreign keys for contact, department,
   designation, faculty, parent department and reporting assignment references.
   Add a real deferred department-head FK after both tables exist.
4. Add designation soft-delete lifecycle and active code uniqueness. Reconcile
   faculty contact uniqueness and required employment fields with existing data
   before adding constraints; report ambiguous mappings instead of dropping rows.
5. Keep primary assignment overlap enforcement in application transactions.
   Lock the faculty row before checking inclusive date ranges and writing, so
   simultaneous requests cannot create two overlapping primary appointments.
   Serialize reporting-tree mutations and reject cycles or incomplete validation.
6. Export bidirectional relations through the existing relations barrel. Split
   definitions into files under 300 lines and retain faculty.ts as the public entry.
7. Generate forward-only SQL, journal and snapshot together. Apply ENABLE and
   FORCE RLS with USING and WITH CHECK using the chosen tenant context. Preserve
   existing platform bypass semantics only where explicitly intended. Add active
   lookup indexes, trash indexes, hard-delete guards and lock timeouts. Build
   indexes on populated tables through the concurrent-index workflow.

Exact UUID option: stage mapping tables/columns first, backfill validated UUID
identities, migrate references and transaction context, then cut over consumers.
Do not cast arbitrary existing text identifiers to UUID or create a second person
authority. UUID RLS must use NULLIF(current_setting(
'app.current_workspace_id', true), '')::uuid and fail closed when unset.

## Phase 2 — Hierarchy queries and mutation boundaries

1. Execute parameterized recursive CTEs through the tenant transaction helper.
   Read node-postgres results through rows with a typed projection.
2. Seed upward and downward paths with the starting node. Track faculty identity
   as well as assignment identity to detect repeated people across roles.
3. Emit the cycle-closing row with is_cycle=true, then stop recursion from it.
   Validate integer depth limits between 1 and 20; return deterministic ordering.
4. Require an active root and exclude deleted nodes. Define an explicit as-of
   calendar date for current appointments and preserve history via separate
   query semantics. Resolve faculty-level requests through eligible assignments.
5. Validate a proposed parent by walking the parent's ancestors for the child,
   not by looking for the parent in the child's existing ancestor chain. Reject
   truncated validation that cannot establish safety.
6. Route saves through a use-case boundary with permission checks, strict shared
   DTOs, same-transaction audit writes and ownership checks for assignment IDs.

## Phase 3 — Migration and compatibility

1. Reuse the existing teacher-to-faculty migration chain for older installations.
   Document its source and destination instead of restoring teachers.ts.
2. Backfill normalized departments/designations from current faculty text fields
   using deterministic per-tenant mappings and explicit fallback labels.
3. Create initial primary assignments only when none have already been migrated.
   Preserve IDs, contact links, deleted state, employment dates and provenance.
   Quarantine missing/ambiguous dates and contacts for review.
4. Make backfill batches resumable and idempotent; verify source/destination
   counts and references, including archived rows. Backfill reporting links only
   after assignments exist and validate cycles before activating them.
5. Keep existing API adapters through the transition. Cut reads and writes to
   normalized records before removing redundant legacy attributes in a later
   forward migration. Include backup, restore, exports and dependent modules.

## Phase 4 — Verification and rules

1. Unit tests must invoke production use-cases and repository helpers, covering
   inclusive date boundaries, primary/secondary transitions, seniority ordering,
   department cycles, malformed depths and assignment ownership.
2. PostgreSQL tests under vitest.db.config.ts must execute production CTEs on
   dynamic trees: upward/downward ordering, repeated-person cycles, A→B→C→A,
   depth 20, deleted roots/ancestors and overlapping appointments.
3. Exercise RLS with a non-superuser, non-BYPASSRLS role: identical IDs in two
   tenants, unset tenant context, cross-tenant writes/FKs and traversal probes.
   Test concurrent primary saves and hierarchy changes on separate connections.
4. Test migration from legacy fixtures, reruns, rollback on invalid data, and
   contract/API allow-deny behavior. Existing simulation tests are not proof of
   PostgreSQL or RLS correctness.
5. Register Faculty model ownership in canonical mms-data-layer.mdc, with tests
   as enforcement. Regenerate .agent/.claude mirrors via sync-all.sh and run the
   rules integrity verifier.
6. Run pnpm typecheck, backend lint, migration/index/projection gates, pnpm test
   and the complete database suite. Report every failure or unavailable dependency;
   completion requires all requested suites to pass.

## File impact

- apps/backend/src/db/schema/faculty*.ts and relations/academicRelations.ts
- apps/backend/src/db/migrations_drizzle/: new migration, journal and snapshot
- apps/backend/src/db/migrations/: resumable normalized-data backfill
- apps/backend/src/db/repositories/faculty*HierarchyRepository.ts
- apps/backend/src/faculty/use-cases/: assignment lifecycle and validators
- apps/backend/src/routes/tenant/faculty/: thin contract adapters
- packages/shared/src/schemas/faculty.dto.ts and Faculty contracts/types
- apps/backend/src/__tests__/facultyUseCases.test.ts and focused regression tests
- apps/backend/src/__tests__/db-integration/: real Faculty traversal/RLS tests
- .cursor/rules/mms-data-layer.mdc and generated rule mirrors
- UUID option additionally touches workspace/contact schemas, tenant context,
  identity maps and every consumer of changed keys; finalize after selection.

## Research

- [Drizzle foreign keys and self references](https://orm.drizzle.team/docs/indexes-constraints)
  supports typed callbacks or explicit foreignKey declarations.
- [PostgreSQL 16 recursive queries](https://www.postgresql.org/docs/16/queries-with.html)
  describes path-based cycle tracking and stopping recursion after cycle detection.
- GitHub MCP was unavailable at discovery; its installation suggestion was not
  confirmed. Research used the official Drizzle and PostgreSQL documentation.

## Gaps confirmed at initial inspection (subsequently addressed except the UUID redesign)

- Hierarchy queries exclude cycle-closing rows, so isCycle can never be true.
- Hierarchy helpers cast execute results to arrays instead of reading rows.
- checkAssignmentCycleSafe walks the old child's chain rather than the proposed
  parent's chain and therefore checks the wrong direction.
- Existing assignment hierarchy integration-named suites simulate in-memory
  traversal; the database suite currently checks Faculty structural migration.
- Designations lack the requested deleted_at/deleted_by lifecycle.
- Department `headFacultyId` was removed (migration 0138).
- The requested physical UUID schemas and tenant setting are not implemented.

## Delivered implementation and compatibility boundaries

- Migration 0133 adds designation soft-delete metadata, active code uniqueness,
  a deferred composite department-head FK, RESTRICT assignment reporting deletes,
  hard-delete guards and FORCE RLS. The existing tenant policies remain in force.
- `facultyContactIndex.ts` builds active contact uniqueness concurrently after the
  Drizzle transaction. Duplicate active person links fail explicitly; resolve
  duplicates before retrying deployment. An interrupted invalid index is rebuilt.
- Data migration 087 backfills missing appointments per workspace and can be
  replayed. It retains existing assignments and does not remigrate teachers.
  Historical missing join dates use the recorded UTC creation day.
- Traversal uses production PostgreSQL CTEs with assignment and faculty paths,
  emitted cycle rows, a maximum depth of 20, and typed shared response contracts.
  Assignment traversal without an as-of date includes appointment history;
  `findFacultyManagerChain` requires an explicit calendar date.
- Department, designation and assignment mutations share a tenant advisory lock.
  Primary appointment overlap checks and audit writes execute in the write
  transaction. Archival emits transactional outbox events.
- Source files touched by this change stay within 300 lines. Faculty relations
  and the data-migration registry are extracted behind the existing barrels.
- Existing text IDs, workspace_subdomain/app.current_tenant RLS, dynamic employment
  status values, legacy designation history APIs, and compatibility fields remain.
  No UUID workspace/contact conversion or removal of those compatibility fields
  is included. They need a separate consumer cutover before a contract migration.
- The cumulative Drizzle snapshot follows the last historical snapshot (0020);
  intervening committed migrations had no snapshots. Old SQL was not rewritten.
- Verification uses a separate local PostgreSQL database, mms_faculty_verify.
  The application's development data has not been migrated by this task.

## Verification results

| Check | Result |
| --- | --- |
| `pnpm typecheck` | Passed across shared, backend, frontend and e2e types |
| `pnpm test` | Passed: shared 1,331; backend 1,754; frontend 2,950 |
| Full `vitest.db.config.ts` suite | Passed: 17 files, 88 tests on PostgreSQL 16.14 |
| Backend lint | Passed |
| Strict migration/RLS audit | Passed: 147 tenant tables, 134 SQL migrations |
| Migration-index and DB-projection gates | Passed |
| Rules mirror synchronization and integrity | Passed |
| Code-norm ratchet and diff whitespace check | Passed |
| Touched/new source files | All at most 300 lines |

The local pnpm is 11.24.0; verification used `PNPM_CONFIG_PM_ON_FAIL=ignore`
to run it without changing the repository's package-manager pin. The full test
run needed local socket access for the existing WebSocket tests. Browser E2E
execution was not part of this backend change's verification.

## Deliverables in requested order

1. Implementation plan: this document.
2. Schema and exports: `apps/backend/src/db/schema/faculty.ts`,
   `facultyDepartmentTables.ts`, `facultyDesignationTables.ts`,
   `facultyAssignmentTables.ts`, and `relations/facultyRelations.ts`.
3. DDL/RLS: `apps/backend/src/db/migrations_drizzle/0133_faculty_integrity.sql`,
   journal and cumulative snapshot; concurrent index helper
   `apps/backend/src/db/migrations/facultyContactIndex.ts`; resumable data backfill
   `087_backfill_faculty_assignments.ts` and `facultyReportingBackfill.ts`.
4. Recursive SQL: `apps/backend/src/db/repositories/facultyHierarchySql.ts`,
   `facultyAssignmentHierarchyRepository.ts` and `facultyDepartmentHierarchyRepository.ts`.
5. Tests: production validator tests, shared assignment contracts, actual API
   `inject()` tests, and three PostgreSQL suites for hierarchy/RLS, appointments,
   and legacy backfill. See `facultyAssignmentValidation.test.ts`,
   `facultyAssignmentsApi.integration.test.ts`, and
   `apps/backend/src/__tests__/db-integration/faculty*Db.integration.test.ts`.
