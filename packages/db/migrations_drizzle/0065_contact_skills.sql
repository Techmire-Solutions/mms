-- Migration 0065: Contact Skills 3NF Table
-- Creates dedicated contact_skills table with tenant isolation and indexes

CREATE TABLE IF NOT EXISTS "contact_skills" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "contact_id" text NOT NULL,
  "name" varchar(255) NOT NULL,
  "category" varchar(100),
  "proficiency" varchar(50),
  "years_of_experience" varchar(50),
  "is_certified" boolean NOT NULL DEFAULT false,
  "issuer" varchar(255),
  "description" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "contact_id", "id")
);

CREATE INDEX IF NOT EXISTS "contact_skills_workspace_contact_idx"
  ON "contact_skills"("workspace_subdomain", "contact_id");

ALTER TABLE "contact_skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_skills" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_skills_tenant_isolation" ON "contact_skills";
CREATE POLICY "contact_skills_tenant_isolation" ON "contact_skills"
  FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));
