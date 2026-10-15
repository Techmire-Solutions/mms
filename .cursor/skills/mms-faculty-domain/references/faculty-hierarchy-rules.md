# Faculty Hierarchy & Temporal Assignment Rules

Governs staff seniority, reporting lines, and temporal designation constraints in the MMS Faculty domain.

## 1. Hierarchy Ranking & Seniority Rules

Enforced by `apps/backend/src/faculty/use-cases/facultyHierarchyValidator.ts`:
- **Seniority Rank Direction:** Lower rank numbers indicate higher seniority (e.g., Rank 1 = Principal, Rank 5 = Head of Department, Rank 10 = Lecturer).
- **Supervisory Validation:** A faculty member's reporting supervisor (`reportingFacultyId`) must hold a strictly lower rank number (`supervisorRank < hierarchyRank`).
- **Circular Hierarchy Prohibition:** A faculty member can never report to themselves or to any direct or indirect subordinate in their reporting tree. Checked via recursive CTE in `repo.findAncestorChain()`.

## 2. Temporal Designation Constraints (0123)

Migration `0123_faculty_temporal_designations.sql` applies PostgreSQL exclusion constraints on `faculty_designation_assignments`:
- **Constraint:** `faculty_designation_assignments_no_overlap_excl`
- **Semantics:** A faculty member cannot have concurrent overlapping date intervals (`effective_from` through `effective_to`) for conflicting designations within the same tenant workspace.
- **Continuous Date Bounds:** When updating a designation appointment, close out the prior active period by setting `effective_to` rather than deleting historical rows.

## 3. Legacy Terminology Bans

`scripts/check-faculty-domain.mjs` prevents regressions of retired symbols:
- Never use `/api/teachers` (use `/api/faculty`).
- Never reference `facultyDesignationAssignments` or FDA (use `facultyAssignments`).
- Never create views named `teachers`.
