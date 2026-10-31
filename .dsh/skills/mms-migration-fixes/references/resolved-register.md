# resolved-register — mms-migration-fixes

Extracted from `SKILL.md` so the skill body stays loadable in one pass; the owning rule is the norm SSOT.


## Resolved (do not reintroduce)

| Item | Resolution |
|------|------------|
| Auth seeds shape | `StoredUser` with `role` + `passwordHash` |
| RBAC on `/api/db/*` writes | `rbacService` |
| Nested `ContactConfigProvider` | Single mount in `TenantScopedProviders` (tenant host) |
| JWT localStorage-only | httpOnly cookies; `apiClient` cookie-only (`credentials: 'include'`) |
| Tenant JWT binding | `authenticateTenant` middleware |
| Bulk sync open download | Admin-only `canDownloadBulkSync` |
| Global DB reset via API | Tenant-scoped `resetTenantData` |
| Nested contact item schemas | Locked down to `.strict()` in `contactNestedSchemas.ts` (P3b) |
| Residual document-store module prefs | Finance, Attendance, Enrollments, etc. moved to typed tables (P3) |
| Massive mock auto-seed | `minimalSeeds` + empty frontend defaults |
| In-memory auth handoff | `auth_artifacts` table |
| Client-side 2FA only | Server `twoFactorService` |
| Orphan route guards | Canonical `ProtectedRoute` in `HostRoutes` |
| FE live push (residual modules) | Modules migrated to `createGenericRelationalService` / `upsertWithBroadcast` (P6) |
| Contacts REST + write RBAC | Full `/api/contacts` CRUD + `canWriteCollection` on mutations |
| Settings monolithic panels | Split into hooks + section components; `useBackupRestore`, `ModuleSettingsNavGrid`, `settingsSectionComponents` |
| Accessible branding theme | `logoBrandColors.ts` + `brandingTheme.ts` WCAG AA tokens |
| Legacy `mms_token` cleanup | Removed — cookie-only session via `apiClient` |
| Composite primary keys | Changed to `(workspace_subdomain, id)` for strict isolation in schema.ts |
| Form modal progress tracking | Built progress scanning inside FormModal.tsx for forms |
| Linter warnings cleanup | Fixed all react-hooks dependency array and unused variable lint errors |
| Unified Phone & Zero-Click Form | Unified phone inputs & zero-click form sublist auto-population in ContactForm and Branding |
| Wrapper files removal | Removed redundant wrapper/alias files for StatCard, ExportToolbar, and SafeResponsiveContainer |
| Column Customizer Props DRY | Consolidated duplicate local ColumnCustomizerProps interfaces into ModuleColumnCustomizerProps |
| REST collections migration | Major modules on dedicated REST + TanStack Query (see migration-status resolved list) |
| Sentry client-side error reporting | Configured and integrated Sentry with global React ErrorBoundary fallback rendering in `main.tsx` |
| RBAC read hardening | Hardened `rbacService.ts` mapping and logic by explicitly checking permissions for `user_activity_logs` and `backups` collection reads/writes |
| Date & Money formatting consistency DRY | Settings-aware `formatDate` / `formatMoney` |
| Settings-Aware Currency Formatting DRY | `useAccountingCurrency` / `useFinanceCurrency`; no hardcoded `"PKR"` |
| Unified Date Filters | `<AccountingDateFilterBar>` |
| Module write-surface `can()` gates | `useModulePermissions(contract)` on major modules — omit forbidden CTAs |
| Students & Teachers soft-delete Work UI | Trash toggle + restore/bulk restore (Contacts-style) |
| Expanded soft-delete Work trash | Sessions, Attendance, Enrollments, Finance, Accounting, Obligations, Hasanat, Examinations, Question Bank (questions), Users (`tenant_users.deleted_at`) |
| Module gold-standard parity | Hasanat → Examinations → Users → Messaging → Question Bank: upsert bulk PUT, awaited saves, setupSubTabs, ErrorState, Cmd/Ctrl+N |
| Onboarding E2E critical path | `e2e/tests/platform-onboarding.spec.ts` |
| Contacts FORCE RLS + typed soft-delete SQL | Squashed `0000_init` (+ journal forward migrations); list filters on `deleted_at` |
| Contacts entity leave document-store | Removed from `ALLOWED_COLLECTIONS` / FE `BUSINESS_COLLECTIONS`; typed `contacts` table only |
| Google Contacts OAuth secrets table | `contact_google_sync_credentials` FORCE RLS; not `objects` |
| Contacts saved reports → typed table | `saved_reports` category `contacts`; object key deprecated from ALLOWED_OBJECTS |
| Audit trigger tenant + user GUCs | `log_row_change` fills `workspace_subdomain`; `app.current_user_id` SET LOCAL |
| Contact write schema soft-delete strip + top-level strict | `contactWriteSchema` / `buildContactWriteSchema` + `stripContactClientSoftDeleteFields` |
| Atomic contact merge | `POST /api/contacts/merge`; FE invalidates after Google sync (no dual upsert) |
| Contacts Setup lookups typed | `contact_lookups` + `/api/contacts/lookups`; removed from `ALLOWED_COLLECTIONS` / FE `BUSINESS_COLLECTIONS` |
| Contacts Setup field-config / prefs / column prefs typed | `contact_field_configs`, `contact_module_preferences`, `contact_user_column_prefs` + REST; removed from `ALLOWED_OBJECTS` |
| Query-first report widgets | `useWidgetCollections({ requiredCollections })` + `useReportCollectionRows`; REST toggles via `widgetRecordToggle` |
| Students Work REST parity | SQL page/filter, table\|cards, trash/`viewingDeleted`, drawer archive chrome, metrics, server CSV (`POST /api/students/export/csv` + audit + `students:export`) |
| Students Identity → Contacts SSOT | Typed student row = `contactId` + module fields; strip `CONTACT_PROFILE_FIELDS` + guardian dual-write on write; hydrate on read; Work list gender/dob/name filter+sort+search joins `contacts` (`studentRepositoryList`); data migrate `046_strip_student_contact_profile_fields`; Drizzle `0020_drop_students_gender_active_idx` |
| Contacts Clean Architecture layering | `contacts/use-cases/**` (load/write/normalize/soft-delete/duplicate-scan/relationship-inference with repo DI) + `contacts/repository/` interface + `contactsRepositoryAdapter` + `contactUseCases` composition root; legacy `contactService*.ts` paths are stable re-export shims |
| Contacts duplicate-scan SQL closure | `findContactDuplicateCandidateIds` / `findContactDuplicateBlockedIds` on the repository interface — no full active-set walk; shared `buildNamePrefixRegex` / `getContactDuplicateCandidateKeys` are the semantic SSOT |
| Contacts list/filter SSOT | Shared `contactsListQuerySchema` drives SQL `listPage` pagination — in-memory `paginateContacts` helper removed; do not fork contact list/filter flags per route |
| Backend DRY factories | `createCollectionAuditHelper` / `createModulePreferencesService` in `apps/backend/src/lib/` — reused by Contacts / Students / Teachers / Users / Sessions (no per-module forked audit/prefs stores) |
| Contacts↔Students Module*/createModule* DRY | Shared Work/Setup chrome (`Module*`), `createModule*` / `registerModule*` (field-config, lookups, CSV, setup audit, field usage), `startServerBackgroundJob`, soft-delete via `registerResourceRoutes` hooks; thin domain adapters only |
| Teachers Work/Setup REST parity | SQL page/filter + contact-name join (`teacherRepositoryList`), table\|cards, trash/drawer archive, SQL metrics, server CSV, typed Setup (`teacher_field_configs` / `teacher_module_preferences` / `teacher_user_column_prefs` + `registerModule*`); Drizzle `0021_teacher_setup_config` |
| Sessions Work REST parity | SQL page/filter (`sessionRepositoryList`), table\|cards, trash drawer archive chrome, SQL metrics, server CSV |
| Users Work REST parity | SQL page/filter (`tenantUserRepositoryList`), FE `useUsersPaginated` + ListPagination, DetailDrawer archive chrome, SQL metrics, server CSV |
| Sessions typed Setup REST | `session_field_configs` / `session_module_preferences` / `session_user_column_prefs` + `registerModuleSetupConfigRoutes`; Drizzle `0022_session_setup_config`; data migrate `049`/`050`; Query-first `useSessionConfig` |
| Users typed Setup REST | `user_field_configs` / `user_module_preferences` / `user_user_column_prefs` + REST; prefs include `workspaceRoles` + auth `requireEmailVerification`; Drizzle `0023_user_setup_config`; data migrate `051`/`052`; Query-first `useUsersConfig` |
| Modern Database Audit Trail Parity | 5-dimension RFC 8785 canonical JSON, transactional outbox capture, sharded cryptographic hash chains with Merkle tree rollups, crypto-shredding / redact-and-append erasure, monthly date partitioning, `INSERT`-only DB privileges, `pgAudit` statement auditing (`mms-audit-trail`) |
| Bulk restore userId audit fix | `registerSoftDeletableBulkRoutes` passes `userId` to `bulkRestoreFn` in `crudBulkRouteFactories.ts` and `crudBulkRouteHelpers.ts` |
| Scheduled retention hard-purge worker (P1) | `purgeExpiredArchivedRecords` implemented in `apps/backend/src/worker/purgeArchivedRecordsJob.ts` (bounded 500-row chunks, `FOR UPDATE SKIP LOCKED`, 50 ms inter-chunk pause, `entity.hard_purge` audit event + outbox CDC, tenant-scoped) and scheduled daily 02:00 UTC by `scheduleNextDailyPurge` in `apps/backend/src/worker/index.ts` (single-leader lease) — matches "Retention Hard-Purge" in `docs/migration-milestones.md` (`docs/soft-delete.md` §13). Resolved 2026-09-18. |
| P1 soft-delete schema gaps — verification closure (items 1–4) | Verified resolved 2026-09-18 against the live schema: partial unique indexes present for every applicable column (`faculty_workspace_employee_id_active_uidx` from 0104/0112; `students_workspace_gr_number_active_uidx` + `students_workspace_student_id_active_uidx` from 0104; `tenant_users_workspace_login_email_active_idx` from 0108; 0108's `contacts` email/phone DO-block guards intentionally no-op — email/phone live in `contact_emails`/`contact_phones` child tables by design); all 20 soft-deletable tables carry Category B (`deleted_at IS NULL`) and Category C (`deleted_at IS NOT NULL`) index pairs — the only information_schema "miss", view `teachers` from `0113_faculty_department_designation.sql`, is a migration-defined compat view over `faculty` needing no indexes; `deleted_with_cascade` present on `enrollments` (0104) and all 19 soft-deletable tables (0108); no raw `includeDeleted` string comparisons remain (routes use `isQueryFlagTrue` / `normalizeIncludeDeletedFlag`). No new DDL required. |
| Saved-reports parity for all module categories (P4) | Generic `/api/saved-reports` router realigned to contract 2026-09-18 (`apps/backend/src/routes/tenant/savedReports.ts`): owner-scoped repository calls, per-category `permissions.read` gates via full 15-category manifest map (teachers→faculty, financial/obligations→finance, messaging/users→contacts), `createCollectionAuditHelper` audit (`<module>.saved_report.create\|delete\|run`); FE wiring pre-existed (`useGenericReportsSource`, `SavedReports` in `ModuleReportsToolPanels`) so 15 categories gained working saved reports; fixed live FE↔contract bug (FE `{}` delete/run body vs `z.void()` contract → 400) via plugin preHandler normalization; 17 inject() allow/deny tests in `savedReportsContractRoutes.test.ts`; dead `services/savedReportsService.ts` removed. Residual: niche chart client-reduce dumps remain opportunistic (`mms-reports-export`). |
