-- Students Work hot-path expression indexes (status / GR filters in listStudentsPage).
-- Expression indexes are SQL SSOT (Drizzle schema cannot express them cleanly).
CREATE INDEX IF NOT EXISTS "students_workspace_status_active_idx"
  ON "students" USING btree (
    "workspace_subdomain",
    (lower(trim(COALESCE(custom_data->>'status', 'active'))))
  )
  WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_workspace_gr_active_idx"
  ON "students" USING btree (
    "workspace_subdomain",
    (lower(trim(custom_data->>'grNumber')))
  )
  WHERE "deleted_at" IS NULL
    AND NULLIF(trim(custom_data->>'grNumber'), '') IS NOT NULL;
