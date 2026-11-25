-- MMS Forward-only Migration: 0134_organization_positions_and_tasks.sql
-- Implements Position-based Organization Structure (locations, positions, faculty_assignment.position_id)
-- and first-class Task Management (tasks, task_assignees) with RLS, soft-delete, and autovacuum tuning.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- 1. Industry type on workspaces registry
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "industry_type" varchar(50) DEFAULT 'madrasa';
--> statement-breakpoint

-- 2. Organization Locations
CREATE TABLE IF NOT EXISTS "organization_locations" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "code"                 varchar(32)   NOT NULL,
  "name"                 varchar(255)  NOT NULL,
  "type"                 varchar(50)   NOT NULL DEFAULT 'branch',
  "parent_location_id"   text,
  "address_line_1"       varchar(255),
  "address_line_2"       varchar(255),
  "city"                 varchar(100),
  "region"               varchar(100),
  "country"              varchar(100),
  "postal_code"          varchar(20),
  "timezone"             varchar(50),
  "is_head_office"       boolean       NOT NULL DEFAULT false,
  "is_active"            boolean       NOT NULL DEFAULT true,
  "sort_order"           integer       NOT NULL DEFAULT 0,
  -- Soft-delete columns (mms-soft-delete)
  "deleted_at"           timestamptz,
  "deleted_by"           text,
  "deletion_reason"      varchar(500),
  "restored_at"          timestamptz,
  "restored_by"          text,
  "deleted_with_cascade" boolean       DEFAULT false,
  -- Audit
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  "created_by"           text,
  "updated_by"           text,

  CONSTRAINT "organization_locations_ws_id_pk"
    PRIMARY KEY ("workspace_subdomain", "id"),

  CONSTRAINT "organization_locations_no_self_parent_check"
    CHECK ("parent_location_id" IS NULL OR "parent_location_id" <> "id"),

  CONSTRAINT "organization_locations_workspace_fk"
    FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain")
    ON DELETE CASCADE,

  CONSTRAINT "organization_locations_parent_fk"
    FOREIGN KEY ("workspace_subdomain", "parent_location_id")
    REFERENCES "organization_locations" ("workspace_subdomain", "id")
    ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "organization_locations_ws_code_active_uidx"
  ON "organization_locations" ("workspace_subdomain", "code")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "organization_locations_parent_active_idx"
  ON "organization_locations" ("workspace_subdomain", "parent_location_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "organization_locations_deleted_idx"
  ON "organization_locations" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint

-- 3. Organization Positions
CREATE TABLE IF NOT EXISTS "organization_positions" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "code"                 varchar(32)   NOT NULL,
  "name"                 varchar(255)  NOT NULL,
  "department_id"        text,
  "designation_id"       text,
  "location_id"          text,
  "parent_position_id"   text,
  "capacity"             integer       NOT NULL DEFAULT 1,
  "sort_order"           integer       NOT NULL DEFAULT 0,
  "is_active"            boolean       NOT NULL DEFAULT true,
  -- Soft-delete columns
  "deleted_at"           timestamptz,
  "deleted_by"           text,
  "deletion_reason"      varchar(500),
  "restored_at"          timestamptz,
  "restored_by"          text,
  "deleted_with_cascade" boolean       DEFAULT false,
  -- Audit
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  "created_by"           text,
  "updated_by"           text,

  CONSTRAINT "organization_positions_ws_id_pk"
    PRIMARY KEY ("workspace_subdomain", "id"),

  CONSTRAINT "organization_positions_capacity_check"
    CHECK ("capacity" >= 1),

  CONSTRAINT "organization_positions_no_self_parent_check"
    CHECK ("parent_position_id" IS NULL OR "parent_position_id" <> "id"),

  CONSTRAINT "organization_positions_workspace_fk"
    FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain")
    ON DELETE CASCADE,

  CONSTRAINT "organization_positions_dept_fk"
    FOREIGN KEY ("workspace_subdomain", "department_id")
    REFERENCES "faculty_departments" ("workspace_subdomain", "id")
    ON DELETE RESTRICT,

  CONSTRAINT "organization_positions_designation_fk"
    FOREIGN KEY ("workspace_subdomain", "designation_id")
    REFERENCES "faculty_designations" ("workspace_subdomain", "id")
    ON DELETE RESTRICT,

  CONSTRAINT "organization_positions_location_fk"
    FOREIGN KEY ("workspace_subdomain", "location_id")
    REFERENCES "organization_locations" ("workspace_subdomain", "id")
    ON DELETE RESTRICT,

  CONSTRAINT "organization_positions_parent_fk"
    FOREIGN KEY ("workspace_subdomain", "parent_position_id")
    REFERENCES "organization_positions" ("workspace_subdomain", "id")
    ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "organization_positions_ws_code_active_uidx"
  ON "organization_positions" ("workspace_subdomain", "code")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "organization_positions_parent_active_idx"
  ON "organization_positions" ("workspace_subdomain", "parent_position_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "organization_positions_dept_active_idx"
  ON "organization_positions" ("workspace_subdomain", "department_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "organization_positions_location_active_idx"
  ON "organization_positions" ("workspace_subdomain", "location_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "organization_positions_deleted_idx"
  ON "organization_positions" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint

-- 4. Extend faculty_assignments with position_id
ALTER TABLE "faculty_assignments" ADD COLUMN IF NOT EXISTS "position_id" text;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'faculty_assignments_position_fk'
  ) THEN
    ALTER TABLE "faculty_assignments"
    ADD CONSTRAINT "faculty_assignments_position_fk"
    FOREIGN KEY ("workspace_subdomain", "position_id")
    REFERENCES "organization_positions" ("workspace_subdomain", "id")
    ON DELETE RESTRICT;
  END IF;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_assignments_position_active_idx"
  ON "faculty_assignments" ("workspace_subdomain", "position_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- 5. Tasks Table
CREATE TABLE IF NOT EXISTS "tasks" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "title"                varchar(255)  NOT NULL,
  "description"          text,
  "status"               varchar(32)   NOT NULL DEFAULT 'todo',
  "priority"             varchar(32)   NOT NULL DEFAULT 'medium',
  "start_date"           date,
  "due_at"               timestamptz,
  "parent_task_id"       text,
  "created_by_user_id"   text          NOT NULL,
  "assigned_by_user_id"  text,
  "completed_at"         timestamptz,
  "cancelled_at"         timestamptz,
  -- Soft-delete columns
  "deleted_at"           timestamptz,
  "deleted_by"           text,
  "deletion_reason"      varchar(500),
  "restored_at"          timestamptz,
  "restored_by"          text,
  "deleted_with_cascade" boolean       DEFAULT false,
  -- Audit
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  "created_by"           text,
  "updated_by"           text,

  CONSTRAINT "tasks_ws_id_pk"
    PRIMARY KEY ("workspace_subdomain", "id"),

  CONSTRAINT "tasks_status_check"
    CHECK ("status" IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled')),

  CONSTRAINT "tasks_priority_check"
    CHECK ("priority" IN ('low', 'medium', 'high', 'urgent')),

  CONSTRAINT "tasks_workspace_fk"
    FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain")
    ON DELETE CASCADE,

  CONSTRAINT "tasks_parent_task_fk"
    FOREIGN KEY ("workspace_subdomain", "parent_task_id")
    REFERENCES "tasks" ("workspace_subdomain", "id")
    ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tasks_status_active_idx"
  ON "tasks" ("workspace_subdomain", "status")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tasks_priority_active_idx"
  ON "tasks" ("workspace_subdomain", "priority")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tasks_due_at_active_idx"
  ON "tasks" ("workspace_subdomain", "due_at")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tasks_parent_task_active_idx"
  ON "tasks" ("workspace_subdomain", "parent_task_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "tasks_deleted_idx"
  ON "tasks" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint

-- 6. Task Assignees Table
CREATE TABLE IF NOT EXISTS "task_assignees" (
  "id"                    text          NOT NULL,
  "workspace_subdomain"   text          NOT NULL,
  "task_id"               text          NOT NULL,
  "faculty_id"            text          NOT NULL,
  "faculty_assignment_id" text,
  "position_id"           text,
  "user_id"               text          NOT NULL,
  "assigned_at"           timestamptz   NOT NULL DEFAULT now(),
  "assigned_by_user_id"   text          NOT NULL,
  "completed_at"          timestamptz,
  -- Soft-delete columns
  "deleted_at"            timestamptz,
  "deleted_by"            text,
  "deletion_reason"       varchar(500),
  "restored_at"           timestamptz,
  "restored_by"           text,
  "deleted_with_cascade"  boolean       DEFAULT false,
  -- Audit
  "created_at"            timestamptz   NOT NULL DEFAULT now(),
  "updated_at"            timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT "task_assignees_ws_id_pk"
    PRIMARY KEY ("workspace_subdomain", "id"),

  CONSTRAINT "task_assignees_workspace_fk"
    FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain")
    ON DELETE CASCADE,

  CONSTRAINT "task_assignees_task_fk"
    FOREIGN KEY ("workspace_subdomain", "task_id")
    REFERENCES "tasks" ("workspace_subdomain", "id")
    ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "task_assignees_task_active_idx"
  ON "task_assignees" ("workspace_subdomain", "task_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "task_assignees_user_active_idx"
  ON "task_assignees" ("workspace_subdomain", "user_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "task_assignees_faculty_active_idx"
  ON "task_assignees" ("workspace_subdomain", "faculty_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "task_assignees_deleted_idx"
  ON "task_assignees" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint

-- 7. Row Level Security
ALTER TABLE "organization_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_locations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "organization_positions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_positions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "tasks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tasks" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

ALTER TABLE "task_assignees" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "task_assignees" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "tenant_isolation_policy" ON "organization_locations" FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

CREATE POLICY "tenant_isolation_policy" ON "organization_positions" FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

CREATE POLICY "tenant_isolation_policy" ON "tasks" FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

CREATE POLICY "tenant_isolation_policy" ON "task_assignees" FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

-- 8. Triggers for Hard Delete Prevention
CREATE TRIGGER trg_organization_locations_forbid_hard_delete
  BEFORE DELETE ON "organization_locations" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint

CREATE TRIGGER trg_organization_positions_forbid_hard_delete
  BEFORE DELETE ON "organization_positions" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint

CREATE TRIGGER trg_tasks_forbid_hard_delete
  BEFORE DELETE ON "tasks" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint

CREATE TRIGGER trg_task_assignees_forbid_hard_delete
  BEFORE DELETE ON "task_assignees" FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint

-- 9. Autovacuum Tuning for Scale
ALTER TABLE "organization_locations" SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE "organization_positions" SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE "tasks" SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE "task_assignees" SET (autovacuum_vacuum_scale_factor = 0.05);
