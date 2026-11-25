-- MMS Forward-only Migration: 0223_attendance_notification_idempotency.sql
-- Exactly-once in-app notifications (docs/attendance-workers-queues-audit-2026-11-09.md):
-- `tenant_notifications` gains an optional producer-supplied dedupe key. The absence scan inserts a
-- notification *then* stamps `attendance_absence_alerts.notified_at`, so a crash in between (or a
-- concurrent manual + scheduled scan) produced a duplicate row. A partial unique index makes the
-- second insert a no-op instead.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by the
-- 0216/0217 snapshot-chain collision.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "tenant_notifications" ADD COLUMN IF NOT EXISTS "dedupe_key" varchar(120);
--> statement-breakpoint

-- Partial index: rows without a key (every existing producer) are unaffected and stay repeatable.
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_notifications_workspace_dedupe_uidx"
  ON "tenant_notifications" ("workspace_subdomain", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
