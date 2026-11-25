-- 0061_obligations_messaging_column_prefs_tables.sql
-- Typed per-user column-prefs tables for the last modules still on the `objects` document-store KV:
-- obligations (1) and messaging (recipients/history/templates). Mirrors the 0041 pattern: composite
-- PK (workspace_subdomain, user_id), no FK on user_id, FORCE ROW LEVEL SECURITY + tenant_isolation_policy.
-- Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).

CREATE TABLE IF NOT EXISTS "obligations_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "obligations_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "obligations_user_column_prefs" ADD CONSTRAINT "obligations_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligations_user_column_prefs_workspace_idx" ON "obligations_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "obligations_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "obligations_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "obligations_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "obligations_user_column_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "messaging_recipients_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "messaging_recipients_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "messaging_recipients_user_column_prefs" ADD CONSTRAINT "messaging_recipients_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messaging_recipients_user_column_prefs_workspace_idx" ON "messaging_recipients_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "messaging_recipients_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "messaging_recipients_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "messaging_recipients_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "messaging_recipients_user_column_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "messaging_history_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "messaging_history_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "messaging_history_user_column_prefs" ADD CONSTRAINT "messaging_history_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messaging_history_user_column_prefs_workspace_idx" ON "messaging_history_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "messaging_history_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "messaging_history_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "messaging_history_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "messaging_history_user_column_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "messaging_templates_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "messaging_templates_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "messaging_templates_user_column_prefs" ADD CONSTRAINT "messaging_templates_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "messaging_templates_user_column_prefs_workspace_idx" ON "messaging_templates_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "messaging_templates_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "messaging_templates_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "messaging_templates_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "messaging_templates_user_column_prefs" FORCE ROW LEVEL SECURITY;