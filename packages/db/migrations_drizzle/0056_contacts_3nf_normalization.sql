-- Migration 0056: Contacts Domain 3NF Normalization
-- Decompose contacts custom_data JSONB into atomic typed columns and dedicated child tables

-- 1. Add typed columns to contacts
ALTER TABLE "contacts"
  ADD COLUMN IF NOT EXISTS "first_name" varchar(150),
  ADD COLUMN IF NOT EXISTS "last_name" varchar(150),
  ADD COLUMN IF NOT EXISTS "name" varchar(300),
  ADD COLUMN IF NOT EXISTS "gender" varchar(20),
  ADD COLUMN IF NOT EXISTS "dob" varchar(30),
  ADD COLUMN IF NOT EXISTS "cnic" varchar(30),
  ADD COLUMN IF NOT EXISTS "is_syed" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "avatar" text,
  ADD COLUMN IF NOT EXISTS "notes" text,
  ADD COLUMN IF NOT EXISTS "whatsapp_status" varchar(30) NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS "last_checked_at" varchar(35),
  ADD COLUMN IF NOT EXISTS "phone" varchar(50),
  ADD COLUMN IF NOT EXISTS "email" varchar(255),
  ADD COLUMN IF NOT EXISTS "line1" varchar(255),
  ADD COLUMN IF NOT EXISTS "address" text,
  ADD COLUMN IF NOT EXISTS "city" varchar(100),
  ADD COLUMN IF NOT EXISTS "state" varchar(100),
  ADD COLUMN IF NOT EXISTS "country" varchar(100),
  ADD COLUMN IF NOT EXISTS "preferred_language" varchar(50),
  ADD COLUMN IF NOT EXISTS "preferred_contact_method" varchar(50),
  ADD COLUMN IF NOT EXISTS "do_not_contact" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ai_summary" text,
  ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "created_by" text,
  ADD COLUMN IF NOT EXISTS "updated_by" text;

-- 2. Create dedicated child tables
CREATE TABLE IF NOT EXISTS "contact_phones" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "contact_id" text NOT NULL,
  "number" varchar(50) NOT NULL,
  "type" varchar(30) NOT NULL DEFAULT 'mobile',
  "country_code" varchar(10),
  "is_primary" boolean NOT NULL DEFAULT false,
  "label" varchar(100),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "contact_id", "id")
);

CREATE TABLE IF NOT EXISTS "contact_emails" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "contact_id" text NOT NULL,
  "address" varchar(255) NOT NULL,
  "type" varchar(30) NOT NULL DEFAULT 'personal',
  "is_primary" boolean NOT NULL DEFAULT false,
  "label" varchar(100),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "contact_id", "id")
);

CREATE TABLE IF NOT EXISTS "contact_addresses" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "contact_id" text NOT NULL,
  "line1" varchar(255) NOT NULL DEFAULT '',
  "line2" varchar(255),
  "city" varchar(100),
  "state" varchar(100),
  "postal_code" varchar(30),
  "country" varchar(100),
  "type" varchar(30) NOT NULL DEFAULT 'home',
  "is_primary" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "contact_id", "id")
);

CREATE TABLE IF NOT EXISTS "contact_socials" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "contact_id" text NOT NULL,
  "platform" varchar(50) NOT NULL,
  "handle" varchar(255),
  "url" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "contact_id", "id")
);

CREATE TABLE IF NOT EXISTS "contact_relationships" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "contact_id" text NOT NULL,
  "related_contact_id" varchar(64) NOT NULL,
  "relationship" varchar(100) NOT NULL,
  "is_emergency" boolean NOT NULL DEFAULT false,
  "notes" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "contact_id", "id")
);

CREATE TABLE IF NOT EXISTS "contact_activities" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "contact_id" text NOT NULL,
  "type" varchar(50) NOT NULL,
  "description" text NOT NULL,
  "date" varchar(30) NOT NULL,
  "user_id" varchar(64),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "contact_id", "id")
);

CREATE TABLE IF NOT EXISTS "contact_attachments" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "contact_id" text NOT NULL,
  "name" varchar(255) NOT NULL,
  "url" text NOT NULL,
  "size" integer NOT NULL DEFAULT 0,
  "mime_type" varchar(100),
  "uploaded_at" varchar(35) NOT NULL,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "contact_id", "id")
);

