-- MMS Forward-only Migration: 0112_rename_teachers_to_faculty.sql
-- Renames teachers, teacher_lookups, teacher_field_configs, and teacher_module_preferences
-- to faculty equivalents with zero-downtime backward-compatibility views.

-- 1. Table renames
ALTER TABLE IF EXISTS teachers RENAME TO faculty;
ALTER TABLE IF EXISTS teacher_lookups RENAME TO faculty_lookups;
ALTER TABLE IF EXISTS teacher_field_configs RENAME TO faculty_field_configs;
ALTER TABLE IF EXISTS teacher_module_preferences RENAME TO faculty_module_preferences;

-- 2. Index renames for faculty table
ALTER INDEX IF EXISTS teachers_workspace_status_idx RENAME TO faculty_workspace_status_idx;
ALTER INDEX IF EXISTS teachers_workspace_employee_id_idx RENAME TO faculty_workspace_employee_id_idx;
ALTER INDEX IF EXISTS teachers_workspace_specialization_idx RENAME TO faculty_workspace_specialization_idx;
ALTER INDEX IF EXISTS teachers_workspace_deleted_idx RENAME TO faculty_workspace_deleted_idx;
ALTER INDEX IF EXISTS teachers_workspace_active_idx RENAME TO faculty_workspace_active_idx;
ALTER INDEX IF EXISTS teachers_workspace_id_active_idx RENAME TO faculty_workspace_id_active_idx;
ALTER INDEX IF EXISTS teachers_workspace_status_id_active_idx RENAME TO faculty_workspace_status_id_active_idx;
ALTER INDEX IF EXISTS teachers_workspace_created_at_active_idx RENAME TO faculty_workspace_created_at_active_idx;
ALTER INDEX IF EXISTS teachers_workspace_updated_at_active_idx RENAME TO faculty_workspace_updated_at_active_idx;
ALTER INDEX IF EXISTS teachers_workspace_status_updated_at_active_idx RENAME TO faculty_workspace_status_updated_at_active_idx;
ALTER INDEX IF EXISTS teachers_workspace_status_expr_updated_at_active_idx RENAME TO faculty_workspace_status_expr_updated_at_active_idx;
ALTER INDEX IF EXISTS teachers_workspace_status_expr_id_active_idx RENAME TO faculty_workspace_status_expr_id_active_idx;
ALTER INDEX IF EXISTS teachers_workspace_specialization_active_idx RENAME TO faculty_workspace_specialization_active_idx;
ALTER INDEX IF EXISTS teachers_workspace_employee_id_active_uidx RENAME TO faculty_workspace_employee_id_active_uidx;
ALTER INDEX IF EXISTS teachers_workspace_deleted_records_idx RENAME TO faculty_workspace_deleted_records_idx;
ALTER INDEX IF EXISTS teachers_workspace_contact_active_idx RENAME TO faculty_workspace_contact_active_idx;
ALTER INDEX IF EXISTS teachers_workspace_user_idx RENAME TO faculty_workspace_user_idx;

-- 3. Index renames for faculty_lookups table
ALTER INDEX IF EXISTS teacher_lookups_workspace_kind_sort_idx RENAME TO faculty_lookups_workspace_kind_sort_idx;
ALTER INDEX IF EXISTS teacher_lookups_workspace_kind_idx RENAME TO faculty_lookups_workspace_kind_idx;

-- 4. Enable Row Level Security (RLS) on renamed tables
ALTER TABLE IF EXISTS faculty ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS faculty FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS faculty_lookups ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS faculty_lookups FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS faculty_field_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS faculty_field_configs FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS faculty_module_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS faculty_module_preferences FORCE ROW LEVEL SECURITY;

-- 5. Backward-compatibility views for legacy queries and backups
CREATE OR REPLACE VIEW teachers AS SELECT * FROM faculty;
CREATE OR REPLACE VIEW teacher_lookups AS SELECT * FROM faculty_lookups;
CREATE OR REPLACE VIEW teacher_field_configs AS SELECT * FROM faculty_field_configs;
CREATE OR REPLACE VIEW teacher_module_preferences AS SELECT * FROM faculty_module_preferences;
