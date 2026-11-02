-- Migration 0201: module-managed contact role tags.
--
-- Contact tags become a projection of student/faculty role state:
--   student  → Student / Parent / Guardian
--   faculty  → faculty-<Designation> (one per active designation)
-- Ended roles stay on the contact as archived `Former …` tags. Manual tags with
-- a colliding name are converted instead of duplicated; the functional unique
-- index makes a second manual row with the same name impossible.

SET LOCAL lock_timeout = '2s';

ALTER TABLE "contact_tags" ALTER COLUMN "name" TYPE varchar(200);
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "source" varchar(20);
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "system_key" varchar(200);
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "archived" boolean NOT NULL DEFAULT false;
ALTER TABLE "contact_tags" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();

-- Case-insensitive duplicate cleanup before the functional unique index. Keep the
-- earliest row (system rows are still NULL at this point).
DELETE FROM "contact_tags" a
USING "contact_tags" b
WHERE a."workspace_subdomain" = b."workspace_subdomain"
  AND a."contact_id" = b."contact_id"
  AND lower(btrim(a."name")) = lower(btrim(b."name"))
  AND (a."created_at" > b."created_at" OR (a."created_at" = b."created_at" AND a."id" > b."id"));

CREATE UNIQUE INDEX IF NOT EXISTS "contact_tags_ws_contact_system_key_uidx"
  ON "contact_tags" ("workspace_subdomain", "contact_id", "system_key")
  WHERE "system_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "contact_tags_ws_system_key_idx"
  ON "contact_tags" ("workspace_subdomain", "system_key")
  WHERE "system_key" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "contact_tags_ws_contact_lower_name_uidx"
  ON "contact_tags" ("workspace_subdomain", "contact_id", lower(btrim("name")));

-- ---------------------------------------------------------------------------
-- Student roles (active = student row live and status active/suspended)
-- ---------------------------------------------------------------------------
WITH student_roles AS (
  SELECT s."workspace_subdomain", s."contact_id" AS contact_id, 'Student' AS base_name,
         'student:self' AS system_key,
         (s."deleted_at" IS NULL AND s."status" IN ('active', 'suspended')) AS active
  FROM "students" s WHERE s."contact_id" IS NOT NULL
  UNION ALL
  SELECT s."workspace_subdomain", s."father_contact_id", 'Parent', 'student:parent',
         (s."deleted_at" IS NULL AND s."status" IN ('active', 'suspended'))
  FROM "students" s WHERE s."father_contact_id" IS NOT NULL
  UNION ALL
  SELECT s."workspace_subdomain", s."mother_contact_id", 'Parent', 'student:parent',
         (s."deleted_at" IS NULL AND s."status" IN ('active', 'suspended'))
  FROM "students" s WHERE s."mother_contact_id" IS NOT NULL
  UNION ALL
  SELECT s."workspace_subdomain", s."guardian_contact_id", 'Guardian', 'student:guardian',
         (s."deleted_at" IS NULL AND s."status" IN ('active', 'suspended'))
  FROM "students" s WHERE s."guardian_contact_id" IS NOT NULL
),
student_desired AS (
  SELECT "workspace_subdomain", contact_id, base_name, system_key, bool_or(active) AS active
  FROM student_roles
  GROUP BY 1, 2, 3, 4
),
student_named AS (
  SELECT "workspace_subdomain", contact_id, system_key,
         CASE WHEN active THEN base_name ELSE 'Former ' || base_name END AS display_name,
         NOT active AS archived
  FROM student_desired
),
student_conflicts AS (
  DELETE FROM "contact_tags" t
  USING student_named d
  WHERE t."workspace_subdomain" = d."workspace_subdomain"
    AND t."contact_id" = d.contact_id
    AND t."system_key" IS NULL
    AND lower(btrim(t."name")) = lower(btrim(d.display_name))
  RETURNING t."id"
)
INSERT INTO "contact_tags"
  ("id", "workspace_subdomain", "contact_id", "name", "source", "system_key", "archived", "created_at", "updated_at")
SELECT 'sys-' || md5(random()::text || clock_timestamp()::text),
       d."workspace_subdomain", d.contact_id, left(d.display_name, 200),
       'student', d.system_key, d.archived, now(), now()
