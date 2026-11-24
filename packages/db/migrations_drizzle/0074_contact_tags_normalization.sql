CREATE TABLE IF NOT EXISTS "contact_tags" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "contact_id" text NOT NULL,
  "name" varchar(100) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "contact_tags_workspace_subdomain_contact_id_id_pk" PRIMARY KEY("workspace_subdomain","contact_id","id")
);

ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "contact_tags" ADD CONSTRAINT "contact_tags_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk" FOREIGN KEY ("workspace_subdomain","contact_id") REFERENCES "public"."contacts"("workspace_subdomain","id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "contact_tags_workspace_contact_idx" ON "contact_tags" USING btree ("workspace_subdomain","contact_id");
CREATE UNIQUE INDEX IF NOT EXISTS "contact_tags_contact_name_uidx" ON "contact_tags" USING btree ("workspace_subdomain","contact_id","name");

-- Data Migration: Migrate existing comma-separated tags to the new table
INSERT INTO "contact_tags" ("id", "workspace_subdomain", "contact_id", "name", "created_at")
SELECT
    concat('ctag_', substr(md5(random()::text), 1, 8)) as id,
    workspace_subdomain,
    id as contact_id,
    trim(unnest(string_to_array(tag, ','))) as name,
    now() as created_at
FROM "contacts"
WHERE tag IS NOT NULL AND tag != '';

-- Drop the old column
ALTER TABLE "contacts" DROP COLUMN IF EXISTS "tag";
