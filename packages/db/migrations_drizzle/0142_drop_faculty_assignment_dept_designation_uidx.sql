-- MMS Forward-only Migration: 0142_drop_faculty_assignment_dept_designation_uidx.sql
-- Drop active dept+designation unique index to allow secondary appointments and multi-role holdings.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DROP INDEX IF EXISTS "faculty_assignments_active_dept_designation_uidx";
