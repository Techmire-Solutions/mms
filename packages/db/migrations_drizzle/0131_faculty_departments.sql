-- MMS Forward-only Migration: 0131_faculty_departments.sql
-- Creates the normalized faculty_departments catalog table with RLS, soft-delete,
-- and self-referencing parent hierarchy. Backfills from faculty_lookups kind='department'.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "faculty_departments" (
  "id"                  text          NOT NULL,
  "workspace_subdomain" text          NOT NULL,
  "parent_id"           text,
  "name"                varchar(255)  NOT NULL,
  "code"                varchar(32)   NOT NULL,
  "head_faculty_id"     text,
  -- soft-delete columns (mms-soft-delete)
  "deleted_at"          timestamptz,
  "deleted_by"          text,
  "deletion_reason"     varchar(500),
  "restored_at"         timestamptz,
  "restored_by"         text,
  "deleted_with_cascade" boolean      DEFAULT false,
  -- audit
  "created_at"          timestamptz   NOT NULL DEFAULT now(),
  "updated_at"          timestamptz   NOT NULL DEFAULT now(),
  "created_by"          text,
  "updated_by"          text,

  CONSTRAINT "faculty_departments_ws_id_pk"
    PRIMARY KEY ("workspace_subdomain", "id"),

  CONSTRAINT "faculty_departments_no_self_parent_check"
    CHECK ("parent_id" IS NULL OR "parent_id" <> "id"),

  CONSTRAINT "faculty_departments_workspace_fk"
    FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain")
    ON DELETE CASCADE,

  CONSTRAINT "faculty_departments_parent_fk"
    FOREIGN KEY ("workspace_subdomain", "parent_id")
    REFERENCES "faculty_departments" ("workspace_subdomain", "id")
    ON DELETE RESTRICT
);
--> statement-breakpoint

-- Deferred application-level FK: head_faculty_id → faculty.id
-- Not a hard DB constraint to avoid DDL circular-dependency;
-- enforced at the service layer when setting/clearing department heads.

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "faculty_departments_ws_code_active_uidx"
  ON "faculty_departments" ("workspace_subdomain", "code")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_departments_parent_active_idx"
  ON "faculty_departments" ("workspace_subdomain", "parent_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_departments_deleted_idx"
  ON "faculty_departments" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_departments_head_faculty_idx"
  ON "faculty_departments" ("workspace_subdomain", "head_faculty_id")
  WHERE "deleted_at" IS NULL AND "head_faculty_id" IS NOT NULL;
--> statement-breakpoint

-- ── Row Level Security ───────────────────────────────────────────────────────
ALTER TABLE "faculty_departments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculty_departments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "tenant_isolation_policy" ON "faculty_departments" FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

-- ── updated_at trigger ───────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_faculty_departments_updated_at'
      AND c.relname = 'faculty_departments'
  ) THEN
    CREATE TRIGGER update_faculty_departments_updated_at
      BEFORE UPDATE ON "faculty_departments"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
--> statement-breakpoint

-- ── Backfill from faculty_lookups kind='department' ─────────────────────────
-- Each distinct department label becomes a root-level department row.
-- Codes are slug-derived; duplicates are silently skipped.
INSERT INTO "faculty_departments" ("id", "workspace_subdomain", "name", "code", "created_at", "updated_at")
SELECT
  'fdep-' || substr(md5("workspace_subdomain" || ':' || lower(trim("label"))), 1, 24),
  "workspace_subdomain",
  trim("label"),
  substr(regexp_replace(lower(trim("label")), '[^a-z0-9]+', '-', 'g'), 1, 32),
  COALESCE("updated_at", now()),
  now()
FROM "faculty_lookups"
WHERE "kind" = 'department'
  AND NULLIF(trim("label"), '') IS NOT NULL
ON CONFLICT ("workspace_subdomain", "code") WHERE "deleted_at" IS NULL DO NOTHING;
