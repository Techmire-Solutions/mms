-- 0099_directory_cursor_compound_indexes.sql
-- Multi-tenant partial compound indexes for cursor/keyset pagination and indexed offset scans.
-- Eliminates heap rechecks and sort spills on active rows (deleted_at IS NULL).

-- Students: default id sort, status + id sort, created_at sort
CREATE INDEX IF NOT EXISTS "students_workspace_id_active_idx" ON "students" USING btree ("workspace_subdomain", "id" ASC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "students_workspace_status_id_active_idx" ON "students" USING btree ("workspace_subdomain", "status", "id" ASC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "students_workspace_created_at_active_idx" ON "students" USING btree ("workspace_subdomain", "created_at" DESC) WHERE "deleted_at" IS NULL;

-- Contacts: default id sort, gender + id sort, gender + created_at sort, first_name / last_name active sorts
CREATE INDEX IF NOT EXISTS "contacts_workspace_id_active_idx" ON "contacts" USING btree ("workspace_subdomain", "id" ASC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "contacts_workspace_gender_id_active_idx" ON "contacts" USING btree ("workspace_subdomain", "gender", "id" ASC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "contacts_workspace_gender_created_at_active_idx" ON "contacts" USING btree ("workspace_subdomain", "gender", "created_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "contacts_workspace_first_name_active_idx" ON "contacts" USING btree ("workspace_subdomain", "first_name") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "contacts_workspace_last_name_active_idx" ON "contacts" USING btree ("workspace_subdomain", "last_name") WHERE "deleted_at" IS NULL;

-- Teachers: default id sort, status + id sort, created_at sort, specialization active, employee_id active
CREATE INDEX IF NOT EXISTS "teachers_workspace_id_active_idx" ON "teachers" USING btree ("workspace_subdomain", "id" ASC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "teachers_workspace_status_id_active_idx" ON "teachers" USING btree ("workspace_subdomain", "status", "id" ASC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "teachers_workspace_created_at_active_idx" ON "teachers" USING btree ("workspace_subdomain", "created_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "teachers_workspace_specialization_active_idx" ON "teachers" USING btree ("workspace_subdomain", "specialization") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "teachers_workspace_employee_id_active_idx" ON "teachers" USING btree ("workspace_subdomain", "employee_id") WHERE "deleted_at" IS NULL;
