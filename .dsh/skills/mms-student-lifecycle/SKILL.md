---
name: mms-student-lifecycle
description: Academic student workflows (admissions, enrollments, attendance grids, exams, grading, hasanat). Use when student/enrollment/attendance/exam features. Do NOT use for faculty (use mms-faculty-domain), fees (use mms-finance-accounting), or SMS (use mms-messaging).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-11-02
---

# MMS Student Lifecycle & Academic Operations

**Rules (norms SSOT):** `mms-module-architecture.md` (Module tiers) · `mms-data-layer.md` §6 (soft-delete cascades) · `mms-form-architecture.md` (student forms) · `mms-core.md`.

## When to use

- Building or modifying student profiles, enrollment records, class assignments, or admissions
- Implementing attendance marking tables, bulk status recording, or session attendance logs
- Configuring examinations, grading schemes, GPA scales, question banks, or term report cards
- Term report-card **layout/print** changes: use `mms-document-templates`; this skill owns exam/result data and aggregation
- Managing student merit, demerit, or hasanat award records

## 1. Domain Invariants & Data Flow

- **Contact Linkage**: Student records link to a primary contact for person identity (`contactId`). Demographic, address, and phone data hydrate from `contacts` rather than duplicating onto `students` (see `packages/modules/contacts` and the `mms-contacts` skill).
- **Enrollment Cascades**: When an academic session is archived or restored, enrollment cascades must preserve `deleted_with_cascade` flags so standalone student un-enrollments are never erroneously restored.
- **Attendance Batching**: Daily attendance operates as workshop grid (`MarkAttendanceTableView.tsx`, `MarkAttendanceStudentCard.tsx`). Form submissions use bulk upsert contracts with transactional atomicity.
- **Grading & GPA Calculations**: Grade calculations (percentages, grade letters, GPA points) must be calculated on the backend or in pure `@mms/contracts` helpers; never rely on un-validated client math.
- **Guardian Triad & Derived Tags**: father/mother/guardian links live on the student primary contact's relationship graph; do not dual-write the `students.father_*` columns. The contact projection derives `Student`, `Parent`, and `Guardian` tags from those links and student status (`active`/`suspended`), archives them on status end/unlink/soft-delete, and reactivates on restore. Student create/update/delete/restore and bulk status paths must reconcile the student and related contacts. See `mms-data-layer.md` §9.

## 2. Implementation Map

| Operational Domain | Frontend Feature | Backend Routes & Services |
|---|---|---|
| Students & Admissions | `apps/tenant-web/src/tenant/features/students/StudentsPage.tsx` | `packages/modules/students/src/`, `packages/modules/contacts/src/backend/systemTags/` |
| Enrollments & Classes | `apps/tenant-web/src/tenant/features/enrollments/EnrollmentsPage.tsx` | `packages/modules/enrollments/src/backend/` |
| Attendance Tracking | `packages/modules/attendance/src/frontend/tenant/AttendancePage.tsx` | `packages/modules/attendance/src/backend/` |
| Examinations & Grades | `apps/tenant-web/src/tenant/features/examinations/ExaminationsPage.tsx` | `packages/modules/examinations/src/backend/` |
| Hasanat & Merits | `apps/tenant-web/src/tenant/features/hasanat/HasanatCardsPage.tsx` | `packages/modules/hasanat/src/backend/` |

## 3. Verification

```bash
pnpm --filter mms-api test attendance
pnpm --filter mms-api test enrollments
pnpm --filter mms-api test examinations
pnpm --filter mms-tenant-web test apps/tenant-web/src/tenant/features/students
pnpm --filter mms-tenant-web test apps/tenant-web/src/tenant/features/attendance
pnpm --filter mms-api test:db contactsSystemTagsDb
```

## References

- Student Lifecycle & Academic Workflows: `references/student-lifecycle-workflows.md`

## Related skills

`mms-module-page`, `mms-module-work`, `mms-faculty-domain`, `mms-finance-accounting`, `mms-messaging`.
