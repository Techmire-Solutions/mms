-- MMS Forward-only Migration: 0177_session_promotion.sql
-- Phase 10 — Duplicate & promote a session (year rollover), run as a background job.
--   session_promotion_runs        — one rollover: source → target (draft), mode, status, counts.
--   session_promotion_class_map   — source class → class whose copy receives the students (null = graduate).
--   enrollments.promoted_from_enrollment_id — new enrollment ← the source enrollment it continues.
-- New tables → plain CREATE INDEX IF NOT EXISTS. The enrollments column is nullable without a default
-- (metadata-only); its index is built out of band:
--   pnpm --filter mms-backend index:concurrent --file src/scripts/session_promotion_concurrent_indexes.sql

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "session_promotion_runs" (
  "id"                   text          NOT NULL,
  "workspace_subdomain"  text          NOT NULL,
  "source_session_id"    text          NOT NULL,
  "target_session_id"    text,
  "mode"                 varchar(20)   NOT NULL,
  "status"               varchar(20)   NOT NULL DEFAULT 'queued',
  "promoted"             integer       NOT NULL DEFAULT 0,
  "retained"             integer       NOT NULL DEFAULT 0,
  "graduated"            integer       NOT NULL DEFAULT 0,
  "left"                 integer       NOT NULL DEFAULT 0,
  "error"                varchar(1000),
  "job_id"               text,
  "created_by"           text,
  "created_at"           timestamptz   NOT NULL DEFAULT now(),
  "updated_at"           timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT "session_promotion_runs_ws_id_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "session_promotion_runs_mode_check" CHECK ("mode" IN ('duplicate', 'promote')),
  CONSTRAINT "session_promotion_runs_status_check" CHECK ("status" IN ('queued', 'running', 'completed', 'failed')),
  CONSTRAINT "session_promotion_runs_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "session_promotion_runs_source_fk" FOREIGN KEY ("workspace_subdomain", "source_session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "session_promotion_runs_target_fk" FOREIGN KEY ("workspace_subdomain", "target_session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id") ON DELETE SET NULL (target_session_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_promotion_runs_source_idx" ON "session_promotion_runs" ("workspace_subdomain", "source_session_id", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_promotion_runs_target_idx" ON "session_promotion_runs" ("workspace_subdomain", "target_session_id");
--> statement-breakpoint
ALTER TABLE "session_promotion_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_promotion_runs" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_promotion_runs";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_promotion_runs"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint
DROP TRIGGER IF EXISTS "update_session_promotion_runs_updated_at" ON "session_promotion_runs";
--> statement-breakpoint
CREATE TRIGGER "update_session_promotion_runs_updated_at" BEFORE UPDATE ON "session_promotion_runs" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "session_promotion_class_map" (
  "workspace_subdomain"  text  NOT NULL,
  "run_id"               text  NOT NULL,
  "source_class_id"      text  NOT NULL,
  "next_class_id"        text,
  CONSTRAINT "session_promotion_class_map_pk" PRIMARY KEY ("workspace_subdomain", "run_id", "source_class_id"),
  CONSTRAINT "session_promotion_class_map_workspace_fk" FOREIGN KEY ("workspace_subdomain")
    REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  CONSTRAINT "session_promotion_class_map_run_fk" FOREIGN KEY ("workspace_subdomain", "run_id")
    REFERENCES "session_promotion_runs" ("workspace_subdomain", "id") ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE "session_promotion_class_map" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_promotion_class_map" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "session_promotion_class_map";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "session_promotion_class_map"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
--> statement-breakpoint

ALTER TABLE "enrollments" ADD COLUMN IF NOT EXISTS "promoted_from_enrollment_id" text;
