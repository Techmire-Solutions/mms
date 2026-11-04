# MMS Faculty Module Review — 2026-11-04 (Round 2)

Independent review of the Faculty module at `main` HEAD `60245210a` (tree clean at review time). Round 2
re-reviews the module closed by #276 (`44871c86c`): the §3 table verifies those fixes, the rest audits
surfaces no earlier round reached.

Scope: `apps/backend/src/routes/tenant/faculty/**`, `apps/backend/src/faculty/**`,
`apps/backend/src/db/repositories/faculty*`, `apps/backend/src/db/schema/faculty*.ts`,
`packages/shared/src/faculty/**`, `packages/shared/src/schemas/faculty*.ts`,
`packages/shared/src/contracts/faculty*.ts`, `apps/frontend/src/tenant/features/faculty/**` (~200 files),
the faculty manifest / route registration / module-access table, and the faculty DB + integration specs.

Method: `read`/`grep`/`glob`, `git show 44871c86c`, `git log 44871c86c..HEAD`, a read-only i18n parity
script, and the module-access coverage table. Every "broken" claim was re-proven on the path production
runs (route → guard → use case → repository/SQL); unproven concerns are **hypothesis**, missing coverage
**untested**. No DB or browser run was performed. `git log --oneline 44871c86c..HEAD -- <faculty paths>`
returns **no commits**: the only later commit is #277 (messaging), whose rule edits are messaging-scoped
(`onlyModules`/`exceptModules: ["messaging"]`) and whose translation additions leave `faculty.*` parity
intact — no faculty regression from #277.

## 1. Baseline evidence

| Gate | Result |
|---|---|
| Structural gates | `typecheck` (4 workspaces), `code-norms`, `work-directory`, `db-projections`, `frontend-structure`, `backend-boundaries`, `faculty-domain` — all green |
| Route/module gates | `moduleAccessCoverage` 1/1 · `routeAccess` 11/11 |

These gates prove the tree builds and the structural ratchets hold; they do not exercise §4. The audit was
**static** — no database, no browser/E2E, no `inject()` request — so #276's "faculty a11y + responsive +
ops-flow e2e" claim remains **untested**: no faculty e2e spec exists (§6).

## 2. Verdict

**Not ready to close.** #276 fixed what it named, but three structural problems survive:

1. **Role escalation on save.** Every faculty write re-derives the linked user's RBAC role from the
   designation's `assignableRoles` with no actor check; a `teacher` (default role holds `faculty.update`)
   can take a mapped role, and demoting a linked admin needs no configuration.
2. **Dead session guard.** Both soft-deleted-faculty session probes pass `user.id` where `faculty.id` is
   required, so the lookup can never match and the guard never fires.
3. **Module-action mismatch.** No faculty delete/restore route is classified `delete`; `faculty.delete`
   alone is unusable while `faculty.write` is silently required, and no expectation pins it.

Secondary: subordinate reassignment is a no-op stub returning 200; CSV import bypasses the implicit-restore
delete gate; "workspace-local day" is the server's day; the Work workload pill and class-count column have
no server producer; person-level reporting is client-stripped while its validator survives only in tests.
Block on **C1**; **C2**, **C3**, **M2**, **M6** belong in the same change set (§9).

## 3. #276 fix verification

