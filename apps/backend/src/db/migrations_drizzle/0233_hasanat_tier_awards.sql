-- 0233_hasanat_tier_awards.sql
-- Forward-only. Adds the materialized tier/badge award ledger.
--
-- Why
-- ---
--   * The module had no progression concept at all. Tiers are now derived from a student's current
--     lifetime earned points (`points_snapshot`, non-deleted), while this table records the awards
--     as evidence: an award is inserted once per (student, tier) and **revoked**, never deleted,
--     when a retroactive adjustment drops the student below its threshold.
--   * The partial unique index allows a tier to be re-earned after a revocation while preventing
--     duplicate live awards.
--   * Tier status is recomputed inside the transaction of every mutation that changes lifetime
--     earned points (issuance, batch award, soft-delete, restore); the admin reconcile endpoint
--     backfills existing students.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "hasanat_student_awards" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "student_id" varchar(64) NOT NULL,
  "tier_key" varchar(32) NOT NULL,
  "tier_name" varchar(60) NOT NULL DEFAULT '',
  "kind" varchar(16) NOT NULL DEFAULT 'tier',
  "earned_snapshot" integer NOT NULL DEFAULT 0,
  "awarded_at" timestamp with time zone NOT NULL DEFAULT now(),
  "revoked_at" timestamp with time zone,
  "revoked_reason" varchar(120),
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "hasanat_student_awards_workspace_subdomain_id_pk" PRIMARY KEY ("workspace_subdomain", "id")
);
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "hasanat_student_awards" ADD CONSTRAINT "hasanat_student_awards_workspace_subdomain_workspaces_subdomain_fk"
    FOREIGN KEY ("workspace_subdomain") REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_student_awards" ADD CONSTRAINT "hasanat_student_awards_student_fk"
    FOREIGN KEY ("workspace_subdomain", "student_id") REFERENCES "students" ("workspace_subdomain", "id")
    ON DELETE RESTRICT;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hasanat_award_ws_student_idx"
  ON "hasanat_student_awards" ("workspace_subdomain", "student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_award_ws_tier_awarded_idx"
  ON "hasanat_student_awards" ("workspace_subdomain", "tier_key", "awarded_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hasanat_award_ws_student_tier_uidx"
  ON "hasanat_student_awards" ("workspace_subdomain", "student_id", "tier_key")
  WHERE "revoked_at" IS NULL;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "hasanat_student_awards" ADD CONSTRAINT "hasanat_award_kind_chk"
    CHECK (kind IN ('tier', 'badge')) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_student_awards" ADD CONSTRAINT "hasanat_award_earned_chk"
    CHECK (earned_snapshot >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "hasanat_student_awards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_student_awards" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "hasanat_student_awards";
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "hasanat_student_awards";
CREATE POLICY "tenant_isolation_policy" ON "hasanat_student_awards"
  FOR ALL
  USING (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  )
  WITH CHECK (
    current_setting('app.rls_bypass', true) = 'on'
    OR workspace_subdomain = current_setting('app.current_tenant', true)
  );
--> statement-breakpoint

-- Awards are evidence: no hard delete, ever (purge still sets `app.allow_hard_purge`).
DROP TRIGGER IF EXISTS trg_hasanat_student_awards_forbid_hard_delete ON "hasanat_student_awards";
CREATE TRIGGER trg_hasanat_student_awards_forbid_hard_delete
  BEFORE DELETE ON "hasanat_student_awards"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
--> statement-breakpoint

DROP TRIGGER IF EXISTS update_hasanat_student_awards_updated_at ON "hasanat_student_awards";
CREATE TRIGGER update_hasanat_student_awards_updated_at
BEFORE UPDATE ON "hasanat_student_awards"
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "hasanat_student_awards" VALIDATE CONSTRAINT "hasanat_award_kind_chk";
  ALTER TABLE "hasanat_student_awards" VALIDATE CONSTRAINT "hasanat_award_earned_chk";
EXCEPTION WHEN check_violation THEN
  RAISE NOTICE '0233: award constraint left NOT VALID (new rows are still enforced)';
END $$;
