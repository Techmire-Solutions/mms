# MMS Student Lifecycle & Academic Workflows

This document specifies the operational lifecycle, entity state machines, attendance marking contracts, and grading workflows across the MMS Academic domain.

---

## 1. Student Lifecycle State Transitions

The student lifecycle manages the student's temporal journey within a tenant workspace:

```
[ Prospect / Applicant ]
          │
          ▼
   ( Admissions ) ─────────► [ Active Student ]
                                  │
          ┌───────────────────────┼──────────────────────┐
          ▼                       ▼                      ▼
    [ Suspended ]           [ On Leave ]          [ Graduated ]
          │                       │                      │
          └───────────────────────┴──────────────────────┘
                                  │
                                  ▼
                            [ Withdrawn ]
```

### State Machine Rules
1. **Admissions (`active`):** Newly admitted students receive a workspace-unique `grNumber` and `studentId`. Unique indexes (`students_workspace_gr_number_active_uidx`, `students_workspace_student_id_active_uidx`) enforce uniqueness across active records.
2. **Suspension / Leave (`suspended`, `on_leave`):** Suspended or leave-status students cannot be marked present in daily attendance grids and cannot sit for examinations.
3. **Completion / Exit (`graduated`, `withdrawn`):** Graduated or withdrawn students are soft-deleted via `studentSoftDeleteUseCases.ts` when archived, preserving their historical exam transcripts and financial ledger entries.

---

## 2. Enrollment Lifecycle

Students must have an active enrollment within an academic session to attend classes or register for exams:

- **Session Assignment:** Managed by `apps/backend/src/enrollments/use-cases/enrollmentsUseCases.ts`.
- **Status Enum:** `enrolled`, `completed`, `dropped`, `transferred`.
- **Cascade Archiving:** Soft-deleting an academic session cascades to soft-delete dependent enrollments with `deleted_with_cascade = true` (`0104_soft_delete_system_complete.sql`). Standalone un-enrollments set `deleted_with_cascade = false` so session restores do not resurrect intentionally dropped enrollments.

---

## 3. Daily Attendance Marking Grid

Attendance is recorded via a high-density, keyboard-accessible grid:
- **Statuses:** `present`, `absent`, `late`, `excused`.
- **Backend Service:** `apps/backend/src/attendance/use-cases/attendanceUseCases.ts`.
- **Invariants:**
  - Marking attendance requires `attendance.mark` permission.
  - Multi-student batch attendance marking executes inside a single `withTenant` transaction (`runInTransaction`).
  - Attendance mutations publish outbox CDC events triggering real-time WebSocket invalidations to connected staff interfaces.

---

## 4. Examinations & Grade Scaling

- **Grading Scale:** Defined in module setup preferences (`percentage`, `letter_grade`, `gpa`).
- **Marks Entry:** Managed in `apps/backend/src/examinations/use-cases/examinationsUseCases.ts`.
- **Formula:**
  $$\text{Final Percentage} = \frac{\sum \text{Obtained Marks}}{\sum \text{Maximum Marks}} \times 100$$
- **Grade Boundary Checks:** Evaluated server-side against tenant grade bands; scores cannot exceed maximum component marks or drop below 0.

---

## 5. Hasanat Points & Merit System

- **Points Operations:** Managed by `apps/backend/src/hasanat/use-cases/hasanatUseCases.ts`.
- **Ledger Invariant:** Every point mutation records a positive (merit) or negative (demerit) transaction referencing the student, authorizing staff member, reason code, and session ID.
- **Audit Requirement:** Point awards above threshold values generate an RFC 8785 canonical audit event (`student.hasanat.award`).
