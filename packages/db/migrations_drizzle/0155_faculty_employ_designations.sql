-- MMS Forward-only Migration: 0155_faculty_employ_designations.sql
-- Faculty Management expand: Employ Designation tenure table
--   faculty_employ_designations owns employment_id + designation_id + tenure dates + Active|Inactive
-- Dual-write mirrors on faculty (designation_id / designation_*_date / profile_status) kept until contract.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "faculty_employ_designations" (
  "id"                       text          NOT NULL,
  "workspace_subdomain"      text          NOT NULL,
  "employment_id"            text          NOT NULL,
  "designation_id"           text          NOT NULL,
  "start_date"               date,
  "end_date"                 date,
  "status"                   varchar(20)   NOT NULL DEFAULT 'active',
  "deleted_at"               timestamptz,
  "deleted_by"               text,
  "deletion_reason"          varchar(500),
  "restored_at"              timestamptz,
  "restored_by"              text,
  "deleted_with_cascade"     boolean       DEFAULT false,
  "created_at"               timestamptz   NOT NULL DEFAULT now(),
  "updated_at"               timestamptz   NOT NULL DEFAULT now(),
  "created_by"               text,
  "updated_by"               text,

  CONSTRAINT "faculty_employ_designations_ws_id_pk"
    PRIMARY KEY ("workspace_subdomain", "id"),

  CONSTRAINT "faculty_employ_designations_status_check"
    CHECK (lower(btrim("status")) IN ('active', 'inactive')),

  CONSTRAINT "faculty_employ_designations_period_check"
    CHECK (
      "end_date" IS NULL
      OR "start_date" IS NULL
      OR "end_date" >= "start_date"
    ),

  CONSTRAINT "faculty_employ_designations_workspace_fk"
    FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain")
    ON DELETE CASCADE,

  CONSTRAINT "faculty_employ_designations_employment_fk"
    FOREIGN KEY ("workspace_subdomain", "employment_id")
    REFERENCES "faculty_employments" ("workspace_subdomain", "id")
    ON DELETE RESTRICT,

  CONSTRAINT "faculty_employ_designations_designation_fk"
    FOREIGN KEY ("workspace_subdomain", "designation_id")
    REFERENCES "faculty_designations" ("workspace_subdomain", "id")
    ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_employ_designations_workspace_deleted_idx"
  ON "faculty_employ_designations" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faculty_employ_designations_workspace_active_idx"
  ON "faculty_employ_designations" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faculty_employ_designations_employment_active_idx"
  ON "faculty_employ_designations" ("workspace_subdomain", "employment_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "faculty_employ_designations_employment_active_uidx"
  ON "faculty_employ_designations" ("workspace_subdomain", "employment_id")
  WHERE "deleted_at" IS NULL AND lower(btrim("status")) = 'active'
    AND "end_date" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faculty_employ_designations_designation_active_idx"
  ON "faculty_employ_designations" ("workspace_subdomain", "designation_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faculty_employ_designations_deleted_idx"
  ON "faculty_employ_designations" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "faculty_employ_designations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculty_employ_designations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation_policy" ON "faculty_employ_designations";
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "faculty_employ_designations";
--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "faculty_employ_designations"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
      AND (
        "deleted_at" IS NULL
        OR current_setting('app.include_deleted', true) = 'true'
      )
    )
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

DROP TRIGGER IF EXISTS "trg_faculty_employ_designations_forbid_hard_delete" ON "faculty_employ_designations";
--> statement-breakpoint
CREATE TRIGGER "trg_faculty_employ_designations_forbid_hard_delete"
  BEFORE DELETE ON "faculty_employ_designations"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_faculty_employ_designations_updated_at'
      AND c.relname = 'faculty_employ_designations'
  ) THEN
    CREATE TRIGGER update_faculty_employ_designations_updated_at
      BEFORE UPDATE ON "faculty_employ_designations"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "faculty_employ_designations" SET (autovacuum_vacuum_scale_factor = 0.05);
--> statement-breakpoint

-- Backfill one employ-designation row per faculty that has employment + designation.
INSERT INTO "faculty_employ_designations" (
  "id",
  "workspace_subdomain",
  "employment_id",
  "designation_id",
  "start_date",
  "end_date",
  "status",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by"
)
SELECT
  'faced-' || f."id",
  f."workspace_subdomain",
  f."employment_id",
  f."designation_id",
  COALESCE(f."designation_start_date", f."employment_start_date", f."join_date", CURRENT_DATE),
  f."designation_end_date",
  CASE
    WHEN lower(btrim(COALESCE(f."profile_status", 'active'))) = 'inactive' THEN 'inactive'
    ELSE 'active'
  END,
  COALESCE(f."created_at", now()),
  COALESCE(f."updated_at", now()),
  f."created_by",
  f."updated_by"
FROM "faculty" f
WHERE f."employment_id" IS NOT NULL
  AND f."designation_id" IS NOT NULL
  AND f."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1
      FROM "faculty_employ_designations" ed
     WHERE ed."workspace_subdomain" = f."workspace_subdomain"
       AND ed."id" = 'faced-' || f."id"
  )
  AND EXISTS (
    SELECT 1
      FROM "faculty_employments" e
     WHERE e."workspace_subdomain" = f."workspace_subdomain"
       AND e."id" = f."employment_id"
  )
  AND EXISTS (
    SELECT 1
      FROM "faculty_designations" d
     WHERE d."workspace_subdomain" = f."workspace_subdomain"
       AND d."id" = f."designation_id"
  );
