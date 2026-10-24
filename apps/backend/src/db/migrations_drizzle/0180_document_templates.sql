-- MMS Forward-only Migration: 0176_document_templates.sql
-- Document Templates relational table with FORCE ROW LEVEL SECURITY.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "document_templates" (
	"workspace_subdomain" text NOT NULL,
	"key" varchar(128) NOT NULL,
	"template" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_templates_workspace_subdomain_key_pk" PRIMARY KEY("workspace_subdomain","key")
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "document_templates_workspace_key_idx" ON "document_templates" ("workspace_subdomain","key");
--> statement-breakpoint

DO $$ BEGIN
 ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

ALTER TABLE "document_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_templates" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

DROP POLICY IF EXISTS "tenant_isolation_policy" ON "document_templates";
--> statement-breakpoint

CREATE POLICY "tenant_isolation_policy" ON "document_templates"
  FOR ALL
  USING (
    workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    workspace_subdomain = current_setting('app.current_tenant', true)
  );
