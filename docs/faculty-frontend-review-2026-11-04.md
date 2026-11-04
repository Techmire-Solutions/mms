# MMS Faculty Frontend Review — 2026-11-04 (Round 1, dedicated)

Independent frontend review of the Faculty module at `main` HEAD `a51ae8bd5` (working tree in flux — see
§9). The multi-module `docs/frontend-module-review-2026-11-04.md` §7 first reported the Faculty frontend
(F-01…F-05, F-m1…F-m12); this review re-verifies those, audits surfaces no earlier round reached, and closes
the P1/P2 defects in the same change.

Scope: `apps/frontend/src/tenant/features/faculty/**` (19,897 LOC across 200+ files), the shared hooks it
composes (`lib/useModuleCrudNotify`, `lib/apiContractError`, `lib/query/createModuleSetupConfigApi`,
`components/app/ModuleTierPage`), the faculty contract consumed by the typed client, and the
`faculty.*` translation surface.

Method: `read`/`grep`/`glob` on every hook and component in scope, targeted `vitest` runs per finding
(red → green), `typecheck`, `lint`, and the structural/i18n ratchets. Root-cause technique: the ts-rest
fetcher (`lib/api.ts:31-64`) **throws only for 401/403** and resolves every other status as
`{ status, body }` — so a write helper that does not inspect the envelope reports failure as success.
Unproven concerns are marked **hypothesis**; missing coverage **untested**.

## 1. Baseline evidence

