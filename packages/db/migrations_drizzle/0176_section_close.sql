-- MMS Forward-only Migration: 0176_section_close.sql
-- Phase 9d — Sections are closed on a date (merge / close), never deleted, so history keeps them.
--   session_class_sections.closed_on / closed_reason — set together with status = 'closed'.
-- Nullable columns without defaults are metadata-only; no backfill (existing closed sections keep a
-- null date).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint
ALTER TABLE "session_class_sections" ADD COLUMN IF NOT EXISTS "closed_on" date;
--> statement-breakpoint
ALTER TABLE "session_class_sections" ADD COLUMN IF NOT EXISTS "closed_reason" varchar(500);
