## Open items (status)

Recorded so they are not lost, with the evidence gathered since.

1. **P1-5 — permission fallbacks (`export → read`, `delete → write`).** _Investigated: deliberate._ The
   mapping is pinned by tests as intended, and the actionable half (the raw `WRITE_ROLES` fallback) was
   already replaced by an explicit allow-list. Tightening further means introducing explicit
   `export`/`delete` permissions across all 16 manifests plus the role matrix — a product decision, not a
   defect. **Left as-is.**
2. **P1-6 — empty/null grant map ⇒ all modules.** _Investigated: deliberate, forward-compatibility._
   `workspaces.granted_modules` is a nullable jsonb (`apps/backend/src/db/schema/platform.ts`) that
   provisioning writes as a **full** map (`apps/backend/src/services/workspaceService.ts:251-272`), and the
   "granted unless explicitly `false`" rule — including migration `086`'s backfill — is what lets a
   **newly introduced module reach existing workspaces**. Pinned by
   `apps/backend/src/__tests__/workspaceRepositoryGrantedModules.test.ts` ("returns all system modules when
   grantedModules is null or empty"). Changing it would break module roll-out. **Left as-is.**
3. ~~Backend coverage floors unenforced.~~ **RESOLVED** — CI now runs the backend shards with coverage and a
   `test-backend-coverage` merge job enforces the thresholds (measured Stmts 44.46 / Branch 33.91 /
   Funcs 42.1 / Lines 46.8 against thresholds 43.5 / 33 / 41 / 46).
4. ~~`check:backend-boundaries` not in CI.~~ **RESOLVED** — now a ratchet step in the `typecheck-lint` job.
   A `sensitive-file-guard` job also landed (whole-tree sensitive-filename blocklist, at any path depth).
5. **Fat-file debt.** **69 → 8** files over the ADR-001 300-LOC cap (baseline ratcheted down via
   `check-code-norms --update-baselines`, never by hand).
   - *Phase 1 (300–321 band):* `sessionRepositoryPersistClasses.ts` (down to 131), `contactFormNormalizeEdit.ts`
     (304 → 231 via `contactFormNormalizeSubCollections.ts`), `examinationQuestionBankTables.ts` (306 → 139 via
     `examinationTestTables.ts`), `routes/tenant/enrollments.ts` (310 → 67 via `enrollmentContractRouter.ts`),
     `messagingUseCases.ts` (314 → 199 via `messagingRecipientUseCases.ts`), `obligationsUseCases.ts`
     (318 → 137 via `obligationsCatalogUseCases.ts`), and `accountingFiscalYearsRepository.ts`
     (321 → 273 via `accountingPostingPeriodsRepository.ts`).
   - *Phase 2 (335–389 band):* `authArtifactService.ts` (335 → 225 via `authRefreshTokenArtifacts.ts`),
     `genericRelationalService.ts` (344 → 277 via `db/genericRelationalConditions.ts`),
     `obligationMujtahidsRepository.ts` (347 → 169 via `obligationMujtahidRepsRepository.ts`),
     `savedReportsRepository.ts` (352 → 259 via `savedReportsAdminRepository.ts`),
     `contactFormNormalize.ts` (383 → 82 via `contactFormNormalizeEdit.js`), and
     `financePaymentsRepository.ts` (389 → 195 via `financePaymentsPersist.ts`).
   - *Phase 3 (366–432 band):* `finance.contract.ts` (366 → 224 via `finance.contract.invoices.ts`),
     `students.contract.ts` (373 → 211 via `students.contract.routes.ts`),
     `crudResourceRoutes.ts` (404 → 289 via `crudSingleDeleteRestoreRoutes.ts`),
     `accountingAccountsRepository.ts` (408 → 220 via `accountingAccountsPersist.ts`),
     `obligationCollectionsRepository.ts` (424 → 198 via `obligationCollectionsPersist.ts`), and
     `hasanatDistributionsRepository.ts` (432 → 208 via `hasanatDistributionsPersist.ts`).
   - *Phase 4 (433–452 band):* `ledgerPostingService.ts` (433 → 178 via `ledgerPostingHelpers.ts` and
     `ledgerReversalPostingService.ts`), `routes/tenant/users/userContractRouter.ts` (434 → 221 via
     `userContractHandlers.ts`), `financeUseCases.ts` (437 → 218 via `financeMutationOperations.ts`),
     `sessionTypes.ts` (443 → 215 via `sessionSubEntityTypes.ts`), `questionBankResultsRepository.ts`
     (447 → 242 via `questionBankResultsPersist.ts`), and `financeInvoicesRepository.ts`
     (452 → 238 via `financeInvoicesPersist.ts`).
   - *Phase 5 (453–494 band):* `platform.dto.ts` (453 → 281 via `platformManagement.dto.ts`),
     `workspacePresentationService.ts` (461 → 280 via `workspaceAdminUserRepository.ts`),
     `contactItemNormalizeRows.ts` (463 → 240 via `contactItemNormalizeProfileRows.ts`),
     `tenantUserRepositoryPersist.ts` (465 → 229 via `tenantUserLifecyclePersist.ts` and
     `tenantUserProfileHelpers.ts`), `accountingEntriesPersist.ts` (491 → 229 via
     `accountingEntriesLifecyclePersist.ts`), and `examinations.ts` (494 → 15 via modular schema aggregator
     re-exporting `examinationExamTables.ts`, `examinationQuestionBankTables.ts`, `examinationTestTables.ts`,
     `examinationSetupTables.ts`, and `examinationSchemaTypes.ts`).
   - *Phase 6 (504–571 band):* `examinationExamsRepository.ts` (504 → 218 via `examinationExamsPersist.ts`),
     `backgroundJobRunnerService.ts` (506 → 235 via `backgroundJobDocumentFinanceRunners.ts`,
     `backgroundJobFacultyRunners.ts`, and `backgroundJobPayloads.ts`), `workspaceRepository.ts` (509 → 125 via
     `workspaceRepositoryCache.ts`, `workspaceRowMappers.ts`, `workspaceBrandingRepository.ts`, and
     `workspaceSettingsRepository.ts`), `platform.contract.ts` (513 → 276 via `platformWorkspaces.contract.ts`
     and `platformAdmins.contract.ts`), `contacts.contract.ts` (514 → 24 via `contacts.contract.schemas.ts` and
     modular contract route aggregation), `seed-20-contacts-data.ts` (525 → 9 via `seed-20-contacts-part1.ts`
     and `seed-20-contacts-part2.ts`), and `seed-20-contacts.ts` (571 → 51 via importing `SEED_20_DUMMY_CONTACTS`).
   - *Phase 7 (528–593 band):* `financeContractRouter.ts` (528 → 270 via `financePaymentHandlers.ts` and
     `financeMetricsHandlers.ts`), `redis.ts` (533 → 213 via `redisKeys.ts`, `redisBullMQ.ts`, and
     `redisCacheOperations.ts`), `sessions.ts` (541 → 13 via `sessionCoreTables.ts`, `sessionClassSubTables.ts`,
     `sessionSetupTables.ts`, and `sessionSchemaTypes.ts`), `sessionContractRouter.ts` (547 → 225 via
     `sessionBulkContractHandlers.ts` and `sessionSetupContractHandlers.ts`), `accountingEntriesRepository.ts`
     (566 → 164 via `accountingEntriesHydrate.ts`), and `questionBankTestsRepository.ts` (593 → 93 via
     `questionBankTestsPersist.ts` and `questionBankTestsHydrate.ts`).
   - *Phase 8 (336–634 band):* `dataMigrationRegistry.ts` (336 → 9 via `dataMigrationsBatch1.ts` and
     `dataMigrationsBatch2.ts`), `resetAllModulesExceptContacts.ts` (354 → 165 via `resetAllModulesExecution.ts` and
     `resetAllModulesVerify.ts`), `dbConnection.ts` (399 → 155 via `dbTransactions.ts` and `dbPoolMetrics.ts`),
     `index.ts` (415 → 10 via `entry/indexCore.ts`, `entry/indexDomainsAcademic.ts`, and `entry/indexDomainsOperations.ts`),
     `contactTabRegistry.ts` (596 → 250 via `contactColumnRegistryPrimary.ts`, `contactColumnRegistryExtended.ts`, and
     `contactColumnRegistry.ts`), and `contactFieldSeed.ts` (634 → 22 via `contactFieldSeedIdentity.ts`,
     `contactFieldSeedProfile.ts`, and `contactFieldSeedAffiliations.ts`).
   - *Phase 9 (681–746 band):* `attendanceContractRouter.ts` (681 → 55 via `attendanceRecordHandlers.ts`,
     `attendanceBulkContractHandlers.ts`, and `attendanceSetupContractHandlers.ts`), `sessionRepositoryHydrate.ts`
     (701 → 142 via `sessionRepositoryHydrateAggregated.ts` and `sessionRepositoryHydrateBatched.ts`),
     `usersUseCases.ts` (726 → 264 via `userCreationUseCases.ts` and `userMutationUseCases.ts`), and
     `accountingUseCases.ts` (745 → 291 via `accountingEntryMutationUseCases.ts`,
     `accountingAccountLifecycleUseCases.ts`, and `accountingLedgerGuards.ts`).
   All extracted parts are comfortably under 300 LOC with full backward-compatible re-exports and zero public
   surface regressions. Baseline ratcheted from **8 down to 4** (65 fat files net eliminated across Phases 1–9).
   **100% of application source files across the monorepo now comply with the 300 LOC ceiling.** The only 4 remaining
   files in the ratchet are the 4 generated translation dictionary data tables (en/ar/ur/fa ~9k lines).
6. ~~Migration DDL duplication · legacy `teachers` DDL names.~~ **RESOLVED — false positive, and no
   migration was touched.** `0108` deliberately **supersedes** `0104`: it `CREATE OR REPLACE`s
   `forbid_hard_delete()` with a better message (`…or set app.allow_hard_purge = true in maintenance
transactions.`) and re-attaches triggers for **19** tables against 0104's **14**, each guarded by
   `DROP TRIGGER IF EXISTS` — idempotent by construction. Deleting 0104's copy would retcon an applied
   migration and gain nothing. The `teachers` names are likewise already remediated: `0112` renames the
   table **and all 17 `teachers_*` indexes** (plus compat views), and `0119:52-61` replaces
   `trg_teachers_forbid_hard_delete` with `trg_faculty_forbid_hard_delete` while renaming the constraints.
   0104's `teachers` references are _historically correct_ for its index in the sequence — which is exactly
   what `softDelete0104Regression.test.ts` pins. What was genuinely missing was **enforcement**, so
   `pnpm run check:migrations-forward-only` now fails on any modification, rename or deletion of an
   already-applied migration (CI `typecheck-lint` + pre-PR gate); adding a new migration is always allowed.
7. ~~Class-level branding contrast.~~ **RESOLVED — the palette itself was failing.** Measured before the
   change: **5 of 22** preset×mode combinations below the 4.5:1 AA floor inside brand tints, including two
   _curated_ presets (`emerald` 4.47, `teal` 4.46) and the synthetic light brands (down to 4.17) — so this
   was not just a call-site mistake. `--muted-foreground` and `--sidebar-muted-foreground` are now fitted
   against **every** brand fill's resting tint via a single `restingTintedSurfaces` helper that the contrast
   matrix also calls, so the guarantee and its test cannot drift; the matrix asserts both tokens in both
   modes. Worst case is now **5.15:1**. Change range, verified by diffing all **858** generated tokens
   against the previous implementation: **44** entries, only the two muted tokens, lightness only
   (light `37 → 32-35`); every fill, foreground, chart and border is byte-identical.
   A follow-up sweep proved the class is closed rather than just this instance: `--foreground` /
   `--card-foreground` read inside every fill tint measured **11.89** (light) / **12.24** (dark) worst case
   — zero failures — confirming that mid-lightness was the exposure, which is now a permanent test.
   Sweeping the _assumption the guarantee rests on_ then found a second, independent defect: the tint bound
   `MAX_RESTING_TINT_BY_MODE` was **stale in three copies**, all claiming dark tops out at `/10`. Reality
   (and the documented contract in `index.css`, "solved against a `/15` tint … stronger than `/15` must use
   `-foreground`") is `/15` in both modes. Fixed by (a) setting the dark bound to `/15` and replacing the
   false docstring with cited evidence, (b) single-sourcing it through `@mms/shared` (both tests import it),
   (c) lowering **ten** `/20` call sites that breached the contract — one of which only the new scan found —
   (d) re-tuning the static dark `--destructive`/`--warning` to `71%`/`52%`, which measured **4.38:1** on
   their own `/15` tint and so were never compliant with their own contract, and (e) making the prose
   executable: a scoped tint-strength scan in `designTokens.contrast.test.ts`. Generated-token blast radius:
   **139 of 858**, all dark mode.
   I first recorded `hover:` tints as out of scope ("the contract is AT-REST"), then measured them and that
   was **wrong**: same-token text on its own tint scores 4.50:1 (light) / 4.51:1 (dark) at `/15` but
   **4.13 / 4.12 at `/20`** and 3.80 at `/25` — and `bg-<token>/10 … hover:bg-<token>/20` is a repeated UI
   convention, not a few outliers. Fixed **27 sites**: 24 hover tints lowered to the bound across 15 files,
   the two offline-banner CTAs kept their strong wash and dropped the same-token hover text (the contract's
   other remedy), and one range cell's now-dead hover class removed. The scan now covers **every interaction
   state**, with that measurement cited in the test so hover is not re-litigated.

8. **Legacy client-state store (`@/lib/db` localStorage + `/api/db` sync).** _Partially migrated; remainder
   blocked on missing endpoints (frontend-only scope)._ `src/lib/db.ts` is a re-export barrel over
   `dbStorageCore` / `dbCollections` / `dbObjects` / `dbBackupSync`; the header already states the rule
   (prefer TanStack Query + REST, keep this for settings/legacy writes). **Removed:** the dead
   `useLiveObject` hook (0 consumers) and the dead barrel exports `saveCollectionAsync`, `saveObjectAsync`,
   `syncDatabase`, `clearAllClientStorage`, `formatDate` (0 call sites; the underlying functions stay in their
   modules). **Blocked — no Query/REST equivalent exists yet, so the file stays on the legacy store:**
   - _Settings/branding_ — `useGlobalSettingsDraft`, `useThemeSettingsDraft`, `useBrandingDraft`,
     `BrandingShared`, `InstitutionSetup` → need `/api/settings/global` + `/api/branding` object endpoints
     (or an `AuthContext` session-settings extension).
   - ~~_Document templates_ — `documentTemplatePersistence` + `invoiceTemplateStore` / student-card / finance /
     exam / hasanat editors (~15 consumers)~~ **PARTIALLY RESOLVED (2026-11-02).** All template editors now read and
     write `/api/templates/:key` through `lib/templates/useDocumentTemplates` (TanStack Query seeded from a
     tenant cache); the legacy `documentTemplatePersistence` store, its background
     `/api/db/objects/:key` double-write and the bespoke per-module save handlers are deleted, and
     `check:frontend-structure` ratchets the legacy store out of template modules. **Print paths now consume
     the saved layouts** (`2026-11-02`): Finance receipts (`InvoiceReceiptModal`), Examination result cards
     (`StudentResultCard`) and Hasanat distribution vouchers (`DistributionDetail`, new print entry point) all
     render through the shared `TemplateDocumentPreview` + `printTemplateDocument`. **Saves are now
     optimistic-concurrency guarded** (`2026-11-02`): GET returns `updatedAt`, PUT requires
     `expectedUpdatedAt`, a stale write returns `409 Conflict` (atomic `insert … on conflict do nothing` /
     `update … where updated_at = ?`), and the editor blocks saving with a “reload latest” banner instead of
     overwriting. **Still open:** template field/preset labels for those modules remain English; an
     examination report card covers one paper (a term-wide multi-subject card needs aggregation); DELETE
     remains unchecked (no UI, documented residual). The version token is the row's `updated_at` (JS `Date`
     millisecond precision); if a future writer uses SQL `now()`, switch to a dedicated integer version column.
   - _Reports/KPI config_ — `usePinnedWidgetsController`, `useDashboardSectionSettings`, `kpiSummaryCard*`,
     `DynamicCardBuilder`, `ModuleReportsToolPanels` → need `/api/reports/section-settings` + per-module KPI
     config endpoints.
   - ~~_Module settings_ — `useObligationsSettings`~~ **RESOLVED** — migrated to the standard relational setup configuration architecture (`createModuleSetupConfigHooks` + `obligation_module_preferences` table with FORCE RLS + `obligationContract` `getPreferences`/`updatePreferences` routes + WebSocket live push invalidation).
   - _Backups history_ — `useLiveCollection("backups")` (1 consumer) → need a `backups` collection endpoint.
   _Deliberately NOT removed_ (not dead, despite `pnpm` grep-appearing unused): the one-time local→server
   widget seed in `useDashboardConfig`/`widgetDefaultsStore` is the **active** path that gives new/legacy
   workspaces their default widgets, and `findCachedCollectionRecord`'s localStorage fallback is covered by
   `queryCacheCollections.test.ts` — both are migration-window code and must stay until the migration closes.
   The backup/restore subsystem (`dbBackupSync` via `useBackupRestore*`) is the sanctioned whole-tenant
   `/api/db` path and is **not** a target.
   Raw `apiFetch`/`apiJson` use is now ratcheted: `eslint-rules/no-direct-api-client.cjs` +
   `direct-api-client-baseline.json` ban new hand-rolled call sites in `src/tenant/features/**`,
   `src/tenant/hooks/**` **and `src/platform/**`** (ts-rest is the target), with a staleness check so the
   baseline only shrinks. **Baselined raw-transport files: 0 (the baseline is now empty).** Tenant: 20 → 0 via
   twenty migrations to their contract routes:
   `useMessagingContactsByIds` (`messaging.resolveContacts`), `useMessagingWorkRecipients`
   (`messaging.listRecipients` + `messaging.matchRecipients`), `useExaminationsReportAggregates`
   (`examinations.reportAggregates`), `accountingListFetch` (`accounting.listEntries` + `listAccounts`),
   `useAccountingQueries` (`accounting.getReportAggregates`), `useDeploymentAppDomain`
   (`public.deploymentConfig`), `useWorkspaceBySubdomain` (`workspace.bySubdomain`),
   `useModuleWidgetAggregates` (per-domain `widgetAggregates` — every dispatched domain declares the route),
   plus the audit surface via a **new `auditContract`** (backend already serves `/api/audit/*` with plain
   Fastify plugins): `collections/audit.ts` (`listEvents`/`listMerkleRoots`/`verifyChain`/`executeErasure`/
   `getAnomalies`) and `AuditIntegritySection.tsx` (`exportAudit`); plus **new `tasksContract`** (11 routes;
   `useTasksApi`) and the auth `ui-state` routes (`useInitializeUiState`) — all served by plain Fastify handlers.
   Plus the accounting ledger-ops via a **new client-only `accountingLedgerContract`** (14 routes — posting rules,
   opening balances, bank statements/reconciliations, specialized entries, reversals, chart seeding, voucher
   numbering): `useAccountingLedgerOps`, `useAccountingMutations`, `useReverseJournalEntry`, `useSeedDefaultChart`,
   `useVoucherNumbering`. It is a separate contract (not added to `accountingContract`, which the backend's ts-rest
   router consumes wholesale) — the same multi-contract split the contacts domain already uses.
   Plus the finance ops via a **new client-only `financeOpsContract`** (9 routes — invoice collect/remind/cancel,
   invoice generation, credit notes, fee structures): `useFinanceCollect`, `useFinanceInvoiceGeneration`,
   `useFinanceFeeStructures`. The tenant surface is now fully on the ts-rest client. Platform:
   13 → 2 via eleven migrations —
   `usePlatformWorkspaceMetrics` (`getWorkspaceMetrics`), `usePlatformActivityLogs` (`getActivityLogs`),
   `usePlatformWorkspaceModules` GET (`getWorkspaceModules`), `usePlatformProfile` GET (`getMe`),
   `useWorkspaceRegistry` (`workspace.registry`), `usePlatformWorkspaces` (`platform.listWorkspaces`),
   `usePlatformSettings` (`platform.getSettings` + `health.ready`), plus four after **declaring their missing
   routes** in `platform.contract.ts` (the backend already serves them via plain Fastify handlers; no handler
   change): `useErdPageController` (`getErd`), `usePlatformTelemetry` (`getTelemetry` + `getActivityTrend`),
   `usePlatformAiDiagnostics` (`aiQuery`), `usePlatformSessionTimeout` (`getSessionPolicy`).
   The last 2 platform files are **sanctioned infrastructure**, ignored by the rule (same class as the
   `src/lib/**` / `src/hooks/**` carve-out): `PlatformAuthContext.tsx` (platform auth/session context — the
   tenant twin `src/lib/contexts/AuthContext.tsx` is raw and outside the rule) and `PlatformSystemMaintenance.tsx`
   (`/ready` probe needing `cache: "no-store"`, which the contract client does not expose). Every tenant and
   platform **module** surface is now on the typed ts-rest client.
   **Forms:** `AccountModal` and `QuestionForm` are migrated onto the shared RHF contract
   (`createZodFormResolver` + `toValidationErrors`); each has a test (`AccountModal.test.tsx` covers schema
   errors, the Setup-driven duplicate check, and trimmed save; `QuestionForm.test.tsx` covers the valid save
   path and the empty-field guard). Both bridge to their unchanged child field components (values via
   `watch()`, updates via `setValue`, errors from `formState.errors`).
   **Deliberately not migrated** — `InvoiceForm`, `PaymentForm`, `useMessagingTemplateEditor`: their Zod
   schemas (`invoiceRecordInsertSchema`, `paymentRecordInsertSchema`, …) validate the **built payload**
   (numbers, computed amounts), not the draft the form holds (amount is a string). The shared resolver
   requires the schema to match the form's own shape, so converting these would mean adding a second,
   draft-shaped schema that duplicates the existing imperative rules — the opposite of the goal. Revisit
   only if those schemas are reworked to validate the draft directly.

9. **Live-push invalidation coverage — reviewed; one real gap fixed.** The tenant WebSocket
   dispatcher (`apps/frontend/src/lib/tenant/invalidateModuleQueries.ts`) maps a broadcast collection
   key to its module's centralized invalidator. React Query invalidates by key **prefix**, so
   sub-entities nested under a module's list key are already covered — e.g.
   `FACULTY_DESIGNATIONS_QUERY_KEY = [...FACULTY_QUERY_KEY, "designations"]` is reached by the `list`
   bucket. Findings:
   - **Faculty catalog writes broadcast nothing** — unlike every other faculty write, which calls
     `broadcastCollection("faculty")` — so a designation/department change was invisible to other
     clients. **Fixed** in `facultyDesignationRouteHandlers` / `facultyDepartmentRouteHandlers`
     (broadcast `"faculty"` on save/delete/restore; the frontend already covers the keys by prefix).
   - **Contacts saved reports** (`savedReports` routes) are **owner-scoped** — each user has their own
     presets — so cross-client push is intentionally not applicable.
   - `FINANCE_FEE_STRUCTURES_QUERY_KEY` is a setup-config read outside the finance list key, but the
     backend **does** broadcast `finance_fee_structures` (`financeBillingUseCases`) and
     `finance_metrics`. The dispatcher previously had no case for either, so another admin's
     fee-structure change stayed stale (and the next save overwrote it). **Fixed** in
     `lib/tenant/invalidateModuleQueries.ts` + `invalidateFinanceQueries`; the key now lives in
     `financeQueryKeys` so the module invalidator owns it. `FINANCE_FIELD_CONFIG_QUERY_KEY` remains
     unbroadcast; revisit only if a cross-client need appears.

10. **Frontend review follow-ups (updated).**
    - **Sidebar/chrome unification (audit F6) — largely done.** Both hosts now compose the shared
      `components/common/AppSidebar` frame (width/collapse container + surface tokens + motion-safe
      transition) and render navigation through the shared `components/common/AppSidebarNav` (sections /
      links / expandable groups / collapsed tooltips), fed by thin per-host adapters in the tenant
      `SidebarNav` and the platform `PlatformSidebarNav`. The two registry models
      (`lib/config/navConfig.tsx` vs `platform/lib/platformNav.ts`) and the brand/footer content stay
      host-specific by design. **Validated against the live tenant shell:** the local authenticated
      responsive spec (`responsive-authenticated.spec.ts`, 19/19) and the axe shell sweep
      (`a11y-shell.spec.ts`, 2/2) both pass; collapsed sidebar links also gained an accessible name
      (`SidebarNavItem` now sets `aria-label` when the label is visually hidden). The platform sidebar's
      authenticated flow still warrants a visual pass.
    - **`lib/invoiceTemplatePresets.ts` split — done.** The 862-line file is now a thin re-export barrel
      over `lib/invoicePresets/*` (palette / types / classic / thermal / formalA5{Header,Amount}Elements /
      modern / available), every module <300 LOC; output proven byte-identical by hash before/after and
      the code-norms `filesOverHardLimit` baseline is now 4 (only the four translation dictionaries).
    - **2026-10-30 frontend review — see [frontend-review-2026-10-30.md](./frontend-review-2026-10-30.md).**
      That pass fixed the PWA precache blow-up (647 → 38 entries), added stale-chunk recovery, moved
      `lang`/`dir` before first paint, removed dead assets, and de-silenced the query/auth provider
      fallbacks. Coverage depth (reports/platform), the 4 × ~10k-line translation packs, and the
      `invalidateQueries` convergence remain open there.

11. **Circular import in the dashboard collections barrel (fixed).** `tenant/hooks/collections/dashboard`
    re-exports `useDashboardData`, which imported `useDashboardSummaryQuery` **back** through that same
    barrel — a cycle that made Vite's dev ESM fail to expose the barrel's re-exports:
    `SyntaxError: … /collections/dashboard.ts does not provide an export named 'DASHBOARD_SUMMARY_QUERY_KEY_ROOT'`,
    surfaced twice per tenant-dashboard load via `useTenantDatabaseUpdates.dispatch`. Fixed by importing
    `useDashboardSummaryQuery` from its defining module (`./useDashboardSetupConfig`) instead of the barrel.
    Reproduced on pristine HEAD too (pre-existing; dev-only — the production bundle was unaffected). Found by
    running the platform-onboarding E2E locally.

12. **`@local-only` tenant flow specs fail at the Chart-of-Accounts step (pre-existing).** Running
    `tenant-critical-lifecycles.spec.ts` and `tenant-operations-flow.spec.ts` locally fails in
    `createAccountsAndJournalEntry` (`e2e/helpers/tenantOperations.ts:921`): after the account PUT returns
    2xx and the dialog closes, `getByText("E2E Cash")` is not visible in the Chart of Accounts list.
    Reproduced identically against the pre-change commit (`6adde94b5`), so it is **not** caused by the
    recent frontend work — most likely shared-DB state / rot (these specs are `@local-only`, not CI-gated;
    the repo notes they need an isolated disposable database). Needs a clean-DB reproduction before it is
    treated as a product bug.

## 2026-10-28 project review — fixed vs. still open

A full read-only review of the repository (architecture, tenancy, money, frontend
data layer, CI/ratchets, docs) landed these fixes. Each is enforced by a test or a
ratchet, so the fix cannot silently regress.

**Fixed**

| Finding | Fix | Enforcement |
| --- | --- | --- |
| RLS could be inert: no role assertion, `getDb()` paths outside any transaction | `db/rlsRoleGuard.ts` inspects `current_user` at boot (strict in production, `MMS_DB_ROLE_ENFORCEMENT` to opt out); the three platform-admin queries now run inside `withGlobalTenant` | `__tests__/tenantScopeGuards.test.ts` |
| `runInTransaction` / `beginLongLivedTenantTransaction` failed **open** on a missing tenant | Both share `resolveTenantScope` with `withTenant`; explicit `runInGlobalTransaction` / `runInGlobalReadSnapshotTransaction` escape hatches | `tenantScopeGuards.test.ts`, `tenantContextGuards.test.ts` |
| Document store fell back to unprefixed keys when the tenant was lost | `runWithGlobalDocumentStore` scope; boot seeding + data migrations are the only global callers | boundary tests |
| Invoice `paid_amt` lost update (read-modify-write + blind upsert) | `findInvoiceById(..., { forUpdate: true })` takes a row lock during settlement | finance use-case tests |
| Audit events appended with `void … .catch()` after commit | Writes + audit share one tenant transaction (`dbObjectRoutes`, `dbCollectionRoutes`, `userActivityLogUseCases`) | `settingsFieldRbac.integration.test.ts`, `facultyRoleUnionAssert.test.ts` |
| Rate-limit bucket keyed on client `x-tenant-id` | Key is the trusted ALS tenant + IP (never a header); tenant binding now runs before the security plugins | `rateLimitConfig.test.ts` |
| `/uploads/*` public, proxy-cacheable | Auth hook + tenant-path match; only `branding`/`avatars` stay public; `private, no-store` for tenant files | `uploadsAuth.test.ts` |
| Any `/auth/me` failure wiped the QueryClient **and** the offline IDB cache | Only 401/403 clears; other errors fall back to the persisted identity | `useAuthSessionSync` |
| Widget aggregates keyed without `xAxisField`/`chartLimit`, never invalidated | `dynamicWidgetAggregatesQueryKey` (all request fields) + invalidation from the live-push dispatcher | key module |
| IndexedDB connection leak (one per save) | Single shared connection with `versionchange`/`close` handling | `idbCachePersister.ts` |
| Money formatting ignored the UI locale and parsed via `parseFloat` | `registerFinanceLocaleProvider`; decimal strings go through the BigInt money layer; `.toFixed(2)` removed from opening balances | shared money tests |
| 21 bespoke query invalidators (18 modules missing setup/lookups invalidation) | All but `messaging` now use `createModuleQueryInvalidator` with `lists`/`preferences`/`lookups` | `queryFactories.test.ts` |
| gitleaks skipped the whole `__tests__` trees | Exclusions replaced by exact fixture literals; every rule scans those files again | `gitleaks detect` (verified: a planted token in a test file still fails) |
| APRs could merge untested source (coverage gate skipped) | `scripts/ci/check-changed-coverage.mjs` gates the files a PR touches | CI `Changed-file coverage` |
| DB tests skipped `services/**` + `use-cases/**` | Added to the `backend_db` path filter | CI |
| Baselines could be padded upward; E2E deep flows ran only locally | `--ratchet` wired into CI; nightly full-suite workflow with `E2E_FULL_SUITE=1` | `ci.yml`, `e2e-nightly.yml` |
| Docs: stale architectures, 59 `file:///Users/…` links, dead links | Rewritten; new broken-relative-link ratchet | `scripts/check-docs.mjs` |
| CSP allowed `ws:`/`wss:` to any host | Same-origin only; extra origins must be listed in `MMS_WS_ORIGINS` | `plugins/security.ts` |
| Failed deploy rollback reported success | Rollback failure now fails the job | `deploy.yml` |

**Still open (deliberate, measured, and now ratcheted)**

1. **Timezone-naive timestamps.** The migration-history ratchet sees **311** bare
   `timestamp` declarations; the live inventory on a freshly migrated DB is **144
   columns across 86 tables** (127 tenant, 17 global) — historical/dropped
   declarations explain the difference. Drizzle declares `withTimezone: true`.
   Converting them is a table-rewrite project and must be planned per-table; run
   `pnpm --filter mms-backend audit:timestamps` and follow
   [timestamp-migration.md](./timestamp-migration.md). `check:migration-hygiene`
   stops new naive columns.
2. **Historical migrations without `lock_timeout`** (143 of 198). Applied migrations are
   immutable (forward-only), so they cannot be edited; `check:migration-hygiene` requires
   `SET LOCAL lock_timeout` on every new migration that runs locking DDL.
3. **Drizzle snapshot chain jumps `0133` → `0197` (63 intermediate snapshots missing).**
   Regeneration needs a dedicated pass (`drizzle-kit generate` would re-emit applied DDL
   otherwise). The ratchet baseline is now 0, so no new journal entry can ship without a
   snapshot while the historical gap is pending.
4. ~~`packages/ui` has no `package.json`~~ **RESOLVED** — it is now the private
   `@mms/ui` workspace package with a source-only `typecheck` task
   (`tsconfig.build.json` excludes tests). Runtime imports still use the
   `@shared/ui` alias; tests stay in the frontend Vitest run, and structural
   rules are covered by `check:code-norms`/`check:shared-ui`.
5. **`useGlobalSettings` still hydrates from localStorage.** The 2FA gate it feeds is
   backend-authoritative (`authenticate.ts` rejects `twoFactorVerified === false`), so this
   is a cache-first UX choice rather than an authorization hole; migrating it to TanStack
   Query remains worthwhile.
6. **The 5 unreferenced-key i18n baseline is 518** (5.5% of 9,414). Pruning them is a
   product/QA decision; `check:i18n-unused` blocks growth in the meantime.

## 2026-10-29 project review

Full report: [project-review-2026-10-29.md](./project-review-2026-10-29.md). Two stored-XSS
vectors were fixed with regression tests:

- Print-window titles are now escaped in `printHtmlDocument` and `buildPrintWindowHtml` (certificate
  names, journal-entry refs, receipt numbers reached a same-origin `<title>` unescaped).
- `formatSocialPlatformUrl` rejects executable URL schemes (`javascript:`, `data:`, `vbscript:`)
  instead of passing them to an `href`/`window.open` target.

Everything recorded above still stands.

**Follow-up applied (same day):** the dependency advisories are patched
(`nodemailer 10.2.1`, `fast-uri 4.2.3`, `ip-address 10.7.5`, `serialize-javascript 7.1.4`; audit
now 1 moderate + 1 low, both reviewed exceptions), coverage floors were raised to the measured
values, the axe sweep now audits all 20 tenant routes (two violations found and fixed), and the
`set-state-in-effect` backlog was burned down with the rule promoted to `error`. Remaining open
items are the localStorage migration (blocked on endpoints) and the data-layer debt above.


## 2026-10-29 backend review

Full report: [backend-review-2026-10-29.md](./backend-review-2026-10-29.md). All findings were
implemented on `fix/backend-review-hardening`; the review document tracks each one. Deliberate
follow-ups:

- **Trgm indexes are an operator step.** Drizzle migrations run in one transaction, so the new
  contact/student expression indexes are in `apps/backend/scripts/sql/0197_search_indexes_concurrent.sql`
  and are applied with `create-index-concurrently.ts --file` after the migration.
- **Snapshot ordering is partial.** Sixteen high-volume loaders got `ORDER BY id`; the rest rely on
  the REPEATABLE READ snapshot plus the duplicate-id abort in `streamingSnapshotProducer`.
- **XLSX/JSON exports are capped at 50k rows**, not streamed yet (CSV is streamed).
- **Legacy crypto/erasure rows without a workspace** are hidden by RLS; an operator cleanup is
  still outstanding.
- **Historical audit state is plaintext**; only new events carrying a `subjectId` are encrypted.

## 2026-10-29 hardening (phase 2)

**Fixed (tests added):**

- Localized export downloads no longer 500: `Content-Disposition` is RFC 6266 with an ASCII
  fallback plus `filename*` (`apps/backend/src/lib/contentDisposition.ts`, route + unit tests).
- Session `startDate`/`endDate` (and class schedule/refreshment dates) are validated with
  `isoDateSchema` / `isoDateOrEmptySchema`; impossible dates are rejected before rollover
  arithmetic can produce `NaN`.
- Logout resets `useUiStateStore`, so the next user in the same tab does not inherit column
  layouts, tab state, or notification read markers.
- The Home bundle no longer imports the Reports/charts chunks (direct component imports).
- Document-template CRUD runs inside `withTenant`/`withTenantRead`; save + audit share one
  transaction and broadcasts happen after commit.
- Audit export decrypts subject state inside its read transaction, and `getLatestShardHash`
  no longer defaults to the root pool (so the shard head is real, not genesis).
- Refresh cookie is scoped to `/api/auth/refresh`; logout evicts the legacy broad cookie.
- Gitleaks uses rule-scoped value allowlists instead of whole-file path exemptions.
- Merkle checkpoints project only the caller's head in SQL.
- External `mailto:`/`wa.me` links open with `noopener,noreferrer`; print windows null their
  opener.
- Messaging filters persist the date range in the URL and validate channel/status/date on read.
- CI: draft→ready triggers a fresh run; a failed `changes` job or a skipped matched suite on a
  ready PR fails the gate; changed files without coverage fail; ratchet baselines cannot be
  raised silently; the new `test-backend-rls` job proves isolation as a non-bypass role.

**Still open (operator/next):**

- **Production still connects as `postgres`.** The strict preflight correctly
  refused it on 2026-10-30 (`role=postgres`, superuser/bypass). The repo
  variables are temporarily `MMS_DB_ROLE_ENFORCEMENT=warn` +
  `MMS_ALLOW_RLS_WARN=1` so deploys continue; RLS is **not** enforced on
  production while they are set. Provision `mms_app`, point `DATABASE_URL` at
  it, confirm `db:check-rls`, then set `strict` and remove the allow flag.
- **Historical snapshot regeneration** (0134–0196) and the 144 live naive
  timestamp columns (311 migration-history declarations).
- **Legacy Gitleaks history** is clean under the new config; keep it that way.

## 2026-10-30 review residuals

**Fixed:**

- `/institution-setup` now sits behind a `RequirePermission` guard for
  `settings.branding.write`: guests go to login, other roles go Home, and only a
  role that can actually persist the profile sees the wizard.
- `packages/ui` is included in the code-norm ratchets; its only raw hex values
  (the WCAG contrast fallbacks in `ThemeScope`) are now CSS keyword colors.
- `minimumReleaseAge: 1440` activates the dependency cooldown that the existing
  `minimumReleaseAgeExclude` list was written for.
- The backend route→storage boundary detector also flags `db/dbClient` imports
  and direct `getDb()`/`getRootDb()` calls; `db/dbConnection` remains sanctioned
  for the long-lived snapshot transaction primitives.

**Still open:**

- Historical Drizzle snapshot regeneration and timezone-naive timestamp conversion.
- i18n dead-key pruning (product/QA decision).

## 2026-10-30 frontend deep-review residuals

See [frontend-review-2026-10-30-deep.md](./frontend-review-2026-10-30-deep.md) for the full register.

**Fixed in the deep pass:**

- Pagination fell back to literal translation keys (`common.pagination.*` missing;
  `t(key) ?? "English"` never fired). Shared keys added + explicit resolution chain.
- Settings deep links (`/settings/:section`, the dashboard branding CTA,
  messaging "configure in Settings") now share one validated `?tab=` contract.
- Command palette: focus trap, topmost Escape and focus return (was `aria-modal`
  without any of them).
- Form-level save errors announce (`role="alert"`) and take focus once.
- Collapsed sidebar toggle has an accessible name and `aria-expanded`.
- `finance_fee_structures` / `finance_metrics` live push now invalidates finance.
- A second 401 after a refresh attempt escalates to session expiry.
- Platform console pages get a page-level error boundary.
- `ROUTES.workshops` added; registry↔ROUTES parity test.
- `user_not_registered` overlay no longer overrides login/forgot/apply pages.
- Cross-tab logout clears user-scoped caches.
- Tenant logo alt text, mobile drawer labels, `nav.recentItems`.

**Fixed in tranche 2 (2026-10-30):**

- **Entry-path motion.** `MotionConfig` moved from `AppProviders` to a
  `providers/MotionPreferences.tsx` mounted by `AppLayout` and the apex tree; the
  entry closure lost framer-motion (29 files / 1,829 KB → 28 / 1,693 KB raw;
  precache 38 / 2.29 MB → 37 / 2.16 MB). `check:pwa` now forbids `vendor-motion`
  in the precache. Reduced-motion coverage is unchanged (every `motion.*` renderer
  is below one of the two wrappers).
- **Table render hot path.** Stable `rowMotion` (`useCallback`), memoized column
  registry (`useModuleColumnLayout`), memoized `DataTable` columns and direct
  `state.rows`; `useDeferredValue` on search. New render-count test proves rows do
  not re-render on unrelated parent renders while data/search updates still do.
- **Route announcements.** `components/routing/RouteAnnouncer.tsx` focuses
  `#main-content` and announces the page heading via a polite live region on
  pathname changes (silent on first paint, no focus steal while a modal is open);
  the remaining `#main-content` landmarks gained `tabIndex={-1}`.
- **Calendar localization.** `lib/ui/calendarLocale.ts` feeds Intl formatters/labels
  (month, weekday, day numerals, ARIA) into `components/ui/calendar.tsx`, with
  `calendar: "gregory"` so `fa-IR`/`ar-SA` do not switch to Jalali/Umm al-Qura
  while the grid stays Gregorian; four `datePicker.*` keys added ×4 locales.

**Fixed in tranche 3 (2026-10-30):**

- **Contract errors carry structure.** `lib/apiContractError.ts` is now the only
  way a non-2xx ts-rest envelope becomes an error (`assertContractOk` /
  `apiContractError` / `contractBodyOrThrow`): 12 local `assertOk`-style helpers
  were deleted and 48 inline status-based `throw new Error` sites migrated, so
  every contract failure is an `ApiError` with status, body message/type/code,
  validation `errors`, `x-request-id` and `Retry-After`. The ts-rest fetcher's
  401/403 path uses the same helper. A static test
  (`src/__tests__/apiContractErrorUsage.test.ts`) fails if a generic `Error` or a
  local helper reappears after a status guard. Envelope returns for ≥400 are
  unchanged (form flows still read the body).
- **Retry policy.** `lib/query/retryPolicy.ts`: 401/403/404/409/422/429 are not
  retried; other failures keep three attempts; `Retry-After` (now present on
  contract `ApiError`s) overrides the exponential delay, capped at 30 s.
- **Socket wake recovery.** `connectTenantDatabaseSocket` reconnects a closed or
  closing socket on `online`, `focus` and `visibilitychange` (visible), leaves a
  CONNECTING/OPEN socket alone, and removes the listeners on disconnect. A true
  half-open heartbeat still needs a server pong.

**Fixed in tranche 4 (2026-10-30):**

- **The coverage gate now measures the whole source tree.** `vitest.config.ts` gained
  `coverage.include: ["src/**/*.{ts,tsx}"]`; before it, Vitest only instrumented files a
  test had loaded, so 715 of 2,820 source files never entered the denominator. Whole-tree
  measurement (2,823 files, unsharded and a 2-shard merge both identical):
  statements **41.48%**, branches **40.95%**, functions **34.58%**, lines **42.41%** — the
  floors are now `42 / 41 / 34 / 40` (lines/statements/functions/branches). The previous
  56/55/46/51 described the 2,104-file subset; this is a basis correction, not a tolerance
  change. The canonical rule row and all four mirrors were updated via `sync-all.sh`.
  Runtime: ~1m48s unsharded; the 2-shard blob+merge smoke reproduced the totals exactly.
- **Assertion-specificity ratchet.** New
  `src/__tests__/testAssertionSpecificity.test.ts` counts `toBeTruthy`/`toBeFalsy`/
  `toBeDefined` across the suite and fails above a baseline that may only go down
  (**288** after deleting the attendance contract-hooks vanity test, which only asserted
  seven imports were defined).
- **Test infrastructure.** Pruned 21 stale + 1 deleted-test keys from
  `src/test/shard-timings.json` (877 remain, all existing) and tightened
  `shardSequencer.test.ts` from "≥90% exist" to per-key existence; the global teardown now
  clears `localStorage` as well as `sessionStorage`; the stale `filesOverHardLimit` comment
  in `check-code-norms.mjs` was corrected.

**Still open (tracked in the review's deferred register):**

- Widget toggle full-record PUT from a cached list row (needs a field-level
  backend write endpoint; `GET /:id` is role-sanitized so fetch-then-PUT is unsafe).
- Shared-contract chunking, `modulePreload`, service-worker update UX, `en`
  dictionary split (the remaining entry-chunk work).
- `useGlobalSettings` fan-out (single provider / identity bail-out).
- Dead-code deletion (27 orphans + 26 test-only modules); duplicated setup hooks;
  bulk-bar SSOT rule drift.
- Remaining test hygiene: burn the 288 loose assertions down, Testing Library migration,
  React root leaks (19 files).
- WS half-open heartbeat; bounded persisted cache.
- ~~Template-editor server-save failure UX~~ **RESOLVED 2026-11-02** — save failures now surface one
  `templateEditor.saveFailed` toast, the editor stays dirty, and no success toast is shown.
- Document-template follow-ups: Finance/Examinations/Hasanat print renderers must consume their layouts;
  template field/preset labels need reviewed translations; optimistic concurrency (`updated_at` → 409).

## 2026-10-30 project review

Full report: [project-review-2026-10-30.md](./project-review-2026-10-30.md). Read-only review at
`84516ad04`; evidence: 21/21 blocking gates, 7,736 unit tests, forced build + bundle/PWA budgets,
and `pnpm audit`. Findings P-01…P-06 were then fixed on `fix/project-review-2026-10-30`.

**Fixed in the resolution pass:**

- **P-01 Major — production print windows never auto-printed.** `printWindowHtml.ts` and
  `paperBuilderUtils.ts` wrote an inline `<script>` into an `about:blank` popup; the nonce-only CSP
  is inherited by that document, so the script was blocked (reproduced with Playwright). Vouchers,
  invoice receipts, certificates, and question-bank papers rendered but never called
  `print()`/`onafterprint` in production. Fixed by removing the inline scripts and printing from the
  opener via `autoPrintWindow(win)`; both builders now have tests asserting no `<script>` is emitted.
- **P-02 Major (gate integrity) — backend/shared coverage measured only loaded files.** Both
  `vitest.config.ts` files now set `coverage.include`; whole-tree measured on 2026-10-30 (backend
  4 shards + merge: lines 45.19 / stmts 43.06 / funcs 41.41 / branches 33.96; shared:
  78.24 / 74.96 / 71.89 / 56.17). Floors re-based to 44/42/40/32 (backend) and 77/74/71/55
  (shared); rule snapshot + all mirrors resynced.
- **P-03 Minor — CI source maps shipped and public.** `package-dist.sh` now tars with
  `--exclude='*.map'` and fails if the artefact contains one (verified: 590 files on disk, 0 in the
  tarball). Maps stay on disk for a future Sentry upload.
- **P-04 Minor — `Math.random()` admin password** → `randomInt` from `node:crypto`.
- **P-05 Minor — e2e seed helpers interpolated `subdomain` into shell strings** → every
  `execSync` in `e2e/helpers/` is now `execFileSync` with argv (`runBackendSeedScript` helper).
- **P-06 Minor — OTP + email logged whenever `NODE_ENV !== "production"`** → requires
  `MMS_DEBUG_OTP=1` (never in production), with unit coverage.

**Still open / unchanged:** production RLS in `warn` + `MMS_ALLOW_RLS_WARN=1` (highest residual
risk; deploy default is `strict` and fails closed), snapshot regeneration and naive timestamps,
143 historical migrations without `lock_timeout`, 517 dead i18n keys, legacy localStorage store
(no new non-test call site), and the 10-30 frontend deferred register.

## 2026-10-31 backend review — accepted debt

Full report: [backend-review-2026-10-31.md](./backend-review-2026-10-31.md). Read-only re-review at
`cf69f9d17` (backend tree identical to `1a9b1d942`); gates green, 2,237 unit tests + 181 real-Postgres
tests passing.

**B-01–B-09 (P0/P1) — FIXED 2026-10-31, no commit/PR.** Ledger guards on the invoice/payment `PUT`
endpoints, reset-password session revocation, strict auth Redis reads (503 instead of fail-open),
cross-node cache-invalidation startup, bounded messaging jobs with a shutdown margin, cross-currency
archive arithmetic with row locks, atomic restore auditing, and per-invoice batch auditing all landed
with regression tests. Evidence and behaviour changes: review report §11. The unit suite is now
329 files / 2,274 tests and the real-Postgres suite still passes.

**P2 batch 2 — FIXED 2026-10-31, no commit/PR.** B-10 (IP-only pre-auth rate-limit buckets), B-11
(atomic 2FA challenge + attempt ceiling), B-12 (super-user-only platform admin disable/delete), B-14
(private cache for session-gated uploads), B-15 (`/ready` probe memoisation), B-16 (loopback-or-token
`/metrics`), B-17 (CI `lib/**`/`middleware/**` → DB + RLS) and B-21 (subject-encrypted erasure audit)
landed with regression tests. Evidence: review report §11 (“P2 batch 2”); unit suite 331 files /
2,291 tests and the real-Postgres suite still pass.

**P2/P3 — still open**

- **B-13** Audit immutability `REVOKE` is gated on `mms_app_user`; the app role is `mms_app`, and
  checkpoints are signed inside the same database. Needs a migration + external signing design.
- **B-18** Credit notes have no idempotency key; a retried POST double-credits. Changes the shared
  contract and replay semantics.
- **B-19** Bank reconciliation stores unchecked ids (no amount/account validation, no unmatch, no
  audit). Needs product rules for statement sign/account matching and partial matches.
- **B-20** Invoice numbering is a racy max-scan; fixing the retry requires moving transaction
  ownership out of the finance routes.
- **B-22** Logic coverage 44 % (mocked unit run only); 54 use-cases without companion tests.
- **B-23–B-36** Remaining hygiene/audit/jobs findings, recorded in the report with evidence and
  proposed tests.
