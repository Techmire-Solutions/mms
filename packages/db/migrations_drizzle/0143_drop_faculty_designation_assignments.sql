-- MMS Forward-only Migration: 0143_drop_faculty_designation_assignments.sql
-- Retire legacy FDA table; faculty_assignments is the appointment SSOT.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DROP TABLE IF EXISTS "faculty_designation_assignments" CASCADE;
