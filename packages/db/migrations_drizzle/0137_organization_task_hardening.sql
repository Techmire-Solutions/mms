-- MMS Forward-only Migration: 0137_organization_task_hardening.sql
-- Blueprint application metadata on workspaces, updated_at triggers for org/tasks,
-- and forbid_hard_delete on task_module_preferences.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "applied_blueprint_key" varchar(100),
  ADD COLUMN IF NOT EXISTS "applied_blueprint_version" integer,
  ADD COLUMN IF NOT EXISTS "blueprint_applied_at" timestamptz;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_organization_locations_updated_at'
      AND c.relname = 'organization_locations'
  ) THEN
    CREATE TRIGGER update_organization_locations_updated_at
      BEFORE UPDATE ON "organization_locations"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_organization_positions_updated_at'
      AND c.relname = 'organization_positions'
  ) THEN
    CREATE TRIGGER update_organization_positions_updated_at
      BEFORE UPDATE ON "organization_positions"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_tasks_updated_at'
      AND c.relname = 'tasks'
  ) THEN
    CREATE TRIGGER update_tasks_updated_at
      BEFORE UPDATE ON "tasks"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_task_assignees_updated_at'
      AND c.relname = 'task_assignees'
  ) THEN
    CREATE TRIGGER update_task_assignees_updated_at
      BEFORE UPDATE ON "task_assignees"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'trg_task_module_preferences_forbid_hard_delete'
      AND c.relname = 'task_module_preferences'
  ) THEN
    CREATE TRIGGER trg_task_module_preferences_forbid_hard_delete
      BEFORE DELETE ON "task_module_preferences"
      FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
  END IF;
END $$;
