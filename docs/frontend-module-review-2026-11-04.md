# MMS Frontend Module Review — Dashboard, Contacts, Students, Faculty, Tasks

Independent, read-only review of the tenant-console frontend for the five modules at `main`
HEAD `30abb1b41` (working tree clean at review time). Scope is frontend only: React 19
components, page controllers, hooks, presentation state, cache/query usage, i18n, BiDi,
accessibility, and the shared shell primitives those modules consume. Backend handlers,
services, and SQL were opened only to explain a frontend symptom.

**No Critical findings.** No authorization escalation, cross-tenant render, or destructive
data path was found in the reviewed frontend. The material defects are state and recovery
gaps: failed metric loads render authoritative zeros, unsaved drafts are discarded on tier
switches, optimistic-concurrency conflicts have no recovery UI, a persisted tier can blank
a module body, and one faculty filter option empties the directory. Full-stack findings
already recorded in the dated module reviews are reconciled in §13, not re-counted here.

## 1. Scope and method

| Module | Non-test source files / LOC | Test files |
| --- | --- | --- |
| Dashboard | 21 / 2,615 | 7 |
| Contacts | 183 / 19,109 | 124 |
| Students | 120 / 11,128 | 63 |
| Faculty | 136 / 13,593 | 66 |
| Tasks | 35 / 3,725 | 21 |
| **Total** | **495 / 50,170** | **281** |

Shared surfaces inspected centrally: `ModuleTierPage`, `ModulePageShell`,
`ResponsiveAccordionTabs`, `useModuleTierPageNav`, `usePersistedTabState`,
`useWorkSelection`, `useDirectoryTrashState`, `WorkBatchTable`/`DataTable`, `FormModal`,
`DetailDrawerShell`, `ModuleCommandMetricsGrid`, module bulk bars,
`tenant/hooks/collections/*`, `routeAccess.ts`, `ModuleAccessRoute`, and the i18n
dictionaries for the module keys.

Method: read-only. Each reviewer read the module's page → tier → controller → list/form/
detail command path in full, plus all files >100 LOC, and sampled leaf presentational cells
through the import graph. Every Critical/Major finding below was re-opened and verified by
the coordinating reviewer; derived findings are labelled. Automated evidence was collected
first, then the static pass, then a focused axe sweep.

## 2. Baseline evidence

| Check | Result |
| --- | --- |
| `pnpm --filter mms-frontend typecheck` | Pass |
| `pnpm --filter mms-frontend lint` | Pass |
| Targeted Vitest (`features/{dashboard,contacts,students,faculty,tasks}`) | **281 files / 835 tests passed** (26.8 s) |
| `check:frontend-structure` / `check:work-directory` | Pass (0 issues) |
| `check:code-norms` | Pass — 0 `any`, 0 arbitrary-colour expressions, 4 files >300 LOC (baseline, none in scope), 26 raw hex (baseline) |
| `check:shared-ui` | Pass (0 duplicate/orphan violations) |
| `check:i18n` | Pass — 9,530 keys, 0 missing / 0 EN fallback in ar/ur/fa |
| `check:bundle` | Pass — 637 chunks, 14.75 MB JS (budget 16 MB), 4.21 MB gzip (budget 4.5 MB) |
| Focused axe sweep (`a11y-shell`, 375/1440 LTR + 1440 RTL) | **7/7 passed** (2.4 min) |

Limitations: the axe run skipped the overlay audits (`contacts` had no drawer trigger;
`students` opened no dialog), so drawer a11y is static-only here. No database, Playwright
flow, visual pixel review, or production-data performance measurement was performed. The
run provisioned throwaway local E2E tenants.

## 3. Verdict and scorecard

| Module | Verdict | Architecture | Directory | Forms | Data/cache | i18n/BiDi | A11y | Reuse |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Dashboard | Data-failure and permission-gating defects; shell correct | Strong | n/a (non-CRUD) | n/a | **Needs work** | Strong | Adequate | Adequate |
| Contacts | Gold-standard shell and directory; drawer/OCC gaps | Strong | Strong | Adequate | Adequate | Adequate | Adequate | Strong |
| Students | Strong overall; import and template-editor gaps | Strong | Strong | Adequate | Adequate | Adequate | Adequate | Strong |
| Faculty | Two directory-breaking defects; write-ordering risks | Adequate | **Needs work** | **Needs work** | Adequate | Adequate | Adequate | Adequate |
| Tasks | Structurally close; recovery and interaction defects | Adequate | Adequate | **Needs work** | Adequate | Strong | Adequate | Strong |

The frontend remains structurally mature: every page is lazy-split, the shared table/form/
drawer primitives are adopted, physical CSS directions are absent, and i18n key parity is
machine-enforced. The defects that remain are exactly the ones those gates cannot see —
state ownership across unmounts, retry/conflict recovery, and copy that is constructed
rather than keyed.

## 4. Dashboard

### D-01 [Major] A failed summary/metric load renders authoritative zeros — no error, no retry
`apps/frontend/src/tenant/features/dashboard/hooks/useDashboardData.ts:212-236`,
`.../buildDashboardMetricCard.ts:111`

```ts
const studentsTotal = studentMetrics?.total ?? 0;
...
return { ..., isLoading: isLoading || isPending };
```

`useDashboardData` exposes only `isLoading`, discarding the summary query's error state.
Every snapshot defaults to `0`, and `buildDashboardMetricCard` renders `resolvedMetric?.value ?? "0"`.
After a 502 on `/dashboard/summary` plus failed per-collection fallbacks, a tenant with
thousands of students sees "Total Students 0" with no error, retry, or live-region message.
`WelcomeBanner` likewise states "0 sessions" (`dashboardRole.ts:34-37`).

**Fix:** surface `isError`/`refetch` from `useDashboardSummaryQuery` through `useDashboardData`;
render `ErrorState` when the summary failed and no section loaded; render `—`, not `0`, for
an undefined snapshot. **Test:** `useDashboardData.error.test.ts` (502 → `isError`, no `0` card)
and a grid case asserting a retry affordance.

### D-02 [Major] Widget loading/error renders the seeded default library as the saved layout
`apps/frontend/src/tenant/features/dashboard/hooks/useDashboardSetupConfig.ts:94-96`,
`apps/frontend/src/hooks/useDashboardConfig.ts:49-51`

