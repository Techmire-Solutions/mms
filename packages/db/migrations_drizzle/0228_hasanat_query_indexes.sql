-- 0228_hasanat_query_indexes.sql
-- Forward-only. Serves the four hot Hasanat read paths and removes the superseded indexes.
--
-- Why
-- ---
--   * The Work list sorts by `updated_at DESC` by default (hasanatRepositoryList.ts) while the only
--     sortable index was `(workspace_subdomain, issued_date)` — every page needed a full tenant
--     scan plus an external sort.
--   * Balance/history and the session comparison filter by student (and session/status) with
--     `deleted_at IS NULL`; the existing indexes were single-purpose `(tenant, column)` pairs, so
--     PostgreSQL could not descend on the full predicate.
--   * Ledger history for a card is read newest-first but had no `created_at` component.
--   * The free-text search is `ILIKE '%…%'` on three columns with no trigram index.
--
-- Sizing: each hasanat table holds at most ~2.4k rows per tenant (0184 header) and is not in the
-- `LARGE_TABLES` ratchet, so a plain (write-blocking for milliseconds) build is acceptable here.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- Work list: default sort and status-filtered sort over live rows -----------------
CREATE INDEX IF NOT EXISTS "hasanat_dist_ws_updated_active_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "updated_at" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_dist_ws_status_updated_active_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "status", "updated_at" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

-- Balance aggregation and per-student history -----------------------------------
CREATE INDEX IF NOT EXISTS "hasanat_dist_ws_student_session_status_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "recipient_student_id", "session_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_dist_ws_student_issued_active_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "recipient_student_id", "issued_date" DESC)
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_dist_ws_session_student_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "session_id", "recipient_student_id");
--> statement-breakpoint

-- Ledger history for one card: (tenant, card_id, created_at) ---------------------
CREATE INDEX IF NOT EXISTS "hasanat_redemp_ws_dist_created_idx"
  ON "hasanat_redemptions" ("workspace_subdomain", "distribution_id", "created_at" DESC);
--> statement-breakpoint

-- Actor attribution indexes were added out of band in 0090 without a schema declaration; restate
-- them here so a fresh database and the Drizzle snapshot agree.
CREATE INDEX IF NOT EXISTS "hasanat_batches_workspace_added_by_idx"
  ON "hasanat_batches" ("workspace_subdomain", "added_by_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_dist_workspace_issued_by_idx"
  ON "hasanat_distributions" ("workspace_subdomain", "issued_by_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_redemp_workspace_approved_by_idx"
  ON "hasanat_redemptions" ("workspace_subdomain", "approved_by_user_id");
--> statement-breakpoint

-- Free-text search (recipient / denomination) ------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_dist_recipient_name_trgm_idx"
  ON "hasanat_distributions" USING gin ("recipient_name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_dist_denom_name_trgm_idx"
  ON "hasanat_distributions" USING gin ("denomination_name" gin_trgm_ops);
--> statement-breakpoint

-- Superseded single-purpose indexes ---------------------------------------------
-- Each is a strict prefix of one of the indexes above; keeping them only pays write cost.
DROP INDEX IF EXISTS "hasanat_dist_workspace_student_idx";
DROP INDEX IF EXISTS "hasanat_dist_workspace_status_idx";
DROP INDEX IF EXISTS "hasanat_dist_workspace_active_idx";
DROP INDEX IF EXISTS "hasanat_redemp_workspace_dist_idx";