-- 3. Backfill data from custom_data (if custom_data column exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'custom_data'
  ) THEN
    -- Backfill parent columns
    UPDATE "contacts"
    SET
      "first_name" = COALESCE(NULLIF(trim("custom_data"->>'firstName'), ''), NULLIF(trim("custom_data"->>'name'), ''), 'Contact'),
      "last_name" = NULLIF(trim("custom_data"->>'lastName'), ''),
      "name" = COALESCE(NULLIF(trim("custom_data"->>'name'), ''), trim(concat_ws(' ', "custom_data"->>'firstName', "custom_data"->>'lastName')), 'Contact'),
      "gender" = NULLIF(trim("custom_data"->>'gender'), ''),
      "dob" = NULLIF(trim("custom_data"->>'dob'), ''),
      "cnic" = NULLIF(trim("custom_data"->>'cnic'), ''),
      "is_syed" = COALESCE(("custom_data"->>'isSyed')::boolean, false),
      "avatar" = NULLIF(trim("custom_data"->>'avatar'), ''),
      "notes" = NULLIF(trim("custom_data"->>'notes'), ''),
      "whatsapp_status" = COALESCE(NULLIF(trim("custom_data"->>'whatsappStatus'), ''), 'unknown'),
      "last_checked_at" = NULLIF(trim("custom_data"->>'lastCheckedAt'), ''),
      "phone" = NULLIF(trim("custom_data"->>'phone'), ''),
      "email" = NULLIF(trim("custom_data"->>'email'), ''),
      "line1" = COALESCE(NULLIF(trim("custom_data"->>'line1'), ''), NULLIF(trim("custom_data"->>'address'), '')),
      "address" = NULLIF(trim("custom_data"->>'address'), ''),
      "city" = NULLIF(trim("custom_data"->>'city'), ''),
      "state" = NULLIF(trim("custom_data"->>'state'), ''),
      "country" = NULLIF(trim("custom_data"->>'country'), ''),
      "preferred_language" = NULLIF(trim("custom_data"->>'preferredLanguage'), ''),
      "preferred_contact_method" = NULLIF(trim("custom_data"->>'preferredContactMethod'), ''),
      "do_not_contact" = COALESCE(("custom_data"->>'doNotContact')::boolean, false),
      "ai_summary" = NULLIF(trim("custom_data"->>'aiSummary'), ''),
      "created_at" = CASE
        WHEN NULLIF(trim("custom_data"->>'createdAt'), '') IS NOT NULL
        THEN ("custom_data"->>'createdAt')::timestamptz
        ELSE "created_at"
      END,
      "created_by" = NULLIF(trim("custom_data"->>'createdBy'), ''),
      "updated_by" = NULLIF(trim("custom_data"->>'updatedBy'), '')
    WHERE "first_name" IS NULL;

    -- Backfill child contact_phones
    INSERT INTO "contact_phones" ("id", "workspace_subdomain", "contact_id", "number", "type", "country_code", "is_primary", "label", "sort_order")
    SELECT
      COALESCE(NULLIF(elem->>'id', ''), 'phone-' || (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id))) AS "id",
      c.workspace_subdomain,
      c.id AS "contact_id",
      elem->>'number' AS "number",
      COALESCE(elem->>'type', 'mobile') AS "type",
      elem->>'countryCode' AS "country_code",
      COALESCE((elem->>'isPrimary')::boolean, false) AS "is_primary",
      elem->>'label' AS "label",
      (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id) - 1)::int AS "sort_order"
    FROM "contacts" c,
    LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c."custom_data"->'phones') = 'array' THEN c."custom_data"->'phones' ELSE '[]'::jsonb END
    ) AS elem
    WHERE NULLIF(trim(elem->>'number'), '') IS NOT NULL
    ON CONFLICT ("workspace_subdomain", "contact_id", "id") DO NOTHING;

    -- Backfill child contact_emails
    INSERT INTO "contact_emails" ("id", "workspace_subdomain", "contact_id", "address", "type", "is_primary", "label", "sort_order")
    SELECT
      COALESCE(NULLIF(elem->>'id', ''), 'email-' || (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id))) AS "id",
      c.workspace_subdomain,
      c.id AS "contact_id",
      elem->>'address' AS "address",
      COALESCE(elem->>'type', 'personal') AS "type",
      COALESCE((elem->>'isPrimary')::boolean, false) AS "is_primary",
      elem->>'label' AS "label",
      (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id) - 1)::int AS "sort_order"
    FROM "contacts" c,
    LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c."custom_data"->'emails') = 'array' THEN c."custom_data"->'emails' ELSE '[]'::jsonb END
    ) AS elem
    WHERE NULLIF(trim(elem->>'address'), '') IS NOT NULL
    ON CONFLICT ("workspace_subdomain", "contact_id", "id") DO NOTHING;

    -- Backfill child contact_addresses
    INSERT INTO "contact_addresses" ("id", "workspace_subdomain", "contact_id", "line1", "line2", "city", "state", "postal_code", "country", "type", "is_primary", "sort_order")
    SELECT
      COALESCE(NULLIF(elem->>'id', ''), 'addr-' || (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id))) AS "id",
      c.workspace_subdomain,
      c.id AS "contact_id",
      COALESCE(elem->>'line1', '') AS "line1",
      elem->>'line2' AS "line2",
      elem->>'city' AS "city",
      elem->>'state' AS "state",
      elem->>'postalCode' AS "postal_code",
      elem->>'country' AS "country",
      COALESCE(elem->>'type', 'home') AS "type",
      COALESCE((elem->>'isPrimary')::boolean, false) AS "is_primary",
      (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id) - 1)::int AS "sort_order"
    FROM "contacts" c,
    LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c."custom_data"->'addresses') = 'array' THEN c."custom_data"->'addresses' ELSE '[]'::jsonb END
    ) AS elem
    ON CONFLICT ("workspace_subdomain", "contact_id", "id") DO NOTHING;

    -- Backfill child contact_socials
    INSERT INTO "contact_socials" ("id", "workspace_subdomain", "contact_id", "platform", "handle", "url", "sort_order")
    SELECT
      COALESCE(NULLIF(elem->>'id', ''), 'soc-' || (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id))) AS "id",
      c.workspace_subdomain,
      c.id AS "contact_id",
      COALESCE(elem->>'platform', 'other') AS "platform",
      elem->>'handle' AS "handle",
      elem->>'url' AS "url",
      (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id) - 1)::int AS "sort_order"
    FROM "contacts" c,
    LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c."custom_data"->'socials') = 'array' THEN c."custom_data"->'socials' ELSE '[]'::jsonb END
    ) AS elem
    ON CONFLICT ("workspace_subdomain", "contact_id", "id") DO NOTHING;

    -- Backfill child contact_relationships
    INSERT INTO "contact_relationships" ("id", "workspace_subdomain", "contact_id", "related_contact_id", "relationship", "is_emergency", "notes", "sort_order")
    SELECT
      'rel-' || (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id)) AS "id",
      c.workspace_subdomain,
      c.id AS "contact_id",
      elem->>'contactId' AS "related_contact_id",
      COALESCE(elem->>'relationship', 'Contact') AS "relationship",
      COALESCE((elem->>'isEmergency')::boolean, false) AS "is_emergency",
      elem->>'notes' AS "notes",
      (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id) - 1)::int AS "sort_order"
    FROM "contacts" c,
    LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c."custom_data"->'relationshipContacts') = 'array' THEN c."custom_data"->'relationshipContacts' ELSE '[]'::jsonb END
    ) AS elem
    WHERE NULLIF(trim(elem->>'contactId'), '') IS NOT NULL
    ON CONFLICT ("workspace_subdomain", "contact_id", "id") DO NOTHING;

    -- Backfill child contact_activities
    INSERT INTO "contact_activities" ("id", "workspace_subdomain", "contact_id", "type", "description", "date", "user_id", "sort_order")
    SELECT
      COALESCE(NULLIF(elem->>'id', ''), 'act-' || (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id))) AS "id",
      c.workspace_subdomain,
      c.id AS "contact_id",
      COALESCE(elem->>'type', 'note') AS "type",
      COALESCE(elem->>'description', '') AS "description",
      COALESCE(elem->>'date', '') AS "date",
      elem->>'userId' AS "user_id",
      (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id) - 1)::int AS "sort_order"
    FROM "contacts" c,
    LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c."custom_data"->'activities') = 'array' THEN c."custom_data"->'activities' ELSE '[]'::jsonb END
    ) AS elem
    ON CONFLICT ("workspace_subdomain", "contact_id", "id") DO NOTHING;

    -- Backfill child contact_attachments
    INSERT INTO "contact_attachments" ("id", "workspace_subdomain", "contact_id", "name", "url", "size", "mime_type", "uploaded_at", "sort_order")
    SELECT
      COALESCE(NULLIF(elem->>'id', ''), 'att-' || (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id))) AS "id",
      c.workspace_subdomain,
      c.id AS "contact_id",
      COALESCE(elem->>'name', 'attachment') AS "name",
      COALESCE(elem->>'url', '') AS "url",
      COALESCE((elem->>'size')::int, 0) AS "size",
      elem->>'mimeType' AS "mime_type",
      COALESCE(elem->>'uploadedAt', now()::text) AS "uploaded_at",
      (row_number() OVER (PARTITION BY c.workspace_subdomain, c.id) - 1)::int AS "sort_order"
    FROM "contacts" c,
    LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c."custom_data"->'attachments') = 'array' THEN c."custom_data"->'attachments' ELSE '[]'::jsonb END
    ) AS elem
    ON CONFLICT ("workspace_subdomain", "contact_id", "id") DO NOTHING;

    -- Drop legacy custom_data column & GIN index
    DROP INDEX IF EXISTS "contacts_custom_data_gin_idx";
    ALTER TABLE "contacts" DROP COLUMN IF EXISTS "custom_data";
  END IF;
