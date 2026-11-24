-- Performance audit indexes: list ORDER BY / recent-filter ordering predicates
-- Backs default list ordering on (workspace_subdomain, {created,updated}_at) for
-- contacts, enrollments, exams, and attendance (mostly active-only lists).
-- Partial indexes (WHERE deleted_at IS NULL) serve the default active-list path.

-- Contacts: default/recent list sort by createdAt / updatedAt + "recent" quick filter
CREATE INDEX IF NOT EXISTS "contacts_workspace_created_at_active_idx" ON "contacts" USING btree ("workspace_subdomain", "created_at") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "contacts_workspace_updated_at_active_idx" ON "contacts" USING btree ("workspace_subdomain", "updated_at") WHERE "deleted_at" IS NULL;

-- Enrollments: default list sort by updatedAt
CREATE INDEX IF NOT EXISTS "enrollments_workspace_updated_at_active_idx" ON "enrollments" USING btree ("workspace_subdomain", "updated_at") WHERE "deleted_at" IS NULL;

-- Exams: default list sort by updatedAt (active-only paged list)
CREATE INDEX IF NOT EXISTS "exams_workspace_updated_at_active_idx" ON "exams" USING btree ("workspace_subdomain", "updated_at") WHERE "deleted_at" IS NULL;

-- Attendance: default list sort by updatedAt
CREATE INDEX IF NOT EXISTS "attendance_workspace_updated_at_active_idx" ON "attendance" USING btree ("workspace_subdomain", "updated_at") WHERE "deleted_at" IS NULL;
