# Attendance Specialised Subsystems — Excuses, Escalation & Exam Eligibility (Audit + Build)

**Date:** 2026-11-09 · **Scope:** excuse/medical-leave processing, chronic-absence escalation, and
exam eligibility gating, plus the completion/evaluation machinery they hang off.

**Method:** traced each subsystem from schema → repository → use case → route → UI, then verified the
two systems they depend on (the countable-attendance rate and the session-completion gates) by
reading their SQL. Findings were reproduced by inspection (no live database in this environment); the
DB suites below are written for CI.

**Headline:** two of the three subsystems **did not exist** — there was no excuse API at all and no
streak detection anywhere in the repository. The third existed only as a *completion* rule, and its
data source was dead: `exams.results_finalized_at` had **no writer**, so exam-gated sessions could
never complete. All three are now built, along with the defects found underneath them.

## Findings

| # | Sev | Finding | Evidence | Status |
|---|---|---|---|---|
| F1 | **Critical** | `exams.results_finalized_at` had **no writer anywhere**. Completion counts only finalized exams, so `examsTotal` was always 0 → `requiresExamPass` always produced `exam_missing`, and every class with an exam was permanently `exams_unfinalized` → completion was blocked. | `apps/backend/src/db/repositories/sessionCompletionRepository.ts#L69-L72`; zero writers of the column | **Fixed** — `POST /api/examinations/exams/:id/results-finalization` (+ audited re-open) |
| F2 | **High** | Completion staleness ignored **soft-deleted** attendance rows (probe required `deleted_at IS NULL`) and **leave changes** entirely. Deleting a mark or adding approved leave changes the rate but did not flag `evaluation_stale` before certificates were issued. | `apps/backend/src/db/repositories/sessionCompletionGateRepository.ts` stale lateral | **Fixed** — probe now includes deleted rows and `attendance_leaves` |
| F3 | **High** | **No excuse lifecycle.** `attendance_leaves` could only be written by enrollment suspension, always pre-approved; no route served leaves, no submit/review/approve path, no transition model, no document reference, and `pending` could never be created. | zero routes; `insertApprovedLeave` hardcodes `status:'approved'` | **Built** — submit → review → approve/reject, cancel/revoke |
| F4 | **High** | **Approving leave never touched the marks it excuses.** Leave only changed the rate denominator; an existing `absent` mark stayed `absent` forever. | no attendance write in the leave path | **Fixed** — approval converts covered `absent` rows to `excused` in the same transaction, audited per row |
| F5 | **High** | **No chronic-absence detection at all.** Zero matches for streak/consecutive/defaulter/chronic in the repo; the only alert was a tenant-wide dashboard rate. The module's `lowAttendanceThreshold` was dead (report hardcoded 75). | grep across `apps/backend/src`, `apps/frontend/src` | **Built** — pure streak rule, hourly leader-lease scan, audited alerts, in-app notification; threshold now wired |
| F6 | **High** | **No exam attendance gate.** `session.minAttendancePct` applied only to *post-hoc completion*; nothing gated sitting an exam, and `exams` had no threshold column. | `exams` schema; result-entry path | **Built** — per-exam threshold (session fallback), live eligibility, audited override, 409 on blocked entry |
| F7 | **Medium** | Approving leave could race a concurrent mark write: the write path checks approved leave, then writes — an approval committing in between left a `present` mark on an approved-leave day. | policy guard P4 read-then-write | **Fixed** — both paths take the same per-student advisory lock (single batched statement, ordered to avoid deadlock) |
| F8 | **Medium** | Two competing attendance-rate definitions: completion/eligibility use 1-decimal precision; the report rounded to integers and compared `< 75`, so 74.5 % was "75 → not a defaulter" in reports and "below 75 → not completed" in completion. | `apps/backend/src/db/repositories/attendanceReportOverview.ts` | **Fixed** — eligibility shares the countable rule and 1-decimal comparison; the report's low-count uses the configured threshold. Display-vs-decision precision documented |
| F9 | **Medium** | `exam_results` had **no natural-key uniqueness** and upserted by surrogate id — two results for one (exam, student) were representable; marks were never bounded by `total_marks`; a result could be entered for a student not enrolled in the exam's class. | `apps/backend/src/db/repositories/examinationResultsRepository.ts` | **Fixed** — unique `(workspace, exam_id, student_id)`, marks range check, enrolment check in the gate |
| F10 | **Medium** | The in-app notification centre **hardcoded the waitlist copy and target for every stored kind**, so a new kind would render the wrong sentence. | `apps/frontend/src/tenant/hooks/notifications/useStoredNotifications.ts` | **Fixed** — per-kind copy/target map with a safe fallback |
| F11 | **Low** | Leave statuses had no CHECK and no transition model; `cancelled` did not exist. | `attendanceLeaves` schema | **Fixed** — status/type/attribution checks + transition table |
| F12 | **Low** | `attendance_absence_alerts` had no table; escalation had no state to dedupe against. | — | **Built** — unique `(workspace, class, student, streak_start)` makes the scan idempotent |

## What was built

### 1. Excuse & medical leave (migration **0220**)
- **Schema:** `leave_type`, `submitted_by/at`, `reviewed_by/at`, `review_note`, `cancelled_by/at`,
  `document_ref`; CHECKs on status/type and on "approved ⇒ reviewed"; legacy `approved_*` backfilled
  into the decision record then validated; review-queue index.
- **Domain:** `attendanceLeaveTransitions.ts` (pending → approved|rejected|cancelled, approved →
  cancelled, terminal otherwise); `attendanceExcuseUseCases` (submit / review / cancel / list) owning
  its transaction; `decideAttendanceLeave` is a **guarded** `UPDATE … WHERE status='pending'`, so two
  reviewers produce one decision and the loser gets 409.
