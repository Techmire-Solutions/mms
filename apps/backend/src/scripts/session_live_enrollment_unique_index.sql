-- Out-of-band ops migration (run with `pnpm --filter mms-backend index:concurrent --file ...` or psql):
-- database backstop against duplicate live (student, session) enrollments created by a rollover
-- retry or a double-submitted enrollment. It is NOT in the forward migration because a blocking
-- CREATE INDEX on `enrollments` is unacceptable once populated.
--
-- Canonical provisioner: the app creates it CONCURRENTLY at boot
-- (src/db/migrations/enrollmentIntegrityIndexes.ts, called from applyDrizzleMigrations), with the
-- duplicate pre-flight below. This file is the manual fallback for repairing a database whose
-- boot build was skipped because duplicates existed — fix the rows, then run this or restart.
--
-- Pre-flight: this must return 0 rows. When it returns duplicates, resolve them first (they are
-- legacy data, listed with their ids) and only then run the CREATE INDEX below.
SELECT workspace_subdomain, session_id, student_id, array_agg(id ORDER BY id) AS enrollment_ids
  FROM enrollments
 WHERE deleted_at IS NULL
   AND status NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left')
 GROUP BY workspace_subdomain, session_id, student_id
HAVING count(*) > 1;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "enrollments_live_student_session_uidx"
  ON "enrollments" ("workspace_subdomain", "session_id", "student_id")
  WHERE "deleted_at" IS NULL
    AND "status" NOT IN ('cancelled', 'withdrawn', 'promoted', 'retained', 'graduated', 'left');