| # | Item | Holds? | Evidence |
|---|---|---|---|
| A1 | Batched CSV import: single reconcile + broadcast, batched employee-id lookup, recorded failures | **Holds** | `facultyImportJobUseCases.ts:66-68` one `findFacultyIdsByEmployeeIds`; `:69` collector; `:117-124` one reconcile + one broadcast; `:104-111` failures capped at 5; deferral `facultyWriteUseCases.ts:145-151,154` |
| A2 | Session revocation by resolved user id | **Holds** | `facultySoftDeleteSessions.ts:26-36` resolves `userIds` from `members[].userId` + `tenant_users` contact match, then revokes per user id |
| A3 | Log every swallowed catch | **Partial** | Holds: `facultySoftDeleteSessions.ts:38-44`, `facultyDepartmentRouteHandlers.ts:128`. Fails: `facultyDesignationRouteHandlers.ts:70-75,104-109,151-158`, `facultyDepartmentRouteHandlers.ts:67-72,94-99` (no log; non-conflict errors → 400) |
| A4 | Assignment error mapping 400/404/409/500 | **Partial** | `facultyAssignmentRouteHandlers.ts:55-71` used `:155,:198`; `handleDeleteAssignment` `:232-238` returns unconditional 500 |
| A5 | `updated_by` on bulk status | **Holds** | `facultyBulkRouteHandlers.ts:25` → `facultyUseCases.ts:64-65` → `facultyOperationUseCases.ts:39-41` → `facultyRepositoryListOps.ts:48-52` |
| A6 | Workspace-local day for appointments | **Partial — server-local** | `facultyWriteHelpers.ts:27` `todayISO()`; `dateFormatIsoUtils.ts:4-13` reads the process TZ; no `loadWorkspaceRow().timezone` |
| A7 | Deduped `/api/v1/tenant/faculty` reads | **Holds** | `routes/tenant/faculty.ts:50-67` both aliases delegate to the canonical handlers |
| A8 | Declared 400 / 409 | **Holds** (hierarchyTree) | `faculty.contract.ts:93-105`; handler 409 `facultyDesignationRouteHandlers.ts:106-107` (declaration not re-read → §10.7) |
| A9 | Department-delete failure logging | **Holds** | `facultyDepartmentRouteHandlers.ts:118-136` logs on the fallthrough |
| A10 | No DB exclusion constraint (skill) | **Holds** | `SKILL.md:35-39`; `facultyAssignmentTables.ts:76-83` has only the date-range check + FKs |

## 4. Findings detail

### C1 — Critical — Faculty save rewrites the linked user's RBAC role

**Evidence.** `facultyRepository.ts:120-126` runs `syncFacultyLinkedUserRole(subdomain, member)` after every
save (`:136-140` per item in `bulkSaveFaculty`). `facultyLinkedUserRoleSync.ts:78-117` overwrites the role —
`if (isSuperAdminRole(linked.role)) return …` then `upsertTenantUserRow({ ...linked, role: nextRole,
roleSource })` + `invalidateTenantRbac`. Only super admin is forbidden as a source
(`userRolePrivilege.ts:12-15`), so `"admin"` is a legal `assignableRoles` value
(`facultyDesignationTypes.ts:33-35`); default `teacher` holds `faculty: ["read", "update"]`
(`userRbacDefaultRoles.ts:99`), `designationId` is client-writable (`faculty.dto.ts:99`), and
`facultyWriteGuards.ts:117-121` only checks the designation is live.
**Production path / consequence.** `PUT /api/faculty/:id` → `facultyMutationRouteHandlers.ts:108` (write
only) → `updateFacultyById` (`facultyWriteUseCases.ts:158-195`) → `repo.save` → role rewrite +
`invalidateTenantRbac`; `authenticate.ts:161-163` applies the matrix role on the next request. A
teacher/principal (no `users.manage`) can point their record at the designation mapped to `admin` and
become admin; with no mapping, editing a record linked to an admin still overwrites that admin's role — a
lockout reachable with only `faculty.write`.
**Proposed fix.** Authorize the role write against the actor (require `users.manage` for roles the actor
could not grant), widen the carve-out to `isAdminRole`, move the sync inside the transaction, log instead
of 500 after a persisted write; test teacher-PUT-self against an admin-mapped designation → 403.

### C2 — Major — Session guards compare a user id to a faculty id

**Evidence.** `authenticate.ts:164-171`:
`if (user.role === "faculty" || user.role === "teacher") { … facultyRepository.findById(tenant, String(user.id)) … }`;
the same defect in `authSessionRoutes.ts:108-116` (`isFacultyProfileDeleted(String(user.id))`) →
`facultyLoadEntityUseCases.ts:101-109` → `facultyRepository.ts:55-68` `eq(faculty.id, id)` — the **faculty**
key, while faculty ids are `fac-<uuid>` (`facultyNormalizeUseCases.ts:12-20`) and user ids are unrelated.
The documented intent is at `facultyLoadEntityUseCases.ts:94-100`.
**Production path / consequence.** Every authenticated request (`authenticateTenant`) and `GET /api/auth/me`.
The "soft-deleted accounts must not retain sessions" defense (`mms-auth-security.md` §1) is absent; if
`revokeFacultySessions` fails (caught + logged only, `facultySoftDeleteSessions.ts:38-44`) nothing revokes
access, and the role-name gate skips custom `faculty_ed_*` roles entirely.
**Proposed fix.** `findByUserId(tenant, userId)` in both places, drop the role-name gate, add an `inject()`
test (soft-delete a linked faculty → 401 on `/auth/me` and a module route).

