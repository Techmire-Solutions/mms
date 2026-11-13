# Workshops Shared Contracts & TypeScript Audit — 2026-11-12

**Frontend/state:** page hierarchy, query invalidation and form UX are audited in
[workshops-frontend-state-audit-2026-11-12.md](workshops-frontend-state-audit-2026-11-12.md).

**Tests/CI:** coverage, concurrency and ratchets are audited in
[workshops-test-audit-2026-11-12.md](workshops-test-audit-2026-11-12.md).

**Scope:** `packages/shared/src/workshops/**` — DTOs, enums, Zod schemas and the static types
consumed by the Fastify routes, repositories and React client. Eighth in the series; companions:
[schema](workshops-schema-persistence-audit-2026-11-12.md),
[lifecycle](workshops-domain-lifecycle-audit-2026-11-12.md),
[subsystems](workshops-subsystems-audit-2026-11-12.md),
[API](workshops-api-layer-audit-2026-11-12.md),
[security](workshops-security-audit-2026-11-12.md),
[async queues](workshops-async-queues-audit-2026-11-12.md),
[printables/analytics](workshops-printables-analytics-audit-2026-11-12.md).

## 1. DTO ownership — verified centralized

| Shape | Owner | Consumers |
|---|---|---|
| `WorkshopEvent`, `WorkshopEventCreate/Update`, `WorkshopParticipant`, `WorkshopDetail`, `WorkshopsPageResponse` | `workshopsRecords.ts` (`z.infer`) | backend routes/repos/use-cases, frontend hooks/components |
| `WorkshopCompletionRow`, `WorkshopReportRow`, `WorkshopPreferences`, `WorkshopCertificatesBody` | `workshopCompletion.ts` | completion routes/use cases, Reports/Completion UI |
| `WorkshopAttendanceMark/DayBody`, `WorkshopScore/ScoresBody` | `workshopsRecords.ts` | check-in/score routes and sections |
| `WorkshopStatus/Phase/CreateStatus`, `WorkshopTransitionBody`, OCC headers | `workshopLifecycle.ts` + `workshopLifecycleSchemas.ts` | transition route/UI, DB CHECK tests |
| `WorkshopRegistrationState` (derived six) | `workshopRegistrationState.ts` | roster UI |
| Registration rules / date rules | `workshopRegistrationRules.ts`, `workshopScheduleRules.ts` | route guard, UI preflight |

No duplicate `WorkshopEvent`/`WorkshopParticipant`/`WorkshopDetail` declarations exist outside
shared. Backend-local `WorkshopRow`, `WorkshopState`, `WorkshopCompletionInputs`,
`WorkshopImportChunkResult` and the frontend certificate/print payload types are structural subsets
(DB row, guard input, worker result, print presentation), not duplicated DTOs. No `z.any()`, no
`any` casts in the workshops surfaces. The repo uses Zod only (no TypeBox).

## 2. Enum & registry consistency

### Persisted workshop status (DB CHECK 0245 ↔ shared)

`draft | open | completed | cancelled` — `WORKSHOP_LIFECYCLE_STATES`, the zod enum and the DB CHECK
are now all pinned by `workshopsSchema.test.ts`. Product phases
(`draft | registration_open | registration_closed | ongoing | finished | completed | cancelled |
archived`) are derived, never persisted; the lifecycle comment's "seven states" miscount is a doc
nit (eight phases).

### Participant status — persisted vs derived

| Product state | Representation |
|---|---|
| Registered | `status = 'registered'` before the books close |
| Waitlisted | `waitlisted_at IS NOT NULL` (status stays `registered`) |
| Attended | `status = 'attended'` (present but short of a criterion) |
| Completed | `status = 'completed'` |
| No-show | `status = 'registered'` after the workshop is `completed` |
| Cancelled | registration/workshop archived, or workshop cancelled |

Only the first four rows exist as persisted values; `WORKSHOP_PARTICIPANT_STATUSES` is exactly
`registered | attended | completed`. The six-state vocabulary is now a single shared derived enum
(`WORKSHOP_REGISTRATION_STATES`) with one resolver used by the roster UI, so the mapping is not
re-implemented per component. **The brief's six states are not six DB statuses, and the audit does
not pretend they are.**

