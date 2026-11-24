-- MMS Forward-only Migration: 0154_faculty_employments.sql
-- Faculty Management expand:
--   faculty_employments owns contact_id + employee_id (Employee Code) + employment dates/status
--   faculty gains employment_id FK + profile_status + designation tenure
-- Dual-write mirrors (faculty.contact_id / employee_id / status / employment dates) kept until contract.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- ───────────────────────── faculty profile expand ─────────────────────────
ALTER TABLE "faculty" ADD COLUMN IF NOT EXISTS "profile_status" varchar(20) NOT NULL DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN IF NOT EXISTS "designation_start_date" date;
--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN IF NOT EXISTS "designation_end_date" date;
--> statement-breakpoint
ALTER TABLE "faculty" ADD COLUMN IF NOT EXISTS "employment_id" text;
--> statement-breakpoint

UPDATE "faculty" SET "profile_status" = CASE
  WHEN lower(btrim("status")) IN ('active', 'on_leave') THEN 'active'
  ELSE 'inactive'
END
WHERE "profile_status" IS DISTINCT FROM CASE
  WHEN lower(btrim("status")) IN ('active', 'on_leave') THEN 'active'
  ELSE 'inactive'
END;
--> statement-breakpoint

UPDATE "faculty" f
   SET "designation_start_date" = COALESCE(
     (
       SELECT a."start_date"
         FROM "faculty_assignments" a
        WHERE a."workspace_subdomain" = f."workspace_subdomain"
          AND a."faculty_id" = f."id"
          AND a."deleted_at" IS NULL
          AND a."is_primary" = true
          AND a."status" = 'active'
        ORDER BY a."start_date" DESC NULLS LAST
        LIMIT 1
     ),
     f."employment_start_date",
     f."join_date",
     CURRENT_DATE
   )
 WHERE f."designation_start_date" IS NULL;
--> statement-breakpoint

