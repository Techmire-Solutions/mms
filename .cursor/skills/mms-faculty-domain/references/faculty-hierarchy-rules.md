# Faculty Hierarchy & Temporal Assignment Rules

Governs staff seniority, reporting lines, and temporal appointment constraints in the MMS Faculty domain.

## 1. Hierarchy Ranking & Seniority Rules

Reporting hierarchy is **derived**, not written: a faculty member's supervisor is
inferred from the designation tree (`parent_designation_id`), and `reportingFacultyId`
is a read-only projection (soft-stopped on write). Rank and cycle prevention are
enforced in `apps/api/src/db/repositories/facultyDesignationValidation.ts`:
- **Seniority Rank Direction:** Lower rank numbers indicate higher seniority (e.g., Rank 1 = Principal, Rank 5 = Head of Department, Rank 10 = Lecturer). `hierarchy_rank` is derived from the parent-chain depth.
- **Circular Hierarchy Prohibition:** a designation can never be its own ancestor — checked via a recursive CTE (`WITH RECURSIVE`) in `validateFacultyDesignationLink()`.

## 2. Temporal Appointment Constraints

`faculty_assignments` is the appointment SSOT. The legacy
`faculty_designation_assignments` table — and the PostgreSQL exclusion
constraint `faculty_designation_assignments_no_overlap_excl` created with
migration `0123_faculty_temporal_designations.sql` for it — was retired by
`0143_drop_faculty_designation_assignments.sql`. Do not reintroduce or cite it.

Non-overlap is enforced in `apps/api/src/db/repositories/facultyAssignmentValidation.ts`:
- **Workspace lock:** `lockFacultyHierarchy()` takes `pg_advisory_xact_lock` per workspace, so concurrent appointment writes serialize.
- **Single primary:** a faculty member cannot hold a second `is_primary` appointment whose `start_date`–`end_date` range overlaps an existing primary one (open ends compare as infinity).
- **Link checks:** the faculty member, department, and designation must be active (not soft-deleted) in the same workspace.
- **Bounds:** `end_date` must not precede `start_date`; date-only boundaries use the workspace-local day.
- **Typed failures:** validation throws `ValidationError` (HTTP 400) or `ConflictError` (HTTP 409) so route handlers never map infrastructure errors to client validation codes.
- **Continuous bounds:** when changing a designation, close the prior appointment by setting its `end_date` rather than deleting historical rows.

## 3. Legacy Terminology Bans

`scripts/check-faculty-domain.mjs` prevents regressions of retired symbols:
- Never use `/api/teachers` (use `/api/faculty`).
- Never reference `facultyDesignationAssignments` or FDA (use `facultyAssignments`).
- Never create views named `teachers`.
