-- Migration 0064: Contact Experiences 3NF Table
-- Creates dedicated contact_experiences table with tenant isolation and indexes

CREATE TABLE IF NOT EXISTS "contact_experiences" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "contact_id" text NOT NULL,
  "title" varchar(255) NOT NULL,
  "organization" varchar(255) NOT NULL,
  "employment_type" varchar(100),
  "location" varchar(255),
  "start_date" varchar(50),
  "end_date" varchar(50),
  "is_current" boolean NOT NULL DEFAULT false,
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "contact_id", "id")
);

CREATE INDEX IF NOT EXISTS "contact_experiences_workspace_contact_idx"
  ON "contact_experiences"("workspace_subdomain", "contact_id");

ALTER TABLE "contact_experiences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_experiences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_experiences_tenant_isolation" ON "contact_experiences";
CREATE POLICY "contact_experiences_tenant_isolation" ON "contact_experiences"
  FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));
