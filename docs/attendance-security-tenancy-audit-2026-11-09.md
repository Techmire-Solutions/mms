# Attendance Security, Multi-Tenancy & Audit-Trail Audit

**Date:** 2026-11-09 · **Scope:** attendance authorization (module, role, section), tenant isolation,
and the audit trail for every attendance-side mutation.

**Method:** traced each write path from handler → use case → repository → audit, and each read path
from handler → SQL → RLS policy. Multi-tenancy was probed by inspecting every raw-SQL statement and
the RLS state of all seven attendance tenant tables; authorization by resolving what a `teacher`
role actually passes at each gate.

**Headline:** multi-tenancy held up — no leak was found. Authorization did not: a **tenant
preference** granted override authority to every writer, section scoping was really class scoping,
and **six mutation paths left no audit row at all** (excuse submission, day submit/reopen,
suspension leave, time-only corrections, setup changes with no diff, and an override row written
outside the transaction that could outlive a rolled-back write).

## Findings

### Authorization

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| S1 | **High** | Override authority came from a **tenant preference**: `canOverride = preferences.allowManualOverride \|\| canDeleteCollection(actor)`. One admin enabling "manual override" let every teacher edit locked days and post-cut-off history. | `attendancePolicyGuard.ts:112,150` | **Fixed** — switch *enables*, `attendance.delete` *authorises*; a justification is now mandatory and recorded |
| S2 | **High** | Teacher scope was **class-level, not section-level**: `findUntaughtClassDates` passes if the teacher has *any* section assignment in the class, and the mark path never passed `sectionId`. A Section-A teacher could mark Section-B students via the API. | `teacherSectionScopeRepository.ts:30-55`, `attendanceMarkUseCases.ts:81,128,188` | **Fixed** — `findUnstaffedSectionDates` + `assertTeacherSectionScope`; marks now carry their section |
| S3 | **Medium-High** | `submitAttendanceDay` had **no actor scope**: any writer could lock a day for a class they do not teach. | `attendanceLeaveUseCases.ts:40-56` | **Fixed** — class scope check before the lock |
| S4 | **Medium** | `GET /api/attendance/leaves` returned **every** student's reason and medical-certificate reference to any attendance reader. | `attendanceExcuseUseCases.ts:155-158` | **Fixed** — section-scoped teachers see only their students; office/admin staff stay unscoped |
| S5 | **Medium** | `submitExcuse` accepted any student for any writer, pre-creating the evidence that later converts marks. | `attendanceExcuseUseCases.ts:162-214` | **Fixed** — 403 `attendance_excuse_out_of_scope` for a student outside the teacher's classes |
| S6 | **Low** | The manual escalation scan needed only `attendance.write`, so any teacher could trigger a tenant-wide alert sweep. | `attendanceEscalationHandlers.ts:60-66` | **Fixed** — now delete-level (the scheduler path is unaffected) |

### Multi-tenancy — verified, no leak found

- Every attendance raw-SQL statement carries a `workspace_subdomain` predicate:
  `excuseAbsencesInRange`, `attendanceEscalationRepository`, `attendanceCountableSql`,
  `attendanceRepository*.ts`, `attendanceRowReads`, `attendanceUpsert` (the conflict target includes
  the workspace column), `enrollmentPlacementLookup`.
- `FORCE ROW LEVEL SECURITY` + `tenant_isolation_policy` exist on `attendance`, `attendance_leaves`,
  `attendance_lookups`, `attendance_field_configs`, `attendance_module_preferences` (0076),
  `attendance_day_submissions` (0219) and `attendance_absence_alerts` (0221).
- `recordModernAuditEvent` refuses an append whose workspace differs from the request tenant.
- Advisory locks are tenant-scoped (`attendance:student:<tenant>:<id>`).
- **Gap found:** nothing *asserted* this. A future query or a new table without FORCE RLS would have
  regressed silently → the DB test in §4 now proves it.

