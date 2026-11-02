-- Migration 0202: backfill Parent/Guardian tags from the relationship graph.
--
-- Students do not dual-write father/mother/guardian columns; guardians live on the
-- student's primary contact relationships. 0201 could only backfill the legacy
-- columns, so this data-only migration derives Parent/Guardian from
-- `contact_relationships` for existing students.

SET LOCAL lock_timeout = '2s';

WITH relationship_roles AS (
  SELECT cr."workspace_subdomain",
         cr."related_contact_id" AS contact_id,
         CASE
           WHEN lower(btrim(cr."relationship")) = 'guardian' THEN 'Guardian'
           ELSE 'Parent'
         END AS base_name,
         CASE
           WHEN lower(btrim(cr."relationship")) = 'guardian' THEN 'student:guardian'
           ELSE 'student:parent'
         END AS system_key,
         (s."deleted_at" IS NULL AND s."status" IN ('active', 'suspended')) AS active
  FROM "contact_relationships" cr
  JOIN "students" s
    ON s."workspace_subdomain" = cr."workspace_subdomain"
   AND s."contact_id" = cr."contact_id"
  WHERE cr."related_contact_id" IS NOT NULL
    AND lower(btrim(cr."relationship")) IN ('parent', 'guardian')
),
desired AS (
  SELECT "workspace_subdomain", contact_id, base_name, system_key, bool_or(active) AS active
  FROM relationship_roles
  GROUP BY 1, 2, 3, 4
),
named AS (
  SELECT "workspace_subdomain", contact_id, system_key,
         CASE WHEN active THEN base_name ELSE 'Former ' || base_name END AS display_name,
         NOT active AS archived
  FROM desired
),
conflicts AS (
  DELETE FROM "contact_tags" t
  USING named d
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
FROM named d
ON CONFLICT ("workspace_subdomain", "contact_id", "system_key") WHERE "system_key" IS NOT NULL
DO NOTHING;
