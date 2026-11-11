# Examinations Security, Multi-Tenancy & Audit Compliance — Round 2 (2026-11-11)

**Scope.** Re-audit tenant isolation, granular RBAC and tamper-evident audit coverage of every
grade-affecting action in the Examinations module, after the schema (0207–0239), lifecycle, specialized
subsystems and API rounds.

**Method.** Read every exam repository (Drizzle + raw SQL), the route/contract layer, the RBAC maps and
default role catalogue, the audit service/trigger and the background-job actor binding; inspected the
live `pg_class`/`pg_policies` catalog; re-read the round-1 security audit and the intervening rounds so
still-open items are separated from regressions. Re-ran the suites (backend 493/3524, shared 269/2141,
frontend 1192/4487, DB 83/429 at the start of this round).

## Verified controls (unchanged)

| Control | Evidence |
|---|---|
| **FORCE RLS everywhere** | Live catalog: `exams`, `exam_classes`, `exam_results`, `exam_eligibility_overrides`, `examinations_field_configs`, `examinations_module_preferences`, `tests`, `test_sections`, `test_questions`, `test_section_questions`, `question_bank_field_configs`, `question_bank_module_preferences` all have RLS **and** FORCE RLS with policies. |
| **Tenant predicates** | Every exam repository/raw SQL carries `workspace_subdomain` on both sides (eligibility grouped CTE, analytics/comparison, widgets, marks page, roster, publication CAS); JWT workspace is bound to the request host; audit append refuses a cross-tenant write; an unknown/cross-tenant eligibility id is 404. |
| **Marking lock** | `assertMarksWritable` takes `FOR SHARE` and refuses published (`exam_results_finalized`), archived (`exam_archived`) and cancelled (`exam_cancelled`) exams for marks and moderation; publication CAS takes `FOR UPDATE`. |
| **Controller actions** | Moderation, publish/unlock, eligibility overrides and trash/restore require `examinations.delete` at handler **and** module route action; unlock requires a reason. |
| **Mark privacy** | A caller without `examinations.write` receives published-only rows without `markedBy`/`version`/moderation reason+actor; numeric grace is intentionally exposed (test-pinned). |
| **Audit infrastructure** | `audit_trail_events` is monthly-partitioned, RFC 8785 canonicalized and SHA-256 hash-chained per tenant, append-only via `trg_audit_trail_immutable` (0235), written in the mutation transaction; background jobs bind the initiator so job writes attribute to the requesting user. |
| **Audited grade actions** | Mark entry/correction (old/new marks, `marks_entry`/`marks_correction`), moderation (old/new grace + reason), publish/unpublish (reason + code), exam create/frame edit incl. **status**, trash/restore (reason + code), overrides (reason + code), attendance-gate change. |
| **Guardian exposure** | No student/guardian examination surface exists; a guardian token is refused on the marks list and export. |

## Findings

### A · Tenant isolation

| # | Sev | Finding | Status |
|---|---|---|---|
| A1 | P3 | The RLS proof's hardcoded table list only covered the 6 core exam tables; the 6 question-bank/config tables (forced-RLS in the live catalog) were unpinned, and the analytics path had no cross-tenant assertion. | **Fixed** — the CI RLS suite now asserts FORCE RLS on all 12 tables and proves tenant A's analytics never include tenant B's marks. No live leak found. |

### B · RBAC / permission bypasses

| # | Sev | Finding | Status |
|---|---|---|---|
| B1 | **P1** | **Marks CSV import bypassed teacher section scope.** The route required only `examinations.write`; the worker ran the attendance/roster gate but not `assertTeacherExamScope`, so a faculty-linked teacher could import marks for **any** section, and a user without a faculty link (refused by the grid) was accepted. | **Fixed** — new [`examMarksImportScope.ts`](../apps/backend/src/examinations/use-cases/examMarksImportScope.ts) resolves the submitted rolls against the exam roster and runs the exact grid rule (exact-section staffing on the exam date, class-level rule for undated exams, coordinator bypass, no-faculty refusal) before enqueueing; the route returns 403 `exam_marks_import_forbidden` with `details.examId`. Unit + route tests. Residual: an already-queued job executes the row set authorized at enqueue time. |
| B2 | **P1** | **Exam definition writes had no controller gate.** `PUT /exams/bulk` (create/update) and the exams CSV import required only `examinations.write` and had no class scope: any teacher (and the librarian role) could change `totalMarks`, `passingMarks`, subject, classes, date or status for every exam — silently re-grading every student. | **Fixed** — both surfaces now require `examinations.delete`: the bulk registrar gained a `canSave` predicate, the exams CSV import predicate is `canDeleteCollection`, module route actions map `PUT /exams/bulk` and `POST /import` to `delete`, and the UI shows create/import/edit only to controllers. Marks entry stays `examinations.write`. Tests: teacher 403, controller 200. |
| B3 | **P2** | The **attendance gate** required only write: any writer could lower an exam's threshold, admitting students policy excluded. | **Fixed** — controller-only (`examinations.delete` handler + rule), optional `reason` on the body, and the audit event now carries `reasonCode: "attendance_gate"` + the reason. No current UI calls the route. |
| B4 | **P2** | The **librarian** default role had `examinations: ["create", "read", "update"]` — a non-teaching role that could read drafts and alter definitions. | **Fixed** — the default catalogue now grants a librarian no examinations access. Existing workspaces keep their stored role rows (SE3 follow-up). |
| B5 | P2 | **No date-based marking window**: marks are accepted for `upcoming`/`scheduled` exams (pre-entry possible); the only window is the exam state (published/archived/cancelled refuse). Teaching-date staffing is the only temporal check. | **Documented** — deferred design SE1; imposing `ongoing|completed` without a window model would break current entry workflows. |
| B6 | P3 | Read granularity is module-wide (any reader sees all published marks; any writer sees drafts/exports any exam); `sessions.delete` holders bypass teacher scope (intended coordinator bypass); admin backup/restore can rewrite published marks with a summary audit. | **Documented** |
| B7 | P3 | No student/guardian surface exists, so "own published results only" is enforced by absence + staff RBAC. | **Documented** (SE2, carries R13) |

