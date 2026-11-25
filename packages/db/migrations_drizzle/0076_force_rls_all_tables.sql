
ALTER TABLE "dashboard_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dashboard_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "dashboard_preferences";
CREATE POLICY tenant_isolation_policy ON "dashboard_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "email_integrations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "email_integrations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "email_integrations";
CREATE POLICY tenant_isolation_policy ON "email_integrations" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "dashboard_widgets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dashboard_widgets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "dashboard_widgets";
CREATE POLICY tenant_isolation_policy ON "dashboard_widgets" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "attendance_leaves" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_leaves" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "attendance_leaves";
CREATE POLICY tenant_isolation_policy ON "attendance_leaves" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "enrollments";
CREATE POLICY tenant_isolation_policy ON "enrollments" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "enrollment_timeline_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollment_timeline_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "enrollment_timeline_events";
CREATE POLICY tenant_isolation_policy ON "enrollment_timeline_events" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "examinations_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "examinations_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "examinations_field_configs";
CREATE POLICY tenant_isolation_policy ON "examinations_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "examinations_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "examinations_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "examinations_module_preferences";
CREATE POLICY tenant_isolation_policy ON "examinations_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "question_bank_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_bank_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "question_bank_field_configs";
CREATE POLICY tenant_isolation_policy ON "question_bank_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "hasanat_denoms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_denoms" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_denoms";
CREATE POLICY tenant_isolation_policy ON "hasanat_denoms" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "hasanat_batches" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_batches" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_batches";
CREATE POLICY tenant_isolation_policy ON "hasanat_batches" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "hasanat_distributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_distributions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_distributions";
CREATE POLICY tenant_isolation_policy ON "hasanat_distributions" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_emails" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_emails" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_emails";
CREATE POLICY tenant_isolation_policy ON "contact_emails" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_phones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_phones" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_phones";
CREATE POLICY tenant_isolation_policy ON "contact_phones" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "exam_classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_classes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "exam_classes";
CREATE POLICY tenant_isolation_policy ON "exam_classes" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_socials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_socials" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_socials";
CREATE POLICY tenant_isolation_policy ON "contact_socials" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_addresses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_addresses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_addresses";
CREATE POLICY tenant_isolation_policy ON "contact_addresses" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "finance_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_invoices" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "finance_invoices";
CREATE POLICY tenant_isolation_policy ON "finance_invoices" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "finance_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_payments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "finance_payments";
CREATE POLICY tenant_isolation_policy ON "finance_payments" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_relationships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_relationships" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_relationships";
CREATE POLICY tenant_isolation_policy ON "contact_relationships" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_activities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_activities" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_activities";
CREATE POLICY tenant_isolation_policy ON "contact_activities" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_attachments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_attachments";
CREATE POLICY tenant_isolation_policy ON "contact_attachments" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_educations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_educations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_educations";
CREATE POLICY tenant_isolation_policy ON "contact_educations" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "tenant_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_users" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "tenant_users";
CREATE POLICY tenant_isolation_policy ON "tenant_users" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "accounting_journal_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_journal_lines" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_journal_lines";
CREATE POLICY tenant_isolation_policy ON "accounting_journal_lines" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "accounting_entry_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_entry_tags" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_entry_tags";
CREATE POLICY tenant_isolation_policy ON "accounting_entry_tags" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "accounting_entry_attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_entry_attachments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_entry_attachments";
CREATE POLICY tenant_isolation_policy ON "accounting_entry_attachments" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "accounting_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_accounts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_accounts";
CREATE POLICY tenant_isolation_policy ON "accounting_accounts" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "accounting_fiscal_years" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_fiscal_years" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_fiscal_years";
CREATE POLICY tenant_isolation_policy ON "accounting_fiscal_years" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "hasanat_redemptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_redemptions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_redemptions";
CREATE POLICY tenant_isolation_policy ON "hasanat_redemptions" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "accounting_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_entries" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_entries";
CREATE POLICY tenant_isolation_policy ON "accounting_entries" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "audit_logs";
CREATE POLICY tenant_isolation_policy ON "audit_logs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "message_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_templates" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "message_templates";
CREATE POLICY tenant_isolation_policy ON "message_templates" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "attendance";
CREATE POLICY tenant_isolation_policy ON "attendance" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "exams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exams" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "exams";
CREATE POLICY tenant_isolation_policy ON "exams" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "exam_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exam_results" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "exam_results";
CREATE POLICY tenant_isolation_policy ON "exam_results" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);


