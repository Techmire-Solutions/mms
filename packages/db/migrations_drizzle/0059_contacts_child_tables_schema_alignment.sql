-- Migration 0059: Contacts child tables schema alignment
-- Harmonizes contact_addresses, contact_phones, contact_relationships, contact_activities, contact_attachments columns with schema.ts

-- 1. contact_addresses
ALTER TABLE "contact_addresses" ADD COLUMN IF NOT EXISTS "label" varchar(100);
ALTER TABLE "contact_addresses" ALTER COLUMN "line1" DROP NOT NULL;
ALTER TABLE "contact_addresses" ALTER COLUMN "line1" DROP DEFAULT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_addresses' AND column_name = 'type'
  ) THEN
    UPDATE "contact_addresses" SET "label" = "type" WHERE "label" IS NULL;
  END IF;
END $$;

-- 2. contact_phones
ALTER TABLE "contact_phones" ADD COLUMN IF NOT EXISTS "whatsapp_status" varchar(30);

-- 2b. contact_emails
ALTER TABLE "contact_emails" ADD COLUMN IF NOT EXISTS "is_verified" boolean NOT NULL DEFAULT false;

-- 3. contact_relationships
ALTER TABLE "contact_relationships" ADD COLUMN IF NOT EXISTS "name" varchar(255);
ALTER TABLE "contact_relationships" ADD COLUMN IF NOT EXISTS "phone" varchar(50);
ALTER TABLE "contact_relationships" ADD COLUMN IF NOT EXISTS "inferred" boolean NOT NULL DEFAULT false;
ALTER TABLE "contact_relationships" ADD COLUMN IF NOT EXISTS "inferred_from_contact_id" varchar(64);
ALTER TABLE "contact_relationships" ADD COLUMN IF NOT EXISTS "inference_depth" integer NOT NULL DEFAULT 0;
ALTER TABLE "contact_relationships" ALTER COLUMN "related_contact_id" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "contact_relationships_workspace_related_idx"
  ON "contact_relationships"("workspace_subdomain", "related_contact_id");

-- 4. contact_activities
ALTER TABLE "contact_activities" ADD COLUMN IF NOT EXISTS "content" text;
ALTER TABLE "contact_activities" ADD COLUMN IF NOT EXISTS "by" varchar(64);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_activities' AND column_name = 'description'
  ) THEN
    UPDATE "contact_activities" SET "content" = "description" WHERE "content" IS NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_activities' AND column_name = 'user_id'
  ) THEN
    UPDATE "contact_activities" SET "by" = "user_id" WHERE "by" IS NULL;
  END IF;
END $$;

ALTER TABLE "contact_activities" ALTER COLUMN "content" SET NOT NULL;

-- 5. contact_attachments
ALTER TABLE "contact_attachments" ADD COLUMN IF NOT EXISTS "type" varchar(100);
ALTER TABLE "contact_attachments" ADD COLUMN IF NOT EXISTS "date" varchar(35);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_attachments' AND column_name = 'mime_type'
  ) THEN
    UPDATE "contact_attachments" SET "type" = "mime_type" WHERE "type" IS NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contact_attachments' AND column_name = 'uploaded_at'
  ) THEN
    UPDATE "contact_attachments" SET "date" = "uploaded_at" WHERE "date" IS NULL;
  END IF;
END $$;

ALTER TABLE "contact_attachments" ALTER COLUMN "date" SET NOT NULL;