FROM student_named d
ON CONFLICT ("workspace_subdomain", "contact_id", "system_key") WHERE "system_key" IS NOT NULL
DO NOTHING;

-- ---------------------------------------------------------------------------
-- Faculty roles (active = live employment active/on_leave and an open active
-- tenure or assignment on a live active designation)
-- ---------------------------------------------------------------------------
WITH faculty_roles AS (
  SELECT e."workspace_subdomain", e."contact_id", d."id" AS designation_id, d."name" AS designation_name,
         (e."deleted_at" IS NULL
           AND e."status" IN ('active', 'on_leave')
           AND f."deleted_at" IS NULL
           AND d."deleted_at" IS NULL
           AND d."status" = 'active'
           AND ed."deleted_at" IS NULL
           AND ed."status" = 'active'
           AND (ed."end_date" IS NULL OR ed."end_date" >= CURRENT_DATE)) AS active
  FROM "faculty_employments" e
  JOIN "faculty" f ON f."workspace_subdomain" = e."workspace_subdomain" AND f."employment_id" = e."id"
  JOIN "faculty_employ_designations" ed
    ON ed."workspace_subdomain" = e."workspace_subdomain" AND ed."employment_id" = e."id"
  JOIN "faculty_designations" d
    ON d."workspace_subdomain" = e."workspace_subdomain" AND d."id" = ed."designation_id"
  UNION ALL
  SELECT e."workspace_subdomain", e."contact_id", d."id", d."name",
         (e."deleted_at" IS NULL
           AND e."status" IN ('active', 'on_leave')
           AND f."deleted_at" IS NULL
           AND d."deleted_at" IS NULL
           AND d."status" = 'active'
           AND a."deleted_at" IS NULL
           AND a."status" = 'active'
           AND (a."end_date" IS NULL OR a."end_date" >= CURRENT_DATE))
  FROM "faculty_employments" e
  JOIN "faculty" f ON f."workspace_subdomain" = e."workspace_subdomain" AND f."employment_id" = e."id"
  JOIN "faculty_assignments" a
    ON a."workspace_subdomain" = e."workspace_subdomain" AND a."faculty_id" = f."id"
  JOIN "faculty_designations" d
    ON d."workspace_subdomain" = e."workspace_subdomain" AND d."id" = a."designation_id"
),
faculty_base AS (
  SELECT "workspace_subdomain", contact_id, designation_id,
         left(regexp_replace(btrim(designation_name), '\s+', ' ', 'g'), 170) AS base_name,
         active
  FROM faculty_roles
),
faculty_desired AS (
  -- Same-named designations collapse into one tag (name is the display identity);
  -- keep an active designation id when one exists so a rename still updates it.
  SELECT "workspace_subdomain", contact_id,
         (array_agg(designation_id ORDER BY active DESC, designation_id))[1] AS designation_id,
         base_name,
         bool_or(active) AS active
  FROM faculty_base
  GROUP BY 1, 2, 4
),
faculty_named AS (
  SELECT "workspace_subdomain", contact_id,
         'faculty:designation:' || designation_id AS system_key,
         CASE
           WHEN active THEN 'faculty-' || base_name
           ELSE 'Former faculty-' || base_name
         END AS display_name,
         NOT active AS archived
  FROM faculty_desired
),
faculty_conflicts AS (
  DELETE FROM "contact_tags" t
  USING faculty_named d
  WHERE t."workspace_subdomain" = d."workspace_subdomain"
    AND t."contact_id" = d.contact_id
    AND t."system_key" IS NULL
    AND lower(btrim(t."name")) = lower(btrim(d.display_name))
  RETURNING t."id"
)
INSERT INTO "contact_tags"
  ("id", "workspace_subdomain", "contact_id", "name", "source", "system_key", "archived", "created_at", "updated_at")
SELECT 'sys-' || md5(random()::text || clock_timestamp()::text),
       d."workspace_subdomain", d.contact_id, left(d.display_name, 200),
       'faculty', d.system_key, d.archived, now(), now()
FROM faculty_named d
ON CONFLICT ("workspace_subdomain", "contact_id", "system_key") WHERE "system_key" IS NOT NULL
DO NOTHING;
