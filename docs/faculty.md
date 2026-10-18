# Faculty Module Architecture & Engineering Specification

> **Module Status:** Production Gold Standard  
> **Package Scopes:** `apps/backend`, `apps/frontend`, `packages/shared`  
> **Conformance Targets:** Clean Architecture, 3-Tier Module Layout (§7 Parity), Zero-Trust Zod DTOs, PostgreSQL 16 RLS & Recursive CTEs, RFC 8785 Canonical JSON Outbox Audit Trail, TanStack Query v5, BiDi / RTL Accessibility (WCAG 2.1 AA).

---

## 1. Executive Summary & Domain Overview

The **Faculty Module** in the Madrasa Management System (MMS) manages academic personnel, organizational structures, multi-role temporal appointments, and operational workflows across tenant institutions.

Historically transformed from a simplistic "teachers" table, the current Faculty domain represents an enterprise-grade personnel subsystem with:
1. **Separation of Personal Identity vs. Employment:** Personal data (names, identity numbers, phones, avatars, addresses) is strictly owned by the **Contacts** module ([`contacts.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/db/schema/contacts.js)). The Faculty profile owns institutional employment attributes (employee IDs, ranks, specializations, qualifications, join dates, and temporal appointments).
2. **Normalized Multi-Role Temporal Appointments:** Faculty members can hold appointments across multiple departments and designations simultaneously or consecutively over date ranges (`startDate` → `endDate`), with transactional validation guaranteeing at most one active primary appointment.
3. **Department / designation structure:** Department and designation catalogs define institutional structure and rank. Display names and hierarchy rank are resolved from primary `faculty_assignments` rows (not denormalized on `faculty`). Session tables (`session_faculty`, `session_classes`, timetable periods) reference `faculty` via composite FKs. The former Organization positions/locations module has been removed.
4. **Three-Tier Command Centre UX:** Conforms strictly to the MMS Master Module Scaffold Layout:
   - **Work Tier:** High-density directory table, responsive mobile cards, quick filters, bulk actions, column customizer, slide-over detail drawer, and batch-printable laminated ID cards.
   - **Reports Tier:** KPI metrics, departmental distributions, qualification breakdowns, and multi-format exports (CSV, Excel, print).
   - **Setup Tier:** Institutional preferences, atomic annual-rollover employee ID generator configuration, department hierarchy catalog, and designation rank catalog.
5. **Strict Architectural Modularity:** Zero files exceeding the 300-line hard ceiling; strict decoupling between presentation components, hooks, use cases, and database repositories.

---

## 2. System Architecture & Component Mapping

```mermaid
graph TD
    subgraph Frontend ["apps/frontend (React 19 + TanStack Query v5 + Tailwind v4)"]
        FP[FacultyPage.tsx] --> FPV[FacultyPageView.tsx]
        FPV --> WT[FacultyWorkTier.tsx]
        FPV --> RT[FacultyReportsTier.tsx]
        FPV --> ST[FacultySetupTier.tsx]
        FPV --> FD[FacultyDetail.tsx (Drawer)]
        FPV --> FF[FacultyForm.tsx (Modal)]
        FPV --> FICM[FacultyIdCardModal.tsx]
        WT --> TQ[TanStack Query Facade<br/>@/tenant/hooks/collections/faculty]
    end

    subgraph Shared ["packages/shared (@mms/shared)"]
        FCTR[facultyContract (@ts-rest)]
        FDTO[Zod DTOs & Validation Schemas]
        FMOD[FACULTY_MODULE_MANIFEST]
        FUTL[Deterministic ID & Cell Format Utils]
    end

    subgraph Backend ["apps/backend (Fastify 5 + Drizzle ORM + Node.js 24)"]
        FR[Fastify Route Handlers<br/>apps/backend/src/routes/tenant/faculty/*]
        FUC[Faculty Use Cases<br/>apps/backend/src/faculty/use-cases/*]
        FREP[Faculty Repositories<br/>apps/backend/src/db/repositories/faculty*]
        SEC[authenticateTenant + requireTenantModule]
        AUD[Audit Trail Service (RFC 8785) + Outbox CDC]
    end

    subgraph Database ["PostgreSQL 16 Engine"]
        TFAC[(faculty)]
        TDEPT[(faculty_departments)]
        TDES[(faculty_designations)]
        TASGN[(faculty_assignments)]
        TCFG[(faculty_setup_config)]
        TLOOK[(faculty_lookups)]
        RLS[Row Level Security: SET LOCAL app.current_tenant]
    end

    TQ -->|Type-Safe HTTP Calls| FCTR
    FR -->|Validates Against| FDTO
    FR --> SEC
    SEC --> FUC
    FUC --> FREP
    FREP --> AUD
    FREP --> RLS
    RLS --> Database
```

---

## 3. Database Layer (PostgreSQL 16 & Drizzle ORM)

The database schema is defined using Drizzle ORM in [`apps/backend/src/db/schema/faculty.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/db/schema/faculty.ts) and sub-modules decomposed to comply with the 300-line limit.

### 3.1 Relational Tables & Field Schemas

#### 1. Core Profile: `faculty`
Defines the institutional profile for an employed instructor or administrator.
- **Primary Key:** Composite `(workspace_subdomain, id)`.
- **Foreign Keys:**
  - `(workspace_subdomain, contact_id)` references `contacts(workspace_subdomain, id)` `ON DELETE RESTRICT` (Contacts SSOT).
  - `(workspace_subdomain, user_id)` references `tenant_users(workspace_subdomain, id)` `ON DELETE SET NULL`.
  - `(workspace_subdomain, reporting_faculty_id)` self-references `faculty(workspace_subdomain, id)` `ON DELETE SET NULL`.
- **Key Columns:**
  - `employee_id`: Unique within tenant among active records (`faculty_workspace_employee_id_active_uidx`).
  - `status`: String state (`active`, `on_leave`, `suspended`, `probation`, `resigned`, `retired`, `terminated`).
  - `hierarchy_rank`: Integer (1 = highest institutional authority, e.g. Principal/Rector; higher numbers = junior).
  - `specialization`, `department`, `designation`, `qualification`, `join_date`, `notes`, `custom_data` (JSONB).
  - Soft-delete columns: `deleted_at`, `deleted_by`, `deletion_reason`.
- **Database Constraints:**
  - `faculty_no_self_reporting_check`: `reporting_faculty_id IS NULL OR reporting_faculty_id <> id`.
  - `faculty_hierarchy_rank_positive_check`: `hierarchy_rank > 0`.

#### 2. Department Catalog: `faculty_departments`
Normalized hierarchical department/faculty tree ([`facultyDepartmentTables.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/db/schema/facultyDepartmentTables.ts)).
- **Primary Key:** `(workspace_subdomain, id)`.
- **Self-Reference:** `parent_id` references `faculty_departments(id)` `ON DELETE RESTRICT`. Unbounded nesting (Faculty → School → Department → Program).
- **Active Code Uniqueness:** Partial unique index `WHERE deleted_at IS NULL` on `(workspace_subdomain, code)`.
- **Constraint:** `CHECK (parent_id IS NULL OR parent_id <> id)`.

#### 3. Designation & Roles Catalog: `faculty_designations`
Normalized academic titles and permissions ([`facultyDesignationTables.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/db/schema/facultyDesignationTables.ts)).
- **Primary Key:** `(workspace_subdomain, id)`.
- **Fields:** `code` (unique among active), `name`, `hierarchy_rank` (> 0), `is_active`, soft-delete fields.
- **Linked Roles (`faculty_designation_roles`):** Maps a designation to workspace security roles (`role_key`) granted when holding the designation.
- **Designation history:** Projected from `faculty_assignments` (FA SSOT). Legacy `faculty_designation_assignments` is retired.

#### 4. Multi-Role Temporal Appointments: `faculty_assignments`
Models multi-role holding, joint appointments, and designation history ([`facultyAssignmentTables.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/db/schema/facultyAssignmentTables.ts)).
- **Primary Key:** `(workspace_subdomain, id)`.
- **Foreign Keys:**
  - `faculty_id` → `faculty.id` `ON DELETE CASCADE`.
  - `department_id` → `faculty_departments.id` `ON DELETE RESTRICT`.
  - `designation_id` → `faculty_designations.id` `ON DELETE RESTRICT`.
- **Attributes:** `is_primary` (boolean), `status`, `start_date` (ISO date), `end_date` (ISO date, nullable), `notes`.
- **Integrity Checks:**
  - `CHECK (end_date IS NULL OR end_date >= start_date)`.
  - `CHECK (status IN ('active', 'inactive'))`.

#### 5. Dynamic Sequence State: `faculty_setup_config`
Maintains atomic sequence generation state per tenant.
- **Primary Key:** `workspace_subdomain`.
- **Fields:** `prefix` (e.g. `FAC`), `year_format` (`YYYY`, `YY`, `NONE`), `sequence_digits` (default 4), `delimiter` (e.g. `-`), `current_sequence` (integer), `last_year` (annual rollover check).

---

### 3.2 Indexing & Performance Engineering

The module implements the **Category B Partial Indexing Strategy** mandated across MMS:

```sql
-- 1. Active entity hot-path index (excludes soft-deleted rows)
CREATE INDEX faculty_workspace_active_idx 
ON faculty (workspace_subdomain) 
WHERE deleted_at IS NULL;

-- 2. Active ID lookup & sorting indexes
CREATE INDEX faculty_workspace_status_updated_at_active_idx 
ON faculty (workspace_subdomain, status, updated_at) 
WHERE deleted_at IS NULL;

-- 3. Expression-based index for case-insensitive and trimmed status filters
CREATE INDEX faculty_workspace_status_expr_id_active_idx 
ON faculty (workspace_subdomain, (lower(btrim(COALESCE(status, 'active')))), id) 
WHERE deleted_at IS NULL;

-- 4. Active uniqueness constraints
CREATE UNIQUE INDEX faculty_workspace_employee_id_active_uidx 
ON faculty (workspace_subdomain, employee_id) 
WHERE deleted_at IS NULL AND employee_id IS NOT NULL;

CREATE UNIQUE INDEX faculty_workspace_contact_active_uidx 
ON faculty (workspace_subdomain, contact_id) 
WHERE deleted_at IS NULL;

-- 5. Soft-deleted trash drawer index
CREATE INDEX faculty_workspace_deleted_records_idx 
ON faculty (workspace_subdomain, deleted_at) 
WHERE deleted_at IS NOT NULL;
```

---

### 3.3 PostgreSQL 16 Recursive CTEs with Cycle Detection

Org-chart supervisor and subordinate traversals are executed in [`apps/backend/src/db/repositories/facultyHierarchySql.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/db/repositories/facultyHierarchySql.ts) using parameterized SQL queries with safety barriers:

```sql
WITH RECURSIVE eligible AS NOT MATERIALIZED (
  SELECT a.id, a.faculty_id, a.department_id, a.designation_id,
         a.reports_to_assignment_id, a.is_primary, a.start_date, a.end_date
  FROM faculty_assignments a
  JOIN faculty f ON f.workspace_subdomain = a.workspace_subdomain AND f.id = a.faculty_id
  JOIN faculty_departments d ON d.workspace_subdomain = a.workspace_subdomain AND d.id = a.department_id
  JOIN faculty_designations g ON g.workspace_subdomain = a.workspace_subdomain AND g.id = a.designation_id
  WHERE a.workspace_subdomain = $1 
    AND a.deleted_at IS NULL
    AND f.deleted_at IS NULL 
    AND d.deleted_at IS NULL 
    AND g.deleted_at IS NULL
    AND a.start_date <= $onDate::date 
    AND (a.end_date IS NULL OR a.end_date >= $onDate::date)
), 
tree AS (
  -- Anchor Member
  SELECT a.id, a.faculty_id, a.department_id, a.designation_id,
         a.reports_to_assignment_id, a.is_primary, a.start_date, a.end_date,
         0 AS depth, 
         ARRAY[a.id] AS path, 
         ARRAY[a.faculty_id] AS faculty_path, 
         FALSE AS is_cycle
  FROM eligible a WHERE a.id = $rootAssignmentId
  
  UNION ALL
  
  -- Recursive Step (Downwards or Upwards based on edge parameter)
  SELECT n.id, n.faculty_id, n.department_id, n.designation_id,
         n.reports_to_assignment_id, n.is_primary, n.start_date, n.end_date,
         tree.depth + 1, 
         array_append(tree.path, n.id), 
         array_append(tree.faculty_path, n.faculty_id),
         -- Detects both assignment cycles AND person cycles across roles!
         (n.id = ANY(tree.path) OR n.faculty_id = ANY(tree.faculty_path))
  FROM eligible n 
  JOIN tree ON n.reports_to_assignment_id = tree.id
  WHERE NOT tree.is_cycle AND tree.depth < $maxDepth
)
SELECT id, faculty_id AS "facultyId", department_id AS "departmentId",
       designation_id AS "designationId", reports_to_assignment_id AS "reportsToAssignmentId",
       is_primary AS "isPrimary", start_date::text AS "startDate", end_date::text AS "endDate",
       depth, path, is_cycle AS "isCycle"
FROM tree 
WHERE depth > 0 
ORDER BY depth, path;
```

**Key Safety Features:**
1. **Double Cycle Tracking:** Tracks `ARRAY[a.id]` (assignment identity) and `ARRAY[a.faculty_id]` (person identity). This prevents cycles where the same person loops through different appointment IDs.
2. **Cycle Row Emission:** Emits the cycle-terminating row with `is_cycle = true` and halts recursion via `WHERE NOT tree.is_cycle`.
3. **Hard Depth Guard:** Enforces `maxDepth` between 1 and 20 (`validateHierarchyDepth`), preventing infinite recursion or denial-of-service stack overflows.

---

### 3.4 Concurrency, Advisory Locks & Atomic ID Generation

1. **Hierarchy Mutation Advisory Lock:**
   Mutations to assignments, departments, and reporting relationships acquire a PostgreSQL tenant-scoped advisory lock ([`lockFacultyHierarchy`](file:///Users/syedaalin/Documents/mms/apps/backend/src/db/repositories/facultyAssignmentValidation.ts)):
   ```ts
   await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${subdomain || 'tenant'} || ':faculty_hierarchy'))`);
   ```
   This prevents concurrent requests from slipping past cycle validations or creating overlapping active primary assignments.

2. **Atomic Employee ID Generator:**
   Implemented in [`facultyEmployeeIdGenerator.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/faculty/use-cases/facultyEmployeeIdGenerator.ts):
   - Acquires a row lock using `SELECT ... FROM faculty_setup_config WHERE workspace_subdomain = $1 FOR UPDATE`.
   - Checks `lastYear === currentYear`. If the calendar year has rolled over, resets `currentSequence` to 1.
   - Atomically updates `currentSequence = currentSequence + 1` and returns the formatted identifier (e.g., `FAC-2026-0042`).

---

## 4. Backend Architecture (Fastify 5 & Clean Architecture)

### 4.1 Route Modularization & Contract Routing

The backend exposes canonical endpoints under `/api/faculty`, `/api/tenant/faculty`, and `/api/v1/tenant/faculty`. Routing utilizes `@ts-rest/fastify` implementing the typed contracts from `@mms/shared`:

| Sub-Route Plugin | Responsibility | File Path |
|---|---|---|
| [`facultyCrudRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyCrudRoutes.ts) | Main CRUD, single item fetch, list pagination, duplicate check | [`facultyCrudRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyCrudRoutes.ts) |
| [`facultyMutationRouteHandlers.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyMutationRouteHandlers.ts) | Create, Update, Soft-delete, Bulk Status, Bulk Specialization | [`facultyMutationRouteHandlers.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyMutationRouteHandlers.ts) |
| [`facultyAssignmentRouteHandlers.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyAssignmentRouteHandlers.ts) | Temporal appointments, close assignment, manager/subordinate trees | [`facultyAssignmentRouteHandlers.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyAssignmentRouteHandlers.ts) |
| [`facultyDepartmentRouteHandlers.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyDepartmentRouteHandlers.ts) | Department catalog list, save, delete (guarded against active assignments) | [`facultyDepartmentRouteHandlers.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyDepartmentRouteHandlers.ts) |
| [`facultyDesignationRouteHandlers.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyDesignationRouteHandlers.ts) | Designation catalog list, save, delete, assignment history | [`facultyDesignationRouteHandlers.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyDesignationRouteHandlers.ts) |
| [`facultyAggregateRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyAggregateRoutes.ts) | Widget aggregates, command metrics | [`facultyAggregateRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyAggregateRoutes.ts) |
| [`facultySetupConfigRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultySetupConfigRoutes.ts) | Preferences, field configurations, auto-ID sequence config | [`facultySetupConfigRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultySetupConfigRoutes.ts) |
| [`facultySoftDeleteRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultySoftDeleteRoutes.ts) | Restore single, bulk restore, bulk soft-delete | [`facultySoftDeleteRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultySoftDeleteRoutes.ts) |
| [`facultyExportRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyExportRoutes.ts) | Server-side streamed CSV export, export audit logging | [`facultyExportRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyExportRoutes.ts) |
| [`facultyLookupRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyLookupRoutes.ts) | Option lookups (specializations, titles, statuses) | [`facultyLookupRoutes.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/routes/tenant/faculty/facultyLookupRoutes.ts) |

### 4.2 Clean Architecture Use-Cases & Repository Pattern

Business logic is completely isolated from HTTP concerns in [`apps/backend/src/faculty/use-cases/`](file:///Users/syedaalin/Documents/mms/apps/backend/src/faculty/use-cases/):
- **Composition Root ([`facultyUseCases.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/faculty/use-cases/facultyUseCases.ts)):** Injects `FacultyRepository` into use-cases, allowing unit tests to run fakes in memory without spinning up database transactions.
- **Write Use-Cases ([`facultyWriteUseCases.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/faculty/use-cases/facultyWriteUseCases.ts)):**
  1. Enforces tenant RLS via `withTenant(subdomain, ...)`.
  2. Strips contact personal data (`stripFacultyWriteNoise`) to enforce Contacts SSOT.
  3. Validates supervisory seniority: verifies supervisor rank < subordinate rank (lower number = higher authority).
  4. Validates hierarchy cycle safety via recursive ancestor walk.
  5. Atomically generates an `employeeId` if auto-generation is enabled and none is provided.
  6. Writes modern audit log (`recordModernAuditEvent`) using RFC 8785 canonical JSON formatting.

---

## 5. Shared Contracts & DTOs (`@mms/shared`)

The shared package maintains single sources of truth for both frontend and backend:

### 5.1 Type-Safe DTO Schemas
- **[`facultyCoreSchema`](file:///Users/syedaalin/Documents/mms/packages/shared/src/facultyModuleManifest.ts):** Core Zod schema defining valid faculty fields.
- **[`buildDynamicFacultySchema`](file:///Users/syedaalin/Documents/mms/packages/shared/src/schemas/faculty.dto.ts):** Dynamic compiler that inspects tenant setup preferences, enabled tabs, and custom fields to assemble a `.strict()` schema that rejects unexpected or dangerous payload properties.
- **[`facultyDepartmentSchema`](file:///Users/syedaalin/Documents/mms/packages/shared/src/facultyDepartmentTypes.ts):** Read/write schemas for departments, including hierarchy depth and child count projections.
- **[`facultyAssignmentSchema`](file:///Users/syedaalin/Documents/mms/packages/shared/src/facultyDepartmentTypes.ts):** Enforces ISO 8601 calendar date formats (`z.iso.date()`) and validates that `endDate >= startDate`.

### 5.2 Pure Utilities & Helpers
- **[`formatDeterministicEmployeeId`](file:///Users/syedaalin/Documents/mms/packages/shared/src/facultyUtils.ts):** Formats sequences with zero-padding and configurable date formats (`YYYY`, `YY`, `NONE`).
- **[`stripFacultyWriteNoise`](file:///Users/syedaalin/Documents/mms/packages/shared/src/facultyUtils.ts):** Strips personal contact fields (`firstName`, `lastName`, `phone`, `email`, `nationalId`, `avatarUrl`) from writes before they hit the faculty table.
- **[`resolveFacultyDisplayName`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/facultyFieldDisplay.ts):** Gracefully resolves a display name across linked Contact models, legacy profile names, or localized placeholder fallbacks.

### 5.3 Standardized Data Transfer & Symmetrical CSV Schemas (`@mms/shared`)
Faculty data transfer implements the monorepo's DRY, symmetric SSOT transfer architecture:
- **[`facultyTransferSchema`](file:///Users/syedaalin/Documents/mms/packages/shared/src/dataTransfer/schemas/facultyTransferSchema.ts):** Unified schema for Faculty Member CSV export and import. Enforces strict Field Whitelist by stripping internal metadata (`id`, `tenantId`, `createdAt`, `updatedAt`, `deletedAt`). Guaranteed 1:1 header symmetry between exported columns and import mappings.
- **[`facultyDesignationTransferSchema`](file:///Users/syedaalin/Documents/mms/packages/shared/src/dataTransfer/schemas/facultyDesignationTransferSchema.ts):** Unified SSOT schema for Faculty Designation CSV export, import mappings, and template generation.
- **Frontend Dialog Integration ([`FacultyCsvImportDialog.tsx`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/FacultyCsvImportDialog.tsx)):** Employs the generic [`ModuleImportDialog`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/components/ui/ModuleImportDialog.tsx) driven by `useModuleCsvImportActions`, consuming schemas without ad-hoc mapping duplication.

---

## 6. Frontend Architecture (React 19 & TanStack Query v5)

### 6.1 Three-Tier Presentation Architecture

The user interface follows the **Three-Tier Command Centre** model:

```
+---------------------------------------------------------------------------------------+
|  [School Icon]  Faculty Directory                                [Export]  [+ Add]    |
|  Manage instructional staff, appointments, and departments                            |
|  Total: 48   Active: 42   On Leave: 4   Suspended: 2                                  |
+---------------------------------------------------------------------------------------+
|  [ Work (Active) ]  |  [ Reports ]  |  [ Setup ]                                      |
+---------------------------------------------------------------------------------------+
|  [Search...]  [Status: All]  [Department: All]  [Columns]  [Grid/Table]  [Trash (2)]  |
|  -----------------------------------------------------------------------------------  |
|  [x] Name / ID          Department        Designation       Contact     Status        |
|  [ ] Dr. Ahmad (FAC01)  Islamic Studies   Dept Head (R:1)   +966...     [Active]      |
|  [ ] Ustadh Bilal       Quran Recitation  Instructor (R:5)  +966...     [Active]      |
+---------------------------------------------------------------------------------------+
```

#### Tier 1: Work Tier ([`FacultyWorkTier.tsx`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/FacultyWorkTier.tsx))
- **Dual Presentation Views:** High-density desktop table (`FacultyListTable`) and mobile-optimized responsive card grid (`FacultyCardItem`).
- **Filter Engine:** Debounced search, status pill toggles, specialization filters, gender filters, active filter chips (`FilterChips`), and clear-all actions.
- **Bulk Operations:** Multi-row checkbox selection triggering [`FacultyBulkActionBar.tsx`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/FacultyBulkActionBar.tsx) for batch status updates, specialization updates, batch soft-deleting, or batch printing ID cards.
- **Detail Drawer ([`FacultyDetail.tsx`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/FacultyDetail.tsx)):** Non-disruptive slide-over sheet containing identity hero cards, quick communication actions (SMS/WhatsApp via centralized `openComposer`), academic details, session class assignments, designation timeline, and audit stamps.
- **Laminated ID Card Generator ([`FacultyIdCardModal.tsx`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/FacultyIdCardModal.tsx)):** Single or batch printable ID cards styled with Tailwind CSS, high-contrast typography, user avatars, barcode/ID placeholders, and `@media print` CSS rules for direct physical printing.

#### Tier 2: Reports Tier ([`FacultyReportsTier.tsx`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/FacultyReportsTier.tsx))
- Code-split via `React.lazy` and `Suspense`.
- Integrates `KPISummary` and `ModuleReports` widgets showing staffing distribution, teacher-student ratios, qualification percentages, and scheduled classes.

#### Tier 3: Setup Tier ([`FacultySetupTier.tsx`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/FacultySetupTier.tsx))
- Code-split with read-only permission enforcement (`canEditSetup`).
- **Institutional Preferences:** Configures employee ID generation rules (prefix, delimiter, year format, sequence padding) with live interactive preview.
- **Department Catalog Manager:** In-place creation, editing, and soft-deletion of departments with parent hierarchy selectors and department head assignments.
- **Designation Catalog Manager:** Seniority rank assignment (1–99), title definitions, and mapped permission roles.

---

### 6.2 Static Form Modal Architecture ([`FacultyForm.tsx`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/FacultyForm.tsx))

The modal adheres to the MMS Form Modal specification:
- **5 Structured Tabs:**
  1. **Contact:** Searchable contact picker linking to Contacts SSOT or creating a new contact on the fly; specialization and qualification fields.
  2. **Employment:** Auto-generated employee ID with live preview, regenerate action, status selector, and join date.
  3. **Designation & Hierarchy:** Department selector, designation selector, supervisor/manager picker, and authority rank presets.
  4. **User Account:** Optional inline provisioning of system login accounts (`tenantUsers`) with role assignment and credentials.
  5. **Notes & Custom Fields:** Unstructured observations and tenant-configured custom fields.
- **Validation Scroll & Tab Switching:** If submission fails validation, [`useFacultyFormTabs`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/facultyFormTabs.ts) detects which tab owns the invalid field, switches to it automatically, and focuses the offending input element.
- **Duplicate Prevention:** Invokes `/api/faculty/duplicate-check` to identify if a contact or employee ID is already assigned, displaying a `ConfirmAlertDialog` if ambiguous.

---

### 6.3 TanStack Query v5 & Facade Architecture

Data fetching hooks are consolidated in [`@/tenant/hooks/collections/faculty.ts`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/hooks/collections/faculty.ts) as a stable facade:
- **Deterministic Query Keys:** Standardized tuple hierarchy `['tenant', 'faculty', subkey, ...]`.
- **Cache Invalidation:** Calling [`invalidateFacultyQueries(queryClient)`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/hooks/invalidateFacultyQueries.ts) synchronizes work lists, metric counters, widget aggregates, and lookup caches.
- **Background Paging for Export:** `fetchAllFacultyForQuery` pages sequentially up to 100,000 records with progress callbacks, preventing browser OOM crashes.

---

## 7. Internationalization (i18n), BiDi & Accessibility (a11y)

### 7.1 Translation Key Parity
All UI labels, validation messages, and aria-attributes are localized across English (`en`), Arabic (`ar`), Urdu (`ur`), and Persian (`fa`). Keys are registered in [`packages/shared/src/appTranslationsEn.ts`](file:///Users/syedaalin/Documents/mms/packages/shared/src/appTranslationsEn.ts) and verified via automated test suites.

### 7.2 BiDi / RTL Layout Compliance
The frontend avoids hardcoded directional CSS (`left`, `right`, `ml-`, `mr-`, `pl-`, `pr-`), strictly employing Tailwind CSS logical utilities:
- Margins: `ms-` (margin-start), `me-` (margin-end).
- Padding: `ps-` (padding-start), `pe-` (padding-end).
- Text alignment: `text-start`, `text-end`.
- Border placement: `border-s`, `border-e`.
- Phone numbers and employee IDs enforce explicit LTR layout: `<span dir="ltr">{employeeId}</span>`.

### 7.3 Accessibility (WCAG 2.1 AA)
- **Touch Targets:** Minimum 44×44px interactive tap area (`min-h-11`, `min-w-11`) across all buttons, dropdown items, and table action icons.
- **Keyboard Navigation:** Full tab trapping in `FormModal` and `Modal`, escape key dismissals, and shortcut bindings via [`useFacultyKeyboardShortcuts`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/hooks/useFacultyKeyboardShortcuts.ts) (`Cmd+K`/`Ctrl+K` search, `C` create, `X` clear selection).
- **Screen Reader Support:** Semantic tables, `aria-expanded`, `aria-busy` indicators during background server fetching, and accessible labels on all icon-only buttons.

---

## 8. Verification & Test Coverage Matrix

The Faculty module is covered by automated unit, integration, and database tests across all packages:

| Test Scope | Runner & Config | File Count | Test Count | Status |
|---|---|---|---|---|
| `@mms/shared` | Vitest (`vitest.config.ts`) | 183 test files | 1,331 tests | **100% Passed** |
| `mms-backend` | Vitest (`vitest.config.ts`) | 224 test files | 1,754 tests | **100% Passed** |
| `mms-frontend` | Vitest (`vitest.config.ts`) | 841 test files | 2,974 tests | **100% Passed** |
| Database Integration | Vitest (`vitest.db.config.ts`) | 17 test files | 88 tests | **Passed (PostgreSQL 16)** |
| Static Types | TypeScript (`pnpm typecheck`) | 4 workspaces | Zero errors | **Clean Pass** |

### Key Regression Suites
1. **Hierarchy Cycle Tests ([`facultyAssignmentsHierarchy.integration.test.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/__tests__/facultyAssignmentsHierarchy.integration.test.ts)):** Verifies multi-node cycle detection (A → B → C → A), depth limits, and self-reporting rejection.
2. **Contact SSOT Integration ([`facultyContactSqlSsot.test.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/__tests__/facultyContactSqlSsot.test.ts)):** Verifies that personal data updates in `contacts` reflect immediately in faculty queries without dual-writing.
3. **Soft-Delete Lifecycle ([`facultySoftDelete.integration.test.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/__tests__/facultySoftDelete.integration.test.ts)):** Verifies trash indexing, cascade soft-delete of active assignments, outbox event generation, and single/bulk restoration.
4. **Form Validation & Tab Switching ([`FacultyFormValidationScroll.test.tsx`](file:///Users/syedaalin/Documents/mms/apps/frontend/src/tenant/features/faculty/components/FacultyFormValidationScroll.test.tsx)):** Verifies that client errors focus the exact tab and field.

---

## 9. Architectural Findings & Roadmap

### 9.1 Exemplary Engineering Patterns (Adopt Across Other Modules)
1. **Double Cycle Tracking in Recursive CTEs:** Combining assignment and faculty arrays in PostgreSQL CTE recursion provides air-tight protection against complex multi-role circular reporting.
2. **Advisory Lock on Hierarchy Mutations:** Serializing structural tree edits at the tenant level eliminates race conditions without causing table-level lock escalation.
3. **Contacts SSOT with Write-Noise Stripping:** Stripping personal fields before database writes guarantees clean layer boundaries and prevents stale profile data.

### 9.2 Technical Debt & Future Optimization Notes
1. **Legacy Backup Hydrator Check Warning:**
   - Running `node scripts/check-faculty-domain.mjs` identifies legacy string mentions of `hydrateFacultySetupFromLegacyBackup` in historical migration files ([`005_normalize_teacher_contacts.ts`](file:///Users/syedaalin/Documents/mms/apps/backend/src/db/migrations/005_normalize_teacher_contacts.ts) etc.).
   - *Recommendation:* Keep these legacy references in historical migrations as immutable audit records; update the checker script if historical migrations should be exempt.
2. **UUID Identifier Migration:**
   - Currently, `workspaces.id` and `contacts.id` use text/nanoid strings. An enterprise roadmap milestone is planned to transition tenant primary keys to sequential UUIDv7. The Faculty schema is prepared with isolated column mapping definitions.

---

*Document compiled and verified against the live codebase on October 2, 2026.*