### Audit trail

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| A1 | **High** | `submitExcuse` wrote **no audit row**: the originating excuse event was invisible; only the decision was recorded. | `attendanceExcuseUseCases.ts:162-214` | **Fixed** — CREATE on `attendance_leaves`, tag `attendance.excuse.submitted` |
| A2 | **High** | Day **submit** and **reopen** were unlogged; reopen is the sanctioned unlock of submitted evidence. | `attendanceLeaveUseCases.ts:40-77` | **Fixed** — both audited in-transaction with old/new lock state and reason |
| A3 | **High** | `recordApprovedLeave` (enrollment suspension) created rate-changing leave with no attendance audit row. | `attendanceLeaveUseCases.ts:22-36` | **Fixed** — CREATE with `source: enrollment_suspension` |
| A4 | **High** | The holiday/extra-class override audit ran **outside the caller's transaction** (no `tx`), so it could outlive a rolled-back write; its `recordId` was `classId:date`, not a row id. The comment claiming it rolled back was false. | `instructionalDayGuard.ts:82-91` | **Fixed** — `tx` threaded from every mark path; real row id used |
| A5 | **Medium** | Bulk save audited **only status changes** (`attendanceStatusChanged`), so time-in/time-out/notes/roll-number corrections were unlogged. | `attendanceMarkUseCases.ts:219-231` | **Fixed** — `attendanceRecordChanged` compares every client-mutable field |
| A6 | **Medium** | Manual overrides were neither tagged nor justified, although `auditAttendanceMutation` supports `tag`/`reason` and its docstring names `attendance.override`. | `attendanceAudit.ts:15-20,52-56` | **Fixed** — 422 without a justification; audit carries `attendance.override` + the reason |
| A7 | **Medium** | Deletions could omit a reason although the manifest declares `captureDeletionReason: true`; the contract handlers never enforced it (the generic trash routes do) and the UI collected none. | `attendanceModuleManifest.ts:201-206`, `attendanceRecordHandlers.ts:197-201` | **Fixed** — schema-level required reason, UI dialog collects it, audit row carries it |
| A8 | **Medium** | Setup writes (preferences, field config) were audited **best-effort**, outside the write transaction, with no old→new diff — flipping `allowManualOverride`/`cutoffTime` may have left no trace. | `attendanceSetupContractHandlers.ts:158-171,208-226` | **Fixed** — same transaction, strict, diff of the six security-relevant keys |

## What changed

**Authorization**
- `attendancePolicyGuard.ts`: `canOverride = allowManualOverride && attendance.delete`; a strict pass
  first (to learn whether an override is needed), then an overridden pass; `422
  attendance_override_reason_required` with no justification; both gates return
  `{ overridden, codes }` so audits can tag the override.
- `teacherSectionScopeRepository.findUnstaffedSectionDates` + `assertTeacherSectionScope` (bypass:
  `sessions.delete`; unsectioned classes keep the class rule) wired into create, update and bulk.
- `submitAttendanceDay(…, actor)` class-scope check; `submitExcuse` out-of-scope 403;
  `listTaughtStudentIds` scopes the excuse queue; escalation scan requires `attendance.delete`.

**Audit**
- New audited events: excuse submission, day submit, day reopen, suspension leave, setup
  preferences/field config (with diff).
- `attendanceRecordChanged` (shared) replaces the status-only comparison in the bulk loop.
- Holiday-override audit joins the caller's transaction and records a real row id.
- Deletion reason enforced in `attendance.dto.ts` (`attendanceDeletionReasonSchema`, min 3 chars),
  with a separate reason-free bulk-restore schema.

**Contract / UI**
- `x-attendance-reason` header on create/update/delete/bulk/delete-bulk; `overrideReason` in the bulk
  body; delete body requires `deletionReason`; 400/409/422/413 statuses declared.
- Grid: on `attendance_override_reason_required` a justification dialog collects the reason and
  retries the same save (submit or draft).
- Trash dialogs collect a mandatory archive reason; the bulk-restore dialog does not.
- 20 new translation keys across en/ar/ur/fa.

## Verification

- `pnpm typecheck` — 6/6.
- Backend: **3,061 tests / 445 files** (attendance: **193 across 21 files**), including the new
  section-scope, day-submission audit, excuse-audit, time-only audit, override audit, policy-types
  and contract suites.
- Frontend: attendance + tenant hooks suites green.
- New DB test (`attendanceTenantIsolationDb`, CI-only): FORCE RLS asserted for all four attendance
  tables, cross-tenant read/update/delete blocked, retroactive-excuse raw SQL proven tenant-scoped.
- Ratchets, docs index, i18n parity and `local-ci` — see the run recorded with this change.

## Accepted trade-offs & follow-ups

- `allowManualOverride` remains a tenant switch but no longer substitutes for the permission; with it
  off, even an administrator cannot post-cut-off edit (they must reopen a submitted day). That is the
  intended strict-evidence posture, and it is a behaviour change for tenants that relied on the old
  shortcut.
- Staff without a faculty record stay unscoped by design (office/admin must correct any roster).
- Section scoping applies to sectioned classes; exams keep their existing class-level scope.
- The single-record edit path returns 422 for an override without a justification but has no UI
  prompt yet — only the grid does; the Records drawer follow-up is recorded.
- A justification is required only when a write actually overrides; normal marking stays header-free.
- Deletion reasons are now mandatory (breaking for API callers that omitted them); the in-repo UI was
  updated in the same change.
- No migration: RLS and indexes already existed; this change adds enforcement and proof, not DDL.
