-- Migration 0063: Contact Educations 3NF Table
-- Creates dedicated contact_educations table with tenant isolation and indexes

CREATE TABLE IF NOT EXISTS "contact_educations" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "contact_id" text NOT NULL,
  "degree" varchar(150),
  "institution" varchar(255) NOT NULL,
  "field_of_study" varchar(255),
  "year" varchar(50),
  "grade" varchar(50),
  "label" varchar(100),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "contact_id", "id")
);

CREATE INDEX IF NOT EXISTS "contact_educations_workspace_contact_idx"
  ON "contact_educations"("workspace_subdomain", "contact_id");

ALTER TABLE "contact_educations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_educations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_educations_tenant_isolation" ON "contact_educations";
CREATE POLICY "contact_educations_tenant_isolation" ON "contact_educations"
  FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));
