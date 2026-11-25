-- MMS Forward-only Migration: 0175_obligation_module_preferences.sql
-- Obligations Setup preferences relational table with FORCE ROW LEVEL SECURITY.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "obligation_module_preferences" (
	"workspace_subdomain" text PRIMARY KEY NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "obligation_module_preferences" ADD CONSTRAINT "obligation_module_preferences_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "obligation_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obligation_module_preferences" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation_policy" ON "obligation_module_preferences";
--> statement-breakpoint

CREATE POLICY "tenant_isolation_policy" ON "obligation_module_preferences"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR (
      "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), '')
    )
  );
