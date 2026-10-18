---
name: mms-faculty-domain
description: Governs the Faculty and Academic Staff domain — faculty records, designation assignments, temporal appointments, departments, and workload. Use when modifying faculty tables, appointments, or staff directory/drawers. Do NOT use for student admissions/enrollments (use mms-student-lifecycle), generic form layouts (use mms-form-architecture), or retired legacy surfaces like /api/teachers or FDA (enforced by check:faculty-domain).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Faculty & Academic Staff Domain

**Rules (norms SSOT):** `mms-data-layer.md` §1 (schema & temporal constraints) · `mms-structure-naming.md` (no legacy names) · `.cursor/rules/README.md` (Enforcement Registry: `check:faculty-domain`).

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
  - `facultyAssignments`: Temporal staff assignments with non-overlapping period constraints.
  - `facultyDepartments`: Academic faculties/departments.
- **Ratchet**: Enforced by `pnpm run check:faculty-domain`.

## 2. Temporal Appointments & Non-Overlapping Exclusion

Migration `0123_faculty_temporal_designations.sql` introduced PostgreSQL exclusion constraints (`faculty_designation_assignments_no_overlap_excl`):
- A faculty member cannot hold overlapping active assignments in conflicting designations within the same time boundary.
- All appointment queries must evaluate temporal bounds (`effective_from` to `effective_to`).
- Always validate assignment changes through `facultyHierarchyValidator.ts`.

For seniority ranking rules, cycle prevention, and temporal constraint details, see [references/faculty-hierarchy-rules.md](references/faculty-hierarchy-rules.md).

## 3. Implementation Map

| Concern | Path / Symbol |
|---|---|
| Drizzle Schema | `apps/backend/src/db/schema/faculty.ts`, `facultyDesignationTables.ts`, `facultyAssignmentTables.ts`, `facultyDepartmentTables.ts` |
| Backend Use-Cases | `apps/backend/src/faculty/use-cases/facultyWriteUseCases.ts`, `facultyHierarchyValidator.ts` |
| Employee ID Generator | `apps/backend/src/faculty/use-cases/facultyEmployeeIdGenerator.ts` |
| Frontend Page Shell | `apps/frontend/src/tenant/features/faculty/FacultyPage.tsx` |
| Frontend Work Sub-tabs | `apps/frontend/src/tenant/features/faculty/facultyPageWorkSubTabs.ts` |
| Legacy Surface Ratchet | `scripts/check-faculty-domain.mjs` |

## 4. Verification

```bash
# Check legacy surface compliance
pnpm run check:faculty-domain

# Run faculty domain tests
pnpm --filter mms-backend test faculty
pnpm --filter mms-frontend test apps/frontend/src/tenant/features/faculty
```

## Related skills

`mms-module-page`, `mms-module-work`, `mms-schema-migrate`, `mms-student-lifecycle`.