ALTER TABLE "saved_reports" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "saved_reports" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "saved_reports";
CREATE POLICY tenant_isolation_policy ON "saved_reports" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_google_sync_credentials" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_google_sync_credentials" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_google_sync_credentials";
CREATE POLICY tenant_isolation_policy ON "contact_google_sync_credentials" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "user_activity_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_activity_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "user_activity_logs";
CREATE POLICY tenant_isolation_policy ON "user_activity_logs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "audit_log_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_log_entries" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "audit_log_entries";
CREATE POLICY tenant_isolation_policy ON "audit_log_entries" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contacts";
CREATE POLICY tenant_isolation_policy ON "contacts" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_lookups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_lookups" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_lookups";
CREATE POLICY tenant_isolation_policy ON "contact_lookups" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_field_configs";
CREATE POLICY tenant_isolation_policy ON "contact_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_module_preferences";
CREATE POLICY tenant_isolation_policy ON "contact_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "contact_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "questions";
CREATE POLICY tenant_isolation_policy ON "questions" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "student_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "student_module_preferences";
CREATE POLICY tenant_isolation_policy ON "student_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "question_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_categories" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "question_categories";
CREATE POLICY tenant_isolation_policy ON "question_categories" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "question_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_options" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "question_options";
CREATE POLICY tenant_isolation_policy ON "question_options" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "question_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_tags" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "question_tags";
CREATE POLICY tenant_isolation_policy ON "question_tags" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "question_citations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_citations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "question_citations";
CREATE POLICY tenant_isolation_policy ON "question_citations" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "tests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tests" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "tests";
CREATE POLICY tenant_isolation_policy ON "tests" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "test_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_questions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "test_questions";
CREATE POLICY tenant_isolation_policy ON "test_questions" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "test_sections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_sections" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "test_sections";
CREATE POLICY tenant_isolation_policy ON "test_sections" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "student_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "student_field_configs";
CREATE POLICY tenant_isolation_policy ON "student_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "student_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "student_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "student_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "student_lookups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_lookups" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "student_lookups";
CREATE POLICY tenant_isolation_policy ON "student_lookups" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "test_section_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "test_section_questions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "test_section_questions";
CREATE POLICY tenant_isolation_policy ON "test_section_questions" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "assessment_results" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessment_results" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "assessment_results";
CREATE POLICY tenant_isolation_policy ON "assessment_results" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "assessment_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "assessment_answers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "assessment_answers";
CREATE POLICY tenant_isolation_policy ON "assessment_answers" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "students" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "students" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "students";
CREATE POLICY tenant_isolation_policy ON "students" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "teacher_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "teacher_field_configs";
CREATE POLICY tenant_isolation_policy ON "teacher_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "teacher_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "teacher_module_preferences";
CREATE POLICY tenant_isolation_policy ON "teacher_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "teacher_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "teacher_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "teacher_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "student_enrolled_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_enrolled_sessions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "student_enrolled_sessions";
CREATE POLICY tenant_isolation_policy ON "student_enrolled_sessions" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "session_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "session_field_configs";
CREATE POLICY tenant_isolation_policy ON "session_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "session_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "session_module_preferences";
CREATE POLICY tenant_isolation_policy ON "session_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "session_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "session_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "session_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "user_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "user_field_configs";
CREATE POLICY tenant_isolation_policy ON "user_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "user_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "user_module_preferences";
CREATE POLICY tenant_isolation_policy ON "user_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "obligation_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obligation_types" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "obligation_types";
CREATE POLICY tenant_isolation_policy ON "obligation_types" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "mujtahids" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mujtahids" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "mujtahids";
CREATE POLICY tenant_isolation_policy ON "mujtahids" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "user_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "user_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "user_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "teacher_lookups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teacher_lookups" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "teacher_lookups";
CREATE POLICY tenant_isolation_policy ON "teacher_lookups" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "mujtahid_reps" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mujtahid_reps" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "mujtahid_reps";
CREATE POLICY tenant_isolation_policy ON "mujtahid_reps" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "wakala_types" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "wakala_types" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "wakala_types";
CREATE POLICY tenant_isolation_policy ON "wakala_types" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "obligation_distributions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obligation_distributions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "obligation_distributions";
CREATE POLICY tenant_isolation_policy ON "obligation_distributions" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "obligation_collections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obligation_collections" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "obligation_collections";
CREATE POLICY tenant_isolation_policy ON "obligation_collections" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_experiences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_experiences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_experiences";
CREATE POLICY tenant_isolation_policy ON "contact_experiences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "teachers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teachers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "teachers";
CREATE POLICY tenant_isolation_policy ON "teachers" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "enrollment_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollment_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "enrollment_field_configs";
CREATE POLICY tenant_isolation_policy ON "enrollment_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "enrollment_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollment_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "enrollment_module_preferences";
CREATE POLICY tenant_isolation_policy ON "enrollment_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "sessions";
CREATE POLICY tenant_isolation_policy ON "sessions" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "enrollment_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "enrollment_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "enrollment_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "enrollment_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "finance_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "finance_field_configs";
CREATE POLICY tenant_isolation_policy ON "finance_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "obligations_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "obligations_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "obligations_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "obligations_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "finance_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "finance_module_preferences";
CREATE POLICY tenant_isolation_policy ON "finance_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "finance_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "finance_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "finance_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "message_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "message_logs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "message_logs";
CREATE POLICY tenant_isolation_policy ON "message_logs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "question_bank_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_bank_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "question_bank_module_preferences";
CREATE POLICY tenant_isolation_policy ON "question_bank_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "session_lookups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_lookups" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "session_lookups";
CREATE POLICY tenant_isolation_policy ON "session_lookups" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "attendance_lookups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_lookups" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "attendance_lookups";
CREATE POLICY tenant_isolation_policy ON "attendance_lookups" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "hasanat_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_field_configs";
CREATE POLICY tenant_isolation_policy ON "hasanat_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "hasanat_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_module_preferences";
CREATE POLICY tenant_isolation_policy ON "hasanat_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "hasanat_distribution_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_distribution_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_distribution_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "hasanat_distribution_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "hasanat_redemption_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "hasanat_redemption_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_redemption_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "hasanat_redemption_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "attendance_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "attendance_field_configs";
CREATE POLICY tenant_isolation_policy ON "attendance_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "attendance_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "attendance_module_preferences";
CREATE POLICY tenant_isolation_policy ON "attendance_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "accounting_field_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_field_configs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_field_configs";
CREATE POLICY tenant_isolation_policy ON "accounting_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "accounting_module_preferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_module_preferences" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_module_preferences";
CREATE POLICY tenant_isolation_policy ON "accounting_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "attendance_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendance_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "attendance_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "attendance_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "accounting_account_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_account_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_account_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "accounting_account_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "accounting_journal_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_journal_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_journal_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "accounting_journal_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "session_classes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_classes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "session_classes";
CREATE POLICY tenant_isolation_policy ON "session_classes" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "finance_payment_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "finance_payment_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "finance_payment_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "finance_payment_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "session_timetable" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_timetable" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "session_timetable";
CREATE POLICY tenant_isolation_policy ON "session_timetable" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "examination_exam_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "examination_exam_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "examination_exam_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "examination_exam_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "session_discounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_discounts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "session_discounts";
CREATE POLICY tenant_isolation_policy ON "session_discounts" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "session_budget_expenses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_budget_expenses" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "session_budget_expenses";
CREATE POLICY tenant_isolation_policy ON "session_budget_expenses" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "session_budget_incomes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_budget_incomes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "session_budget_incomes";
CREATE POLICY tenant_isolation_policy ON "session_budget_incomes" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "session_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "session_events";
CREATE POLICY tenant_isolation_policy ON "session_events" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "examination_results_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "examination_results_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "examination_results_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "examination_results_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "session_tabarruk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session_tabarruk" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "session_tabarruk";
CREATE POLICY tenant_isolation_policy ON "session_tabarruk" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "question_bank_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_bank_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "question_bank_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "question_bank_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "messaging_recipients_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messaging_recipients_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "messaging_recipients_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "messaging_recipients_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "messaging_history_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messaging_history_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "messaging_history_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "messaging_history_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "messaging_templates_user_column_prefs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "messaging_templates_user_column_prefs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "messaging_templates_user_column_prefs";
CREATE POLICY tenant_isolation_policy ON "messaging_templates_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_skills" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_skills" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_skills";
CREATE POLICY tenant_isolation_policy ON "contact_skills" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "contact_tags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "contact_tags" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "contact_tags";
CREATE POLICY tenant_isolation_policy ON "contact_tags" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "background_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "background_jobs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "background_jobs";
CREATE POLICY tenant_isolation_policy ON "background_jobs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR tenant_id = current_setting('app.current_tenant', true)
);
