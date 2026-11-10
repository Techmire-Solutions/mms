-- 0226_hasanat_ledger_and_person_fks.sql
-- Forward-only. Repairs the person foreign keys and turns `hasanat_redemptions` into a guarded
-- append-only ledger.
--
-- Why
-- ---
--   1. The student/faculty FKs were declared `ON DELETE SET NULL` over the **composite**
--      `(workspace_subdomain, recipient_*_id)`. PostgreSQL's plain form nulls *every* referencing
--      column, including the NOT NULL `workspace_subdomain`, so a hard delete of a student or
--      faculty member aborted with 23502. The PostgreSQL 15+ column-list form
--      (`SET NULL (recipient_student_id)`) nulls only the person column.
--   2. `hasanat_redemptions` had no student link at all (only a `student_name` snapshot) and no
--      uniqueness, so two concurrent redemptions of the same card both succeeded (double spend).
--      A per-card advisory lock + existence check in a BEFORE INSERT trigger closes the race, and
--      a unique index is created where the legacy data is already clean.
--   3. Ledger rows could be hard-deleted with no trace; they now carry the same
--      `forbid_hard_delete` guard as the rest of the soft-delete system (purge still sets
--      `app.allow_hard_purge`).

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- 1. Person FKs: null only the person column -----------------------------------
ALTER TABLE "hasanat_distributions" DROP CONSTRAINT IF EXISTS "hasanat_distributions_student_fk";
ALTER TABLE "hasanat_distributions" DROP CONSTRAINT IF EXISTS "hasanat_distributions_teacher_fk";
ALTER TABLE "hasanat_distributions" DROP CONSTRAINT IF EXISTS "hasanat_distributions_workspace_subdomain_recipient_student_id_students_workspace_subdomain_id_fk";
ALTER TABLE "hasanat_distributions" DROP CONSTRAINT IF EXISTS "hasanat_distributions_workspace_subdomain_recipient_faculty_id_faculty_workspace_subdomain_id_fk";
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_distributions_workspace_subdomain_recipient_student_id_students_workspace_subdomain_id_fk"
    FOREIGN KEY ("workspace_subdomain", "recipient_student_id")
    REFERENCES "students" ("workspace_subdomain", "id")
    ON DELETE SET NULL ("recipient_student_id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_distributions_workspace_subdomain_recipient_faculty_id_faculty_workspace_subdomain_id_fk"
    FOREIGN KEY ("workspace_subdomain", "recipient_faculty_id")
    REFERENCES "faculty" ("workspace_subdomain", "id")
    ON DELETE SET NULL ("recipient_faculty_id") NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "hasanat_distributions" VALIDATE CONSTRAINT "hasanat_distributions_workspace_subdomain_recipient_student_id_students_workspace_subdomain_id_fk";
ALTER TABLE "hasanat_distributions" VALIDATE CONSTRAINT "hasanat_distributions_workspace_subdomain_recipient_faculty_id_faculty_workspace_subdomain_id_fk";
--> statement-breakpoint

-- 2. Ledger student link -------------------------------------------------------
ALTER TABLE "hasanat_redemptions" ADD COLUMN IF NOT EXISTS "student_id" varchar(64);
--> statement-breakpoint

UPDATE "hasanat_redemptions" r
   SET "student_id" = d."recipient_student_id",
       "student_name" = CASE
         WHEN COALESCE(btrim(r."student_name"), '') = '' THEN d."recipient_name"
         ELSE r."student_name"
       END
  FROM "hasanat_distributions" d
 WHERE r."workspace_subdomain" = d."workspace_subdomain"
   AND r."distribution_id" = d."id"
   AND r."student_id" IS NULL
   AND d."recipient_student_id" IS NOT NULL;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "hasanat_redemptions" ADD CONSTRAINT "hasanat_redemptions_student_fk"
    FOREIGN KEY ("workspace_subdomain", "student_id")
    REFERENCES "students" ("workspace_subdomain", "id")
    ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "hasanat_redemptions" VALIDATE CONSTRAINT "hasanat_redemptions_student_fk";
EXCEPTION WHEN foreign_key_violation THEN
  RAISE NOTICE '0226: hasanat_redemptions has dangling student_id values; constraint left NOT VALID';
END $$;
--> statement-breakpoint

-- 3. One redemption per card ---------------------------------------------------
CREATE OR REPLACE FUNCTION hasanat_redemption_guard()
RETURNS TRIGGER AS $$
DECLARE
  v_card_exists boolean;
  v_duplicate boolean;
BEGIN
  -- Serialize on the card row: two concurrent inserts for the same distribution queue here, so
  -- the second one observes the first one's committed row.
  SELECT true INTO v_card_exists
    FROM hasanat_distributions
   WHERE workspace_subdomain = NEW.workspace_subdomain
     AND id = NEW.distribution_id
   FOR UPDATE;

  IF v_card_exists IS NOT TRUE THEN
    RAISE EXCEPTION 'Hasanat card % does not exist for workspace %', NEW.distribution_id, NEW.workspace_subdomain
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM hasanat_redemptions r
     WHERE r.workspace_subdomain = NEW.workspace_subdomain
       AND r.distribution_id = NEW.distribution_id
       AND r.id <> NEW.id
  ) INTO v_duplicate;

  IF v_duplicate THEN
    RAISE EXCEPTION 'Hasanat card % is already redeemed', NEW.distribution_id
      USING ERRCODE = 'unique_violation', CONSTRAINT = 'hasanat_redemp_ws_dist_uidx';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_hasanat_redemptions_guard ON "hasanat_redemptions";
CREATE TRIGGER trg_hasanat_redemptions_guard
  BEFORE INSERT OR UPDATE ON "hasanat_redemptions"
  FOR EACH ROW EXECUTE FUNCTION hasanat_redemption_guard();
--> statement-breakpoint

-- Unique index where the legacy data is already clean; the trigger protects new rows either way.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM hasanat_redemptions
     GROUP BY workspace_subdomain, distribution_id
    HAVING count(*) > 1
  ) THEN
    RAISE NOTICE '0226: duplicate redemptions exist; unique index skipped — reconcile them and re-run the index build (the trigger still blocks new duplicates)';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS "hasanat_redemp_ws_dist_uidx"
      ON "hasanat_redemptions" ("workspace_subdomain", "distribution_id");
  END IF;
END $$;
--> statement-breakpoint

-- 4. Append-only ledger guard --------------------------------------------------
DROP TRIGGER IF EXISTS trg_hasanat_redemptions_forbid_hard_delete ON "hasanat_redemptions";
CREATE TRIGGER trg_hasanat_redemptions_forbid_hard_delete
  BEFORE DELETE ON "hasanat_redemptions"
  FOR EACH ROW EXECUTE FUNCTION forbid_hard_delete();
