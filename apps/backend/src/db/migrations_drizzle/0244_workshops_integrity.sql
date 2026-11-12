-- MMS Forward-only Migration: 0244_workshops_integrity.sql
-- Workshops persistence audit follow-up (docs/workshops-schema-persistence-audit-2026-11-12.md).
--
--   • workshop_events: partial composite (workspace, start_date, end_date) WHERE deleted_at IS NULL
--     — the Work list and the Reports/metrics scans both filter archived rows out and sort by
--     start day, so the planner gets a covering active index instead of scanning the
--     archiving-agnostic (workspace, start_date) index.
--   • workshop_events: registration_deadline must sit inside the workshop window. The Zod schema
--     already enforces it; this is the DB-level mirror for direct SQL and import paths.
--   • workshop_attendance / workshop_scores: the participant FK now carries workshop_id too, so a
--     check-in or score can only name a participant of the *same* workshop. Both child FKs point
--     at workshop_participants (workspace_subdomain, id, workshop_id), hence the unique index.
--
-- Hand-authored by exception (mms-schema-migrate §2 step 2): `drizzle-kit generate` is blocked by
-- a pre-existing snapshot collision (0216/0217 point at the same parent snapshot) and reports
-- several meta/*_snapshot.json files as malformed. The 0244 snapshot was derived from the 0243
-- snapshot by applying these same definitions, and the journal entry is committed with it.
--
-- All four tables are small (a reserved module with no legacy volume), so plain DDL and index
-- builds are instant; the CHECK and the FKs are added NOT VALID and then validated.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "workshop_events_workspace_active_dates_idx"
  ON "workshop_events" ("workspace_subdomain", "start_date", "end_date")
  WHERE "deleted_at" IS NULL;
--> statement-breakpoint

ALTER TABLE "workshop_events" DROP CONSTRAINT IF EXISTS "workshop_events_deadline_check";
--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_deadline_check"
  CHECK (
    "registration_deadline" IS NULL
    OR coalesce("end_date", "start_date") IS NULL
    OR "registration_deadline" <= coalesce("end_date", "start_date")
  ) NOT VALID;
--> statement-breakpoint
ALTER TABLE "workshop_events" VALIDATE CONSTRAINT "workshop_events_deadline_check";
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "workshop_participants_workshop_scoped_uidx"
  ON "workshop_participants" ("workspace_subdomain", "id", "workshop_id");
--> statement-breakpoint

-- Repair any mark whose workshop_id disagreed with its participant before the composite FK takes
-- over. The application has always written both columns from the same workshop, so this is a
-- no-op on healthy data; it runs first so VALIDATE cannot fail on a pre-existing mismatch.
UPDATE "workshop_attendance" a
   SET "workshop_id" = p."workshop_id"
  FROM "workshop_participants" p
 WHERE p."workspace_subdomain" = a."workspace_subdomain"
   AND p."id" = a."participant_id"
   AND p."workshop_id" <> a."workshop_id";
--> statement-breakpoint
UPDATE "workshop_scores" s
   SET "workshop_id" = p."workshop_id"
  FROM "workshop_participants" p
 WHERE p."workspace_subdomain" = s."workspace_subdomain"
   AND p."id" = s."participant_id"
   AND p."workshop_id" <> s."workshop_id";
--> statement-breakpoint

-- Drop whatever 2-column participant FK exists today. `workshop_attendance` named it in 0178;
-- `workshop_scores` let Drizzle derive the name, which PostgreSQL then truncated to 63 bytes, so
-- the constraint is looked up by shape rather than by a literal identifier.
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT con.conname, rel.relname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
     WHERE ns.nspname = 'public'
       AND rel.relname IN ('workshop_attendance', 'workshop_scores')
       AND con.contype = 'f'
       AND con.confrelid = 'public.workshop_participants'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', fk.relname, fk.conname);
  END LOOP;
END $$;
--> statement-breakpoint

ALTER TABLE "workshop_attendance" ADD CONSTRAINT "workshop_attendance_participant_fk"
  FOREIGN KEY ("workspace_subdomain", "participant_id", "workshop_id")
  REFERENCES "workshop_participants" ("workspace_subdomain", "id", "workshop_id")
  ON DELETE CASCADE NOT VALID;
--> statement-breakpoint
ALTER TABLE "workshop_attendance" VALIDATE CONSTRAINT "workshop_attendance_participant_fk";
--> statement-breakpoint

ALTER TABLE "workshop_scores" ADD CONSTRAINT "workshop_scores_participant_fk"
  FOREIGN KEY ("workspace_subdomain", "participant_id", "workshop_id")
  REFERENCES "workshop_participants" ("workspace_subdomain", "id", "workshop_id")
  ON DELETE CASCADE NOT VALID;
--> statement-breakpoint
ALTER TABLE "workshop_scores" VALIDATE CONSTRAINT "workshop_scores_participant_fk";
