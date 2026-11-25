CREATE TABLE IF NOT EXISTS "user_ui_preferences" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_ui_preferences_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);
--> statement-breakpoint
ALTER TABLE "user_ui_preferences" ADD CONSTRAINT "user_ui_preferences_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_ui_preferences" ADD CONSTRAINT "user_ui_preferences_workspace_subdomain_user_id_tenant_users_workspace_subdomain_id_fk" FOREIGN KEY ("workspace_subdomain","user_id") REFERENCES "public"."tenant_users"("workspace_subdomain","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_ui_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "user_ui_preferences" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "user_ui_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);