`useDashboardWidgetsQuery` substitutes `DEFAULT_WIDGETS_PLACEHOLDER` whenever `rawWidgets`
is undefined — which is both the pending and the errored state. `useDashboardConfig` then
treats a non-empty list as "server has rows", so a deleted layout reappears, and
`DashboardWidgets` starts `useWidgetCollections`/`use*WidgetAggregates` fetches for those
phantom widgets. There is no error or retry path for the widgets query.

**Fix:** return `data: undefined` plus `isError` until the query succeeds; keep the default
library only for the first-run seed path, not for render. **Test:**
`useDashboardWidgetsQuery.test.tsx` — reject `getWidgets` and assert no widget grid and no
aggregate fetches.

### D-03 [Major] Preferences are full-document PUTs from the unhydrated default
`apps/frontend/src/hooks/useDashboardConfig.ts:81`,
`.../useDashboardSetupConfig.ts:40-46`

`useDashboardPreferencesQuery` returns `DEFAULT_DASHBOARD_PREFERENCES` until the GET
resolves, and `updatePref` falls back to that same object when the cache is empty. A toggle
fired before hydration therefore PUTs the full default document with one field changed,
reverting stored `gridMode`, both attendance thresholds, and chart preferences. The
optimistic `onMutate` replaces the whole document, and `toggleCardVisibility` reads
`prefs.disabledCardIds` from the render closure, so two toggles in one tick can drop the
first id. Derived from the code path (not executed against a live store).

**Fix:** gate writes on `prefsQuery.isSuccess`, derive the next document from the cache,
and send a patch-shaped body. **Test:** with the GET pending, assert no PUT; with a seeded
cache, two toggles in one tick preserve both ids.

### D-04 [Major] Layout-write controls bypass the customize permission
`apps/frontend/src/components/reports/pinnedWidgets/DashboardWidgetsGrid.tsx:104`,
`.../DashboardWidgetsHeader.tsx:26-37`, `apps/frontend/src/tenant/features/dashboard/DashboardPage.tsx:166`

The Customize toggle is gated by `configuration.view` (`DashboardPage.tsx:94`), but the
per-widget Unpin button is rendered for every viewer in all modes, the density segmented
control always persists `gridMode`, and "Reset cards" is always offered. The backend rejects
these writes with 403 (`canWriteDashboard` requires `setupWrite` or `customize`), so the
optimistic cache mutation is rolled back and the user sees a failure toast from controls the
product says they cannot use. No unauthorized write was found.

**Fix:** derive one `canCustomize` in the controller and thread it to the grid/header/reset
action; hide or disable the controls when false. **Test:** deny `configuration.view`, assert
no unpin/density/reset control and no `putPreferences` call.

### D-05 [Major] Accountant sees a fabricated "all fees clear" alert when finance metrics are unknown
`apps/frontend/src/lib/buildDashboardNotifications.ts:122`,
`apps/frontend/src/tenant/features/dashboard/hooks/useDashboardPageController.ts:136-149`

`unpaidCount` is `financeMetrics?.outstanding ?? 0`, and the builder emits the green
`fees-clear` notification whenever the role is accountant/administrator and finance read is
granted. A failed summary, an in-flight load, or a disabled finance module all produce
`0` and assert a fact the client has not loaded.

**Fix:** pass a `financeLoaded` flag and emit `fees-clear` only when metrics are loaded and
the count is 0. **Test:** `buildDashboardNotifications.test.ts` — unloaded metrics emit no
`fees-clear`.

### Dashboard minors

| ID | Finding | Evidence |
| --- | --- | --- |
| D-m1 | Print snapshot hides the welcome `<header>` via the global `@media print` rule, so the greeting/name/dates are missing; collapsed insights and mobile-overflow metrics are also absent | `index.css:1303`, `WelcomeBanner.tsx:54`, `DashboardPage.tsx:68-71,218` |
| D-m2 | Widget/card deletion is immediate and unrecoverable (no confirm, no undo) | `DashboardCustomizeWidgetsSection.tsx:116`, `StatisticsGrid.tsx:149-161` |
| D-m3 | Inline widget builder has no Escape handler, autofocus, dialog semantics, or focus return; it scrolls the document away from the panel | `useDashboardPageController.ts:62-70`, `DashboardCustomizePanel.tsx:58-79` |
| D-m4 | Loading grid has no `aria-busy` or `role="status"` text; always four skeletons | `StatisticsGrid.tsx:44-62` |
| D-m5 | Six REST-facade functions and seven `useDashboardContract*` aliases have no production consumer | `dashboardApi.ts:11-69`, `tenant/hooks/collections/dashboard.ts:23-31` |
| D-m6 | Per-render trend/card/notification derivations are unmemoised; `DashboardWidgets` mounts a second `useDashboardConfig()` graph just for `gridMode` | `useDashboardMetricCards.ts:33`, `pinnedWidgets/DashboardWidgets.tsx:51` |
| D-m7 | Setup callout uses a raw `settings.branding.write` literal and an OR-completeness check | `DashboardPage.tsx:61`, `SetupIncompleteCallout.tsx:17-25` |

**Verified clean:** non-CRUD landing model (`dashboardModuleManifest.ts:16`, `tiers: []`);
`ModulePageShell` SEO/header; metric/widget permission filtering through
`isDashboardWidgetAllowed` before render and fetch; no early module fetches while access is
pending; 44 px targets on dashboard controls; logical CSS; keyboard-operable widget reorder;
module/permission-filtered quick actions; per-user notification read state; i18n keys present
in all four locales.

## 5. Contacts

### C-01 [Major] Detail drawer renders collection sub-fields the viewer role cannot see
`apps/frontend/src/tenant/features/contacts/components/detail/ContactDetailCollections.tsx:51-106`,
`.../ContactDetailPhonesSection.tsx:28`, `.../contactDetailChannelSections` equivalent for bank details,
`.../hooks/useContactDetailFields.ts:66-79`

Collection tabs are split into field definitions (`phones.label`, `phones.number`,
`bankDetails.accountNumber`, …), each carrying `permissions[]`. The drawer filters those
definitions with `canViewContactField`, but uses the result only to decide whether a section
exists; the section then renders the raw `contact.phones` / `contact.bankDetails` arrays.
A role denied `bankDetails.accountNumber` still sees the account number whenever a sibling
field (e.g. `bankName`) is visible. Grouped scalar fields do apply the gate, so this is the
one inconsistent surface. No backend enforcement of `canViewContactField` was found, so the
field-permission feature is client-side only.