### C · Audit trail / compliance

| # | Sev | Finding | Status |
|---|---|---|---|
| C1 | **P2** | **The broadsheet export was not audited** although it exposes marks and (for graders) moderation adjustments. | **Fixed** — the route appends a best-effort `VIEW` event (`reasonCode: "broadsheet_export"`, exam, `includeInternal`, job id) with the actor. |
| C2 | **P2** | **The marks-import job had no summary evidence** (per-mark rows were audited, but not who imported which file into which exam, or how much applied). | **Fixed** — the worker appends an `UPDATE` summary (`reasonCode: "marks_import"`, imported, rejected, jobId) with `realUserId = ctx.userId`. |
| C3 | P3 | Reason-code inconsistency: mark events carried `reason` but not `reasonCode`; exam create/frame and gate events had no code. | **Fixed** — `marks_entry`/`marks_correction`, `scoring_frame` (or `status_override` for a pure status move), `exam_created`, `attendance_gate` are now recorded beside the existing `reason` fields. |
| C4 | **P2** | No database test pinned the append-only trigger (0235). | **Fixed** — DB test: direct `UPDATE`/`DELETE` on `audit_trail_events` → `23514`; the audited purge escape still works (proven in a rolled-back transaction). |
| C5 | — | No unlogged grade alteration found: every mark edit, moderation, publish/unlock, status/frame change, gate change and override writes an attributed audit row inside its transaction. `Absent → Present` is an attendance status (results have no such status — D1). | Verified |

## Implemented in this change set

- **Backend**: `examMarksImportScope` use case + route call; `canSave` on the bulk registrars and the
  exams bulk/import predicates; attendance-gate controller authority + optional reason; audit reason
  codes (marks, frame/status, create, gate); broadsheet-export `VIEW` event; marks-import summary event.
- **Shared**: attendance-gate body gains an optional `reason`; librarian default role loses its
  examinations grant; error type `exam_marks_import_forbidden`.
- **Frontend**: page actions split `canWrite` (marks/export) from `canManage` (create/import); exam list
  create/edit and the create shortcut are controller-only; tests for both audiences.
- **Tests**: import-scope unit suite (exact section, undated fallback, ambiguous/unknown rolls, 403
  wrap); route authority tests (teacher 403 / controller 200 for definition, import, gate; scoped marks
  import 403); DB tests for append-only, purge escape, mark-entry/correction and gate reason codes and
  the status-override code; RLS suite extended to the question-bank tables and the analytics path.

## Deferred, decision-ready

- **SE1 · Marking windows** — `marking_opens_at`/`marking_closes_at` (per exam, optionally per
  class/section), enforced in `assertMarksWritable` and the teacher-scope check; blocks pre-entry on
  upcoming exams and post-window edits without a controller unlock.
- **SE2 · Student/guardian portal** — self-scoped endpoint filtered by the authenticated student link
  and `results_finalized_at`, returning only the public marks projection.
- **SE3 · Role resync** — reconcile stored workspace role rows with the corrected librarian default
  and audit the change.
- **SE4 · Dedicated `examinations.moderate` / `examinations.publish` permissions** instead of
  overloading `delete`.
- **SE5 · Read-scope granularity** — an optional section-scoped reader role.
- **SE6 · Absent/exempt/withheld result statuses** (D1 roadmap) with their own audited transitions.

## Verification

```bash
pnpm typecheck
pnpm --filter mms-backend test          # 494 files / 3533 tests
pnpm --filter @mms/shared test          # 269 files / 2141 tests
pnpm --filter mms-frontend test         # 1192 files / 4489 passed
pnpm --filter mms-backend test:db       # 83 files / 434 passed (1 skipped)
node scripts/check-examinations-test-matrix.mjs
node scripts/ci/check-examinations-route-injection.mjs   # 20 paths, 0 baselined
pnpm check:docs && pnpm check:i18n
# CI-only: pnpm --filter mms-backend test:rls (NOSUPERUSER/NOMBYPASSRLS role)
```