UPDATE "faculty" f
   SET "designation_end_date" = (
     SELECT a."end_date"
       FROM "faculty_assignments" a
      WHERE a."workspace_subdomain" = f."workspace_subdomain"
        AND a."faculty_id" = f."id"
        AND a."deleted_at" IS NULL
        AND a."is_primary" = true
        AND a."status" = 'active'
      ORDER BY a."start_date" DESC NULLS LAST
      LIMIT 1
   )
 WHERE f."designation_end_date" IS NULL
   AND EXISTS (
     SELECT 1 FROM "faculty_assignments" a
      WHERE a."workspace_subdomain" = f."workspace_subdomain"
        AND a."faculty_id" = f."id"
        AND a."deleted_at" IS NULL
        AND a."is_primary" = true
        AND a."status" = 'active'
        AND a."end_date" IS NOT NULL
   );
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "faculty"
    ADD CONSTRAINT "faculty_profile_status_check"
    CHECK (lower(btrim("profile_status")) IN ('active', 'inactive'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "faculty"
    ADD CONSTRAINT "faculty_designation_period_check"
    CHECK (
      "designation_end_date" IS NULL
      OR "designation_start_date" IS NULL
      OR "designation_end_date" >= "designation_start_date"
    );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_workspace_profile_status_active_idx"
  ON "faculty" ("workspace_subdomain", "profile_status")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- ───────────────────────── faculty_employments ─────────────────────────
CREATE TABLE IF NOT EXISTS "faculty_employments" (
  "id"                       text          NOT NULL,
  "workspace_subdomain"      text          NOT NULL,
  "contact_id"               text          NOT NULL,
  "employee_id"              varchar(100),
  "employment_start_date"    date,
  "employment_end_date"      date,
  "status"                   varchar(50)   NOT NULL DEFAULT 'active',
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

  CONSTRAINT "faculty_employments_ws_id_pk"
    PRIMARY KEY ("workspace_subdomain", "id"),

  CONSTRAINT "faculty_employments_status_check"
    CHECK (lower(btrim("status")) IN ('active', 'on_leave', 'inactive', 'retired', 'terminated')),

  CONSTRAINT "faculty_employments_period_check"
    CHECK (
      "employment_end_date" IS NULL
      OR "employment_start_date" IS NULL
      OR "employment_end_date" >= "employment_start_date"
    ),

  CONSTRAINT "faculty_employments_workspace_fk"
    FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain")
    ON DELETE CASCADE,

  CONSTRAINT "faculty_employments_contact_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id")
    REFERENCES "contacts" ("workspace_subdomain", "id")
    ON DELETE RESTRICT
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "faculty_employments_workspace_deleted_idx"
  ON "faculty_employments" ("workspace_subdomain", "deleted_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faculty_employments_workspace_active_idx"
  ON "faculty_employments" ("workspace_subdomain")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "faculty_employments_contact_active_uidx"
  ON "faculty_employments" ("workspace_subdomain", "contact_id")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "faculty_employments_employee_id_active_uidx"
  ON "faculty_employments" ("workspace_subdomain", "employee_id")
  WHERE "deleted_at" IS NULL AND "employee_id" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faculty_employments_status_active_idx"
  ON "faculty_employments" ("workspace_subdomain", "status")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "faculty_employments_deleted_idx"
  ON "faculty_employments" ("workspace_subdomain", "deleted_at")
  WHERE "deleted_at" IS NOT NULL;
--> statement-breakpoint

ALTER TABLE "faculty_employments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "faculty_employments" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation_policy" ON "faculty_employments";
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "faculty_employments";
--> statement-breakpoint
CREATE POLICY "tenant_soft_delete_isolation" ON "faculty_employments"
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

DROP TRIGGER IF EXISTS "trg_faculty_employments_forbid_hard_delete" ON "faculty_employments";
--> statement-breakpoint
CREATE TRIGGER "trg_faculty_employments_forbid_hard_delete"
  BEFORE DELETE ON "faculty_employments"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'update_faculty_employments_updated_at'
      AND c.relname = 'faculty_employments'
  ) THEN
    CREATE TRIGGER update_faculty_employments_updated_at
      BEFORE UPDATE ON "faculty_employments"
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "faculty_employments" SET (autovacuum_vacuum_scale_factor = 0.05);
--> statement-breakpoint

-- Backfill one employment row per faculty from mirrored contact / employment fields.
INSERT INTO "faculty_employments" (
  "id",
  "workspace_subdomain",
  "contact_id",
  "employee_id",
  "employment_start_date",
  "employment_end_date",
  "status",
  "deleted_at",
  "deleted_by",
  "deletion_reason",
  "restored_at",
  "restored_by",
  "deleted_with_cascade",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by"
)
SELECT
  'facemp-' || substr(md5(f."workspace_subdomain" || ':' || f."id"), 1, 24),
  f."workspace_subdomain",
  f."contact_id",
  f."employee_id",
  COALESCE(f."employment_start_date", f."join_date"),
  f."employment_end_date",
  COALESCE(NULLIF(lower(btrim(f."status")), ''), 'active'),
  f."deleted_at",
  f."deleted_by",
  CASE WHEN f."deleted_at" IS NOT NULL THEN 'Cascade: parent faculty deleted' ELSE NULL END,
  f."restored_at",
  f."restored_by",
  CASE WHEN f."deleted_at" IS NOT NULL THEN true ELSE false END,
  f."created_at",
  f."updated_at",
  f."created_by",
  f."updated_by"
FROM "faculty" f
WHERE f."contact_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "faculty_employments" e
     WHERE e."workspace_subdomain" = f."workspace_subdomain"
       AND e."contact_id" = f."contact_id"
       AND e."deleted_at" IS NULL
  )
ON CONFLICT ("workspace_subdomain", "id") DO NOTHING;
--> statement-breakpoint

-- Point faculty.employment_id at the backfilled employment row.
UPDATE "faculty" f
   SET "employment_id" = e."id"
  FROM "faculty_employments" e
 WHERE e."workspace_subdomain" = f."workspace_subdomain"
   AND e."contact_id" = f."contact_id"
   AND e."deleted_at" IS NULL
   AND f."employment_id" IS NULL;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "faculty"
    ADD CONSTRAINT "faculty_employment_fk"
    FOREIGN KEY ("workspace_subdomain", "employment_id")
    REFERENCES "faculty_employments" ("workspace_subdomain", "id")
    ON DELETE RESTRICT;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "faculty_workspace_employment_active_uidx"
  ON "faculty" ("workspace_subdomain", "employment_id")
  WHERE "deleted_at" IS NULL AND "employment_id" IS NOT NULL;
--> statement-breakpoint

-- Catalog polish: disallow null department_id when all live rows are filled.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "faculty_designations"
     WHERE "deleted_at" IS NULL AND "department_id" IS NULL
  ) THEN
    BEGIN
      ALTER TABLE "faculty_designations" ALTER COLUMN "department_id" SET NOT NULL;
    EXCEPTION
      WHEN others THEN NULL;
    END;
  END IF;
END $$;
