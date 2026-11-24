-- 0062_dashboard_preferences_widgets.sql
-- Server-authoritative dashboard config: workspace-scoped layout preferences (singleton jsonb) and
-- pinned/custom widgets (normalized rows). Replaces browser-local `mms_dashboard_preferences` and
-- `kpi_custom_widgets` document-store keys. Mirrors the 0041/0061 pattern: workspace FK ON DELETE cascade,
-- FORCE ROW LEVEL SECURITY + tenant_isolation_policy. No legacy BE backfill (data is browser-local;
-- FE seeds one-time on first load). Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).

CREATE TABLE IF NOT EXISTS "dashboard_preferences" (
	"workspace_subdomain" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_preferences_workspace_subdomain_pk" PRIMARY KEY("workspace_subdomain")
);--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ADD CONSTRAINT "dashboard_preferences_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "dashboard_preferences";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "dashboard_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "dashboard_preferences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "dashboard_widgets" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"widget_type" varchar(64),
	"category" varchar(64) NOT NULL,
	"collection" varchar(64) NOT NULL,
	"role" varchar(32),
	"is_pinned_to_dashboard" boolean DEFAULT false NOT NULL,
	"title" varchar(255) NOT NULL,
	"icon" varchar(64),
	"color" varchar(32) NOT NULL,
	"operation" varchar(32) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"config" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_widgets_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dashboard_widgets_workspace_pinned_idx" ON "dashboard_widgets" USING btree ("workspace_subdomain","is_pinned_to_dashboard");--> statement-breakpoint
ALTER TABLE "dashboard_widgets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "dashboard_widgets";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "dashboard_widgets" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "dashboard_widgets" FORCE ROW LEVEL SECURITY;