### C3 — Major — Faculty delete/restore routes resolve a `write` module action

**Evidence.** `moduleRouteActions.ts:22-43` maps delete/restore **only for students**
(`onlyModules: ["students"]`), so faculty falls to `return mutating ? "write" : "read"` (`:149`).
`moduleAccessCoverage.test.ts:314-328` `EXPECTED_MODULE_ROUTE_ACTIONS` has **no faculty key**. Handlers
require delete: `facultyMutationRouteHandlers.ts:178`; `facultySoftDeleteRoutes.ts:14,29`;
`facultyAssignmentRouteHandlers.ts:209-213`; `facultyDesignationRouteHandlers.ts:138`,
`facultyDepartmentRouteHandlers.ts:108` (`canArchiveFacultySetup`). The gate maps `write → faculty.write`
(`moduleAccessPolicy.ts`; `facultyModuleManifest.ts:177-185`).
**Production path / consequence.** `moduleAccessGuard` runs before every `/api/faculty`,
`/api/tenant/faculty`, `/api/v1/tenant/faculty` delete/restore handler (`faculty.ts:25,43-45`). Effective
requirement is **`faculty.write` AND `faculty.delete`**: a role with `faculty.delete` but no `update`
(arbitrary action arrays, `usersModuleSettings.ts:17`) sees the trash UI, passes `canDeleteCollection`, then
gets `403 {type:"forbidden",code:"PERMISSION_DENIED"}` — the class the students rules fixed in #276.
Direction is safe (handlers stay stricter), so this is a permission-model defect, not an escalation.
**Proposed fix.** Mirror the students rules for `DELETE …/faculty/:id`, `POST …/:id/restore`,
`/bulk-delete`, `/bulk-restore`, `DELETE …/assignments/:id`, designation/department delete+restore; pin each
in `EXPECTED_MODULE_ROUTE_ACTIONS` for all three prefixes.

### M1 — Major — `reassignSubordinatesTo` is accepted, returns 200, and does nothing

**Evidence.** `facultyRepositorySubordinateCounts.ts:71-84`: "reassignment is a no-op" with
`const execute = async (_tx) => 0;`. `facultySoftDeleteGuards.ts:26-42` accepts the target, verifies it,
calls `repo.reassignSubordinates(…)` and continues without checking the count; the contract advertises the
field (`faculty.contract.ts:73-77`) and the guard runs inside the delete transaction
(`facultySoftDeleteUseCases.ts:36`).
**Production path / consequence.** `DELETE /api/faculty/:id {reassignSubordinatesTo}` →
`softDeleteFacultyById` → `guardSubordinatesOnDelete` → no-op → delete. It returns 200 and audits a delete,
but no link changes; subordinates (counted via `faculty_designations.parent_designation_id`, `:46-60`) lose
their resolvable supervisor because `findDirectSupervisorsBatch` joins `sf.deleted_at IS NULL`. Without the
parameter the delete is a hard 409 (`facultySoftDeleteGuards.ts:38-41`) — the only "successful" path is the
silent one.
**Proposed fix.** Implement the reassignment under `lockFacultyHierarchy` and assert the affected count, or
return a typed 409/501 and remove the field from the contract + UI.

### M2 — Major — CSV import bypasses the implicit-restore delete guard

**Evidence.** Single-record guard: `facultyWriteUseCases.ts:115-117`
`if (archived && options.canRestore === false) throw new FacultyPermissionError();`, fed by
`facultyMutationRouteHandlers.ts:46-48` (`canDeleteCollection`). The import job never sets it —
`facultyImportJobUseCases.ts:97` `createFaculty({ id: randomUUID(), contactId, ...patch }, { batch })` — so
the archived row is merged and un-deleted (`facultyWriteUseCases.ts:125-140`); import is gated only by
`canWriteCollection` (`facultyImportRoutes.ts:18`).
**Production path / consequence.** `POST /api/faculty/import` → background job → `runFacultyMembersImportJob`.
A `faculty.write`-only role can resurrect a soft-deleted faculty profile (returning its data/linkage to
Work/Reports) without `faculty.delete`.
**Proposed fix.** Resolve `canRestore` inside the job from its actor's grants (payload carries `viewerRole`,
`facultyImportRoutes.ts:40`), pass `{ batch, canRestore }`, and test an archived `contactId`.

