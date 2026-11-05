# MMS Backend Module Review — Dashboard, Contacts, Students, Faculty, Tasks

Independent architectural, security, and data integrity review of the Fastify + PostgreSQL 16 + Drizzle ORM backend for five core modules: **Dashboard**, **Contacts**, **Students**, **Faculty**, and **Tasks**.

**No Critical findings.** All 5 modules are in production-grade health:
- Row-Level Security (RLS) is strictly enforced fail-closed (`withTenant` / `withTenantRead`).
- Zero wildcard projections (`0` `SELECT *`).
- Primary keys are composite `(workspace_subdomain, id)`.
- Soft-delete sextuple with partial indexes where `deleted_at IS NULL` is systematically applied.
- All 126 test files (**900 tests**) pass at 100%.

---

## 1. Scope & Module Scorecard

| Module | Route Style / Contract | Data Storage & Primary Keys | Soft Delete & Triggers | RBAC & Module Access Gates | Ports & Adapters Status | Test Suite Health |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Dashboard** | `@ts-rest` Contract Router (`dashboardContract`) | Drizzle `dashboard_preferences` & `dashboard_widgets` (`workspace_subdomain`, `id`) | N/A (Widgets hard-deleted on unpin; singleton prefs) | Gated on `dashboard` module, caller role section stripping (`pickReadableModuleSections`), `setupWrite` / `customize` | Service-driven (`dashboardSummaryService`, `dashboardPreferencesService`) | 3 suites, 25 tests passed |
| **Contacts** | Granular Fastify sub-routers (`/api/contacts`) | Drizzle `contacts`, `contact_emails`, `contact_phones`, `contact_tags` (`workspace_subdomain`, `id`) | Full sextuple + partial indexes (`WHERE deleted_at IS NULL`) + outbox events | Gated on `contacts` module, `contacts.read`, `contacts.write`, `contacts.delete`, field-level sanitization | Fully split into `contacts/repository/` and `contacts/use-cases/` (≤300 LOC per file) | 42 suites, 348 tests passed |
| **Students** | Granular Fastify sub-routers (`/api/students`) | Drizzle `students`, `student_setup_configs` (`workspace_subdomain`, `id`) | Full sextuple + partial unique index on `gr_no` + restore-on-create conflict detection | Gated on `students` module, `students.read`, `students.write`, `students.delete`, `students.export` | Fully split into `students/repository/` and `students/use-cases/` | 32 suites, 235 tests passed |
| **Faculty** | Modular route handlers + legacy aliases (`/api/faculty`, `/api/tenant/faculty`, `/api/v1/tenant/faculty`) | Drizzle `faculty`, `faculty_employments`, `faculty_employ_designations`, `faculty_assignments` | Full sextuple + assignment cascade + session guard | Gated on `faculty` module, `faculty.read`, `faculty.write`, `faculty.delete`, `facultyCatalogRouteAuth` | Fully split into `faculty/repository/` and `faculty/use-cases/` + legacy surface check | 38 suites, 248 tests passed |
| **Tasks** | Dedicated routes (`tasksRoutes.ts`, `tasksReadRoutes.ts`, `tasksSoftDeleteRoutes.ts`) | Drizzle `tasks`, `task_assignees`, `task_comments`, `task_settings` | Full sextuple + cycle detection CTE + subtask conflict check | Gated on `tasks` module, `tasks.read`, `tasks.write`, `tasks.assign`, `tasks.assign_anywhere`, `tasks.delete` | Port & adapter bound in `tasksRepository.ts` & `tasksRepositoryAdapter.ts` | 10 suites, 43 tests passed |

---

## 2. In-Depth Module Reviews

### 2.1 Dashboard Module
- **Route & Access Controls:** Defined in `apps/backend/src/routes/tenant/dashboard.ts` using `@ts-rest/fastify` and `dashboardContract`. Gated by `authenticateTenant` and `registerModuleAccess(fastify, "dashboard")`.
- **Composite Summary & Dynamic Filtering:** In `getSummary`, `pickReadableModuleSections(request, summary)` dynamically checks caller read access on each module key. If a user lacks permission for a domain (e.g., accounting or finance), that section is stripped server-side.
- **Caching & Resilience:** Cached in Redis with key `dashboardSummary(tenant, date)` and a 30s TTL. Aggregations run in a read-only transaction with a 10s statement timeout.
- **Tasks Integration:** Connected `TasksCommandMetricsSnapshot` via `tasksUseCases.getTaskMetrics(cleanTenant)` into `DashboardSummaryResponse`, making task metrics available on the dashboard while respecting caller module access.

