SET LOCAL lock_timeout = '2s';--> statement-breakpoint
DROP INDEX "contact_phones_workspace_number_active_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "contact_phones_workspace_number_active_uidx" ON "contact_phones" USING btree ("workspace_subdomain",regexp_replace(
          CASE
            WHEN NULLIF(trim("number"), '') LIKE '+%' THEN trim("number")
            ELSE COALESCE(trim("country_code"), '') || COALESCE(trim("number"), '')
          END,
          '[^0-9]', '', 'g'
        )) WHERE NULLIF(regexp_replace(
        CASE
          WHEN NULLIF(trim("contact_phones"."number"), '') LIKE '+%' THEN trim("contact_phones"."number")
          ELSE COALESCE(trim("contact_phones"."country_code"), '') || COALESCE(trim("contact_phones"."number"), '')
        END,
        '[^0-9]', '', 'g'
      ), '') IS NOT NULL;