- **Retroactive sync:** `excuseAbsencesInRange` converts only `absent` rows in the range, prefixes the
  row note, bumps `version`, and emits one audit row per conversion (`attendance.leave_sync`). A
  `present`/`late` mark is never rewritten — it is evidence the student *was* there.
- **Revocation:** cancelling an approved leave stops future coverage but does **not** rewrite the
  marks it excused; the decision stands and the revocation itself is audited.
- **Race:** review and marking both take `pg_advisory_xact_lock('attendance:student:<tenant>:<id>')`
  (marking takes it for the batch's students in one ordered statement).
- **API/UI:** `GET/POST /api/attendance/leaves`, `POST …/:id/review`, `POST …/:id/cancel`; Work tier
  gains an **Excuses** tab with the review queue and actions; module-route rule makes review
  delete-level.

### 2. Chronic absence & escalation (migration **0221**)
- **Shared rule:** `absenceStreaks.ts` — runs of consecutive **countable, marked** unexcused
  absences; `present`/`late`/`excused`, an **unmarked** day or a non-countable day all break the run
  (a data gap is not evidence of absence).
- **Table:** `attendance_absence_alerts` with a unique streak key, status (`open|resolved|dismissed`),
  notification and resolution attribution; FORCE RLS.
- **Scan:** `scanAbsenceStreaks` (45-day window) reads the class's marked days + countable marks,
  evaluates each student with the pure rule, and upserts one alert per streak. Re-runs update the end
  date/length **without** re-notifying (`notified_at` untouched; `ON CONFLICT DO NOTHING`).
- **Escalation:** in-app notification to `students.write` (counsellors/admins) + audit row; hourly
  leader-lease scheduler registered in the worker; manual `POST …/absence-alerts/scan`; alert queue
  + resolve/dismiss in the Excuses tab.
- **Settings:** `absenceStreakThreshold` (1–30, default 3) validated and normalised; the module's
  `lowAttendanceThreshold` now drives the report's low-attendance count instead of a hardcoded 75.

### 3. Exam eligibility gating (migration **0222**)
- **Schema:** `exams.min_attendance_pct` (null ⇒ session fallback, 0 ⇒ gate off),
  `exam_eligibility_overrides` (audited, revocable), unique `exam_results(workspace, exam_id,
  student_id)` and a non-negative marks check.
- **Shared rule:** `examEligibility.ts` — 1-decimal percentage, `eligible | blocked | unknown`
  (`unknown` = no countable day yet, deliberately *not* eligible), override clears a block.
- **Backend:** one query per exam computes each enrolled student's countable attendance with the
  shared rule; the result-entry `beforeSave` hook now rejects blocked/unknown students, marks above
  the exam total, and students not enrolled in the exam's class, with audited overrides as the only
  bypass.
- **Finalisation:** the missing writer (F1) plus re-open; sets `status='completed'` and invalidates
  the sessions cache so completion re-reads.
- **UI:** the exam drawer shows an attendance-eligibility panel (counts, blocked students with their
  percentage, finalise action for managers).

## Synchronisation flaws & race conditions handled

| Concern | Handling |
|---|---|
| Leave approval vs concurrent marking | shared per-student advisory lock; single ordered statement so batches cannot deadlock |
| Two reviewers deciding one excuse | guarded `UPDATE … WHERE status='pending'`; loser gets 409, no overwrite |
| Approval side-effects vs the decision | mark sync, audits and the leave decision share one transaction; a failure rolls the decision back |
| Scan re-runs | unique streak key + `notified_at` guard: one alert, one notification per streak |
| Retroactive deletions / leave changes vs completion | staleness probe now covers deleted attendance and leave rows |
| Exam results vs eligibility | gate runs before save; overrides are the only bypass and are audited |
| Report vs completion precision | eligibility/completion share the 1-decimal countable rule; report display remains integer but its threshold is configured |

## Verification

- `pnpm typecheck` — 6/6 tasks (shared, backend, frontend, e2e).
- Backend unit: **2,969 tests / 434 files** (101 attendance-related across 10 files, incl. new
  `attendanceExcuseUseCases` and the streak/eligibility suites in `@mms/shared`).
- Frontend: **174 tests** across the attendance and examinations features.
- Shared: 58 attendance tests (transitions, streaks, eligibility).
- Ratchets: `check-code-norms` (300-line ceiling), `check-migration-hygiene`,
  `check-migration-indexes`, `check-migrations-forward-only`, `check-backend-structure`, i18n parity
  (en/ar/ur/fa) — all held.
- DB suites (CI, real Postgres): `attendanceSpecializedSubsystemsDb` covers approval→sync,
  double-decision 409, cancel-keeps-marks, scan idempotency, eligibility block/override, marks range,
  finalisation and a per-exam gate.

## Accepted / deferred

- **Guardian SMS/WhatsApp for escalation** — the chosen first implementation is in-app notification +
  audited alert. Sending externally needs messaging templates and consent handling.
- **Auto-absent job** (`autoAbsentAfterMins`) — still not implemented; it needs a scheduled
  mark-and-audit job (the scheduler and policy hooks now exist).
- **`trackHalfDay`** — still has no domain model (needs a `half_day` status plus rate/report handling).
- **Excuse submission UI** is the review queue with actions; a guardian-facing request form, document
  upload pipeline (`document_ref` is a free-form reference) and excuse quotas are follow-ups.
- **Exam threshold/override editing UI** — the endpoints exist and the drawer renders eligibility;
  the administrative edit surface (threshold, override dialog) is the next UI increment.
- **Leave overlap** is serialized by the advisory lock rather than a DB exclusion constraint
  (`btree_gist` + live-table DDL); recorded deliberately, with the concurrency test as the guard.
