CREATE OR REPLACE FUNCTION mms_safe_cast_to_date(val text) RETURNS date AS $$
BEGIN
  IF val IS NULL OR btrim(val) = '' THEN
    RETURN NULL;
  END IF;
  -- If YYYY-MM format, append -01
  IF val ~ '^\d{4}-\d{1,2}$' THEN
    BEGIN
      RETURN (val || '-01')::date;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;
  -- If YYYY format, append -01-01
  IF val ~ '^\d{4}$' THEN
    BEGIN
      RETURN (val || '-01-01')::date;
    EXCEPTION WHEN OTHERS THEN
      RETURN NULL;
    END;
  END IF;
  BEGIN
    RETURN val::date;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION mms_safe_cast_to_timestamptz(val text) RETURNS timestamptz AS $$
BEGIN
  IF val IS NULL OR btrim(val) = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    RETURN val::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

ALTER TABLE "contact_attachments" ALTER COLUMN "size" TYPE bigint;
ALTER TABLE "contact_relationships" ALTER COLUMN "related_contact_id" TYPE text;

DO $$ BEGIN
  ALTER TABLE "contact_relationships"
    ADD CONSTRAINT "contact_relationships_related_fk"
    FOREIGN KEY ("workspace_subdomain", "related_contact_id")
    REFERENCES "contacts"("workspace_subdomain", "id")
    ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "contacts" ALTER COLUMN "dob" TYPE date USING mms_safe_cast_to_date("dob"::text);
ALTER TABLE "contacts" ALTER COLUMN "last_checked_at" TYPE timestamp with time zone USING mms_safe_cast_to_timestamptz("last_checked_at"::text);

DROP FUNCTION IF EXISTS mms_safe_cast_to_date(text);
DROP FUNCTION IF EXISTS mms_safe_cast_to_timestamptz(text);

