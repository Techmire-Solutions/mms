-- Students Work gender filter expression index (aligns with genderExpr() in listStudentsPage).
-- Expression indexes are SQL SSOT (Drizzle schema cannot express them cleanly).
CREATE INDEX IF NOT EXISTS "students_workspace_gender_active_idx"
  ON "students" USING btree (
    "workspace_subdomain",
    (lower(trim(COALESCE(custom_data->>'gender', ''))))
  )
  WHERE "deleted_at" IS NULL;
