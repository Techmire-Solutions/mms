-- MMS Forward-only Migration: 0113_faculty_department_designation.sql
-- Adds department and designation columns to faculty table and refreshes the teachers view.

ALTER TABLE faculty ADD COLUMN IF NOT EXISTS department varchar(150);
ALTER TABLE faculty ADD COLUMN IF NOT EXISTS designation varchar(150);

-- Refresh backward-compatibility view to include new columns
DROP VIEW IF EXISTS teachers;
CREATE VIEW teachers AS SELECT * FROM faculty;
