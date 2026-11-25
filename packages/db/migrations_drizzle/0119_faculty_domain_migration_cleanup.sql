-- MMS Forward-only Migration: 0119_faculty_domain_migration_cleanup.sql
-- Renames residual foreign key constraints, soft-delete triggers, and referencing relations to faculty.

-- 1. Safely rename table constraints on faculty
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_workspace_subdomain_workspaces_subdomain_fk') THEN
    ALTER TABLE "faculty" RENAME CONSTRAINT "teachers_workspace_subdomain_workspaces_subdomain_fk" TO "faculty_workspace_subdomain_workspaces_subdomain_fk";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk') THEN
    ALTER TABLE "faculty" RENAME CONSTRAINT "teachers_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk" TO "faculty_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_user_fk') THEN
    ALTER TABLE "faculty" RENAME CONSTRAINT "teachers_user_fk" TO "faculty_user_fk";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teachers_workspace_subdomain_id_pk') THEN
    ALTER TABLE "faculty" RENAME CONSTRAINT "teachers_workspace_subdomain_id_pk" TO "faculty_workspace_subdomain_id_pk";
  END IF;

  -- Constraints on faculty_lookups
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_lookups_workspace_subdomain_workspaces_subdomain_fk') THEN
    ALTER TABLE "faculty_lookups" RENAME CONSTRAINT "teacher_lookups_workspace_subdomain_workspaces_subdomain_fk" TO "faculty_lookups_workspace_subdomain_workspaces_subdomain_fk";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_lookups_workspace_subdomain_id_pk') THEN
    ALTER TABLE "faculty_lookups" RENAME CONSTRAINT "teacher_lookups_workspace_subdomain_id_pk" TO "faculty_lookups_workspace_subdomain_id_pk";
  END IF;

  -- Constraints on faculty_field_configs
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_field_configs_workspace_subdomain_workspaces_subdomain_fk') THEN
    ALTER TABLE "faculty_field_configs" RENAME CONSTRAINT "teacher_field_configs_workspace_subdomain_workspaces_subdomain_fk" TO "faculty_field_configs_workspace_subdomain_workspaces_subdomain_fk";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_field_configs_workspace_subdomain_pk') THEN
    ALTER TABLE "faculty_field_configs" RENAME CONSTRAINT "teacher_field_configs_workspace_subdomain_pk" TO "faculty_field_configs_workspace_subdomain_pk";
  END IF;

  -- Constraints on faculty_module_preferences
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_module_preferences_workspace_subdomain_workspaces_subdomain_fk') THEN
    ALTER TABLE "faculty_module_preferences" RENAME CONSTRAINT "teacher_module_preferences_workspace_subdomain_workspaces_subdomain_fk" TO "faculty_module_preferences_workspace_subdomain_workspaces_subdomain_fk";
  END IF;

  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_module_preferences_workspace_subdomain_pk') THEN
    ALTER TABLE "faculty_module_preferences" RENAME CONSTRAINT "teacher_module_preferences_workspace_subdomain_pk" TO "faculty_module_preferences_workspace_subdomain_pk";
  END IF;
END $$;
--> statement-breakpoint

-- 2. Rename soft-delete trigger on faculty
DROP TRIGGER IF EXISTS trg_teachers_forbid_hard_delete ON "faculty";
--> statement-breakpoint
DROP TRIGGER IF EXISTS trg_faculty_forbid_hard_delete ON "faculty";
--> statement-breakpoint
CREATE TRIGGER trg_faculty_forbid_hard_delete
  BEFORE DELETE ON "faculty"
  FOR EACH ROW
  EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint

-- 3. Rename hasanat_distributions referencing column and index
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hasanat_distributions' AND column_name = 'recipient_teacher_id'
  ) THEN
    ALTER TABLE "hasanat_distributions" RENAME COLUMN "recipient_teacher_id" TO "recipient_faculty_id";
  END IF;
END $$;
--> statement-breakpoint
ALTER INDEX IF EXISTS hasanat_dist_workspace_teacher_idx RENAME TO hasanat_dist_workspace_faculty_idx;
