-- Teachers Setup field-config, preferences, and per-user column prefs — typed tenant stores.
CREATE TABLE IF NOT EXISTS "teacher_field_configs" (
	"workspace_subdomain" text NOT NULL,
	"config" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_field_configs_workspace_subdomain_pk" PRIMARY KEY("workspace_subdomain")
);--> statement-breakpoint
ALTER TABLE "teacher_field_configs" ADD CONSTRAINT "teacher_field_configs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_field_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "teacher_field_configs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "teacher_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "teacher_field_configs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "teacher_module_preferences" (
	"workspace_subdomain" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_module_preferences_workspace_subdomain_pk" PRIMARY KEY("workspace_subdomain")
);--> statement-breakpoint
ALTER TABLE "teacher_module_preferences" ADD CONSTRAINT "teacher_module_preferences_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_module_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "teacher_module_preferences";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "teacher_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "teacher_module_preferences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "teacher_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teacher_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "teacher_user_column_prefs" ADD CONSTRAINT "teacher_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teacher_user_column_prefs_workspace_idx" ON "teacher_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "teacher_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "teacher_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "teacher_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "teacher_user_column_prefs" FORCE ROW LEVEL SECURITY;
