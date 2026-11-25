-- 0117_attendance_composite_active_idx.sql
-- Composite active index for Attendance Work directory and command metrics
CREATE INDEX IF NOT EXISTS "attendance_workspace_class_date_status_active_idx" ON "attendance" USING btree ("workspace_subdomain", "class_id", "date", "status") WHERE "deleted_at" IS NULL;