| Gate | At review start | After this change |
|---|---|---|
| Faculty frontend suite | 66 files / 214 tests | **71 files / 240 tests pass** |
| `pnpm --filter mms-frontend typecheck` | pass | **0 faculty errors** (repo-wide run fails on another session's dashboard/messaging/tasks edits) |
| `pnpm --filter mms-frontend lint` | pass | **0 faculty errors** (1 foreign error in `tasks/hooks/useTasksPageController.ts`) |
| `pnpm run check:i18n` | 9,558 keys complete | **9,564 keys, 0 missing / 0 EN-fallback** |
| `check:frontend-structure` | pass | pass |
| `check:code-norms` | pass | 1 foreign regression (`messageComposer/useMessageComposerModel.ts` at 310 lines) |

No browser/E2E/axe run was performed — the a11y and responsive claims in §7 below are static (labelled).

## 2. Verdict

**The module's write path was not trustworthy: every core faculty mutation reported success for 4xx/5xx
responses.** The optimistic-concurrency 409 that `handleSaveFaculty` explicitly claims to "surface"
(`useFacultyPageActions.ts:56-60`) resolved as a successful update: success toast, closed form, reset
dirty-baseline — a silently lost edit. Everything else in the module was structure-verified clean; the
remaining findings are the round-1 majors (all five still open at `a51ae8bd5`) plus one new tracking gap
(Setup config writes) and one data-fabrication gap in the drawer.

All P1/P2 findings below are now fixed with pinning tests; F-m4 (workload producer) stays product-deferred
with the backend M4 item.

## 3. Round-1 status re-verification

| # | Round-1 finding | Status at `a51ae8bd5` | Resolution |
|---|---|---|---|
| F-01 | "All genders"/"All specializations" writes `all` and empties the directory | **Open → fixed (FE-02)** | `facultyFilterValues.ts` maps `all ↔ ""` on both sides; the query builder drops it defensively |
| F-02 | A persisted-but-hidden tier renders a blank module body | **Open → fixed (FE-03)** | `resolveFacultyPageTab` repairs to the first visible tab and the controller persists it |
| F-03 | Contract-type select never reaches the API | **Open → fixed (FE-04)** | `employmentContractType` added to `FACULTY_PERSIST_KEYS` (server persists unknown keys in `custom_data`) |
| F-04 | Linked-user role select shows the module default, not the account role | **Open → fixed (FE-05)** | `resolveInitialUserAccountRole` + draft seeding; a real write can no longer demote an admin to `staff` |
| F-05 | User account written before the faculty record | **Open → fixed (FE-06)** | Record first, account second in both save paths; failure reports "saved, account not updated" |
| F-m1 | Leave save leaves the open drawer stale | **Open** (fixed the write guard; drawer still reads page state) | deferred (needs a per-row query source) |
| F-m2 | Catalog quick-create remount wipes typed designation | **Open** | deferred (needs modal state refactor) |
| F-m3 | Three hardcoded English placeholders | **Open → fixed (FE-09)** | 3 keys × 4 locales |
| F-m4 | Workload pill derives data no producer populates | **Open** | backend-deferred (`open-items.md` M4) |
| F-m5 | "Filtered" metric shows the faculties count on every tier | **Open → fixed (FE-10)** | the pill only renders on the `faculties` tier |
| F-m6 | Supervisor filter roster capped at 100 | **Open** | deferred (needs a roster endpoint/limit decision) |
| F-m7 | Departments/Designations peer tiers eager imports | **Open** | deferred (measure bundle first) |
| F-m8 | Sessions empty state reuses module-level copy | **Open** | deferred (copy decision) |
| F-m9 | Assignments section fabricates a primary row and hides errors | **Open → fixed (FE-08)** | error state + retry; profile-derived fallback clearly labelled, no synthetic row |
| F-m10 | Half-entered Ijazah entry lost on tab switch | **Open** | deferred (draft persistence design) |
| F-m11 | Unreachable `FacultyFormAllSections` fallback has drifted | **Open** | deferred (dead-code cleanup) |
| F-m12 / X-02 | Pagination disappears when the current page empties | **Open** | shared behaviour (other modules identical) |

## 4. Findings detail (new)

### FE-01 — P1 — Every core faculty write reported success for 4xx/5xx

**Evidence.** `hooks/useFacultyPageActions.ts` (pre-fix): `handleSaveFaculty` `:54-79`, `handleDelete`
`:85-103`, `handleRestore`, and the three bulk handlers call `mutateAsync` and immediately notify success /
read `body.succeeded`. The ts-rest fetcher resolves non-401/403 envelopes (`lib/api.ts:31-64`), and
`@ts-rest/react-query` exposes the envelope as the mutation result, so a 409/400/500 never rejected.
Students already guard every call (`useStudentsCrudActions.ts:44,51`), as do faculty's own
departments/designations hooks (`useFacultyDepartments.ts:67,90`) — the core path did not.

**Production path / consequence.** `PUT /api/faculty/:id` with a stale `x-expected-updated-at` → backend
409 → FE prints "Faculty member updated", resets the dirty baseline and closes the form. The edit is lost.
`DELETE /api/faculty/:id` 409 (subordinates/session links) → "archived" toast + undo. The drawer's leave
save (`components/FacultyDetail.tsx:73-79`) had the same hole and sent no OCC token at all.

**Fix.**
- `assertContractOk` after every write in `useFacultyPageActions` (create, update, delete, restore, all three
  bulk operations); success toasts only after the 2xx check.
- New `isConflictError` helper (`lib/apiContractError.ts`) and a conflict title (`faculty.toast.conflict`,
  server message as description) in `useFacultyCrudNotify`, `notifyFacultySaveFailed` and the leave modal.
- Drawer leave save sends `x-expected-updated-at` from the drawer row and guards the envelope.
- `facultyContract.update` now declares `409` (the backend already returns it).

**Test.** `hooks/useFacultyPageActions.test.tsx` (5 cases) — 200 updates notify + return the entity and send
the OCC header; 409/500 reject with no success toast; delete 409 never announces an archive; the bulk path
propagates transport failures.

### FE-02 — P2 — "All genders" / "All specializations" emptied the directory

**Evidence.** `FacultyFiltersMenuPanel.tsx:85-92,146-153` passed the neutral option's raw `"all"` to the
setter (department/designation/supervisor mapped it inline). `buildFacultyDirectoryQuery` only dropped
falsy values (`facultyQueryShared.ts:43-56`), and the shared schema has no `all` normalisation
(`packages/shared/src/faculty/facultyListQuery.ts:71-81`), so the request carried `gender=all` /
`specialization=all` and the SQL equality filter returned zero rows while the badge claimed one active
filter.

**Fix.** New `lib/facultyFilterValues.ts` (`normalizeFacultyFilterValue`, `facultyFilterMenuValue`) used by
the panel for all five groups and by `buildFacultyDirectoryQuery` as a second line of defence. No API change.

**Test.** `lib/facultyFilterValues.test.ts` (6 cases): `all` maps to `""`, the menu highlights the neutral
option when nothing is filtered, and the builder omits `gender`/`specialization`/`department`/`designation`/
`reportingFacultyId` for raw `all` while keeping real selections.

### FE-03 — P2 — A persisted-but-hidden tier blanked the module body

**Evidence.** `facultyPageWorkSubTabs.ts:77-84` returned `""` for a persisted tier that is no longer visible;
`ModuleTierPage.tsx:83-101` renders `null` when no tier matches → header + tab strip with no body. The unit
test pinned the blank result (`facultyPageWorkSubTabs.test.ts:33`).

**Fix.** `resolveFacultyPageTab` repairs to the first visible tab (default tier first), and
`useFacultyPageController` persists the repaired value so a stale permission-scoped value cannot resurface.
Only an empty visible set still yields `""`.

**Test.** `facultyPageWorkSubTabs.test.ts` rewritten: `setup` → `faculties`, `reports`/`["designations",
"setup"]` → `designations`, `""` → first visible, `[]` → `""`.

### FE-04 — P2 — The employment contract-type control could never persist

**Evidence.** `lib/facultyFormSavePayload.ts:15-32` omitted `employmentContractType`, so
`buildFacultySavePayload` dropped it while `FacultyEmploymentSection.tsx:123-128` marked the form dirty and the
hero rendered the stored value. The wire schema accepts the key
(`packages/shared/src/faculty/facultyModuleManifest.ts:108`) and the server persists unknown keys in
`faculty.custom_data` (`apps/backend/src/db/repositories/facultyRepositoryColumns.ts:41-46`), so the
frontend allowlist was the only gap.

**Fix.** Add `employmentContractType` to `FACULTY_PERSIST_KEYS`.

**Test.** `facultyFormSavePayload.test.ts` — the key survives `buildFacultySavePayload`.

### FE-05 — P2 — The linked-account role select showed `staff`, not the account's role

**Evidence.** `DEFAULT_USER_ACCOUNT_DRAFT.role = DEFAULT_FACULTY_USER_ROLE ("staff")`
(`lib/facultyFormDraft.ts:127-133`) and `FacultyLinkedUserCard.tsx:56` resolved
`userAccountDraft.role || linkedUser.role` — the default always won. `syncUserAccount` only writes when
`draftRole !== linkedUser.role`, so enabling the section and saving would write `staff` over an Admin role.

**Fix.** `resolveInitialUserAccountRole(draftRole, linkedUserRole)` (draft preserves a deliberate choice;
an untouched default adopts the account role) used by the card, plus a one-shot draft seed in
`FacultyUserAccountSection` so the write path agrees with the display.

**Test.** `facultyFormDraft.test.ts` — account role wins over the default, a deliberate pick is preserved,
no account → `staff`.

### FE-06 — P2 — The user account was written before the faculty record

**Evidence.** `lib/facultyFormSaveFlow.ts:116-127` and `lib/facultyFormUserSync.ts:116-131`
(`confirmPendingFacultySave`) ran `syncUserAccount` (users.create/users.update) before `onSave`.

**Consequence.** A failed faculty write (409 duplicate employee id, validation, 500) left a created account or
an applied role behind while the form stayed open; the retry could create a second account.

**Fix.** Both paths save the faculty record first and sync the account after it resolves; an account failure
now surfaces `faculty.toast.savedAccountFailed` ("record saved, account not updated"), keeps the form open and
does not close it. The faculty↔user link is resolved server-side from the contact, so the reorder cannot lose
the linkage.

**Test.** `lib/facultyFormSaveFlow.test.ts` (3 cases) — failed faculty write → `syncUserAccount` never
called; success order is `["faculty", "account"]`; account failure keeps the form open.

### FE-07 — P2 — Setup preferences/field-config reported success on failure

**Evidence.** `hooks/facultySetupConfigApi.ts` returned `res.body` without a status check for
`getPreferences`, `updatePreferences`, `getFieldConfig`, `updateFieldConfig`, so a 403/500 rendered
"Preferences saved" (`hooks/useFacultySetupSaveActions.ts:36-49`).

**Fix.** `assertContractOk` in all four adapter functions (module-local; the shared
`createModuleSetupConfigApi` is untouched).

**Test.** `hooks/facultySetupConfigApi.test.ts` (4 cases) — failed preferences save/read and field-config
save/read reject with the status; a 200 save still resolves.

### FE-08 — P2 — The drawer fabricated an appointment and hid the load error

**Evidence.** `hooks/useFacultyAssignments.ts:20` mapped any non-200 to `[]`; the section then rendered a
synthetic `primary-fallback` row (`isPrimary: true`, `status: "active"`, `startDate: ""`) from the faculty
row and never rendered `isError` (`FacultyDetailAssignmentsSection.tsx:26,40-58`).

**Fix.** The hook throws `apiContractError` on non-200; the section renders a load error with a retry
(`faculty.errors.loadAssignments` + `common.retry`), and only a *successful empty* list falls back to the
profile's primary designation/department — marked `faculty.assignments.derivedFromProfile`, with no status
badge and no invented dates.

**Test.** `FacultyDetailAssignmentsSection.test.tsx` (2 cases) — error → error copy, no fabrication;
success-empty → derived fallback with the explicit label.

### FE-09 / FE-10 — P3 — Copy and metric scope

- Three hardcoded English placeholders replaced with `faculty.leave.reasonPlaceholder`,
  `faculty.ijazah.authorityPlaceholder`, `faculty.ijazah.yearPlaceholder` (`FacultyLeaveModal.tsx:192`,
  `FacultyIjazahSection.tsx:165,174`).
- `FacultyCommandMetrics.shown` is now optional and `FacultyPageView` only passes the filtered count on the
  `faculties` tier (`FacultyPageView.tsx:74-82`), so Departments/Designations/Reports/Setup no longer report
  the faculties directory count.

### FE-11 — P3 — Contract response drift

`facultyContract.update` lacked the `409` the backend returns (fixed as part of FE-01). The create/update
response envelope (`{faculty, facultyMember}`) was already handled.

## 5. Minors & deferred register

| # | Item | Status |
|---|---|---|
| F-m1 | Leave save leaves the open drawer stale (drawer reads page state, not a query) | Deferred — needs a per-row query source |
| F-m2 | Quick-creating a department inside the designation modal remounts and wipes the typed designation | Deferred — modal state refactor |
| F-m4 | Workload pill/class-count have no backend producer | Deferred — `open-items.md` Faculty M4 |
| F-m6 | Supervisor filter roster capped at the first 100 faculty | Deferred — roster endpoint/limit decision |
| F-m7 | Departments/Designations peer tiers are eager imports | Deferred — measure bundle first |
| F-m8 | Sessions empty state reuses module-level copy | Deferred — copy decision |
| F-m10 | Half-entered Ijazah entry lost on form tab switch | Deferred — draft persistence design |
| F-m11 | Unreachable `FacultyFormAllSections` fallback has drifted | Deferred — dead-code cleanup |
| F-m12 | Pagination disappears when the current page empties | Shared (`ModuleWorkTier` behaviour) |
| — | Bulk status/specialization bypass OCC by design (no token) and emit one summary audit row (project-wide pattern) | Accepted |

## 6. Test gaps remaining

1. **No faculty E2E or axe spec** — critical-path/résumé/a11y coverage for the module is still browser-untested.
2. No test for the drawer's leave-save OCC round-trip beyond the conflict copy (no component test for
   `FacultyLeaveModal` save ordering).
