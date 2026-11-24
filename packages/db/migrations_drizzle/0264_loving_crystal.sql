SET LOCAL lock_timeout = '2s';

-- Deduplicate pre-existing duplicate emails/phones before enforcing the unique
-- indexes. Keeps the earliest-created row per normalized key (then lowest id for
-- ties) — a no-op on databases where app-level uniqueness already held.
DELETE FROM "contact_emails" e
USING "contact_emails" e2
WHERE e."workspace_subdomain" = e2."workspace_subdomain"
  AND lower(trim(e."address")) = lower(trim(e2."address"))
  AND NULLIF(trim(e."address"), '') IS NOT NULL
  AND (e."created_at", e."id") > (e2."created_at", e2."id");--> statement-breakpoint

DELETE FROM "contact_phones" p
USING "contact_phones" p2
WHERE p."workspace_subdomain" = p2."workspace_subdomain"
  AND regexp_replace(p."number", '[^0-9]', '', 'g') = regexp_replace(p2."number", '[^0-9]', '', 'g')
  AND NULLIF(regexp_replace(p."number", '[^0-9]', '', 'g'), '') IS NOT NULL
  AND (p."created_at", p."id") > (p2."created_at", p2."id");--> statement-breakpoint

CREATE UNIQUE INDEX "contact_emails_workspace_address_active_uidx" ON "contact_emails" USING btree ("workspace_subdomain",lower(trim("address"))) WHERE NULLIF(trim("contact_emails"."address"), '') IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_phones_workspace_number_active_uidx" ON "contact_phones" USING btree ("workspace_subdomain",regexp_replace("number", '[^0-9]', '', 'g')) WHERE NULLIF(regexp_replace("contact_phones"."number", '[^0-9]', '', 'g'), '') IS NOT NULL;