### Attendance

`present | absent | late | excused` — shared tuple, DB CHECK and zod enum agree.

### Participant type

**Absent.** Every participant is a `contact_id`; there is no Student/External/Faculty discriminator
anywhere. Adding one is a model + import + UI decision (D1), not a schema tweak.

### Slot schedules

**Absent.** Workshops are date-only (`start_date`/`end_date`, no times/rooms/slots), so there is no
slot timestamp whose timezone could drift (D2; see the subsystems audit's slot design).

## 3. Runtime alignment changes

| Finding | Fix |
|---|---|
| Record date/timestamp fields were `z.string()` (accepted `not-a-date`, offsets, junk) | New `isoUtcTimestampSchema` + `isIsoUtcTimestamp` in `core/isoDateSchema.ts` (calendar-valid, mandatory `Z`, bounded clock). Record `startDate/endDate/registrationDeadline` and attendance `dayOn` use `isoDateSchema`; `completedAt/certificateIssuedAt/waitlistedAt/createdAt/updatedAt/deletedAt/restoredAt` use the UTC schema. Report dates likewise |
| `WORKSHOP_COMPLETION_STATUSES` was a second independent tuple | It now **is** `WORKSHOP_PARTICIPANT_STATUSES`; a set-equality test prevents drift |
| Two DB-row status casts bypassed the enums | Exported `workshopParticipantStatusSchema`/`workshopAttendanceStatusSchema`; mappers `.parse(row.status)` so a corrupt row fails loudly (the DB CHECK remains the invariant) |
| OCC contract header only a non-empty string; generic parser also accepted `x-expected-version`, which the workshop transition (timestamp CAS only) silently ignored and answered with a misleading 428 | Header schema now validates ISO-UTC; the transition route rejects `x-expected-version` with a 400 explaining `x-expected-updated-at` is required. Missing updated-at still yields 428 |
| Date-only display could shift a day in negative-offset timezones (`new Date("2026-03-05")` = UTC midnight, formatted in the workspace timezone) | `formatDate` detects pure `YYYY-MM-DD` and formats its calendar parts directly, bypassing instant conversion. ISO datetimes keep the timezone-aware path. Tests cover America/Los_Angeles, Asia/Karachi, Pacific/Kiritimati, Etc/GMT+12 |
| Both ts-rest routers cast `as unknown as RouterImplementation<Contract>` | Documented as the repo-wide ts-rest pattern; runtime `responseValidation: true` remains the guard (D4 if ever generalized) |

## 4. Tests

- `packages/shared/src/workshops/workshopsContracts.test.ts`: ISO-UTC accept/reject matrix, record
  date/timestamp rejection, participant/attendance status parsing, completion↔participant status
  set equality, all six registration-state branches and precedence.
- `settingsDateFormatters.test.ts`: date-only calendar stability across four timezones plus the
  timezone-aware ISO-datetime path.
- `workshopsSchema.test.ts`: event status CHECK (0245) now asserted against
  `WORKSHOP_LIFECYCLE_STATES`, alongside participant/attendance CHECKs.
- `workshops.integration.test.ts`: version-only OCC token → 400; malformed updated-at → 400; admin
  timestamp transition → 200.
- Frontend: roster renders the derived registration state (`registered`, `completed`).
- Full suites: shared 281/2278, backend 521/3686, frontend 1209/4545 (2 skipped); workshop DB
  suites 71; all ratchets/i18n/soft-delete/rules gates green.

## 5. Deferred

- **D1 participant type** — `participant_type` enum (`student | external_contact | faculty`) with
  migration, import mapping and picker; contacts-only today.
- **D2 workshop slots/times/rooms** — schema and timezone-aware slot timestamps (design in the
  subsystems audit).
- **D3 persisted waitlisted/no-show/cancelled participant statuses** — only if the derived six-state
  model proves insufficient; it would require a migration and rule changes.
- **D4 removing the ts-rest router cast pattern repo-wide.**
