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
   `test-backend-coverage` merge job enforces the thresholds (measured Stmts 47.29 / Branch 35.76 /
   Funcs 46.43 / Lines 49.63 against 43.2 / 27 / 37.5 / 45 before enabling).
4. ~~`check:backend-boundaries` not in CI.~~ **RESOLVED** — now a ratchet step in the `typecheck-lint` job.
   A `sensitive-file-guard` job also landed (whole-tree sensitive-filename blocklist, at any path depth).
5. **Fat-file debt.** **69 → 62** files over the ADR-001 300-LOC cap (baseline ratcheted down via
   `check-code-norms --update-baselines`, never by hand). Seven splits landed, all one shape: extract a
   cohesive block into its own module and keep the origin working — a **barrel re-export** when the block
   was public (`crud*`, `livePush`, `contacts.dto`), or a plain **import** when it was module-private
   (`financeListQueryBuilders`, `attendanceListQueryBuilders`, `attendanceReportOverview`), which leaves the
   public surface untouched by construction. Composition of the remaining 62: **42 backend,
   16 `@mms/shared`, 4 frontend**; four are the ~8.4k-line generated `appTranslations*.ts`.
   Prioritisation (the part that matters): a split only lowers the count when **every** part lands under
   300 with headroom, so the lane is the 300–321 band — now down to **7 files**
   (`accountingFiscalYearsRepository.ts` 321, `obligationsUseCases.ts` 318, `messagingUseCases.ts` 314,
   `routes/tenant/enrollments.ts` 308, `sessionRepositoryPersistClasses.ts` 306,
   `contactFormNormalizeEdit.ts` 304, `examinationQuestionBankTables.ts` 303). Rejected as-is, because a
   _move_ cannot fix them: `obligationsUseCases.ts` (one 270-line factory), the `*UseCases.ts` /
   `*ContractRouter.ts` monoliths, `invoiceTemplatePresets.ts` (863 — its `buildFormalA5Preset` alone is
   ~314 lines, so it needs a second split inside the extracted part), and
   `accountingFiscalYearsRepository.ts` lands at ~267 with only ~33 lines of headroom.
   _Needs:_ a call on whether to keep going.
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
   - _Document templates_ — `documentTemplatePersistence` + `invoiceTemplateStore` / student-card / finance /
     exam / hasanat editors (~15 consumers) → need a generic `/api/templates/:key` object endpoint.
   - _Reports/KPI config_ — `usePinnedWidgetsController`, `useDashboardSectionSettings`, `kpiSummaryCard*`,
     `DynamicCardBuilder`, `ModuleReportsToolPanels` → need `/api/reports/section-settings` + per-module KPI
     config endpoints.
   - _Module settings_ — `useObligationsSettings` → could reuse the `createModuleSetupConfigHooks` pattern
     once a settings endpoint exists.
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
