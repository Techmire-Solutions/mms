-- 0227_hasanat_session_attribution.sql
-- Forward-only. Gives a Hasanat distribution an explicit academic-session link.
--
-- Why
-- ---
-- `hasanat_distributions` only carried `class_id` (nullable, backfilled by name match in 0171) and
-- no session: the session comparison report joined distributions to students **only**, so a
-- student enrolled in N sessions contributed their lifetime points to each of them.
--
-- What
-- ----
--   1. `session_id` column + composite FK to `sessions` (RESTRICT, NOT VALID then validated).
--   2. A BEFORE trigger stamps `session_id` from `class_id` on write, so new rows are attributed
--      without an application round-trip.
--   3. Backfill in two deterministic passes: (a) from `class_id`; (b) from the **single** session
--      whose date range contains `issued_date` and that the student was enrolled in. Rows that
--      remain NULL are genuinely unattributable — they stay NULL and are reported as
--      "unattributed" rather than being guessed into a session.
--
-- Behaviour change: per-session comparison excludes unattributed rows instead of double-counting
-- lifetime points into every session. Tenant-wide totals are unchanged.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "session_id" text;
--> statement-breakpoint

CREATE OR REPLACE FUNCTION hasanat_stamp_session_from_class()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.session_id IS NULL AND NEW.class_id IS NOT NULL THEN
    SELECT sc.session_id INTO NEW.session_id
      FROM session_classes sc
     WHERE sc.workspace_subdomain = NEW.workspace_subdomain
       AND sc.id = NEW.class_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_hasanat_distributions_stamp_session ON "hasanat_distributions";
CREATE TRIGGER trg_hasanat_distributions_stamp_session
  BEFORE INSERT OR UPDATE OF class_id, session_id ON "hasanat_distributions"
  FOR EACH ROW EXECUTE FUNCTION hasanat_stamp_session_from_class();
--> statement-breakpoint

-- Backfill (a): the card's class already knows its session.
UPDATE "hasanat_distributions" d
   SET "session_id" = sc."session_id"
  FROM "session_classes" sc
 WHERE d."workspace_subdomain" = sc."workspace_subdomain"
   AND d."class_id" = sc."id"
   AND d."session_id" IS NULL;
--> statement-breakpoint

-- Backfill (b): exactly one enrolled session whose date range contains the issue date.
WITH candidates AS (
  SELECT d."workspace_subdomain" AS ws, d."id" AS did, min(s."id") AS sid
    FROM "hasanat_distributions" d
    JOIN "enrollments" e
      ON e."workspace_subdomain" = d."workspace_subdomain"
     AND e."student_id" = d."recipient_student_id"
     AND e."deleted_at" IS NULL
     AND lower(btrim(e."status")) <> 'cancelled'
    JOIN "sessions" s
      ON s."workspace_subdomain" = e."workspace_subdomain"
     AND s."id" = e."session_id"
     AND s."deleted_at" IS NULL
     AND (s."start_date" IS NULL OR d."issued_date" >= s."start_date")
     AND (s."end_date" IS NULL OR d."issued_date" <= s."end_date")
   WHERE d."session_id" IS NULL
     AND d."recipient_student_id" IS NOT NULL
   GROUP BY d."workspace_subdomain", d."id"
  HAVING count(DISTINCT s."id") = 1
)
UPDATE "hasanat_distributions" d
   SET "session_id" = c."sid"
  FROM candidates c
 WHERE d."workspace_subdomain" = c."ws"
   AND d."id" = c."did";
--> statement-breakpoint

DO $$
DECLARE
  v_unattributed integer;
BEGIN
  SELECT count(*) INTO v_unattributed
    FROM hasanat_distributions
   WHERE session_id IS NULL AND deleted_at IS NULL;

  IF v_unattributed > 0 THEN
    RAISE NOTICE '0227: % active hasanat distribution(s) could not be attributed to a session; they are excluded from per-session comparison', v_unattributed;
  END IF;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_distributions_session_fk"
    FOREIGN KEY ("workspace_subdomain", "session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id")
    ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  ALTER TABLE "hasanat_distributions" VALIDATE CONSTRAINT "hasanat_distributions_session_fk";
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE '0227: hasanat_distributions has dangling session_id values; constraint left NOT VALID';
END $$;
