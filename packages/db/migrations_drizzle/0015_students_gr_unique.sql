-- Dedupe active non-blank GR numbers, then enforce partial unique index
-- (expression matches 0014 / list conflict SQL: lower(trim(custom_data->>'grNumber'))).

-- Keep lexicographically smallest id per (tenant, normalized GR); suffix others.
UPDATE "students" AS s
SET "custom_data" = jsonb_set(
  s."custom_data",
  '{grNumber}',
  to_jsonb(trim(s."custom_data"->>'grNumber') || '-dup-' || s."id")
)
FROM (
  SELECT
    "workspace_subdomain",
    lower(trim("custom_data"->>'grNumber')) AS gr_key,
    min("id") AS keep_id
  FROM "students"
  WHERE "deleted_at" IS NULL
    AND NULLIF(trim("custom_data"->>'grNumber'), '') IS NOT NULL
  GROUP BY "workspace_subdomain", lower(trim("custom_data"->>'grNumber'))
  HAVING count(*) > 1
) AS d
WHERE s."workspace_subdomain" = d."workspace_subdomain"
  AND lower(trim(s."custom_data"->>'grNumber')) = d.gr_key
  AND s."id" <> d.keep_id
  AND s."deleted_at" IS NULL;--> statement-breakpoint

DROP INDEX IF EXISTS "students_workspace_gr_active_idx";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "students_workspace_gr_active_uidx"
  ON "students" (
    "workspace_subdomain",
    (lower(trim("custom_data"->>'grNumber')))
  )
  WHERE "deleted_at" IS NULL
    AND NULLIF(trim("custom_data"->>'grNumber'), '') IS NOT NULL;
