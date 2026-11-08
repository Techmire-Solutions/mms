-- MMS Forward-only Migration: 0212_session_class_drop_deadline.sql
-- Adds the class-level drop deadline ("last day to withdraw"), the counterpart of the
-- existing enrollment_deadline (add deadline). Nullable/empty = no deadline; the
-- withdrawal path enforces it with an audited admin override.
SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "session_classes" ADD COLUMN IF NOT EXISTS "drop_deadline" date;
--> statement-breakpoint