### M3 — Major — "Workspace-local day" is the server process day

**Evidence.** `facultyWriteHelpers.ts:22-33` claims the workspace day, then calls `todayISO()`
(`dateFormatIsoUtils.ts:4-13`, process TZ). Neither `syncPrimaryAppointment`
(`facultyWriteHelpers.ts:41-88`), `closeAssignment` (`facultyAssignmentWriteRepository.ts:46-77`) nor the
overlap predicate (`facultyAssignmentValidation.ts:45-54`) consults the workspace timezone.
**Consequence.** On a UTC server with an Asia/Karachi workspace, appointments opened/closed 00:00–05:00 local
are stamped a day early: `closeAssignment(shiftIsoDate(today,-1))` leaves a one-day gap or overlap and the
single-primary check runs against the wrong day (`mms-data-layer.md` §8.3/§9.5).
**Proposed fix.** `loadWorkspaceRow(tenant).timezone` (UTC fallback) → format "today" in that zone, thread
it through both helpers; test a frozen 23:30 UTC clock asserting +05 gets tomorrow.

### M4 — Major — Workload pill and class-count column have no data producer

**Evidence.** `FacultyWorkloadPill.tsx:23-27` derives `classCount` from
`faculty.assignedClasses`/`assignedClassesCount`; `:29` reads `leaveDetails?.isOnLeave`; `:46-48` needs
`classCount >= 3`. `facultyWorkColumnCell.tsx:93-103` renders the same keys. No backend producer exists
(`grep -rn "assignedClassesCount" apps/backend/src` → nothing); only the single-record ID-card overlay
produces it (`FacultyPageOverlays.tsx:80-86`), and `leaveDetails` (`facultyModuleManifest.ts:109`) is never
written.
**Consequence.** Every Work row/card shows "Available" with no count, `on_leave` never appears, and "heavy"
is unreachable — the pill is decorative and the column always 0.
**Proposed fix.** Hydrate counts in one batched query, or derive `isOnLeave` from
`status/employDesignationStatus === "on_leave"` and drop the column until it has a producer.

### M5 — Major — Reporting hierarchy: write path stripped, validator test-only, hierarchy stubs

**Evidence.** `faculty.dto.ts:233-246` `FACULTY_WRITE_STRIP_KEYS` removes `"reportingFacultyId"`,
`"reportingRole"`, … `"hierarchyRank"`, `"subordinateCount"` (applied `:248-255`), so no request can set or
reparent `faculty.reporting_faculty_id`. `facultyHierarchyValidator.ts:25` is referenced **only** by
`__tests__/facultyHierarchy.integration.test.ts:8,169-191`. The real chain is designation-derived
(`facultyRepositoryAncestors.ts:98-145`) and reads override the stored column
(`facultyLoadEntityUseCases.ts:54-57,78-79`). Assignment-level hierarchy is a stub:
`facultyAssignmentHierarchyRepository.ts:6-23` returns `[]`, `facultyHierarchySql.ts:23-37` builds
`… WHERE FALSE …`, yet routes answer 200 with `{tree: []}` / `{chain: []}`
(`facultyAssignmentHierarchyRouteHandlers.ts:35-36,71-72`).
**Consequence.** Cycle prevention cannot occur on `reportingFacultyId`; the real protection is
`validateFacultyDesignation` (sound, §7). `docs/faculty.md:170-226` still advertises the double-cycle CTE,
and clients render an empty org chart as data.
**Proposed fix.** Choose one model and document it (delete the dead validator + docs, or re-enable the
fields behind it plus the workspace lock); gate or remove the empty endpoints; add a 3-node cycle test.

### M6 — Major — Client-supplied `userId` is persisted as the linked account

