-- MMS Forward-only Migration: 0204_contact_attachments_legacy_columns.sql
-- 0056 created contact_attachments with legacy `mime_type`/`uploaded_at` columns,
-- one of which (`uploaded_at`) was NOT NULL. 0059 copied them into `type`/`date`
-- but never removed the legacy columns, so Drizzle inserts (which only write the
-- current column set) failed every attachment save with a NOT NULL violation and
-- surfaced as a 500 from PUT /api/contacts/:id.
--
-- Backfill any remaining legacy value into the canonical column, then drop the
-- unused columns. Idempotent: safe on databases where the columns are already gone.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contact_attachments'
      AND column_name = 'uploaded_at'
  ) THEN
    EXECUTE $sql$
      UPDATE "contact_attachments"
      SET "date" = left("uploaded_at", 10)::date
      WHERE "date" IS NULL
        AND "uploaded_at" IS NOT NULL
        AND "uploaded_at" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contact_attachments'
      AND column_name = 'mime_type'
  ) THEN
    EXECUTE $sql$
      UPDATE "contact_attachments"
      SET "type" = "mime_type"
      WHERE "type" IS NULL
        AND "mime_type" IS NOT NULL
    $sql$;
  END IF;
END $$;
--> statement-breakpoint

ALTER TABLE "contact_attachments" DROP COLUMN IF EXISTS "uploaded_at";
--> statement-breakpoint

ALTER TABLE "contact_attachments" DROP COLUMN IF EXISTS "mime_type";