**Fix:** pass the filtered collection entries into each section (or filter inside the
section with the same predicate), and gate bank details on a visible sub-field. **Test:**
render the drawer with `accountNumber` denied and assert the value is absent.

### C-02 [Major] Optimistic-concurrency 409 has no recovery path
`apps/frontend/src/tenant/features/contacts/hooks/useContactFormSave.ts:145-157`,
`.../useContactMutations.ts:95-97`

The update sends `x-expected-updated-at`, but no contacts hook branches on 409. On a stale
token the draft keeps the old timestamp, so every retry 409s forever; the user must close and
lose the edit. The toast uses `settings.serverSaveFailed`, a cross-namespace key. The
document-template conflict pattern (`useTemplateSaveConflict`) already exists as the model.

**Fix:** detect 409, keep the draft, block re-save, offer "reload latest" with an explicit
overwrite path, and use a `contacts.*` key. **Test:** reject `updateContact` with 409, assert
the modal stays open and a conflict action is shown.

### Contacts minors

| ID | Finding | Evidence |
| --- | --- | --- |
| C-m1 | Validation failure keeps only `tabId`; `fieldId`/`index` are dropped, so no focus/scroll to the invalid field (students/faculty do focus) | `ContactForm.tsx:74`, `useContactFormSave.ts:70,145` |
| C-m2 | The Google OAuth "open Setup → Sync" one-shot reader runs during render and is consumed; the next render flips `initialKey` to Preferences | `ContactsSetupTier.tsx:63`, `googleContactsOAuth.ts:190` |
| C-m3 | Command metrics render `0` while loading or after failure; `isLoading`/`isError` are ignored | `ContactsCommandMetrics.tsx:26-30` |
| C-m4 | "Filtered" tile reads 0 on Setup/Reports because the work query is disabled outside Work | `useContactsDirectory.ts:29,56`, `ContactsPageView.tsx:76` |
| C-m5 | Selection is hand-rolled local state instead of `useWorkSelection`; stale ids survive a row disappearing from the same page | `useContactsDirectoryFilters.ts:31`, `useContactsPageDirectoryProps.ts:65` |
| C-m6 | Conflict retry cap is enforced only in "Keep local"; "Retry all" and "Apply merge" requeue uncapped (already open: round-5 m-2) | `contactsSyncOutboxConflicts.ts:50`, `useContactsSyncConflictRow.ts:91-141` |
| C-m7 | Bulk tag modal double-submits; `isTagPending` exists but is never wired | `ContactsBulkActionBar.tsx:32,110`, `ContactsBulkTagModal.tsx:45` |
| C-m8 | A failed bulk delete still clears the selection (`.then` after a caught failure) | `useContactsPageDeleteActions.ts:79` |
| C-m9 | CSV import job labels/errors are hardcoded English | `ContactsCsvImportDialog.tsx:56-74` |
| C-m10 | Form panel renders raw `tab`, not the resolved `activeTab`, after enabled tabs shrink | `ContactForm.tsx:163` |
| C-m11 | Sub-list rows are keyed by index (`formInstanceId-tab-idx`), so removing a middle row remounts the rest | `ContactLabeledValueSubListTab.tsx:138`, `useContactFormDraftHelpers.ts:40` |
| C-m12 | File-size formatting uses browser locale (`Intl.NumberFormat(undefined)`) beside app-language dates | `ContactDetailFiles.tsx:82` |
| C-m13 | Outbox state is subscribed three times, so banner/metrics/panel disagree about `flushing` and can emit duplicate success toasts | `ContactsDataBanner.tsx:21`, `useContactsConflictPanel.ts:8`, `ContactsSyncConflictPanel.tsx:30` |
| C-m14 | Setup sub-tabs are manifest-driven but rendering is hardcoded to `preferences`/`sync`; a new key renders an empty panel | `ContactsSetupTier.tsx:44-97` |

**Verified clean:** `ModuleTierPage` shell with `nav.contacts` label, persisted/reconciled
tier, lazy Reports/Setup behind Suspense + ErrorBoundary, active-tier-only rendering; header
is the only IO owner and hides create/import/export in trash; server pagination and
virtualization >30; single filter menu; selection scope resets on filter/page; dirty draft
preserved across refetch and save failure; shared Zod validation; authenticated uploads and
data-URL rejection; outbox keys tenant+user scoped with module-level single-flight; query
invalidation fans out to messaging/students; archived chrome and confirm dialogs; 44 px
targets; logical CSS.

## 6. Students

### S-01 [Major] CSV import closes before completion, so partial failures are never shown
`apps/frontend/src/components/app/StandardModuleCsvImportDialog.tsx:41-48`,
`apps/frontend/src/lib/backgroundJobs/useModuleCsvImportActions.ts:122-132`

The shared dialog passes `onSuccess: onClose`, and the shared action hook calls
`setCompletedJob(job)` immediately before `onSuccess?.()`. The dialog therefore unmounts as
soon as the job finishes, so `ModuleImportDialog`'s completed/partial-failure panel can never
render; per-row failure counts are lost. The success toast uses the server job label
("Importing Students") rather than `imported N / failed M`, and the catch branch emits a
hardcoded English `Import failed: …`, which the i18n gate cannot see. This affects every
module that uses the shared dialog (Students, Faculty, Tasks, and others); Contacts has its
own dialog and the same class of bug in C-m9.

**Fix:** do not close on submit success; keep the dialog mounted and render `completedJob`
with succeeded/failed counts; replace the constructed strings with module keys. **Test:**
complete an import with `failed > 0` and assert the dialog stays open with the failure count.

### S-02 [Major] Bulk-status menu offers global default statuses, not the tenant's configured ones
`apps/frontend/src/tenant/features/students/hooks/useStudentsPageOverlayState.ts:14`,
`apps/frontend/src/lib/students/studentStatusUi.ts:22-28`,
`.../hooks/useStudentsPageController.ts:44`

The bulk bar's status config comes from `studentStatusBadgeConfig(t)` with no configured
list, resolving `STUDENT_STATUS_VALUES`; the filter menu and form use
`resolveStudentStatuses(configuredStatuses)`. A write user can bulk-set a status the tenant
removed from Preferences and cannot bulk-set a tenant-added status the form offers.

**Fix:** build the band config from `resolveStudentStatuses(settings.statuses)` and thread it
into `StudentsBulkActionBar`. **Test:** statuses `["active","on_leave"]` yield exactly two
bulk options.