**Evidence.** `faculty.dto.ts:103` `userId: z.string().nullable().nullish()` (also in
`FACULTY_WRITE_AUDIT_META_KEYS`, `:47-55`); `facultyRepositoryColumns.ts:166`
`let userId = flat.userId ? String(flat.userId) : null;`, written `:185,188-199`. The only guard is the
composite FK (foreign id → 23503 → 500). The value is trusted later: `facultySoftDeleteSessions.ts:31`
collects `members[].userId` and calls `revokeAllUserSessions(userId)`.
**Consequence.** The linkage is a server-owned projection (resolved from the contact at `:167-181`), but a
`faculty.write` holder can point a record at any tenant user (e.g. an admin) and later have that account's
sessions revoked, bypassing the "one faculty per user" check (`facultyWriteGuards.ts:80-88`).
**Proposed fix.** Add `userId` to `FACULTY_WRITE_STRIP_KEYS`, resolve it from the contact, return 400 on a
disagreeing payload, add a route test.

## 5. Minor findings

| # | Finding | Evidence |
|---|---|---|
| m1 | Catalog catches swallow without logging; infrastructure errors become 400 | `facultyDesignationRouteHandlers.ts:70-75,104-109,151-158`; `facultyDepartmentRouteHandlers.ts:67-72,94-99` |
| m2 | `handleDeleteAssignment` never calls `assignmentErrorResponse`; typed 404/409 → 500 | `facultyAssignmentRouteHandlers.ts:232-238` vs `:55-71` |
| m3 | ID-card print surface hardcoded — no `document_templates` row, no CAS/409 | `FacultyIdCardModal.tsx:41-205` |
| m4 | `yearFormat: "NONE"` silently coerced to `YYYY` in generation and preview | `facultyEmployeeIdGenerator.ts:106-115`; `facultyEmployeeIdPreview.ts:45-54` |
| m5 | Annual rollover uses the server year, not the workspace year | `facultyEmployeeIdGenerator.ts:18` |
| m6 | Org-position residue: `resolveSupervisorPrimaryPositionId` → `null`, `reassignSubordinates` → 0 | `facultyRepositorySubordinateCounts.ts:6-10,71-84` |
| m7 | English-only placeholders (untranslated copy) | `FacultyLeaveModal.tsx:182`; `FacultyIjazahSection.tsx:165,174` |
| m8 | ID-card issue date uses the client clock | `FacultyIdCardModal.tsx:195` |
| m9 | Docs drift: `docs/faculty.md:170-226` documents the CTE (now `WHERE FALSE`); `:256-257` credits bulk status to `facultyMutationRouteHandlers` (moved to `facultyBulkRouteHandlers.ts:9-75`) | as cited |
| m10 | Missing tenant returns 500 where 403 is the module convention | `facultyRouteHelpers.ts:76-82` |
| m11 | `printAreaRef` unused; `handlePrint` prints the whole window via ambient `@media print` | `FacultyIdCardModal.tsx:31,35-37,75-79` |
| m12 | Bulk specialization records no `updated_by` while bulk status does | `facultyRepositoryListOps.ts:65+` vs `:46-52` |

## 6. Test gaps

1. **No faculty E2E specs** — `find e2e -iname "*faculty*"` is empty; a11y/responsive/ops-flow untested.
2. **No pinned faculty module actions** — `moduleAccessCoverage.test.ts:314-328` has no faculty key, so C3
   is invisible to CI.
3. **No production-path session-guard test** (C2) — no `inject()` soft-deletes a linked faculty.
4. **No authorization test for role sync** (C1) — `facultyLinkedUserRoleSync.test.ts` mocks the mechanics.
5. **`reassignSubordinatesTo` untested against the real repository** (M1).
6. **Import restore-permission path untested** (M2) — no archived-`contactId` case.
7. **No timezone test for appointment bounds** (M3).
8. **No list-projection assertion for `assignedClasses*`/`leaveDetails`** (M4).
9. **Primary-appointment concurrency** — advisory lock unit-tested, no DB test with two overlapping
   `saveFacultyAssignment` transactions (`facultyAssignmentValidation.ts:45-54`).
10. **No `leaveDetails` round-trip test** (§10.1).

## 7. Verified-clean surfaces

- **Designation hierarchy cycles prevented server-side** — `facultyDesignationValidation.ts:58-78` (CTE path
  array, cycle marker, depth cap, re-derived descendant ranks `:82-102`).
