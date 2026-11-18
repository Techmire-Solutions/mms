-- Migration 0265: messaging_preferences table (typed, FORCE RLS) and message_logs.sent_at
-- varchar(35) -> timestamptz. Invalid legacy sent_at strings fall back to the epoch so the
-- type change is lossless and NOT NULL is preserved.
--
-- The BRIN (message_logs.sent_at) and pg_trgm (contacts.name) search/retention indexes are
-- created out-of-band because they target large tables:
--   pnpm --filter mms-backend index:concurrent --table message_logs --columns sent_at --name message_logs_sent_at_brin_idx --method brin
--   pnpm --filter mms-backend index:concurrent --table contacts --columns name --name contacts_name_trgm_idx --method gin --opclass gin_trgm_ops

SET LOCAL lock_timeout = '2s';--> statement-breakpoint
CREATE TABLE "messaging_preferences" (
	"workspace_subdomain" text PRIMARY KEY NOT NULL,
	"default_channel" varchar(30) DEFAULT 'sms' NOT NULL,
	"default_sms_mode" varchar(30) DEFAULT 'gateway' NOT NULL,
	"default_dispatch_speed" varchar(30) DEFAULT 'normal' NOT NULL,
	"default_country_code" varchar(10) DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messaging_preferences" ADD CONSTRAINT "messaging_preferences_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messaging_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messaging_preferences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "messaging_preferences";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "messaging_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "message_logs" ALTER COLUMN "sent_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "message_logs" ALTER COLUMN "sent_at" SET DATA TYPE timestamp with time zone
USING CASE
  WHEN "sent_at" ~ '^\d{4}-\d{2}-\d{2}T' THEN "sent_at"::timestamptz
  ELSE '1970-01-01T00:00:00Z'::timestamptz
END;