### S-03 [Major] Card-template side switch disarms the unsaved-changes guard
`apps/frontend/src/tenant/features/students/components/card-template/StudentCardTemplateEditor.tsx:224-238`

`TemplateEditor` is remounted via `key={`card-editor-${activeSide}-${reloadNonce}`}`, and its
dirty baseline is seeded at mount while it reports `onDirtyChange(editor.isDirty)`. Switching
front↔back re-baselines the editor as pristine, so the parent guard clears even though the
front layout was just edited; leaving Setup then discards it without a prompt. Derived from
the remount + dirty-reporting code path.

**Fix:** keep one editor instance or derive dirtiness in the parent from the full template
vs the last saved snapshot. **Test:** edit front, switch to back, assert `onDirtyChange` was
never called with `false` and leaving prompts.

### Students minors

| ID | Finding | Evidence |
| --- | --- | --- |
| S-m1 | "Total" KPI falls back to the filtered shown count while metrics load or fail | `StudentsPageView.tsx:65`, `StudentsCommandMetrics.tsx:22` |
| S-m2 | Avatar upload updates the linked contact but never invalidates student rows/cards | `useStudentFormActionHandlers.ts:159` |
| S-m3 | Card `canSelect={canDelete}` governs only Space-key selection; the header checkbox stays visible and the table is unrestricted | `StudentCard.tsx:67`, `DirectoryCardHeader.tsx:77` |
| S-m4 | Printed card defaults are hardcoded English and fall back to the product name instead of the workspace name | `studentCardTemplateBackDefaults.ts:10,47` |
| S-m5 | Dead create branch writes `setEditStudent(savedStudent)` immediately before `closeStudentForm()` nulls it | `useStudentsPageOverlayProps.ts:42`, `studentFormSaveFlow.ts:113-122` |
| S-m6 | Non-GR 409 falls through to the generic `students.saveFailed` toast (same OCC gap as C-02) | `useStudentsCrudActions.ts:41`, `studentFormSaveFlow.ts:125` |
| S-m7 | Setup prefs/card-template draft is lost when switching tier — see X-01 | `StudentsPageView.tsx:73`, `StudentsSetupTier.tsx:23,78` |
| S-m8 | Pagination disappears when the current page empties — see X-02 | `StudentsList.tsx:81` |

**Verified clean:** `useModuleTierPageNav` persisted + reconciled tabs; lazy Reports/Setup;
header IO hidden in trash; render-phase page reset and selection scoping; server pagination
with virtualization >30; bulk delete/restore/enroll keep dialog and selection on failure;
bulk enroll double-gated by enrollment write; form dirty baseline/reset, GR autofill,
Zod/duplicate/GR-conflict validation with focus; drawer capability/archive chrome; print
unclamp; invalidation includes contacts/sessions/enrollments; row-action gating; no
hardcoded strings in the `.tsx` surfaces (spot check).

## 7. Faculty

### F-01 [Major] "All genders" / "All specializations" writes the literal `all` and empties the directory
`apps/frontend/src/tenant/features/faculty/components/FacultyFiltersMenuPanel.tsx:92,153`,
`.../hooks/facultyQueryShared.ts:45-56`

The neutral option passes its raw `"all"` value to the setter, unlike the
department/designation/supervisor groups which map `"all"` → `""`. `buildFacultyDirectoryQuery`
only drops falsy values, so the request carries `gender=all` / `specialization=all` and the
list SQL applies equality, returning zero rows. The UI shows "All …" selected, a filter-count
badge of 1, and no chip (chips treat `"all"` as inactive) — an active-filter badge over an
empty table.

**Fix:** map `"all"` → `""` for both groups (or normalise in the query builder). **Test:**
fire the radio change and assert the setter receives `""` and the outgoing query omits the
param.

### F-02 [Major] A persisted tier that is no longer visible renders a blank module body
`apps/frontend/src/tenant/features/faculty/facultyPageWorkSubTabs.ts:77-84`,
`apps/frontend/src/components/app/ModuleTierPage.tsx:83`,
`apps/frontend/src/tenant/hooks/useModuleTierPageNav.ts:54-58`

`resolveFacultyPageTab` returns `""` when the persisted tier is filtered out (e.g. persisted
`setup`, then setup permission is revoked). `ModuleTierPage` then finds no active tier and
renders header + tab strip with no body. The shared nav hook used by Contacts/Students
repairs exactly this case on desktop; Faculty reimplemented nav and omitted the fallback. The
existing unit test pins the blank result instead of the fallback.

**Fix:** resolve `""` to the first visible tab on desktop (and persist it), mirroring
`useModuleTierPageNav`. **Test:** `resolveFacultyPageTab("setup", [faculties, departments,
designations, reports])` must not return `""`.

### F-03 [Major] Contract-type select never reaches the API
`apps/frontend/src/tenant/features/faculty/components/FacultyEmploymentSection.tsx:115-129`,
`apps/frontend/src/tenant/features/faculty/lib/facultyFormSavePayload.ts:15-32`

The draft updates `employmentContractType` and the form goes dirty, but
`FACULTY_PERSIST_KEYS` omits the key, so `buildFacultySavePayload` drops it. The detail hero
renders the stored value as if the control persisted. A visible employment control can
therefore never be saved.

**Fix:** add `"employmentContractType"` to the persist allowlist (or remove the control).
**Test:** payload test asserts the key survives.

### F-04 [Major] Linked-user role select shows the module default, not the account's role
`apps/frontend/src/tenant/features/faculty/components/FacultyLinkedUserCard.tsx:51-60`,
`apps/frontend/src/tenant/features/faculty/lib/facultyFormDraft.ts:127-133`

`DEFAULT_USER_ACCOUNT_DRAFT.role` is `"staff"`, so `userAccountDraft.role || linkedUser.role`
always resolves to `staff`. An existing admin account opens with the badge showing "Admin"
while the editable select says "Staff"; any change writes a role from a value the account
never had. The write itself only happens when `enabled` is set, so this is a misleading
control rather than a silent demotion.

**Fix:** initialise the draft role from `linkedUser.role` (reset on account change); use the
default only for new accounts. **Test:** render with `linkedUser.role="admin"` and assert the
selected option is admin.

### F-05 [Major] User account is written before the faculty record, orphaning it on a failed save
`apps/frontend/src/tenant/features/faculty/lib/facultyFormSaveFlow.ts:116-128`,
`.../facultyFormUserSync.ts:40-80`