- **Primary-appointment overlap serialized and typed** — `facultyAssignmentValidation.ts:6-11`
  `pg_advisory_xact_lock(hashtextextended('faculty:'||tenant,0))`; `:45-54` `'infinity'::date`, typed
  400/409; every write takes the lock first (`facultyAssignmentWriteRepository.ts:16,54,87`).
- **Assignment hijack blocked** — `facultyAssignmentValidation.ts:19-25`; close/delete 404 on a `facultyId`
  mismatch (`facultyAssignmentRouteHandlers.ts:182-184,224-226`).
- **Department delete dependency guard** — `facultyDepartmentValidation.ts:88-101` → 409.
- **Server-owned fields stripped, viewer sanitized** — `facultyNormalizeUseCases.ts:41-52`;
  `facultyCrudRoutes.ts:84,140`; `handleListFaculty:66-76`.
- **Bulk status** — one batched `UPDATE` with `updated_by` (`facultyRepositoryListOps.ts:31-62`), one
  reconcile + one broadcast (`facultyOperationUseCases.ts:42-45`).
- **i18n parity** — 567 `faculty.*` keys, 0 missing in ar/ur/fa.
- **Work-tier state model** — `useWorkSelection` (`useFacultyDirectoryFilters.ts:33`), page reset from the
  filter fingerprint (`:36-42`), selection cleared on change (`:44-58`).
- **All three faculty prefixes registered and gated** — `routes/tenant/faculty.ts:24-48,52-67,69`;
  `moduleAccessCoverage.test.ts:34-36`. **No faculty regression from #277**; **TSR / temporary staff records
  are absent** from this module, so the only tenant-user link surface is `faculty.user_id`.

## 8. Adversarial audit

**Edge cases / payload integrity.** `facultyWriteSchema` is `preprocess(strip…) + facultyCoreSchema` with
`.catchall(z.unknown())` while the dynamic form schema is `.strict()` (`faculty.dto.ts:177`) — two
acceptance rules for one body (`leaveDetails`, §10.1). Employee-id collisions map to 409 only on create
(`facultyMutationRouteHandlers.ts:69-77`).

**Failure modes / silent failures.** C2 and M1 are "success with no effect"; A3's catalog catches turn DB
failures into 400 without a log; `syncFacultyLinkedUserRole` runs after commit, so its failure 500s a
persisted write; import caps row messages at five.

**Security / multi-tenancy.** C1 is an object-level authorization gap on a privileged projection, reachable
with the default `teacher` role, and enables privilege destruction; C2 removes defense-in-depth; M6 attaches
a tenant-local user id that is later revoked; C3 is the over-strict inverse. Tenant scoping held on every
path reviewed (`withTenant`/`withTenantRead`, composite `(workspace_subdomain, id)` keys, guard bound to the
verified tenant).

**Concurrency / derived state.** Appointment writes serialize on the advisory lock (sound); races remain in
`syncPrimaryAppointment` reading before the lock (§10.4) and first-ever employee-id generation (§10.5). Two
"current appointment" sources coexist — `faculty_assignments` (counts, guard, supervisors) and
`faculty_employ_designations` (list projection, reports-to filter), reconciled only by
`syncPrimaryAppointment` (§10.2): pin that with a DB test.

## 9. Resolution plan

**Tier 1 — before closing the module (security / correctness, small diffs).**

1. **C1** — actor-authorized role write, `isAdminRole` carve-out, sync inside the transaction, denial test.
2. **C2** — `findByUserId` probe in `authenticate` and `/auth/me`, role gate removed, `inject()` test.
3. **C3** — faculty delete/restore rules + `EXPECTED_MODULE_ROUTE_ACTIONS` for all three prefixes.
4. **M2** — `canRestore` threaded into the import job from the job actor's grants.
5. **M6** — `userId` stripped from client writes, resolved from the contact only.

**Tier 2 — same release if capacity allows, otherwise a deferred entry with a pinning test.**

6. **M1** — implement or reject subordinate reassignment (no silent 200).
7. **M3** — workspace-timezone "today" for appointment open/close.
8. **M4** — server-side class counts, or drop `assignedClassesCount` until they exist.
9. **M5** — one reporting model documented and enforced; gate or remove the empty endpoints.
10. **Minors** — logging/error typing (m1, m2), ID-card decision (m3, m11), employee-id format/rollover
    (m4, m5), stale stubs (m6), i18n placeholders (m7), docs refresh (m9), audit parity (m12).

