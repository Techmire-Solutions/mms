# Workshops Security, Multi-Tenancy & Compliance Audit — 2026-11-12

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

**Scope:** tenant isolation, granular RBAC and audit-trail coverage for the Workshops module: every
repository read/write, both ts-rest routers, the route guard, the module gate, completion/certificate
mutations and the frontend lifecycle actions. Fifth in the series; companions:
[schema](workshops-schema-persistence-audit-2026-11-12.md),
[lifecycle](workshops-domain-lifecycle-audit-2026-11-12.md),
[subsystems](workshops-subsystems-audit-2026-11-12.md),
[API layer](workshops-api-layer-audit-2026-11-12.md).

**Method:** inspected `pg_class`/`pg_policies` on the live DB, every workshop repository query, the
composite FKs from migration `0244`, `withTenant`/`registerModuleAccess`/`guarded`, role defaults and
permission rules, and `recordModernAuditEvent` + the append-only trigger. Verified with new real-DB
suites (cross-tenant, audit coverage) and route tests; the existing 54 workshop DB tests were extended
to 69 and the capacity/waitlist concurrency files were run 5×.

## 1. Verified positives

- **RLS is real:** `workshop_events`, `workshop_participants`, `workshop_attendance`,
  `workshop_scores` and `workshop_module_preferences` all have `relrowsecurity` **and**
  `relforcerowsecurity`, with a `tenant_isolation_policy` on `workspace_subdomain =
  current_setting('app.current_tenant', true)`. Attendance/preferences use `NULLIF(...,'')`.
- **Defence in depth:** every repository query also filters `workspace_subdomain` explicitly (list,
  detail, completion, report, metrics, registration, waitlist, trash, preferences). No
  `allowGlobal`/`app.rls_bypass` call exists in the module.
- **Composite tenant FKs:** participants→events and participants→contacts carry
  `(workspace_subdomain, …)`; attendance/scores→participants carry
  `(workspace_subdomain, participant_id, workshop_id)` (migration 0244). A cross-tenant reference
  cannot be inserted.
- **Audit integrity:** `audit_trail_events` is append-only at the DB
  (`0235_audit_trail_immutability.sql`) with a per-tenant SHA-256 hash chain, subject-key encryption
  for `subjectId` state, and a service-level guard that refuses an append into a tenant other than the
  bound request tenant.
- **Authorization is pre-use-case everywhere:** all 13 contract routes call `guarded`, and every
  route scope is behind `authenticateTenant` + `registerModuleAccess("workshops")`.
- A missing tenant now denies with **403 before any query** instead of entering `runWithTenant("")`.

## 2. Findings and remediation

### Tenant isolation

| # | Sev | Finding | Status |
|---|---|---|---|
| T1 | P1 | No cross-tenant test covered workshops; the generic non-bypass RLS suite tested students/templates only | **Fixed** — `workshopsTenantIsolationDb.integration.test.ts` (same workshop/participant ids in two tenants; reads, writes, completion, report, metrics, preferences, audit guard) and workshop tables added to `rlsEnforcement.db.integration.test.ts` |
| T2 | P2 | `guarded` fell back to `runWithTenant("")` when `request.tenant` was missing, surfacing a generic 500 | **Fixed** — explicit `forbidden` (403) before the callback |
| T3 | P3 | Three RLS policies omit `NULLIF(...,'')` (consistent with fail-closed empty settings; no row matches `''`) | **Deferred D4** — consistency only, no leak |

### Authorization / RBAC

| # | Sev | Finding | Status |
|---|---|---|---|
| R1 | **P1** | **Any `workshops.write` role could cancel or complete a workshop** (teacher/registrar/principal), with no admin gate | **Fixed** — new `workshops.manage` permission; `to: completed|cancelled` now requires it (admin/super_admin automatic, principal default, custom roles grantable). Route test: teacher 403, admin 200, publish still 200 |
| R2 | **P1** | **Facilitator scoping does not exist** — no facilitator table/route/field; any writer can mark attendance/scores/completion/certificates on any workshop | **Deferred D1** with a concrete design (see §5). Residual risk documented; there is nothing to enforce against until the model exists |
| R3 | P1 | No participant/student surface (staff JWT only); "open workshops / my registrations" cannot be expressed | **Deferred D2** (needs student/guardian auth). No leak: no route is exposed |
| R4 | P2 | Read-only staff (`workshops.read`, e.g. assistant teacher) received every participant's `contactPhone` in `GET /:id` and the waitlist | **Fixed** — `contactPhone` is masked to `""` unless the caller can write participants; names remain for operational context. Unit + route tests assert both paths |
| R5 | P3 | Module gate classified `POST /:id/restore` and `/bulk-delete` as `write` while handlers require `delete` (handler still blocked; defence-in-depth gap) | **Fixed** — `MODULE_ROUTE_ACTION_RULES` entries map both to `delete`; teacher restore now 403 at the gate |

### Audit trail

| # | Sev | Finding | Status |
|---|---|---|---|
| A1 | **P1** | Only `transitionWorkshop` and workshop trash audited. Create, update (capacity/dates/criteria/waitlist), participant add/bulk, withdrawal, promotion, cancel-archive, attendance, scores, completion evaluation, certificate issuance and Setup preferences were **unlogged** | **Fixed** — every mutation now appends inside its own transaction (matrix below) |
| A2 | **P1** | `open → completed` finalized participant standings and certificate issuance silently | **Fixed** — per-participant `UPDATE` audit rows with `completion_evaluated` / `certificate_issued` |
| A3 | P2 | Soft-delete audit had `oldState` only; delete/restore state diff incomplete | **Fixed** — delete records the post-delete state; withdrawal/archival record old + new |
| A4 | P2 | No test proved workshop mutations produce audit rows with actor/diffs, or that failures roll them back | **Fixed** — `workshopsAuditDb.integration.test.ts` (9 tests) |