`syncUserAccount` performs `users.create`/`users.update` before `onSave(payload)`. If the
faculty write then fails (duplicate employee id, 409, 500), the role change or account
persists while the form reports failure and stays open; retry can create a second account or
re-apply an abandoned role. The same ordering exists in the pending-duplicate confirm path.

**Fix:** save the faculty record first, then sync the account; report "record saved, account
not updated" distinctly. **Test:** reject `onSave` and assert `users.create` was never called.

### Faculty minors

| ID | Finding | Evidence |
| --- | --- | --- |
| F-m1 | Leave save succeeds but the open drawer keeps the pre-save badge/banner (source is page state, not a query) | `FacultyDetail.tsx:74-79`, `useFacultyPageOverlayState.ts:17` |
| F-m2 | Quick-creating a department inside the designation modal changes `defaultDepartmentId`, remounts the content via `key`, and wipes the typed designation | `FacultyDesignationFormModal.tsx:190`, `FacultyCatalogCreateOverlays.tsx:66` |
| F-m3 | Three hardcoded English placeholders (leave reason, Ijazah authority/year) | `FacultyLeaveModal.tsx:182`, `FacultyIjazahSection.tsx:165,174` |
| F-m4 | Workload pill derives `assignedClasses(Count)` which no list/backend producer populates, so every row claims "Available" (already open: round-2 M4) | `FacultyWorkloadPill.tsx:23-48`, `facultyWorkColumnCell.tsx:93-103` |
| F-m5 | Command-centre "Filtered" shows the cached Faculties count on Departments/Designations/Reports/Setup | `useFacultyWorkTierState.ts:86,109`, `FacultyPageView.tsx:74` |
| F-m6 | Supervisor filter roster is capped at the first 100 faculty, so larger rosters cannot be filtered by supervisor | `useFacultyDirectoryFilterCatalog.ts:8,43-53` |
| F-m7 | Departments/Designations peer tiers are eager imports; only Reports/Setup are lazy | `FacultyPageView.tsx:78-86` |
| F-m8 | Sessions empty state reuses the module-level "add faculty members" copy inside a member drawer | `FacultyDetailSessionsSection.tsx:62` |
| F-m9 | Assignments section fabricates an `active` primary row when the fetch fails and maps non-200 to `[]` | `FacultyDetailAssignmentsSection.tsx:40`, `useFacultyAssignments.ts:20` |
| F-m10 | Half-entered Ijazah entry is local state and is lost on form tab switch | `FacultyIjazahSection.tsx:22`, `FacultyFormTabContent.tsx:46-64` |
| F-m11 | Unreachable `FacultyFormAllSections` fallback has drifted (omits custom fields and user account) | `FacultyFormTabContent.tsx:124` |
| F-m12 | Pagination disappears when the current page empties — see X-02 | `FacultyWorkTier.tsx:141` |

**Verified clean:** peer tabs permission-filtered with localized labels/descriptions; lazy
Reports/Setup; active-tier-only rendering; server pagination + virtualization >30; selection
scoped to the rendered page; page reset on every filter/search/sort/trash change; single
header IO owner; catalog duplicate-name preflight and delete guards; dirty reset/re-baseline,
discard confirm, saving-disabled footer; validation focus; archived drawer restore-only;
detail field visibility honours enabled/tab; logical CSS and 44 px targets on the bulk bar.

## 8. Tasks

### T-01 [Major] Reports treats a failed metrics query as zeros and "100% on time"
`apps/frontend/src/tenant/features/tasks/components/TasksReportsTab.tsx:16-36`

`useTaskMetrics()` is destructured as `{ data, isLoading }`; `isError` is ignored. On failure
the tab renders a full KPI grid of zeros, and `onTimeRate` computes
`m.total > 0 ? … : 100`, so the page reports perfect execution health while nothing loaded.
There is no error text or retry (the Faculty reports tier is the correct model:
`FacultyReportsTier.tsx:15-27`). The Work-header strip has the same fallback shape
(`TasksPageView.tsx:91-103`).

**Fix:** render `ErrorState` with retry on `isError`; render KPIs only when metrics are
defined. **Test:** mock `isError`, assert error title/retry and no "100%".

### T-02 [Major] Opening the row status menu also opens the detail drawer
`apps/frontend/src/tenant/features/tasks/components/tasksWorkBatchColumns.tsx:60`,
`apps/frontend/src/components/common/work/WorkBatchTableRow.tsx:56,119`

The row attaches `onClick: () => onRowClick(row)`; only the selection and actions cells stop
propagation. The status cell renders `TaskStatusMenu` without a stop, so clicking the chevron
both opens the dropdown and fires the drawer's `onView`. The drawer then shows the pre-change
snapshot behind the menu — a confusing double action on the only desktop status-transition
path. Derived from the row/cell handlers.

**Fix:** stop propagation in the status cell (or teach `WorkBatchTableRow` to ignore clicks
inside interactive descendants). **Test:** click the trigger and assert `onView` was not
called.

### T-03 [Major] Form saving state and dirty-close guard are unwired, allowing double submit
`apps/frontend/src/tenant/features/tasks/components/TasksPageView.tsx:161-166`,
`.../TaskFormModal.tsx:70-77`, `.../hooks/useTasksPageController.ts:99-108`

`TaskFormModal` has a `saving` prop defaulting to `false`, and the page never passes it;
`FormModalFooter` disables Save only via `saving || saveDisabled || saved`. `handleSubmit`
and `handleSave` have no in-flight guard, so a double click creates two tasks or sends two
PATCHes. `isDirty` is supplied but no `discardUnsavedTitle`/description, so Escape/backdrop/
Cancel silently discard a filled task (`FormModal.requestClose` intercepts only when the
discard props exist).

**Fix:** pass `saving={create.isPending || update.isPending}`, short-circuit while pending,
and pass the shared discard props. **Test:** double-click Save with a deferred mutation →
one create; dirty close → confirm dialog.

### T-04 [Major] Page index is not reset or clamped when entering trash or when totals shrink
`apps/frontend/src/tenant/features/tasks/hooks/useTasksPageController.ts:152-158`,
`.../TasksPaginationFooter.tsx:24-48`

