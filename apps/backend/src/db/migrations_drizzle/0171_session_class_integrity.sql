-- MMS Forward-only Migration: 0171_session_class_integrity.sql
-- Phase 6 — Class / section reference integrity.
--   1. Unique (workspace, id) on session_classes and session_class_timetables so children can reference them.
--   2. Foreign keys from the seven class child tables and timetable periods (cascade, deferrable).
--   3. attendance.class_id → session_classes (restrict); legacy session-id values are rewritten to the
--      session's only class; attendance.section_id added (stamped on write, backfilled out of band).
--   4. exam_classes.class_id → session_classes (restrict).
--   5. Typed class / session / program ids on finance fee structures, hasanat distributions and
--      question-bank papers (text columns stay as display snapshots), backfilled by unique name match.
-- Every FK is added NOT VALID (enforced for new writes immediately) and validated only when no
-- orphan rows remain, so legacy data is never deleted here; `pnpm --filter mms-backend
-- audit:class-references` lists anything left. Indexes on attendance are built out of band:
-- src/scripts/class_integrity_concurrent_indexes.sql

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM session_classes GROUP BY workspace_subdomain, id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'session_classes has duplicate (workspace_subdomain, id) rows; run audit:class-references and resolve them first';
  END IF;
  IF EXISTS (SELECT 1 FROM session_class_timetables GROUP BY workspace_subdomain, id HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'session_class_timetables has duplicate (workspace_subdomain, id) rows; run audit:class-references and resolve them first';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_classes_ws_id_uidx" ON "session_classes" ("workspace_subdomain", "id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "session_class_timetables_ws_id_uidx" ON "session_class_timetables" ("workspace_subdomain", "id");
--> statement-breakpoint

-- ───────────────────────── class child tables ─────────────────────────
DO $$ BEGIN
  ALTER TABLE "session_class_fees" ADD CONSTRAINT "session_class_fees_class_fk" FOREIGN KEY ("workspace_subdomain", "session_class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_class_schedules" ADD CONSTRAINT "session_class_schedules_class_fk" FOREIGN KEY ("workspace_subdomain", "session_class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_class_budgets" ADD CONSTRAINT "session_class_budgets_class_fk" FOREIGN KEY ("workspace_subdomain", "session_class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_class_discounts" ADD CONSTRAINT "session_class_discounts_class_fk" FOREIGN KEY ("workspace_subdomain", "session_class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_class_timetables" ADD CONSTRAINT "session_class_timetables_class_fk" FOREIGN KEY ("workspace_subdomain", "session_class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_class_refreshments" ADD CONSTRAINT "session_class_refreshments_class_fk" FOREIGN KEY ("workspace_subdomain", "session_class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_class_scholarships" ADD CONSTRAINT "session_class_scholarships_class_fk" FOREIGN KEY ("workspace_subdomain", "session_class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "session_class_timetable_periods" ADD CONSTRAINT "session_class_timetable_periods_timetable_fk" FOREIGN KEY ("workspace_subdomain", "timetable_id")
    REFERENCES "session_class_timetables" ("workspace_subdomain", "id") ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ───────────────────────── attendance ─────────────────────────
-- Legacy rows stored the session id in class_id; point them at the session's only class
-- (skipping rows that would collide with an existing row for that student and day).
UPDATE "attendance" a
   SET "class_id" = c."id", "updated_at" = now()
  FROM "session_classes" c
 WHERE c."workspace_subdomain" = a."workspace_subdomain" AND c."session_id" = a."class_id"
   AND NOT EXISTS (SELECT 1 FROM "session_classes" x WHERE x."workspace_subdomain" = a."workspace_subdomain" AND x."id" = a."class_id")
   AND (SELECT count(*) FROM "session_classes" y WHERE y."workspace_subdomain" = a."workspace_subdomain" AND y."session_id" = a."class_id") = 1
   AND NOT EXISTS (SELECT 1 FROM "attendance" d WHERE d."workspace_subdomain" = a."workspace_subdomain" AND d."class_id" = c."id"
                    AND d."student_id" = a."student_id" AND d."date" = a."date" AND d."deleted_at" IS NULL);
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN IF NOT EXISTS "section_id" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "attendance" ADD CONSTRAINT "attendance_class_fk" FOREIGN KEY ("workspace_subdomain", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "attendance" ADD CONSTRAINT "attendance_section_fk" FOREIGN KEY ("workspace_subdomain", "section_id")
    REFERENCES "session_class_sections" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ───────────────────────── exam_classes ─────────────────────────
DO $$ BEGIN
  ALTER TABLE "exam_classes" ADD CONSTRAINT "exam_classes_class_fk" FOREIGN KEY ("workspace_subdomain", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- ───────────────────────── typed ids on other modules ─────────────────────────
ALTER TABLE "finance_fee_structures" ADD COLUMN IF NOT EXISTS "session_id" text;
ALTER TABLE "finance_fee_structures" ADD COLUMN IF NOT EXISTS "class_id" text;
ALTER TABLE "finance_fee_structures" ADD COLUMN IF NOT EXISTS "program_id" text;
ALTER TABLE "hasanat_distributions" ADD COLUMN IF NOT EXISTS "class_id" text;
ALTER TABLE "tests" ADD COLUMN IF NOT EXISTS "class_id" text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "finance_fee_structures" ADD CONSTRAINT "finance_fee_structures_session_fk" FOREIGN KEY ("workspace_subdomain", "session_id")
    REFERENCES "sessions" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "finance_fee_structures" ADD CONSTRAINT "finance_fee_structures_class_fk" FOREIGN KEY ("workspace_subdomain", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "finance_fee_structures" ADD CONSTRAINT "finance_fee_structures_program_fk" FOREIGN KEY ("workspace_subdomain", "program_id")
    REFERENCES "programs" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_distributions_class_fk" FOREIGN KEY ("workspace_subdomain", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tests" ADD CONSTRAINT "tests_class_fk" FOREIGN KEY ("workspace_subdomain", "class_id")
    REFERENCES "session_classes" ("workspace_subdomain", "id") ON DELETE RESTRICT NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_fee_structures_session_idx" ON "finance_fee_structures" ("workspace_subdomain", "session_id");
CREATE INDEX IF NOT EXISTS "finance_fee_structures_class_idx" ON "finance_fee_structures" ("workspace_subdomain", "class_id");
CREATE INDEX IF NOT EXISTS "finance_fee_structures_program_idx" ON "finance_fee_structures" ("workspace_subdomain", "program_id");
CREATE INDEX IF NOT EXISTS "hasanat_distributions_class_idx" ON "hasanat_distributions" ("workspace_subdomain", "class_id");
CREATE INDEX IF NOT EXISTS "tests_class_idx" ON "tests" ("workspace_subdomain", "class_id");
--> statement-breakpoint

-- Backfill by case-insensitive name, only where the match is unique (ambiguous rows keep text only).
WITH session_match AS (
  SELECT f."workspace_subdomain" AS ws, f."id" AS fid, min(s."id") AS sid
    FROM "finance_fee_structures" f
    JOIN "sessions" s ON s."workspace_subdomain" = f."workspace_subdomain" AND lower(btrim(s."name")) = lower(btrim(f."session"))
   WHERE f."session_id" IS NULL AND btrim(f."session") <> ''
   GROUP BY f."workspace_subdomain", f."id"
  HAVING count(*) = 1
)
UPDATE "finance_fee_structures" f SET "session_id" = m.sid
  FROM session_match m WHERE f."workspace_subdomain" = m.ws AND f."id" = m.fid;
--> statement-breakpoint
WITH class_match AS (
  SELECT f."workspace_subdomain" AS ws, f."id" AS fid, min(c."id") AS cid
    FROM "finance_fee_structures" f
    JOIN "session_classes" c ON c."workspace_subdomain" = f."workspace_subdomain" AND lower(btrim(c."name")) = lower(btrim(f."class_name"))
     AND (f."session_id" IS NULL OR c."session_id" = f."session_id")
   WHERE f."class_id" IS NULL AND btrim(f."class_name") <> ''
   GROUP BY f."workspace_subdomain", f."id"
  HAVING count(*) = 1
)
UPDATE "finance_fee_structures" f SET "class_id" = m.cid
  FROM class_match m WHERE f."workspace_subdomain" = m.ws AND f."id" = m.fid;
--> statement-breakpoint
UPDATE "finance_fee_structures" f
   SET "program_id" = COALESCE(c."program_id", s."program_id")
  FROM "session_classes" c
  JOIN "sessions" s ON s."workspace_subdomain" = c."workspace_subdomain" AND s."id" = c."session_id"
 WHERE f."program_id" IS NULL AND c."workspace_subdomain" = f."workspace_subdomain" AND c."id" = f."class_id";
--> statement-breakpoint
WITH class_match AS (
  SELECT d."workspace_subdomain" AS ws, d."id" AS did, min(c."id") AS cid
    FROM "hasanat_distributions" d
    JOIN "session_classes" c ON c."workspace_subdomain" = d."workspace_subdomain" AND lower(btrim(c."name")) = lower(btrim(d."recipient_class"))
   WHERE d."class_id" IS NULL AND btrim(d."recipient_class") <> ''
   GROUP BY d."workspace_subdomain", d."id"
  HAVING count(*) = 1
)
UPDATE "hasanat_distributions" d SET "class_id" = m.cid
  FROM class_match m WHERE d."workspace_subdomain" = m.ws AND d."id" = m.did;
--> statement-breakpoint
WITH class_match AS (
  SELECT p."workspace_subdomain" AS ws, p."id" AS pid, min(c."id") AS cid
    FROM "tests" p
    JOIN "session_classes" c ON c."workspace_subdomain" = p."workspace_subdomain" AND lower(btrim(c."name")) = lower(btrim(p."exam_class"))
   WHERE p."class_id" IS NULL AND btrim(COALESCE(p."exam_class", '')) <> ''
   GROUP BY p."workspace_subdomain", p."id"
  HAVING count(*) = 1
)
UPDATE "tests" p SET "class_id" = m.cid
  FROM class_match m WHERE p."workspace_subdomain" = m.ws AND p."id" = m.pid;
--> statement-breakpoint

-- ───────────────────────── validate where clean ─────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM session_class_fees t WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = t.workspace_subdomain AND c.id = t.session_class_id)) THEN
    ALTER TABLE "session_class_fees" VALIDATE CONSTRAINT "session_class_fees_class_fk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM session_class_schedules t WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = t.workspace_subdomain AND c.id = t.session_class_id)) THEN
    ALTER TABLE "session_class_schedules" VALIDATE CONSTRAINT "session_class_schedules_class_fk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM session_class_budgets t WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = t.workspace_subdomain AND c.id = t.session_class_id)) THEN
    ALTER TABLE "session_class_budgets" VALIDATE CONSTRAINT "session_class_budgets_class_fk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM session_class_discounts t WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = t.workspace_subdomain AND c.id = t.session_class_id)) THEN
    ALTER TABLE "session_class_discounts" VALIDATE CONSTRAINT "session_class_discounts_class_fk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM session_class_timetables t WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = t.workspace_subdomain AND c.id = t.session_class_id)) THEN
    ALTER TABLE "session_class_timetables" VALIDATE CONSTRAINT "session_class_timetables_class_fk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM session_class_refreshments t WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = t.workspace_subdomain AND c.id = t.session_class_id)) THEN
    ALTER TABLE "session_class_refreshments" VALIDATE CONSTRAINT "session_class_refreshments_class_fk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM session_class_scholarships t WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = t.workspace_subdomain AND c.id = t.session_class_id)) THEN
    ALTER TABLE "session_class_scholarships" VALIDATE CONSTRAINT "session_class_scholarships_class_fk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM session_class_timetable_periods p WHERE NOT EXISTS (SELECT 1 FROM session_class_timetables t WHERE t.workspace_subdomain = p.workspace_subdomain AND t.id = p.timetable_id)) THEN
    ALTER TABLE "session_class_timetable_periods" VALIDATE CONSTRAINT "session_class_timetable_periods_timetable_fk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM attendance a WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = a.workspace_subdomain AND c.id = a.class_id)) THEN
    ALTER TABLE "attendance" VALIDATE CONSTRAINT "attendance_class_fk";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM exam_classes e WHERE NOT EXISTS (SELECT 1 FROM session_classes c WHERE c.workspace_subdomain = e.workspace_subdomain AND c.id = e.class_id)) THEN
    ALTER TABLE "exam_classes" VALIDATE CONSTRAINT "exam_classes_class_fk";
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "attendance" VALIDATE CONSTRAINT "attendance_section_fk";
--> statement-breakpoint
ALTER TABLE "finance_fee_structures" VALIDATE CONSTRAINT "finance_fee_structures_session_fk";
ALTER TABLE "finance_fee_structures" VALIDATE CONSTRAINT "finance_fee_structures_class_fk";
ALTER TABLE "finance_fee_structures" VALIDATE CONSTRAINT "finance_fee_structures_program_fk";
ALTER TABLE "hasanat_distributions" VALIDATE CONSTRAINT "hasanat_distributions_class_fk";
ALTER TABLE "tests" VALIDATE CONSTRAINT "tests_class_fk";
