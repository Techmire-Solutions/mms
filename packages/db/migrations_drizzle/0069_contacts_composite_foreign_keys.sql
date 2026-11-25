-- Forward-only Migration: 0069_contacts_composite_foreign_keys
-- Adds DDL composite foreign keys for all 10 contacts child tables with ON DELETE CASCADE.

-- 1. contact_phones
DELETE FROM "contact_phones" cp
WHERE NOT EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."workspace_subdomain" = cp."workspace_subdomain" AND c."id" = cp."contact_id"
);
DO $$ BEGIN
  ALTER TABLE "contact_phones" ADD CONSTRAINT "contact_phones_contact_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. contact_emails
DELETE FROM "contact_emails" ce
WHERE NOT EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."workspace_subdomain" = ce."workspace_subdomain" AND c."id" = ce."contact_id"
);
DO $$ BEGIN
  ALTER TABLE "contact_emails" ADD CONSTRAINT "contact_emails_contact_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. contact_addresses
DELETE FROM "contact_addresses" ca
WHERE NOT EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."workspace_subdomain" = ca."workspace_subdomain" AND c."id" = ca."contact_id"
);
DO $$ BEGIN
  ALTER TABLE "contact_addresses" ADD CONSTRAINT "contact_addresses_contact_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. contact_socials
DELETE FROM "contact_socials" cs
WHERE NOT EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."workspace_subdomain" = cs."workspace_subdomain" AND c."id" = cs."contact_id"
);
DO $$ BEGIN
  ALTER TABLE "contact_socials" ADD CONSTRAINT "contact_socials_contact_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 5. contact_educations
DELETE FROM "contact_educations" ce
WHERE NOT EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."workspace_subdomain" = ce."workspace_subdomain" AND c."id" = ce."contact_id"
);
DO $$ BEGIN
  ALTER TABLE "contact_educations" ADD CONSTRAINT "contact_educations_contact_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. contact_experiences
DELETE FROM "contact_experiences" ce
WHERE NOT EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."workspace_subdomain" = ce."workspace_subdomain" AND c."id" = ce."contact_id"
);
DO $$ BEGIN
  ALTER TABLE "contact_experiences" ADD CONSTRAINT "contact_experiences_contact_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. contact_skills
DELETE FROM "contact_skills" cs
WHERE NOT EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."workspace_subdomain" = cs."workspace_subdomain" AND c."id" = cs."contact_id"
);
DO $$ BEGIN
  ALTER TABLE "contact_skills" ADD CONSTRAINT "contact_skills_contact_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. contact_relationships
DELETE FROM "contact_relationships" cr
WHERE NOT EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."workspace_subdomain" = cr."workspace_subdomain" AND c."id" = cr."contact_id"
);
DO $$ BEGIN
  ALTER TABLE "contact_relationships" ADD CONSTRAINT "contact_relationships_contact_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 9. contact_activities
DELETE FROM "contact_activities" ca
WHERE NOT EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."workspace_subdomain" = ca."workspace_subdomain" AND c."id" = ca."contact_id"
);
DO $$ BEGIN
  ALTER TABLE "contact_activities" ADD CONSTRAINT "contact_activities_contact_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 10. contact_attachments
DELETE FROM "contact_attachments" ca
WHERE NOT EXISTS (
  SELECT 1 FROM "contacts" c
  WHERE c."workspace_subdomain" = ca."workspace_subdomain" AND c."id" = ca."contact_id"
);
DO $$ BEGIN
  ALTER TABLE "contact_attachments" ADD CONSTRAINT "contact_attachments_contact_fk"
    FOREIGN KEY ("workspace_subdomain", "contact_id") REFERENCES "contacts"("workspace_subdomain", "id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
