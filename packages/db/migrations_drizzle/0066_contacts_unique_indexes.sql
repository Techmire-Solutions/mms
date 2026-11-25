-- Migration 0066: Contacts composite partial unique indexes for CNIC, Phone, and Email
-- Scoped per workspace, ignoring soft-deleted contacts and blank/NULL values.

-- 1. Dedupe pre-existing duplicate CNICs per workspace (keep min(id), nullify duplicate peers)
UPDATE "contacts" AS c
SET "cnic" = NULL
FROM (
  SELECT
    "workspace_subdomain",
    regexp_replace("cnic", '[^0-9]', '', 'g') AS cnic_key,
    min("id") AS keep_id
  FROM "contacts"
  WHERE "deleted_at" IS NULL
    AND NULLIF(regexp_replace("cnic", '[^0-9]', '', 'g'), '') IS NOT NULL
  GROUP BY "workspace_subdomain", regexp_replace("cnic", '[^0-9]', '', 'g')
  HAVING count(*) > 1
) AS d
WHERE c."workspace_subdomain" = d."workspace_subdomain"
  AND regexp_replace(c."cnic", '[^0-9]', '', 'g') = d.cnic_key
  AND c."id" <> d.keep_id
  AND c."deleted_at" IS NULL;--> statement-breakpoint

-- 2. Dedupe pre-existing duplicate Phones per workspace (keep min(id), nullify duplicate peers)
UPDATE "contacts" AS c
SET "phone" = NULL
FROM (
  SELECT
    "workspace_subdomain",
    regexp_replace("phone", '[^0-9]', '', 'g') AS phone_key,
    min("id") AS keep_id
  FROM "contacts"
  WHERE "deleted_at" IS NULL
    AND NULLIF(regexp_replace("phone", '[^0-9]', '', 'g'), '') IS NOT NULL
  GROUP BY "workspace_subdomain", regexp_replace("phone", '[^0-9]', '', 'g')
  HAVING count(*) > 1
) AS d
WHERE c."workspace_subdomain" = d."workspace_subdomain"
  AND regexp_replace(c."phone", '[^0-9]', '', 'g') = d.phone_key
  AND c."id" <> d.keep_id
  AND c."deleted_at" IS NULL;--> statement-breakpoint

-- 3. Dedupe pre-existing duplicate Emails per workspace (keep min(id), nullify duplicate peers)
UPDATE "contacts" AS c
SET "email" = NULL
FROM (
  SELECT
    "workspace_subdomain",
    lower(trim("email")) AS email_key,
    min("id") AS keep_id
  FROM "contacts"
  WHERE "deleted_at" IS NULL
    AND NULLIF(trim("email"), '') IS NOT NULL
  GROUP BY "workspace_subdomain", lower(trim("email"))
  HAVING count(*) > 1
) AS d
WHERE c."workspace_subdomain" = d."workspace_subdomain"
  AND lower(trim(c."email")) = d.email_key
  AND c."id" <> d.keep_id
  AND c."deleted_at" IS NULL;--> statement-breakpoint

-- 4. Create Partial Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspace_cnic_active_uidx"
  ON "contacts" (
    "workspace_subdomain",
    (regexp_replace("cnic", '[^0-9]', '', 'g'))
  )
  WHERE "deleted_at" IS NULL
    AND NULLIF(regexp_replace("cnic", '[^0-9]', '', 'g'), '') IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspace_phone_active_uidx"
  ON "contacts" (
    "workspace_subdomain",
    (regexp_replace("phone", '[^0-9]', '', 'g'))
  )
  WHERE "deleted_at" IS NULL
    AND NULLIF(regexp_replace("phone", '[^0-9]', '', 'g'), '') IS NOT NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "contacts_workspace_email_active_uidx"
  ON "contacts" (
    "workspace_subdomain",
    (lower(trim("email")))
  )
  WHERE "deleted_at" IS NULL
    AND NULLIF(trim("email"), '') IS NOT NULL;
