---
name: mms-student-lifecycle
description: Implements academic student lifecycle workflows — admissions, enrollments, attendance marking grids, examinations, grading formulas, and hasanat points. Use when modifying student, enrollment, attendance, examination, or hasanat features. Do NOT use for faculty staff appointments (use mms-faculty-domain), student fee invoicing (use mms-finance-accounting), or guardian SMS/WhatsApp broadcasts (use mms-messaging).
license: Proprietary
metadata:
  owner: mms-platform
  last-verified: 2026-10-16
---

# MMS Student Lifecycle & Academic Operations

**Rules (norms SSOT):** `mms-module-architecture.md` (Module tiers) · `mms-data-layer.md` §6 (soft-delete cascades) · `mms-form-architecture.md` (student forms) · `mms-core.md`.

## When to use

- Building or modifying student profiles, enrollment records, class assignments, or admissions
- Implementing attendance marking tables, bulk status recording, or session attendance logs
- Configuring examinations, grading schemes, GPA scales, question banks, or term report cards
- Managing student merit, demerit, or hasanat award records

## 1. Domain Invariants & Data Flow

- **Contact Linkage**: Student records link to a primary contact for person identity (`contactId`). Demographic, address, and phone data hydrate from `contacts` rather than duplicating onto `students` (`mms-migration-status.mdc` §2).
- **Enrollment Cascades**: When an academic session is archived or restored, enrollment cascades must preserve `deleted_with_cascade` flags so standalone student un-enrollments are never erroneously restored.
- **Attendance Batching**: Daily attendance operates as workshop grid (`MarkAttendanceTableView.tsx`, `MarkAttendanceStudentCard.tsx`). Form submissions use bulk upsert contracts with transactional atomicity.
- **Grading & GPA Calculations**: Grade calculations (percentages, grade letters, GPA points) must be calculated on the backend or in pure `@mms/shared` helpers; never rely on un-validated client math.

## 2. Implementation Map

| Operational Domain | Frontend Feature | Backend Routes & Services |
|---|---|---|
| Students & Admissions | `apps/frontend/src/tenant/features/students/StudentsPage.tsx` | `apps/backend/src/students/` |
| Enrollments & Classes | `apps/frontend/src/tenant/features/enrollments/EnrollmentsPage.tsx` | `apps/backend/src/enrollments/` |
| Attendance Tracking | `apps/frontend/src/tenant/features/attendance/AttendancePage.tsx` | `apps/backend/src/attendance/` |
| Examinations & Grades | `apps/frontend/src/tenant/features/examinations/ExaminationsPage.tsx` | `apps/backend/src/examinations/` |
| Hasanat & Merits | `apps/frontend/src/tenant/features/hasanat/HasanatCardsPage.tsx` | `apps/backend/src/hasanat/` |

## 3. Verification

```bash
pnpm --filter mms-backend test attendance
pnpm --filter mms-backend test enrollments
pnpm --filter mms-backend test examinations
pnpm --filter mms-frontend test apps/frontend/src/tenant/features/students
pnpm --filter mms-frontend test apps/frontend/src/tenant/features/attendance
```

## References

- Student Lifecycle & Academic Workflows: `references/student-lifecycle-workflows.md`

## Related skills

`mms-module-page`, `mms-module-work`, `mms-faculty-domain`, `mms-finance-accounting`, `mms-messaging`.
