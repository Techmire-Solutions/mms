-- Migration 0106: Restore attribution columns + deletion_reason varchar cap
-- Per docs/soft-delete.md §2.1 Column Quintuple:
--   • deletion_reason MUST be varchar(500), not text
--   • restoredAt/restoredBy belong on person-module tables (contacts, students, teachers)

-- 1. Add restored_at / restored_by to person entity tables
ALTER TABLE "contacts"
  ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint

ALTER TABLE "students"
  ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint

ALTER TABLE "teachers"
  ADD COLUMN IF NOT EXISTS "restored_at" TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS "restored_by" TEXT;--> statement-breakpoint

-- 2. ALTER deletion_reason from TEXT → VARCHAR(500) on all soft-deletable tables
-- PostgreSQL text and varchar share the same storage; adding a length cap is safe.
ALTER TABLE "contacts"       ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "students"       ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "teachers"       ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "sessions"       ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "enrollments"    ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "finance_invoices"  ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "finance_payments"  ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "accounting_entries"      ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "accounting_accounts"     ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "accounting_fiscal_years" ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "obligation_collections" ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "hasanat_distributions"  ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "exams"      ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "questions"  ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "tests"      ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "assessment_results" ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "attendance"         ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
ALTER TABLE "message_logs"       ALTER COLUMN "deletion_reason" TYPE VARCHAR(500);--> statement-breakpoint