### 2.2 Contacts Module
- **Single Source of Truth (SSOT):** Acts as the demographic SSOT for persons. Student profiles and Faculty employment records reference `contactId`.
- **System-Managed Tags:** Managed via `contactSystemTagReconcile.ts` with archive-not-delete semantics. Unique partial index `contact_tags_ws_contact_system_key_uidx` prevents duplicate system tags during concurrent operations.
- **Data Protection:** `sanitizeForUser` redacts sensitive fields (CNIC, confidential notes) unless caller holds elevated `contacts.view_sensitive` permissions.
- **Sync & Search:** Includes bi-directional Google Contacts sync, peer matching, phonetic/Levenshtein de-duplication, and CSV/VCF exports.

### 2.3 Students Module
- **Admission & GR Number Sequencing:** Per-tenant auto-incrementing General Register (`grNo`) generator with conflict detection.
- **Restore-On-Create:** Re-registration of a previously soft-deleted student invokes `restoreArchivedStudentOnCreate`, preventing duplicate records while verifying deletion permissions.
- **Enrollment Cascades:** State transitions to exit statuses (`graduated`, `expelled`, `withdrawn`) atomically terminate active enrollments via `withdrawEnrollmentsForStudentStatus`.
- **Contact Tag Reconcile:** Dispatches `reconcileContactSystemTags` upon status updates.

### 2.4 Faculty Module
- **Normalized Data Architecture:** Separates academic profiles (`faculty`), employment contracts (`faculty_employments`), designation appointments (`faculty_employ_designations`), and department workload assignments (`faculty_assignments`).
- **Hierarchy & Cycle Prevention:** `facultyHierarchyValidator.ts` uses a recursive SQL CTE to verify that assignments to `reportsToFacultyId` cannot create cycles.
- **Advisory Locking:** Executes `lockFacultyHierarchy(tx, tenant)` to prevent race conditions during concurrent organizational changes.
- **Linked User Role Sync:** Synchronizes tenant user role assignments based on active designations and `facultyManagedRolesPrefs`.

### 2.5 Tasks Module
- **Hierarchical Delegation:** Evaluates assigner and assignee positions against institutional hierarchy and task settings (`descendants`, `direct_reports`).
- **DAG Cycle Prevention:** Recursive CTE verifies task parent-child chains up to depth 20.
- **Soft-Delete Invariants:** Prevents soft-deleting tasks with active subtasks (`Task has active subtasks`), and prevents restoring subtasks whose parent remains archived.
- **Ports & Adapters Integration:** `TasksRepository` port and `tasksRepositoryAdapter` adapter bind `createTask` and `updateTask` to enforce the architectural boundary.

---

## 3. Security & Adversarial Loophole Audit

1. **Multi-Tenancy & RLS:** All operations execute within `withTenant(tenant, ...)`. RLS is enabled on all tenant tables with fail-closed semantics.
2. **IDOR & Boundary Scoping:** Composite primary keys `(workspace_subdomain, id)` and tenant constraints on all queries prevent cross-tenant access.
3. **Soft-Delete Safety:** Active queries strictly enforce `WHERE deleted_at IS NULL`. Partial unique indexes protect recyclable unique keys.
4. **Concurrency & Deadlocks:** Recursive CTEs and advisory locks (`lockFacultyHierarchy`) guard hierarchical trees from concurrency anomalies.
5. **DB Projections:** 100% compliant with zero wildcard projections (`SELECT *`).

---

## 4. Verification Evidence

- `pnpm --filter mms-backend test dashboard` (3 suites, 25 tests passed)
- `pnpm --filter mms-backend test contact` (42 suites, 348 tests passed)
- `pnpm --filter mms-backend test student` (32 suites, 235 tests passed)
- `pnpm --filter mms-backend test faculty` (38 suites, 248 tests passed)
- `pnpm --filter mms-backend test task` (10 suites, 43 tests passed)
- `pnpm --filter mms-backend test moduleAccessCoverage.test.ts` (1 suite, 1 test passed)
- `pnpm typecheck` (Pass, 6/6 packages clean)
- `node scripts/check-backend-boundaries.mjs` (Pass, 0 route storage offenders)
- `node scripts/check-backend-structure.mjs` (Pass, all ratchets held)
- `node scripts/check-faculty-domain.mjs` (Pass, zero legacy surface leaks)
- `node scripts/check-db-projections.mjs` (Pass, 0 wildcard queries)
- `node scripts/check-code-norms.mjs` (Pass, 0 `any`, 0 files >300 LOC)