### Compliance

| # | Sev | Finding | Status |
|---|---|---|---|
| C1 | P2 | Participant phone visible to read-only roles | **Fixed** with R4 |
| C2 | P3 | Attendance/score edits had no audit trail | **Fixed** — one summary audit row per day/save (full old/new marks map) |

## 3. Implemented change set

- **Permission model:** `workshops.manage` added to `PERMISSIONS`, `PERMISSION_RULES`
  (`requiredActions:["manage"]`), `WORKSHOPS_MODULE_MANIFEST.permissions.manage`, and the principal
  default role. Admin/super_admin receive it through the full permission map.
- **Routes:** transition rule is target-aware (`completed|cancelled` → manage, publish/unpublish →
  write); `GET /:id` masks contact phones for non-writers; `guarded` denies a missing tenant.
- **Module gate:** restore/bulk-delete rules.
- **Frontend:** `canManage` from `useModulePermissions` threads through the page → work tab → drawer;
  `lifecycleActions(workshop, canManage)` hides Complete/Cancel from writers (Publish/Unpublish
  remain).
- **Audit writes** (`auditRow` helper, same transaction, actor/IP/session/correlation from ALS,
  `subjectId` for participant state so erasure can shred it):

| Mutation | Table / recordId | Action |
|---|---|---|
| Create workshop | `workshop_events` / id | CREATE |
| Update workshop (capacity, dates, criteria, waitlist) | `workshop_events` / id | UPDATE (delta) |
| Add participant (single/bulk) | `workshop_participants` / id | CREATE per row |
| Withdraw participant | `workshop_participants` / id | DELETE (old + deleted state) |
| Waitlist promotion | `workshop_participants` / id | UPDATE (`waitlist_promoted`) |
| Cancel archive | `workshop_participants` / id | DELETE per archived row |
| Evaluate completion | `workshop_participants` / id | UPDATE per changed row (`completion_evaluated`) |
| Issue certificate | `workshop_participants` / id | UPDATE per row (`certificate_issued`) |
| Attendance save | `workshop_attendance` / `workshopId:day` | CREATE/UPDATE summary |
| Scores save | `workshop_scores` / workshop id | CREATE/UPDATE summary |
| Setup preferences | `workshop_module_preferences` / tenant | CREATE/UPDATE |
| Delete/restore workshop | existing trash audit | DELETE/RESTORE (now with post-delete state) |

- **Refactor:** attendance/scores writes moved to `workshopActivityWriteRepository.ts` to keep every
  repository under the 300-line ceiling.

## 4. RBAC matrix (default roles)

| Action | admin/super_admin | principal | registrar | teacher | assistant teacher |
|---|---|---|---|---|---|
| Read workshops/roster/completion/report | ✓ | ✓ | ✓ | ✓ | ✓ (phone masked) |
| Create/update/publish/unpublish | ✓ | ✓ | ✓ | ✓ | — |
| Mark attendance/scores, evaluate | ✓ | ✓ | ✓ | ✓ | — |
| Cancel/complete (`workshops.manage`) | ✓ | ✓ | — | — | — |
| Delete/restore | ✓ | ✓ | — | — | — |
| Setup defaults (`settings.global.write`) | ✓ | — | — | — | — |

Custom roles may be granted `manage` explicitly; all checks resolve through the tenant role catalog.

## 5. Residual risk / deferred

- **D1 — facilitator assignment + per-workshop scoping.** No facilitator model exists. Design:
  `workshop_facilitators(workspace_subdomain, workshop_id, user_id, created_at)` with composite FKs,
  RLS, unique `(ws, workshop_id, user_id)`; `POST/DELETE /:id/facilitators` (admin-only
  `workshops.manage`); a `canFacilitate` capability required by attendance/score/completion/
  certificate/participant-write guards (admin/principal bypass); FE assignment in the workshop drawer.
  Until then **any `workshops.write` role can mark any workshop in the tenant**.
- **D2 — participant/student self-service.** Needs student/guardian authentication and a
  participant-scoped route (`/api/workshops/mine`, open-workshop catalogue). Not implemented; no data
  is exposed to students today.
- **D3 — participant names for read-only staff.** Kept for operational context; only phones are
  masked.
- **D4 — RLS policy `NULLIF` consistency** for `workshop_events`/`participants`/`scores`
  (fail-closed today; no functional leak).

## 6. Verification

```bash
pnpm --filter @mms/shared typecheck && pnpm --filter mms-backend typecheck && pnpm --filter mms-frontend typecheck
pnpm --filter @mms/shared test     # 280 files / 2269 tests
pnpm --filter mms-backend test     # 516 files / 3668 tests
pnpm --filter mms-frontend test    # 1206 files / 4535 passed (2 skipped)
# workshop DB suites: 69 tests (8 files), including the new cross-tenant and audit suites
# capacity + waitlist concurrency files: 19 tests × 5 runs
pnpm run check:code-norms check:backend-structure check:backend-boundaries check:i18n check:migration-indexes
bash .agent/skills/mms-soft-delete/scripts/verify-soft-delete-schema.sh
```

The non-bypass RLS suite (`src/__tests__/rls/`) now covers the workshop tables; it requires a
`NOSUPERUSER NOBYPASSRLS` database role and is executed by the RLS CI lane, not the local
superuser-backed DB run.
