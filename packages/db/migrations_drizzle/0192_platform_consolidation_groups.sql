-- Migration 0192: platform consolidation groups (IAS 21 translation, IFRS 10).
-- Platform-owned configuration: no workspace_subdomain column and no tenant RLS
-- policy; members reference workspaces through member_subdomain and access is
-- gated by platform permissions (authenticatePlatform + requirePlatformPermission).

CREATE TABLE IF NOT EXISTS "consolidation_groups" (
  "id" text PRIMARY KEY,
  "name" varchar(120) NOT NULL,
  "presentation_currency" varchar(3) NOT NULL,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text,
  CONSTRAINT "consolidation_groups_presentation_iso" CHECK ("presentation_currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE IF NOT EXISTS "consolidation_group_members" (
  "group_id" text NOT NULL REFERENCES "consolidation_groups"("id") ON DELETE CASCADE,
  "member_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "ownership_percent" numeric(7, 4) NOT NULL,
  "is_parent" boolean NOT NULL DEFAULT false,
  "closing_rate" numeric(20, 10),
  "average_rate" numeric(20, 10),
  "historical_rate" numeric(20, 10),
  PRIMARY KEY ("group_id", "member_subdomain"),
  CONSTRAINT "consolidation_group_members_ownership" CHECK ("ownership_percent" >= 0 AND "ownership_percent" <= 100)
);

CREATE INDEX IF NOT EXISTS "consolidation_group_members_member_idx"
  ON "consolidation_group_members" ("member_subdomain");

CREATE TABLE IF NOT EXISTS "consolidation_intercompany_accounts" (
  "group_id" text NOT NULL REFERENCES "consolidation_groups"("id") ON DELETE CASCADE,
  "account_code" varchar(50) NOT NULL,
  PRIMARY KEY ("group_id", "account_code")
);
