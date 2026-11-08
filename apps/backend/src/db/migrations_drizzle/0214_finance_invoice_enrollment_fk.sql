-- MMS Forward-only Migration: 0214_finance_invoice_enrollment_fk.sql
-- `finance_invoices.enrollment_id` (migration 0094) was a bare column with a unique index
-- but no foreign key, so a hard purge could leave billing rows pointing at a nonexistent
-- enrollment. Add the link with a column-list SET NULL (PostgreSQL 15+) so clearing the
-- enrollment id never nulls the NOT NULL workspace key.
--
-- Pre-flight: dangling links are cleared first (they are already unusable). The constraint is
-- added NOT VALID and then validated; a validation failure warns instead of aborting the
-- migration (the app already stops creating new dangling rows because the FK is enforced for
-- new writes).
--
-- Drizzle schema note: the column-list SET NULL form is not expressible in schema.ts, so the
-- constraint is intentionally not declared there (migrations are hand-authored here).
SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

UPDATE "finance_invoices" fi
   SET "enrollment_id" = NULL
 WHERE fi."enrollment_id" IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "enrollments" e
      WHERE e."workspace_subdomain" = fi."workspace_subdomain"
        AND e."id" = fi."enrollment_id");
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'finance_invoices_enrollment_fk'
  ) THEN
    ALTER TABLE "finance_invoices"
      ADD CONSTRAINT "finance_invoices_enrollment_fk"
      FOREIGN KEY ("workspace_subdomain", "enrollment_id")
      REFERENCES "enrollments" ("workspace_subdomain", "id")
      ON DELETE SET NULL ("enrollment_id")
      NOT VALID;
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "finance_invoices" VALIDATE CONSTRAINT "finance_invoices_enrollment_fk";
EXCEPTION WHEN others THEN
  RAISE WARNING 'finance_invoices_enrollment_fk left NOT VALID: %', SQLERRM;
END $$;
--> statement-breakpoint