`handleToggleTrash` sets the trash mode and clears selection but leaves `pageIndex`. Toggling
to trash on page 4 requests `offset=150` against a three-row archive; the directory shows its
empty state and the footer renders an out-of-range `4 / 1`, while archived rows exist on page
1. Deleting the last rows of a page has the same effect. `handleServerFiltersChange` already
resets the page, which is the missing line here.

**Fix:** reset to page 0 on trash toggle and clamp to the last page when `total` shrinks.
**Test:** page 3 + trash toggle → page 0; out-of-range page + total 3 → `1 / 1`.

### Tasks minors

| ID | Finding | Evidence |
| --- | --- | --- |
| T-m1 | Tier state is local `useState`, not persisted/reconciled; tabs omit descriptions/icons and the page hand-rolls the tier shell instead of `ModuleTierPage` | `useTasksPageController.ts:37,169-174`, `TasksPageView.tsx:106-159` |
| T-m2 | Footer labels the whole result set as "N shown" while the toolbar shows the filtered page length, producing two contradictory "shown" numbers | `TasksPaginationFooter.tsx:28`, `TasksWorkToolbar.tsx:86` |
| T-m3 | Client-side filtering of the already server-filtered page can disagree (quick filter "open" + status "completed" yields 0 rows while the server total is non-zero) | `useTasksWorkTabFilters.ts:25-69`, `tasksServerFilters.ts:30-52` |
| T-m4 | In trash the header "Total" falls back to the current page length (metrics disabled) | `TasksPageView.tsx:91-103`, `useTasksPageController.ts:71` |
| T-m5 | Drawer shows the raw parent UUID and never adopts the refetched row after an inline status change | `TaskDetailDrawer.tsx:102-112`, `TasksWorkTab.tsx:126,225` |
| T-m6 | Assignee picker ignores `isError`; a failed eligibility call is indistinguishable from "no eligible staff" | `TaskFormAssigneePicker.tsx:34`, `useTaskFormController.ts:54` |
| T-m7 | Status trigger is 24×24 px and named "Change Status" without the task title (below the 44 px policy; row-agnostic label) | `TaskStatusMenu.tsx:45-55` |
| T-m8 | Tasks import dialog falls back to the Faculty CSV hint because no Tasks subtitle is passed | `StandardModuleCsvImportDialog.tsx:48`, `TasksCsvImportDialog.tsx:17` |
| T-m9 | Export timeout is reported as a failure while the job keeps running; no idempotency key, so retries queue duplicate exports | `useTasksPageController.ts:52-58`, `useGenericModuleExport.ts:78-81` |
| T-m10 | Lazy Reports/Setup render inside Suspense without the tier ErrorBoundary used by `ModuleTierPage` | `TasksPageView.tsx:146-156` |

**Verified clean:** header-owned Create/Import/Export hidden in trash; server limit/offset
matching the manifest and real `total`; virtualization >30; page-owned selection with scope
reset on filter/page change; no fake empty state (directory error state + retry); OCC header
on status updates; legal-transition menu and form options; bulk partial-failure reporting and
undo-restore of actual deleted ids; settings are read by `taskNotificationService` (outbox
emission), though delivery remains open (M4); logical CSS; full i18n key coverage.

## 9. Cross-cutting findings

### X-01 [Major] Unsaved Setup drafts are discarded on a tier switch
`apps/frontend/src/components/app/ModuleTierPage.tsx:96-110`,
`apps/frontend/src/tenant/features/contacts/components/ContactsSetupTier.tsx:64-70`,
`apps/frontend/src/tenant/features/students/components/StudentsSetupTier.tsx:23-47,78`

`ModuleTierPage` renders only the active tier and its `ResponsiveAccordionTabs` receives no
`isDirty`/`onSave`. The Setup tiers implement dirty guards for their **sub-tabs**
(Contacts duplicate thresholds, Students preferences/card template), but neither page lifts
that flag to the tier switch. Editing a preference and clicking "Contacts"/"Students" or
"Reports" unmounts the panel and drops the draft with no prompt. Tasks' Setup tab keeps a
local draft and has the same exposure.

**Fix:** let `ModuleTierPageSpec` accept `isDirty`/`onSave`/`onDiscard` (or a setup-dirty
context) and pass the Setup tier's flag; gate `onTabChange` with the shared discard confirm.
**Test:** dirty the prefs, switch to Work, assert the discard dialog and draft retention on
cancel.

### X-02 [Major] Empty pages strand the user: pagination hides (Students/Faculty) or goes out of range (Tasks)
`apps/frontend/src/tenant/features/students/components/StudentsList.tsx:81`,
`apps/frontend/src/tenant/features/faculty/components/FacultyWorkTier.tsx:141`,
`apps/frontend/src/tenant/features/tasks/hooks/useTasksPageController.ts:152-158`

Students and Faculty gate pagination on `rows.length > 0`; after deleting the last rows of
page N (or any out-of-range page), the empty state replaces the only page navigation while
`total` still indicates earlier pages, and `listPage` stays out of range because no filter
changed. Tasks keeps the footer mounted but never resets/clamps the index, so the same
situation renders an out-of-range `4 / 1` instead of a reachable page. All three then show
empty-state copy that implies the workspace has no records.

**Fix:** keep pagination mounted when `total > 0`, and clamp/reset the page when a fetched
page comes back empty. **Test:** render page 2 with one row, delete it, assert the previous
page is still reachable.

### X-03 [Minor] The mobile accordion collapse sentinel is neutralised by persisted tab state
`apps/frontend/src/hooks/usePersistedTabState.ts:17-18`,
`apps/frontend/src/components/app/ResponsiveAccordionTabs.tsx:52-55`

`ResponsiveAccordionTabs` writes `""` when the active mobile section header is tapped, but
`usePersistedTabState` computes `(normalize(value) || defaultValue)`, so `""` becomes the
default tier and the section stays open. The `""` handling documented in
`useModuleTierPageNav.ts:50-58` is therefore unreachable, and the stored preference says `""`
while the UI shows Work. Tasks (local state) is the only reviewed module where collapse
works, so behaviour differs by module.

**Fix:** preserve `MODULE_TIER_TAB_CLOSED` and fall back only when the stored value is
absent; keep the desktop fallback in the nav hook. **Test:** setter with `""` reads back `""`,
and tapping the open mobile section unmounts its body.

