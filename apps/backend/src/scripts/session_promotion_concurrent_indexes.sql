-- MMS session promotion (migration 0177): one promoted enrollment per source enrollment and target
-- session, so a re-run of the same rollover cannot duplicate students. Run outside a transaction:
--   pnpm --filter mms-backend index:concurrent --file src/scripts/session_promotion_concurrent_indexes.sql
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "enrollments_session_promoted_from_uidx" ON "enrollments" ("workspace_subdomain", "session_id", "promoted_from_enrollment_id") WHERE "promoted_from_enrollment_id" IS NOT NULL AND "deleted_at" IS NULL;