END $$;

-- 4. Enforce NOT NULL constraints on parent required columns
ALTER TABLE "contacts"
  ALTER COLUMN "first_name" SET NOT NULL,
  ALTER COLUMN "name" SET NOT NULL;

-- 5. Create B-Tree indexes on contacts
CREATE INDEX IF NOT EXISTS "contacts_workspace_subdomain_idx" ON "contacts"("workspace_subdomain");
CREATE INDEX IF NOT EXISTS "contacts_workspace_name_idx" ON "contacts"("workspace_subdomain", "name");
CREATE INDEX IF NOT EXISTS "contacts_workspace_first_name_idx" ON "contacts"("workspace_subdomain", "first_name");
CREATE INDEX IF NOT EXISTS "contacts_workspace_last_name_idx" ON "contacts"("workspace_subdomain", "last_name");
CREATE INDEX IF NOT EXISTS "contacts_workspace_phone_idx" ON "contacts"("workspace_subdomain", "phone");
CREATE INDEX IF NOT EXISTS "contacts_workspace_email_idx" ON "contacts"("workspace_subdomain", "email");
CREATE INDEX IF NOT EXISTS "contacts_workspace_cnic_idx" ON "contacts"("workspace_subdomain", "cnic");
CREATE INDEX IF NOT EXISTS "contacts_workspace_gender_idx" ON "contacts"("workspace_subdomain", "gender");
CREATE INDEX IF NOT EXISTS "contacts_workspace_city_idx" ON "contacts"("workspace_subdomain", "city");

