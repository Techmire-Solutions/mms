---
name: mms-faculty-domain
description: Governs the Faculty and Academic Staff domain — faculty records, designation assignments, temporal appointments, departments, and workload. Use when modifying faculty tables, appointments, or staff directory/drawers. Do NOT use for student admissions/enrollments (use mms-student-lifecycle), generic form layouts (use mms-form-architecture), or retired legacy surfaces like /api/teachers or FDA (enforced by check:faculty-domain).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-11-04
---

# MMS Faculty & Academic Staff Domain

**Rules (norms SSOT):** `mms-data-layer.mdc` §1 (schema & temporal constraints) · `mms-structure-naming.mdc` (no legacy names) · `.cursor/rules/README.md` (Enforcement Registry: `check:faculty-domain`).

## When to use

- Adding or modifying faculty records, appointments, departments, or designations
- Writing backend use-cases for faculty hierarchy, workloads, or employee ID generation
- Building or modifying frontend faculty directory, drawers, or Setup tabs (`FacultyPage.tsx`)
- Diagnosing or resolving `pnpm run check:faculty-domain` CI ratchet failures

## 1. Domain Terminology & Legacy Bans

The term "Teacher" and the acronym "FDA" (`facultyDesignationAssignments`) are retired and banned:
- **Forbidden**: `/api/teachers`, `CREATE VIEW teachers`, `facultyDesignationAssignments`, `hydrateTeachersSetupFromLegacyObjects`.
- **Enforced Schema Tables**:
  - `faculty`: Core staff record, employment metadata, employee ID, contact link.
  - `facultyDesignations`: Academic titles (e.g. Mudarris, Muhaffiz, HOD).
  - `facultyDesignationRoles`: RBAC role bindings for designations.
  - `facultyAssignments`: Temporal staff appointments (`start_date`/`end_date`), app-enforced single-primary non-overlap (§2).
  - `facultyDepartments`: Academic faculties/departments.
- **Ratchet**: Enforced by `pnpm run check:faculty-domain`.

## 2. Temporal Appointments & Non-Overlap

There is **no database exclusion constraint** on appointments. The retired
`faculty_designation_assignments` table (and its
`faculty_designation_assignments_no_overlap_excl` constraint from migration
`0123`) was dropped by `0143_drop_faculty_designation_assignments.sql`;
`faculty_assignments` is the appointment SSOT.

Non-overlap is enforced in the application, not by DDL:
- `apps/backend/src/db/repositories/facultyAssignmentValidation.ts` —
  `lockFacultyHierarchy()` takes `pg_advisory_xact_lock` on the workspace key,
  then `validateFacultyAssignment()` rejects a second overlapping `is_primary`
  row for the same faculty (`start_date`–`end_date`, open ends = infinity),
  missing/inactive faculty-department-designation links, and `endDate < startDate`.
- Domain failures throw typed `ValidationError` (400) / `ConflictError` (409) so
  route handlers never report infrastructure failures as client input.
- All appointment reads evaluate temporal bounds (`start_date` to `end_date`);
  date-only ends are written with the **workspace-local day**, not UTC.
- Reporting-hierarchy ranking and cycle prevention live in
  `apps/backend/src/faculty/use-cases/facultyHierarchyValidator.ts`.

For seniority ranking rules, cycle prevention, and temporal constraint details, see [references/faculty-hierarchy-rules.md](references/faculty-hierarchy-rules.md).

## 3. Implementation Map

| Concern | Path / Symbol |
|---|---|
| Drizzle Schema | `apps/backend/src/db/schema/faculty.ts`, `facultyDesignationTables.ts`, `facultyAssignmentTables.ts`, `facultyDepartmentTables.ts` |
| Backend Use-Cases | `apps/backend/src/faculty/use-cases/facultyWriteUseCases.ts`, `facultyHierarchyValidator.ts` |
| Appointment Overlap Guard | `apps/backend/src/db/repositories/facultyAssignmentValidation.ts` |
| Employee ID Generator | `apps/backend/src/faculty/use-cases/facultyEmployeeIdGenerator.ts` |
| Frontend Page Shell | `apps/frontend/src/tenant/features/faculty/FacultyPage.tsx` |
| Frontend Work Sub-tabs | `apps/frontend/src/tenant/features/faculty/facultyPageWorkSubTabs.ts` |
| Legacy Surface Ratchet | `scripts/check-faculty-domain.mjs` |
| Contact role tags | `apps/backend/src/contacts/systemTags/contactSystemTagFacultyCompute.ts`, `contactSystemTagReconcile.ts` |

## 4. Role-Derived Contact Tags

- Every contact linked to active faculty receives `faculty-<Designation>` tags from **both** HR tenure (`faculty_employ_designations`) and multi-role assignments (`faculty_assignments`).
- Active means: employment `active`/`on_leave` and inside its start/end window; designation active/not deleted; the tenure/assignment row active and inside its own window. Use the workspace-local day, not UTC.
- Designation rename/status/delete, assignment save/close/delete, faculty create/update/soft-delete/restore, and imports must reconcile the affected contacts. Archive ended roles as `Former faculty-…`; never delete the row.
- Two same-name designations collapse to one visible tag deterministically. Reconcile is idempotent, advisory-locked per contact, and runs once after a batch.
- Date-only ends are repaired by the leader-locked hourly sweep; see `mms-data-layer.mdc` §9.

## 5. Verification

```bash
# Check legacy surface compliance
pnpm run check:faculty-domain

# Run faculty domain tests
pnpm --filter mms-backend test faculty
pnpm --filter mms-frontend test apps/frontend/src/tenant/features/faculty
pnpm --filter mms-backend test:db contactsSystemTagsDb
```

## Related skills

`mms-module-page`, `mms-module-work`, `mms-schema-migrate`, `mms-student-lifecycle`.
