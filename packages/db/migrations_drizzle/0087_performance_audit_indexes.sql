-- Performance audit indexes: foreign keys, composite filters, and sorting predicates

-- Students foreign key indexes
CREATE INDEX IF NOT EXISTS "students_workspace_father_contact_idx" ON "students" USING btree ("workspace_subdomain", "father_contact_id");
CREATE INDEX IF NOT EXISTS "students_workspace_mother_contact_idx" ON "students" USING btree ("workspace_subdomain", "mother_contact_id");
CREATE INDEX IF NOT EXISTS "students_workspace_guardian_contact_idx" ON "students" USING btree ("workspace_subdomain", "guardian_contact_id");

-- Teachers foreign key index
CREATE INDEX IF NOT EXISTS "teachers_workspace_user_idx" ON "teachers" USING btree ("workspace_subdomain", "user_id");

-- Tenant users foreign key & filter indexes
CREATE INDEX IF NOT EXISTS "tenant_users_workspace_contact_idx" ON "tenant_users" USING btree ("workspace_subdomain", "contact_id");
CREATE INDEX IF NOT EXISTS "tenant_users_workspace_contact_active_idx" ON "tenant_users" USING btree ("workspace_subdomain", "contact_id") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "tenant_users_workspace_role_active_idx" ON "tenant_users" USING btree ("workspace_subdomain", "role") WHERE "deleted_at" IS NULL;

-- Hasanat distributions foreign key index
CREATE INDEX IF NOT EXISTS "hasanat_dist_workspace_teacher_idx" ON "hasanat_distributions" USING btree ("workspace_subdomain", "recipient_teacher_id");

-- Enrollments invoice link index
CREATE INDEX IF NOT EXISTS "enrollments_workspace_invoice_idx" ON "enrollments" USING btree ("workspace_subdomain", "invoice_id");

-- Accounting journal lines account foreign key index
CREATE INDEX IF NOT EXISTS "accounting_lines_workspace_account_idx" ON "accounting_journal_lines" USING btree ("workspace_subdomain", "account_id");

-- Attendance filter and active composite indexes
CREATE INDEX IF NOT EXISTS "attendance_workspace_status_idx" ON "attendance" USING btree ("workspace_subdomain", "status");
CREATE INDEX IF NOT EXISTS "attendance_workspace_class_date_active_idx" ON "attendance" USING btree ("workspace_subdomain", "class_id", "date") WHERE "deleted_at" IS NULL;

-- Message logs user and sentAt sort index
CREATE INDEX IF NOT EXISTS "message_logs_workspace_user_sent_active_idx" ON "message_logs" USING btree ("workspace_subdomain", "user_id", "sent_at" DESC) WHERE "deleted_at" IS NULL;

-- Background jobs user sort index
CREATE INDEX IF NOT EXISTS "background_jobs_tenant_user_created_idx" ON "background_jobs" USING btree ("tenant_id", "user_id", "created_at" DESC);

-- Saved reports category sort index
CREATE INDEX IF NOT EXISTS "saved_reports_workspace_category_created_idx" ON "saved_reports" USING btree ("workspace_subdomain", "category", "created_at" DESC);

-- Audit logs user changedAt sort index
CREATE INDEX IF NOT EXISTS "audit_logs_workspace_user_changed_idx" ON "audit_logs" USING btree ("workspace_subdomain", "user_id", "changed_at" DESC);
