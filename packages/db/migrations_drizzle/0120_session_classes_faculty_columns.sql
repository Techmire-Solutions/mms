-- MMS Forward-only Migration: 0120_session_classes_faculty_columns.sql
-- Renames referencing teacher columns and indexes in session_classes and session_class_timetable_periods to faculty.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_classes' AND column_name = 'teacher_id'
  ) THEN
    ALTER TABLE "session_classes" RENAME COLUMN "teacher_id" TO "faculty_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_classes' AND column_name = 'teacher_name'
  ) THEN
    ALTER TABLE "session_classes" RENAME COLUMN "teacher_name" TO "faculty_name";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS session_classes_workspace_teacher_idx RENAME TO session_classes_workspace_faculty_idx;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_class_timetable_periods' AND column_name = 'teacher_id'
  ) THEN
    ALTER TABLE "session_class_timetable_periods" RENAME COLUMN "teacher_id" TO "faculty_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'session_class_timetable_periods' AND column_name = 'teacher_name'
  ) THEN
    ALTER TABLE "session_class_timetable_periods" RENAME COLUMN "teacher_name" TO "faculty_name";
  END IF;
END $$;
