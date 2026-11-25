-- 0127_accounting_entries_ref_unique.sql
-- Disambiguate pre-existing duplicate active reference numbers before creating the unique index
DO $$
DECLARE
  dup_record RECORD;
  new_ref TEXT;
  counter INT;
BEGIN
  FOR dup_record IN
    SELECT "workspace_subdomain", "id", "ref"
    FROM (
      SELECT
        "workspace_subdomain",
        "id",
        "ref",
        ROW_NUMBER() OVER (
          PARTITION BY "workspace_subdomain", "ref"
          ORDER BY "created_at" ASC, "id" ASC
        ) AS rn
      FROM "accounting_entries"
      WHERE "deleted_at" IS NULL
        AND "ref" IS NOT NULL
        AND "ref" <> ''
    ) sub
    WHERE sub.rn > 1
  LOOP
    counter := 1;
    LOOP
      new_ref := SUBSTRING(dup_record."ref", 1, 80) || '-dup-' || counter;
      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "accounting_entries"
        WHERE "workspace_subdomain" = dup_record."workspace_subdomain"
          AND "ref" = new_ref
          AND "deleted_at" IS NULL
      );
      counter := counter + 1;
    END LOOP;

    UPDATE "accounting_entries"
    SET "ref" = new_ref
    WHERE "workspace_subdomain" = dup_record."workspace_subdomain"
      AND "id" = dup_record."id";
  END LOOP;
END $$;

-- Enforce unique reference numbers for active journal entries per workspace
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_entries_workspace_ref_active_uidx" ON "accounting_entries" USING btree ("workspace_subdomain", "ref") WHERE "deleted_at" IS NULL AND "ref" IS NOT NULL AND "ref" <> '';