3. `FacultyLinkedUserCard`/`FacultyUserAccountSection` seeding is covered at the pure-helper level, not through
   a rendered form round-trip.
4. No regression test for the "Filtered" metric scope (covered only by type + the component's existing
   snapshot-ish tests).

## 7. Verified-clean surfaces

- **Routing/module gating.** Peer tabs are permission-filtered (`useFacultyPageController.ts:43-52`); Reports
  and Setup are lazy; module-access routing is shared with the tenant shell.
- **Query layer.** TanStack Query keys are tuple-scoped (`facultyQueryKeys`), `placeholderData` is
  filter-aware (`useFacultyTsrQueries.ts:74-84`), list reads check `status === 200`, and faculty mutations
  invalidate list/metrics/widgets/preferences/lookups **plus** contacts (`invalidateFacultyQueries.ts`).
  Realtime invalidation is wired centrally (`lib/tenant/invalidateModuleQueries.ts:53`).
- **No dual data path.** No localStorage document-store read for faculty; all reads/writes go through the
  contract.
- **Directory behaviour.** Page reset on every filter/search/sort/trash change; selection scoped to the rendered
  page (`computeFacultySelectionTargets`); server pagination with virtualization above the row threshold.
- **Forms.** Dirty baseline + discard confirm; saving disables the footer; validation errors focus/scroll to the
  field; duplicate employee-id preflight; designation-scoped role allow-list checked before save.
