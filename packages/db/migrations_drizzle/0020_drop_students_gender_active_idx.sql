-- Gender filter/sort now joins contacts (Contacts SSOT). Drop unused student JSONB index.
DROP INDEX IF EXISTS "students_workspace_gender_active_idx";