**Product decisions (owner call).**

- Is `faculty.reporting_faculty_id` user-editable (re-enable writes + validation) or a derived projection
  (delete the dead validator + docs)? Decides M5.
- Is the tenant-wide `faculty.write` grant (held by `teacher` by default) meant to allow editing *any* faculty
  record, including designations that drive RBAC? If not, add an object-level rule (self / own department /
  descendant scope) on top of C1.
- Does the module promise tenant-editable ID-card templates (`document_templates`) or a fixed card? And do
  all date-only fields follow the workspace timezone (the rule says yes) — with what backfill for rows
  already stamped in server time?

## 10. Hypotheses not proven

1. **`leaveDetails` cannot be persisted.** `facultyCoreSchema` accepts it (`facultyModuleManifest.ts:109`)
   and `FacultyLeaveModal.tsx:101` submits `{ leaveDetails }`, while the dynamic schema is `.strict()`
   (`faculty.dto.ts:177`) and its `schemaObject` (`:88-113`) has no `leaveDetails`; the system-key loop
   (`:120-150`) only adds status/date/specialization/employeeId/notes. If the form payload forwards it, the
   PUT fails "Unrecognized key". Not executed.
2. **Cross-SSOT supervisor divergence.** The reports-to filter reads `faculty_employ_designations`
   (`facultyPrimaryAppointmentSql.ts:19-36,73-82`) while supervisors/counts read `faculty_assignments`; if
   the bridge is skipped, display, delete guard and filter disagree. Not reproduced with data.
3. **Role sync is non-atomic** — runs after commit (`facultyRepository.ts:120-126`).
4. **Concurrent create can spuriously 409** — `syncPrimaryAppointment` reads the primary before the lock
   (`facultyWriteHelpers.ts:50-88`).
5. **Employee-id rollover** — `NONE` coerced to `YYYY` prevents collisions but ignores the configured format;
   no year-boundary two-worker test (`facultyEmployeeIdGenerator.ts:89-104`).
6. **`/api/faculty/setup/next-employee-id`** — `faculty.ts:28` mounts setup routes at `/api/faculty`, so the
   preview may live at a different URL than the contract's `nextEmployeeId`. Not traced end-to-end.
7. **`saveDesignation` 409 declaration** — handler returns 409 (`facultyDesignationRouteHandlers.ts:106-107`);
   the contract was not re-read to confirm it is declared.

---

*Static review of `main` @ `60245210a`; line numbers are from the tree as reviewed. The audit modified no
source file. Baseline gates are recorded in §1; no DB or browser run was performed.*

## 11. Implementation status (2026-11-04)

Tier 1 landed in the same change set after this review:

| ID | Status | Change | Guard |
| --- | --- | --- | --- |
| C1 | **Fixed** | `syncFacultyLinkedUserRole` now resolves the actor, requires admin/`users.manage` for any role change, never demotes a linked admin for a non-admin, and runs inside the faculty write transaction (a rejection rolls the write back) | `facultyLinkedUserRoleSync.test.ts` (escalation/demotion/admin/no-actor) |
| C2 | **Fixed** | `isFacultyDeletedByUserId` probes `faculty.user_id` (un-hydrated); `authenticate` and `/auth/me` use it and no longer gate on the role name | `facultySessionGuard.test.ts` |
| C3 | **Fixed** | Faculty delete/restore rules added for all three prefixes (and catalog/assignment deletes), pinned in the coverage table | `moduleAccessCoverage.test.ts` |
| M2 | **Fixed** | The import job carries `canRestore` from its viewer role, so an import cannot resurrect an archived profile without `faculty.delete` | `facultyImportJobUseCases` path |
| M6 | **Fixed** | `userId` is stripped from client writes by the dynamic write schema; the linked account is always resolved from `contact_id` | `facultyWriteSchema.test.ts` |

Behaviour change: a role change attempted by an actor without user-management authority now returns 403 instead of silently rewriting the account; background imports without a bound actor skip the role sync (logged).

Still open (Tier 2): M1 subordinate reassignment stub, M3 workspace-local day, M4 workload producer, M5 reporting model, and the minors in §5.
