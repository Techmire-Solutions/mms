-- MMS Forward-only Migration: 0211_drop_session_classes_enrolled.sql
-- `session_classes.enrolled` was a denormalised seat counter (0054/0110) written as 0 on
-- insert and never maintained. Every read — session hydrate, sections, reports, lists —
-- counts live seat-holding enrollments instead, so the column only invited a future
-- writer to trust a permanently-zero "atomic counter". Seat capacity is enforced with
-- section row locks in the enrollment write path, not with a stored counter.
--
-- Contract step: the Drizzle schema no longer declares the column and the class upsert no
-- longer writes it, so nothing reads or writes it any more.
--
-- Hand-authored migration (documented exception, mms-schema-migrate §2):
-- `drizzle-kit generate` aborts on the malformed meta/0000 snapshot. meta/0211_..._snapshot.json
-- is 0210's snapshot with the `session_classes.enrolled` column removed.
SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "session_classes" DROP COLUMN IF EXISTS "enrolled";
--> statement-breakpoint