-- 6. Create B-Tree indexes on child tables
CREATE INDEX IF NOT EXISTS "contact_phones_workspace_contact_idx" ON "contact_phones"("workspace_subdomain", "contact_id");
CREATE INDEX IF NOT EXISTS "contact_phones_workspace_number_idx" ON "contact_phones"("workspace_subdomain", "number");

CREATE INDEX IF NOT EXISTS "contact_emails_workspace_contact_idx" ON "contact_emails"("workspace_subdomain", "contact_id");
CREATE INDEX IF NOT EXISTS "contact_emails_workspace_address_idx" ON "contact_emails"("workspace_subdomain", "address");

CREATE INDEX IF NOT EXISTS "contact_addresses_workspace_contact_idx" ON "contact_addresses"("workspace_subdomain", "contact_id");
CREATE INDEX IF NOT EXISTS "contact_socials_workspace_contact_idx" ON "contact_socials"("workspace_subdomain", "contact_id");
CREATE INDEX IF NOT EXISTS "contact_relationships_workspace_contact_idx" ON "contact_relationships"("workspace_subdomain", "contact_id");
CREATE INDEX IF NOT EXISTS "contact_relationships_workspace_related_idx" ON "contact_relationships"("workspace_subdomain", "related_contact_id");
CREATE INDEX IF NOT EXISTS "contact_activities_workspace_contact_idx" ON "contact_activities"("workspace_subdomain", "contact_id");
CREATE INDEX IF NOT EXISTS "contact_attachments_workspace_contact_idx" ON "contact_attachments"("workspace_subdomain", "contact_id");

-- 7. Configure FORCE ROW LEVEL SECURITY across all 8 tables
ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contacts_tenant_isolation" ON "contacts";
CREATE POLICY "contacts_tenant_isolation" ON "contacts"
  FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));

ALTER TABLE "contact_phones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_phones" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_phones_tenant_isolation" ON "contact_phones";
CREATE POLICY "contact_phones_tenant_isolation" ON "contact_phones"
  FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));

ALTER TABLE "contact_emails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_emails" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_emails_tenant_isolation" ON "contact_emails";
CREATE POLICY "contact_emails_tenant_isolation" ON "contact_emails"
  FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));

ALTER TABLE "contact_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_addresses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_addresses_tenant_isolation" ON "contact_addresses";
CREATE POLICY "contact_addresses_tenant_isolation" ON "contact_addresses"
  FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));

ALTER TABLE "contact_socials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_socials" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_socials_tenant_isolation" ON "contact_socials";
CREATE POLICY "contact_socials_tenant_isolation" ON "contact_socials"
  FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));

ALTER TABLE "contact_relationships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_relationships" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_relationships_tenant_isolation" ON "contact_relationships";
CREATE POLICY "contact_relationships_tenant_isolation" ON "contact_relationships"
  FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));

ALTER TABLE "contact_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_activities" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_activities_tenant_isolation" ON "contact_activities";
CREATE POLICY "contact_activities_tenant_isolation" ON "contact_activities"
  FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));

ALTER TABLE "contact_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_attachments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contact_attachments_tenant_isolation" ON "contact_attachments";
CREATE POLICY "contact_attachments_tenant_isolation" ON "contact_attachments"
  FOR ALL
  USING ("workspace_subdomain" = current_setting('app.current_tenant', true))
  WITH CHECK ("workspace_subdomain" = current_setting('app.current_tenant', true));
