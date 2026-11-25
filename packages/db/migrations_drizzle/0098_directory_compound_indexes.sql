-- 0098_directory_compound_indexes.sql
-- Multi-tenant partial compound indexes for high-volume directory filtering and sorting.
-- Eliminates heap rechecks, sequential scans, and in-memory sort spills on active rows (deleted_at IS NULL).

-- Students: status + updated_at sort, default updated_at sort, registered_date sort, gr_number sort
CREATE INDEX IF NOT EXISTS "students_workspace_updated_at_active_idx" ON "students" USING btree ("workspace_subdomain", "updated_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "students_workspace_status_updated_at_active_idx" ON "students" USING btree ("workspace_subdomain", "status", "updated_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "students_workspace_registered_date_active_idx" ON "students" USING btree ("workspace_subdomain", "registered_date" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "students_workspace_gr_number_active_idx" ON "students" USING btree ("workspace_subdomain", "gr_number") WHERE "deleted_at" IS NULL;

-- Teachers: status + updated_at sort, default updated_at sort
CREATE INDEX IF NOT EXISTS "teachers_workspace_updated_at_active_idx" ON "teachers" USING btree ("workspace_subdomain", "updated_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "teachers_workspace_status_updated_at_active_idx" ON "teachers" USING btree ("workspace_subdomain", "status", "updated_at" DESC) WHERE "deleted_at" IS NULL;

-- Contacts: gender filter, gender + updated_at sort, name sort
CREATE INDEX IF NOT EXISTS "contacts_workspace_gender_active_idx" ON "contacts" USING btree ("workspace_subdomain", "gender") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "contacts_workspace_gender_updated_at_active_idx" ON "contacts" USING btree ("workspace_subdomain", "gender", "updated_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "contacts_workspace_name_active_idx" ON "contacts" USING btree ("workspace_subdomain", "name") WHERE "deleted_at" IS NULL;
