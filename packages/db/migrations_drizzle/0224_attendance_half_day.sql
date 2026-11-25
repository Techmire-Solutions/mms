-- MMS Forward-only Migration: 0224_attendance_half_day.sql
-- `half_day` becomes a first-class attendance status (docs/attendance-shared-contracts-audit-2026-11-10.md).
--
-- The shared enum, the matrix and the rate predicates all derive from ATTENDANCE_RECORD_STATUSES;
-- this widens the DB guard to match, so the value the API accepts is the value the database stores.
--
-- Lock-safe: the constraint is added NOT VALID (existing rows are not scanned under the lock) and
-- then validated. Every existing row holds one of the four old values, so validation is a formality;
-- if a legacy outlier exists, validation fails loudly instead of silently blocking future writes.
--
-- Hand-authored (reviewed exception, mms-schema-migrate §2): `drizzle-kit generate` is blocked by the
-- 0216/0217 snapshot-chain collision.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "attendance" DROP CONSTRAINT IF EXISTS "attendance_status_check";
--> statement-breakpoint

ALTER TABLE "attendance" ADD CONSTRAINT "attendance_status_check"
  CHECK ("status" IN ('present', 'absent', 'late', 'half_day', 'excused')) NOT VALID;
--> statement-breakpoint

ALTER TABLE "attendance" VALIDATE CONSTRAINT "attendance_status_check";