- **Catalog setup.** Departments/designations hooks guard every envelope and expose 409s; duplicate-name
  preflight; delete guards.
- **i18n & BiDi.** 9,564 keys complete across en/ar/ur/fa; no physical CSS utilities
  (`ml/mr/pl/pr/left/right`) anywhere in `features/faculty/*.tsx`; logical spacing and start/end alignment.
- **Imports/exports.** CSV import/export go through the shared `useModuleCsvImportActions` /
  `useModuleServerCsvExportActions`; the client-forgeable export-audit call was removed with the backend round-3
  fix.

## 8. Adversarial audit

**Edge cases.** OCC 409 keeps the form open and the baseline dirty; 400 keeps field errors; 500 keeps the form
open. Delete/restore conflicts no longer produce an undo affordance for a record that was never archived. Bulk
partial results still read `succeeded/failed` from a 2xx body only. "All …" filters clear the param on both the
list and the CSV-export query. A persisted `setup`/`reports` tier resolves and persists a visible tab. An
existing account opens the role select on its own role and a save without touching it writes nothing.

**Failure modes.** Queue/transport failures in imports and exports still surface through the shared job
helpers; setup saves now fail loudly; the assignments section offers retry instead of empty-looking data.

**Security / multi-tenancy.** Client-side module and action gating is unchanged and remains
non-authoritative (the backend gate is the boundary). The review removed no guard: the write path is now
strictly stricter, and no endpoint or payload shape was widened.

