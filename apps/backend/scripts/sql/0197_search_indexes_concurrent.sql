-- Out-of-band trgm indexes for 0197. Run once after the migration, with:
--   pnpm --filter mms-backend tsx src/scripts/create-index-concurrently.ts --file scripts/sql/0197_search_indexes_concurrent.sql
-- Plain CREATE INDEX on contacts/students blocks writes while the table is large;
-- the migration-index ratchet therefore keeps these out of the migration.
-- Normalized-name expressions must match contactRepositoryListSql.ts exactly.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contacts_name_trgm_idx" ON "contacts" USING gin (
  lower(translate(regexp_replace(regexp_replace(normalize(coalesce("name", ''), NFD), U&'[\0300-\036f]', '', 'g'), U&'[\064B-\065F\0670]', '', 'g'), U&'\064A\0643', U&'\06CC\06A9')) gin_trgm_ops
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contacts_first_name_trgm_idx" ON "contacts" USING gin (
  lower(translate(regexp_replace(regexp_replace(normalize(coalesce("first_name", ''), NFD), U&'[\0300-\036f]', '', 'g'), U&'[\064B-\065F\0670]', '', 'g'), U&'\064A\0643', U&'\06CC\06A9')) gin_trgm_ops
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contacts_last_name_trgm_idx" ON "contacts" USING gin (
  lower(translate(regexp_replace(regexp_replace(normalize(coalesce("last_name", ''), NFD), U&'[\0300-\036f]', '', 'g'), U&'[\064B-\065F\0670]', '', 'g'), U&'\064A\0643', U&'\06CC\06A9')) gin_trgm_ops
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contacts_cnic_trgm_idx" ON "contacts" USING gin (
  lower(translate(regexp_replace(regexp_replace(normalize(coalesce("cnic", ''), NFD), U&'[\0300-\036f]', '', 'g'), U&'[\064B-\065F\0670]', '', 'g'), U&'\064A\0643', U&'\06CC\06A9')) gin_trgm_ops
);
--> statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS "contact_phones_number_trgm_idx" ON "contact_phones" USING gin (
  lower(translate(regexp_replace(regexp_replace(normalize(coalesce("number", ''), NFD), U&'[\0300-\036f]', '', 'g'), U&'[\064B-\065F\0670]', '', 'g'), U&'\064A\0643', U&'\06CC\06A9')) gin_trgm_ops
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contact_emails_address_trgm_idx" ON "contact_emails" USING gin (
  lower(translate(regexp_replace(regexp_replace(normalize(coalesce("address", ''), NFD), U&'[\0300-\036f]', '', 'g'), U&'[\064B-\065F\0670]', '', 'g'), U&'\064A\0643', U&'\06CC\06A9')) gin_trgm_ops
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "contact_addresses_text_trgm_idx" ON "contact_addresses" USING gin (
  lower(translate(regexp_replace(regexp_replace(normalize(
    coalesce("line1", '') || ' ' || coalesce("city", '') || ' ' || coalesce("state", '') || ' ' || coalesce("country", ''),
    NFD), U&'[\0300-\036f]', '', 'g'), U&'[\064B-\065F\0670]', '', 'g'), U&'\064A\0643', U&'\06CC\06A9')) gin_trgm_ops
);
--> statement-breakpoint

CREATE INDEX CONCURRENTLY IF NOT EXISTS "students_gr_number_trgm_idx" ON "students" USING gin (
  coalesce("gr_number", '') gin_trgm_ops
);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "students_registered_on_year_idx" ON "students" (
  "workspace_subdomain",
  extract(year from "registered_on")
);
