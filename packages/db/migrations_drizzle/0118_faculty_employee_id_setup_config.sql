-- MMS Forward-only Migration: 0118_faculty_employee_id_setup_config.sql
-- Table faculty_setup_config for deterministic, concurrency-safe employee ID generation.

CREATE TABLE IF NOT EXISTS "faculty_setup_config" (
	"workspace_subdomain" text NOT NULL,
	"prefix" varchar(20) DEFAULT 'FAC' NOT NULL,
	"year_format" varchar(10) DEFAULT 'YYYY' NOT NULL,
	"sequence_digits" integer DEFAULT 4 NOT NULL,
	"delimiter" varchar(5) DEFAULT '' NOT NULL,
	"current_sequence" integer DEFAULT 0 NOT NULL,
	"last_year" integer DEFAULT 2026 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "faculty_setup_config_workspace_subdomain_pk" PRIMARY KEY("workspace_subdomain")
);
--> statement-breakpoint
ALTER TABLE "faculty_setup_config" ADD CONSTRAINT "faculty_setup_config_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "faculty_setup_config" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "faculty_setup_config" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "faculty_setup_config";
--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "faculty_setup_config" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);
--> statement-breakpoint
CREATE OR REPLACE VIEW teacher_setup_config AS SELECT * FROM faculty_setup_config;
