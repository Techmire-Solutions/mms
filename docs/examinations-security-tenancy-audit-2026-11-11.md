# Examinations Security, Multi-Tenancy & Compliance Audit — 2026-11-11

**Scope:** tenant isolation, granular RBAC for marking/moderation/publication, and the audit trail for
every grade-affecting action in the Examinations module.

**Method:** read every exam repository (Drizzle + raw SQL), the route/contract layer, the RBAC maps
and role catalogue, the audit service, and the live database catalog (RLS flags/policies). Verified
with a new two-tenant RLS suite (CI non-bypass role) and real-Postgres subsystem tests.

**Overall:** tenant isolation was already sound (FORCE RLS on every exam table + tenant predicates
everywhere + JWT↔host binding). RBAC had **three real holes** — the worst found while writing the
tests: `exams`/`exam_results` were missing from `COLLECTION_DELETE_PERMISSION`, so the delete check
fell back to *write* and **every teacher could trash an exam, publish results and moderate marks**.
Audit coverage had three unlogged mutations (exam create, trash/restore, full marks replacement).

## 1 · Tenant isolation — verified

| Control | Evidence |
|---|---|
| RLS enabled **and forced** | `exams`, `exam_classes`, `exam_results`, `exam_eligibility_overrides`, `examinations_field_configs`, `examinations_module_preferences` (live `pg_class`) |
| Tenant-composite keys/FKs | cross-tenant rows are unrepresentable; a cross-tenant mark insert fails the FK |
| Query predicates | every repository/SQL join carries `workspace_subdomain` on both sides (eligibility batch, reports CTEs, completion, widgets, marks page) |
| Token ↔ host | `authenticateTenant` rejects a JWT whose workspace differs from the request tenant |
| Realtime | tenant-addressed rooms only |
| Audit append | refuses a cross-tenant write |

**Changed:** `GET /exams/:id/eligibility` now returns **404** for an unknown/cross-tenant exam (it
previously returned `200 {students:[]}`, confirming an id existed); new
`src/__tests__/rls/examinationsTenantIsolation.db.integration.test.ts` proves it under a non-bypass
role (cross-tenant reads = 0 rows, updates/deletes = 0 rows, cross-tenant insert rejected, audit
append throws).

## 2 · RBAC — holes closed

| # | Hole | Fix |
|---|---|---|
| R1 | **Delete/publish/moderate fell back to write.** `COLLECTION_DELETE_PERMISSION` had no `exams`/`exam_results` entry → `canDeleteCollection` fell back to `canWriteCollection` → teachers could delete, publish, unlock and moderate. | Mapped both to `examinations.delete`; teacher integration test now proves a 403 on moderation. |
| R2 | **Moderation only required write.** | Handler now requires `examinations.delete` ("Moderator rights required"); module route action for `moderation`/`results-finalization` is `delete`; the drawer panel follows `canDelete`. |
| R3 | **A cancelled exam accepted marks and grace.** | `assertMarksWritable` locks the row and returns **409 `exam_cancelled`** for marks *and* moderation. |
| R4 | **Teacher scope was class-level and bypassed for non-faculty users.** | Marks now use `assertTeacherExamScope`: the student's seat-holding enrollment supplies the **section**, the exact-section staffing rule applies on the exam date, a user **without a faculty link is refused**, and only `sessions.delete` (coordinator) bypasses. Exams without a date keep the class-level rule. |
| R5 | **Read-only audiences received internal mark fields.** | `GET /results` projects `id, examId, studentId, marksObtained, graceMarks` only for audiences without `examinations.write` (still published-only); `markedBy`, `version` and moderation notes never leave the grading audience. |
| R6 | No student/guardian surface exists. | Documented: a self-scoped portal would filter by the authenticated student link + `results_finalized_at`; not built (no role/endpoint). |

## 3 · Audit trail — complete for grade-affecting actions

`audit_trail_events` is append-only (0235 trigger), hash-chained (RFC 8785), partitioned, and records
actor/IP/correlation/old-new. Now written **in the same transaction** as:

| Action | Event |
|---|---|
| Exam create (single + bulk) | `CREATE` with the scoring frame |
| Exam scoring-frame edit (totals, passing, date, duration, status, subject, classes, **description**) | `UPDATE` delta |
| Exam soft-delete / restore | `DELETE` / `RESTORE` with actor + **reason** (`captureDeletionReason` enabled) |
| Full exams / marks replacement (restore path) | one summary `UPDATE` per workspace with counts |
| Mark entry / correction | per changed mark, `reasonCode` `marks_entry` / `marks_correction` |
| Grace moderation | `UPDATE` with old/new grace + reason (`moderation`) |
| Publish / unpublish | `UPDATE` with `publication` / `unpublish` + reason |
| Eligibility override grant / re-grant / **revoke** | `CREATE` / `UPDATE` with prior state; revocation stores the reason (`eligibility_override_revoked`) |
| Attendance gate change | `UPDATE` |

**Framing:** `Absent → Present` is an attendance status; the exams module has no absent/exempt flag
(documented gap).

## Tests

- `rls/examinationsTenantIsolation.db.integration.test.ts` — two-tenant proof (CI non-bypass role).
- `db-integration/examinationSubsystemsDb` — cancelled-exam 409s, CREATE/DELETE/RESTORE audit,
  replacement summary audit, override grant/revoke/re-grant audit.
- `examinations.integration.test.ts` — teacher moderation 403, read-only projection, unknown exam 404.
- `teacherExamScope.test.ts` — no-faculty refusal, exact-section refusal, coordinator bypass.

## Deferred

Dedicated `examinations.moderate` / `examinations.publish` permission keys; date-based marking
windows; student/guardian portal; absent/exempt status; attendance's own non-faculty scope bypass
(left unchanged).
