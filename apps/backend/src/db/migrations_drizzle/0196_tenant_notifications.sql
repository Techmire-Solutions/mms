-- MMS Forward-only Migration: 0196_tenant_notifications.sql
-- Stored in-app notifications for the tenant shell. The first producer is the admissions
-- waitlist: when a freed seat flags the oldest waitlisted application back into review, staff who
-- can act on it are told. Until now that was only a live cache invalidation, lost on reload.
--   • tenant_notifications — one row per event, addressed to everyone holding
--     `audience_permission` (not to individual users), so a new staff member sees it too.
--   • tenant_notification_reads — per-user read receipts.
-- Labels are data (applicant, class); the UI composes the sentence per `kind` so it is translated.
-- Notifications are ephemeral, so rows are hard-deleted with their workspace (no soft delete).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tenant_notifications" (
  "id"                   text         NOT NULL,
  "workspace_subdomain"  text         NOT NULL REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE,
  "kind"                 varchar(40)  NOT NULL,
  "audience_permission"  varchar(64)  NOT NULL,
  "entity_type"          varchar(40)  NOT NULL,
  "entity_id"            text         NOT NULL,
  "subject_label"        text         NOT NULL,
  "context_label"        text         NOT NULL DEFAULT '',
  "created_at"           timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_notifications_pk" PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "tenant_notifications_kind_check" CHECK ("kind" IN ('waitlist_seat_offered'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_notifications_workspace_created_idx"
  ON "tenant_notifications" ("workspace_subdomain", "created_at" DESC);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "tenant_notification_reads" (
  "workspace_subdomain"  text         NOT NULL,
  "notification_id"      text         NOT NULL,
  "user_id"              text         NOT NULL,
  "read_at"              timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_notification_reads_pk" PRIMARY KEY ("workspace_subdomain", "notification_id", "user_id"),
  CONSTRAINT "tenant_notification_reads_notification_fk"
    FOREIGN KEY ("workspace_subdomain", "notification_id")
    REFERENCES "tenant_notifications" ("workspace_subdomain", "id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_notification_reads_user_idx"
  ON "tenant_notification_reads" ("workspace_subdomain", "user_id");
--> statement-breakpoint

ALTER TABLE "tenant_notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_notifications" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "tenant_notifications";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "tenant_notifications"
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
ALTER TABLE "tenant_notification_reads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_notification_reads" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "tenant_notification_reads";
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "tenant_notification_reads"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
  );
