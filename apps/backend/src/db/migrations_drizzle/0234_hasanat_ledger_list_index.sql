-- 0234_hasanat_ledger_list_index.sql
-- Forward-only. Serves the paginated ledger history (`GET /api/hasanat/redemptions`).
--
-- Why
-- ---
-- The ledger list now pages newest-first (`ORDER BY created_at DESC`) instead of returning up to
-- 10 000 rows. The existing indexes cover `(distribution_id, created_at)` and `date`, neither of
-- which can serve a tenant-wide newest-first scan, so every page would sort the whole tenant.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "hasanat_redemp_ws_created_idx"
  ON "hasanat_redemptions" ("workspace_subdomain", "created_at" DESC);
