-- MMS Forward-only Migration: 0197_backend_review_hardening
-- Hardening from the 2026-10-29 backend review (F2, F6, F26, F27, F32).
--   • crypto_shredding_keys / audit_erasure_requests — tenant scoping + FORCE RLS.
--     Legacy rows (written before subject encryption had any call site) stay NULL and
--     are therefore invisible to tenant traffic; no destructive backfill.
--   • audit_verification_runs — anchor columns so a run can resume from its predecessor
--     and survive a detached monthly partition without reporting a false BROKEN_CHAIN.
--   • audit_merkle_roots — per-shard head map so a tenant can read only its own head.
--   • pg_trgm extension only; the expression indexes are built out of band
--     (scripts/sql/0197_search_indexes_concurrent.sql) to avoid a write lock.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- 1. Tenant scope for subject keys and erasure requests -----------------------
ALTER TABLE "crypto_shredding_keys"
  ADD COLUMN IF NOT EXISTS "workspace_subdomain" text
  REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE;

ALTER TABLE "audit_erasure_requests"
  ADD COLUMN IF NOT EXISTS "workspace_subdomain" text
  REFERENCES "workspaces" ("subdomain") ON DELETE CASCADE;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "crypto_shredding_keys_ws_subject_status_idx"
  ON "crypto_shredding_keys" ("workspace_subdomain", "subject_id", "status");
CREATE INDEX IF NOT EXISTS "audit_erasure_requests_ws_subject_time_idx"
  ON "audit_erasure_requests" ("workspace_subdomain", "subject_id", "requested_at" DESC);
--> statement-breakpoint

ALTER TABLE "crypto_shredding_keys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "crypto_shredding_keys" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "crypto_shredding_keys";
CREATE POLICY tenant_isolation_policy ON "crypto_shredding_keys" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "audit_erasure_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_erasure_requests" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "audit_erasure_requests";
CREATE POLICY tenant_isolation_policy ON "audit_erasure_requests" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);
--> statement-breakpoint

-- 2. Verification anchoring ---------------------------------------------------
ALTER TABLE "audit_trail_events"
  ALTER COLUMN "verification_status" SET DEFAULT 'PENDING';

ALTER TABLE "audit_verification_runs"
  ADD COLUMN IF NOT EXISTS "from_id" bigint,
  ADD COLUMN IF NOT EXISTS "from_timestamp" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "from_hash" varchar(64),
  ADD COLUMN IF NOT EXISTS "to_id" bigint,
  ADD COLUMN IF NOT EXISTS "to_timestamp" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "to_hash" varchar(64),
  ADD COLUMN IF NOT EXISTS "anchored" boolean NOT NULL DEFAULT true;
--> statement-breakpoint

ALTER TABLE "audit_merkle_roots"
  ADD COLUMN IF NOT EXISTS "heads" jsonb NOT NULL DEFAULT '{}'::jsonb;
--> statement-breakpoint

-- 3. Trigram indexes ----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