### X-04 [Minor] Hardcoded or constructed copy bypasses the i18n gate
`check:i18n` verifies key parity, not whether copy is keyed. In-scope examples: Faculty leave
and Ijazah placeholders (`FacultyLeaveModal.tsx:182`, `FacultyIjazahSection.tsx:165,174`),
Contacts import job labels (`ContactsCsvImportDialog.tsx:56-74`), shared CSV import
success/failure strings (`useModuleCsvImportActions.ts:124-129`), Students printed card
defaults (`studentCardTemplateBackDefaults.ts:47`), and the Faculty CSV hint reused by Tasks
(`StandardModuleCsvImportDialog.tsx:48`). Arabic/Urdu/Persian users see English in these
surfaces.

**Fix:** key the strings in all four locales; add a lint/scan for literal `placeholder="…"`
and constructed `notify.*` copy on module surfaces.

### X-05 [Minor] "Authoritative zero" is a repeated metrics pattern
Dashboard (D-01), Contacts (`ContactsCommandMetrics.tsx:26-30`) and Tasks Reports
(`TasksReportsTab.tsx:16-36`) all render `0` for an undefined/failed metric query; Students
instead substitutes the filtered row count (`StudentsPageView.tsx:65`, S-m1). Only Faculty's
Reports tier handles `isError` with an `ErrorState` + retry (`FacultyReportsTier.tsx:15-27`).
The pattern teaches users that a number is a measurement when it is actually "unknown".

**Fix:** standardise on a metric state contract (`isLoading | isError | value`), render
skeletons while loading, `—` + retry on error, never `0`.

### X-06 [Minor] Faculty eager peer tiers and Tasks' hand-rolled tier shell
Faculty would benefit from lazy-loading Departments/Designations (`FacultyPageView.tsx:78-86`),
and Tasks should adopt `ModuleTierPage`/`useModuleTierPageNav` (`TasksPageView.tsx:106-159`)
instead of re-declaring the scaffold without the tier ErrorBoundary. Both are contained, but
they are the two places where the module-shell contract has drifted.

## 10. Verified-clean surfaces (shared)

- Module access: `ModuleAccessRoute` gates every route on server availability and fails
  closed; hidden tabs are not a security boundary and none of the findings claims otherwise.
- Tier rendering: `ModuleTierPage` renders exactly one active tier; Contacts/Students use
  `useModuleTierPageNav` with persisted + reconciled tabs and lazy Reports/Setup.
- Data layer: no `useLiveCollection`, no direct `fetch`, no `localStorage` token in the five
  modules; query invalidation fans out Contacts ↔ Students ↔ Faculty and sessions/enrollments
  on bulk enroll; outbox keys are tenant+user scoped with single-flight flush.
- Forms: every create/edit surface uses `FormModal` + shared Zod; Contacts/Students/Faculty
  forms preserve dirty drafts and confirm discard.
