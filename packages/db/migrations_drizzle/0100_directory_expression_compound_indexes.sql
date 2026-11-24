-- 0100_directory_expression_compound_indexes.sql
-- Multi-tenant partial expression compound indexes for canonical directory filtering and sorting.
-- Eliminates sequential table scans, heap rechecks, and in-memory sort spills on active rows (deleted_at IS NULL).

-- Students: case-insensitive status expression compound indexes
CREATE INDEX IF NOT EXISTS "students_workspace_status_expr_updated_at_active_idx" ON "students" USING btree ("workspace_subdomain", (lower(btrim(COALESCE("status", 'active')))), "updated_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "students_workspace_status_expr_id_active_idx" ON "students" USING btree ("workspace_subdomain", (lower(btrim(COALESCE("status", 'active')))), "id" ASC) WHERE "deleted_at" IS NULL;

-- Teachers: case-insensitive status expression compound indexes
CREATE INDEX IF NOT EXISTS "teachers_workspace_status_expr_updated_at_active_idx" ON "teachers" USING btree ("workspace_subdomain", (lower(btrim(COALESCE("status", 'active')))), "updated_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "teachers_workspace_status_expr_id_active_idx" ON "teachers" USING btree ("workspace_subdomain", (lower(btrim(COALESCE("status", 'active')))), "id" ASC) WHERE "deleted_at" IS NULL;

-- Contacts: case-insensitive gender expression compound indexes + is_syed filter index
CREATE INDEX IF NOT EXISTS "contacts_workspace_gender_expr_updated_at_active_idx" ON "contacts" USING btree ("workspace_subdomain", (lower(btrim(COALESCE("gender", '')))), "updated_at" DESC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "contacts_workspace_gender_expr_id_active_idx" ON "contacts" USING btree ("workspace_subdomain", (lower(btrim(COALESCE("gender", '')))), "id" ASC) WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "contacts_workspace_is_syed_active_idx" ON "contacts" USING btree ("workspace_subdomain", "is_syed", "updated_at" DESC) WHERE "deleted_at" IS NULL;