**Concurrency.** Every faculty write now respects the OCC token the backend already enforces; a stale edit is a
visible conflict instead of a silent overwrite. Account sync runs after the record write, so a concurrent
failure cannot leave a privileged account behind a failed record.

**Accessibility.** No regression: the new assignments error state uses a text paragraph plus a real button, and
the conflict toasts use the existing `notify` surface (live region). Faculty axe coverage remains missing
(§6.1) — labelled untested, not claimed.

## 9. Change set

Source: `hooks/useFacultyPageActions.ts`, `hooks/useFacultyCrudNotify.ts`, `hooks/useFacultyAssignments.ts`,
`hooks/facultyQueryShared.ts`, `hooks/facultySetupConfigApi.ts`, `hooks/useFacultyPageController.ts`,
`lib/facultyFormSaveFlow.ts`, `lib/facultyFormUserSync.ts`, `lib/facultyFormSavePayload.ts`,
`lib/facultyFormDraft.ts`, `lib/facultyFilterValues.ts` (new), `facultyPageWorkSubTabs.ts`,
`components/FacultyDetail.tsx`, `components/FacultyLeaveModal.tsx`, `components/FacultyLinkedUserCard.tsx`,
`components/FacultyUserAccountSection.tsx`, `components/FacultyDetailAssignmentsSection.tsx`,
`components/FacultyFiltersMenuPanel.tsx`, `components/FacultyCommandMetrics.tsx`,
`components/FacultyPageView.tsx`, `lib/apiContractError.ts`,
`packages/shared/src/contracts/faculty.contract.ts`, `packages/shared/src/i18n/appTranslations{En,Ar,Ur,Fa}.ts`.

Tests added: `hooks/useFacultyPageActions.test.tsx`, `hooks/facultySetupConfigApi.test.ts`,
`lib/facultyFilterValues.test.ts`, `lib/facultyFormSaveFlow.test.ts`,
`components/FacultyDetailAssignmentsSection.test.tsx`. Rewritten/extended: `facultyPageWorkSubTabs.test.ts`,
`facultyFormSavePayload.test.ts`, `facultyFormDraft.test.ts`.

Gates: faculty suite **71 files / 240 tests** · `typecheck` (0 faculty errors) · `lint` (0 faculty errors) ·
`check:i18n` (9,564 keys complete) · `check:frontend-structure` · `check:work-directory` · `check:docs`.

Working-tree note: another session is concurrently editing `contacts/`, `dashboard/`, `messaging/`,
`students/`, `tasks/` and `components/messageComposer`; the repo-wide `typecheck`/`lint`/`code-norms` failures
at the time of writing come from those files, not from this change set.