- Directories: all four list modules use `WorkBatchTable`/`DataTable` with shared view mode,
  page-owned selection (except Contacts' hand-rolled variant, C-m5), virtualization >30, and
  header-owned IO.
- Drawers: all use `DetailDrawerShell` with archive chrome and capability-gated actions.
- Styling/a11y: zero physical direction utilities in the reviewed modules; 44 px targets on
  bulk bars and dashboard controls; axe serious/critical violations none on the five audited
  routes at 375/1440 and RTL.
- i18n: 9,530 keys complete in en/ar/ur/fa; no missing/EN-fallback keys.

## 11. Test gaps

| Area | Missing coverage |
| --- | --- |
| Dashboard | summary/widget error states; prefs write before hydration; permission-gated unpin/density/reset; print expansion; builder focus |
| Contacts | restricted collection fields; 409 recovery; validation field focus; failed bulk delete keeps selection; bulk-tag double submit; OAuth Sync landing; capped conflict retry |
| Students | import completion/partial-failure panel; configured bulk statuses; card-side dirty guard; setup draft across tier switch; empty-page pagination; Total KPI fallback; avatar invalidation; 409 path |
| Faculty | "all" filter mapping; invisible-tier fallback; contract-type payload; linked-role select value; account-before-faculty ordering; leave→drawer refresh; nested quick-create draft; supervisor cap; eager tiers |
| Tasks | reports error state; double submit; dirty close; page reset/clamp; status-trigger vs row click; footer shown-vs-total; picker error/empty; export timeout/idempotency |
| Cross-cutting | `usePersistedTabState` closed-key round-trip; `ModuleTierPage` dirty guard; shared CSV import partial-failure panel |

## 12. Adversarial audit

- **Edge cases:** empty vs failed vs loading directories (Tasks/Faculty/Students now have
  error states; dashboard does not); first/last page after bulk delete (X-02); a persisted
  tier whose permission disappears (F-02); a tenant-defined status list (S-02, F-m5);
  >100-row pickers (F-m6, linked-user detection); a deleted contact in a conflict row.
- **Failure modes:** summary/metrics 5xx → zeros (D-01, X-05); widgets GET failure → phantom
  layout (D-02); prefs PUT before hydration → silent field reset (D-03); users written before
  faculty (F-05); import job completes with row failures → dialog already gone (S-01); export
  timeout reported as failure (T-m9); 409 with no recovery (C-02, S-m6).
- **Security/multi-tenancy:** no cross-tenant render found; field-level contact permissions
  are applied client-side only, and the Contacts drawer bypass is the one visible gap (C-01).
  Backend still owns authorization; no finding relies on frontend hiding as a control.
- **Concurrency/optimistic UI:** dashboard prefs closure/full-document write (D-03); two
  bulk-tag submissions (C-m7); contact OCC loop (C-02); conflict retry cap (C-m6); Tasks
  double submit (T-03); Task row click + menu (T-02).

## 13. Prior-review reconciliation

| Prior item | Status in this pass | Evidence |
| --- | --- | --- |
| Dashboard D1 — workspace-scoped prefs/widgets | **Open (product decision)**; UI still presents customization as personal | `useDashboardConfig.ts:44-51`, manifest `customize` |
| Dashboard D2/D3 — optimistic prefs + partial PUT merge | **Fixed** (verified server merge and optimistic path); residual pre-hydration write is D-03 | `useDashboardSetupConfig.ts:52-86` |
| Dashboard D5 — permission-denied metric cards | **Fixed** | `useDashboardMetricCards.ts:36-41` |
| Dashboard m5 — tenant-agnostic dismissal keys | **Open** | `NotificationsPanel.tsx:19`, `SetupIncompleteCallout.tsx:27` |
| Dashboard m6/m7/m8 — grid aria, builder focus, OR completeness | **Open** | `StatisticsGrid.tsx:44-62`, `useDashboardPageController.ts:62-70`, `SetupIncompleteCallout.tsx:17-25` |
| Contacts round-5 M3 — OCC token sent | **Partial**: header sent, recovery missing (C-02) | `useContactMutations.ts:95`, `useContactFormSave.ts:145-157` |
| Contacts round-5 m-2 — attempt cap on Retry all | **Open** (C-m6) | `contactsSyncOutboxConflicts.ts:50` |
| Students round-3 M2/M3 — bulk-enroll gate, settings fail-closed | **Fixed** (verified) | `StudentsBulkActionBar.tsx:66-69`, controller |
| Faculty round-2 M4 — workload producer | **Open** (F-m4) | `FacultyWorkloadPill.tsx:23-48` |
| Faculty round-2 M5 — hierarchy model | **Open**; drawer still renders projection values | `FacultyReportingHierarchyCard.tsx:23-75` |
| Tasks M3 — complete/assign permission model | **Partial**: backend accepts write OR complete (reviewed code matches); complete-only users still lack a bulk path | `tasksRoutes.ts:180-210`, `TasksBulkActionBar.tsx:39-43` |
| Tasks M4 — assignment notification delivery | **Open**: outbox events are emitted but no consumer delivers them | `taskNotificationService.ts:39-60`; repo-wide search finds no consumer |
| Tasks m11/m13 — saving prop, selection gate | **Open**: `saving` still unwired (T-03); cards still gate selection on delete (m13); status trigger still 24 px (m8/m9 partial) | `TasksPageView.tsx:161`, `TaskCardItem.tsx:89`, `TaskStatusMenu.tsx:47` |
| Tasks C1/C2, M6/M7/M8, m10/m12 | **Fixed** (verified in current code) | export/import runners, server pagination, status transitions, selection scope, empty-state create, status onError |

## 14. Resolution plan

**Tier 1 — correctness/recovery, land before the next module change**

1. D-01 + X-05: standardise the metrics state contract; `ErrorState` + retry, `—` instead of
   `0` (Dashboard, Contacts, Students, Tasks reports).
2. D-02 + D-03: stop returning placeholder widgets/prefs as data; gate prefs writes on
   hydration and send/merge from the cache document.
3. F-01 + F-02: map the Faculty neutral filter to `""`; fall back to the first visible tab on
   desktop and update the pinned test.
4. F-03 + F-04 + F-05: persist `employmentContractType`, initialise the linked-role select
   from the account, and save faculty before syncing the user account.
5. C-01: pass filtered collection entries into the contact drawer sections.
6. C-02 + S-m6: add a shared 409 conflict branch (keep draft, reload/overwrite) and a
   contacts-namespaced toast.
7. S-01: keep the import dialog mounted through completion and render counts; translate the
   shared strings.
8. S-02: build bulk statuses from the configured tenant list.
9. S-03: derive template dirtiness from the full template, not the remounted editor.
10. T-01: error state for Tasks reports; T-02: stop row-click propagation from the status
    cell; T-03: wire `saving` and discard props.
11. T-04/X-02: reset/clamp page index and keep pagination mounted when `total > 0`.
12. X-01: add a dirty guard to `ModuleTierPage` and pass Setup dirtiness up.
13. D-04 + D-05: gate Unpin/density/reset on the customize permission; emit `fees-clear`
    only when finance metrics are loaded.

**Tier 2 — schedule with the module's next patch**

- Dashboard D-04 (gate layout controls), D-m1 (print expansion), D-m2 (delete confirm/undo),
  D-m3 (builder focus), D-m5 (delete dead facade), D-m6 (memoise/one config hook).
- Contacts C-m2 (OAuth one-shot in state initializer), C-m3/C-m4 (metric truthfulness),
  C-m5 (`useWorkSelection`), C-m7/C-m8 (pending/failed bulk), C-m10–C-m14.
- Students S-m1–S-m5.
- Faculty F-m1–F-m3, F-m5–F-m12.
- Tasks T-m1–T-m10.
- X-03 (closed-tab sentinel), X-04 (i18n scan), X-06 (lazy/catalog shell parity).

**Product decisions still blocking**

- Dashboard prefs/widgets personal vs workspace (D1 in the prior review).
- Tasks delegation/ownership model and notification delivery (M1/M2/M4).
- Faculty reporting-hierarchy model and workload producer (M4/M5).

## 15. Hypotheses not proven

1. **Dashboard summary payload filtering** — the request is issued unconditionally; if the
   endpoint does not filter sections by caller permission, that is a backend over-return. Not
   verified with a captured body.
2. **Contact collection permissions** — server-side enforcement of `canViewContactField` was
   not found, but the backend list/detail projection may filter elsewhere; C-01 is scored as a
   frontend inconsistency regardless.
3. **Production frequency of F-02** — the blank body requires a persisted invisible tier
   (permission change after selection); the state machine is proven, the frequency is not.
4. **Card-editor dirty baseline** — S-03 is derived from `TemplateEditor` remount semantics,
   not executed in a browser.
5. **Task row-click bubbling** — T-02 is derived from the DOM handler placement; Radix event
   timing could alter the observed sequence.
6. **`usePersistedTabState` collapse** — X-03 is a pure code-path derivation; no browser
   interaction was recorded.
7. **Mobile/print visual regressions** — axe passed, but drawer overlays were skipped and no
   pixel review was performed.
8. **Metrics cardinality/performance** — no production `EXPLAIN` or render profiling; the
   memoisation findings are code-shape observations, not measured regressions.

## 16. Appendix — commands run

```bash
pnpm --filter mms-frontend typecheck
pnpm --filter mms-frontend lint
pnpm --filter mms-frontend exec vitest run \
  src/tenant/features/dashboard src/tenant/features/contacts \
  src/tenant/features/students src/tenant/features/faculty src/tenant/features/tasks
pnpm check:frontend-structure && pnpm check:work-directory && pnpm check:code-norms \
  && pnpm check:shared-ui && pnpm check:i18n
pnpm check:bundle
pnpm --filter e2e-tests exec playwright test tests/a11y/a11y-shell.spec.ts \
  --project=a11y --grep "shell & core work|academic work|money & records|RTL" --reporter=line
```

Environment: local dev servers on :5173/:3000; axe provisioned throwaway E2E tenants. No
database, Playwright flow, or production target was exercised.
