-- MMS Forward-only Migration: 0208_background_job_dead_letters.sql
-- Durable dead-letter marker for background jobs that exhausted all BullMQ retries. The payload
-- stays on the row, so the ops replay script can re-enqueue the exact same request.
SET LOCAL lock_timeout = '2s';
--> statement-breakpoint
ALTER TABLE "background_jobs" ADD COLUMN IF NOT EXISTS "dead_lettered_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "background_jobs_dead_letter_idx"
  ON "background_jobs" ("dead_lettered_at")
  WHERE "dead_lettered_at" IS NOT NULL;
