-- MMS Forward-only Migration: 0145_session_faculty_composite_fk.sql
-- Normalize session faculty_id references and add composite FKs to faculty.

SET LOCAL lock_timeout = '2s';
--> statement-breakpoint

-- Remove session_faculty rows that do not reference an existing faculty member.
DELETE FROM session_faculty sf
WHERE NOT EXISTS (
  SELECT 1 FROM faculty f
  WHERE f.workspace_subdomain = sf.workspace_subdomain
    AND f.id = sf.faculty_id
);
--> statement-breakpoint

-- session_classes: empty string → NULL (optional instructor).
UPDATE session_classes SET faculty_id = NULL WHERE btrim(faculty_id) = '';
--> statement-breakpoint
UPDATE session_classes SET faculty_id = NULL
WHERE faculty_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM faculty f
    WHERE f.workspace_subdomain = session_classes.workspace_subdomain
      AND f.id = session_classes.faculty_id
  );
--> statement-breakpoint

UPDATE session_class_timetable_periods SET faculty_id = NULL WHERE btrim(COALESCE(faculty_id, '')) = '';
--> statement-breakpoint
UPDATE session_class_timetable_periods SET faculty_id = NULL
WHERE faculty_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM faculty f
    WHERE f.workspace_subdomain = session_class_timetable_periods.workspace_subdomain
      AND f.id = session_class_timetable_periods.faculty_id
  );
--> statement-breakpoint

ALTER TABLE session_classes ALTER COLUMN faculty_id DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE session_classes ALTER COLUMN faculty_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE session_classes ALTER COLUMN faculty_id TYPE text USING faculty_id::text;
--> statement-breakpoint

ALTER TABLE session_class_timetable_periods ALTER COLUMN faculty_id TYPE text USING NULLIF(btrim(COALESCE(faculty_id, '')), '')::text;
--> statement-breakpoint

ALTER TABLE session_faculty ALTER COLUMN faculty_id TYPE text USING faculty_id::text;
--> statement-breakpoint

ALTER TABLE session_faculty ADD CONSTRAINT session_faculty_faculty_fk
  FOREIGN KEY (workspace_subdomain, faculty_id)
  REFERENCES faculty (workspace_subdomain, id)
  ON DELETE RESTRICT
  NOT VALID;
--> statement-breakpoint
ALTER TABLE session_faculty VALIDATE CONSTRAINT session_faculty_faculty_fk;
--> statement-breakpoint

ALTER TABLE session_classes ADD CONSTRAINT session_classes_faculty_fk
  FOREIGN KEY (workspace_subdomain, faculty_id)
  REFERENCES faculty (workspace_subdomain, id)
  ON DELETE RESTRICT
  NOT VALID;
--> statement-breakpoint
ALTER TABLE session_classes VALIDATE CONSTRAINT session_classes_faculty_fk;
--> statement-breakpoint

ALTER TABLE session_class_timetable_periods ADD CONSTRAINT session_class_timetable_periods_faculty_fk
  FOREIGN KEY (workspace_subdomain, faculty_id)
  REFERENCES faculty (workspace_subdomain, id)
  ON DELETE RESTRICT
  NOT VALID;
--> statement-breakpoint
ALTER TABLE session_class_timetable_periods VALIDATE CONSTRAINT session_class_timetable_periods_faculty_fk;
