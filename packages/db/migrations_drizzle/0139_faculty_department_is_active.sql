-- MMS Forward-only Migration: 0139_faculty_department_is_active.sql
-- Add is_active status for faculty departments (mirrors faculty_designations).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "faculty_departments"
  ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;
