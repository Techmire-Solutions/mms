-- Out-of-band trigram index for the Question Bank search box (migration 0240).
-- Run once after deploying 0240, with:
--   pnpm --filter mms-backend index:concurrent -- --file scripts/sql/0240_question_bank_indexes_concurrent.sql
--
-- `questionRepositoryList` searches with `"text" ILIKE '%term%'`, which no B-tree can serve. A plain
-- CREATE INDEX on "questions" blocks writes for the whole build, and `CONCURRENTLY` cannot be
-- expressed inside a Drizzle migration (the migrator wraps each run in one transaction), so the index
-- lives here. It is intentionally absent from the Drizzle snapshot chain, like the 0197/0228 trgm
-- indexes; pg_trgm is already installed by 0197.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "questions_text_trgm_idx" ON "questions" USING gin (
  "text" gin_trgm_ops
);
