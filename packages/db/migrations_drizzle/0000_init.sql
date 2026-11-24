CREATE TABLE IF NOT EXISTS "accounting_accounts" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_accounts_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_entries" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_entries_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounting_fiscal_years" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_fiscal_years_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "assessment_results" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_results_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attendance" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_log_entries" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "audit_log_entries_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"workspace_subdomain" text,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"action" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"user_id" text,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_artifacts" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"lookup_key" text,
	"scope_key" text,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "auth_artifacts_kind_check" CHECK ("kind" IN (
		'handoff',
		'two_factor_challenge',
		'refresh_token',
		'platform_setup',
		'platform_password_reset',
		'login_email_change'
	))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "background_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"module_id" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"label" text NOT NULL,
	"payload" jsonb NOT NULL,
	"progress_current" integer,
	"progress_total" integer,
	"artifact_id" text,
	"has_download" boolean DEFAULT false NOT NULL,
	"error" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collections" (
	"name" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_google_sync_credentials" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text,
	"client_secret" text,
	"access_token" text,
	"refresh_token" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_google_sync_credentials_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"deleted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contacts_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "custom_tabs" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"module_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"icon" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"permissions" jsonb,
	"description" text,
	"color" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_tabs_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_migrations" (
	"id" text PRIMARY KEY NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollments" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enrollments_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exam_results" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exam_results_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "exams" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "exams_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_invoices" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_invoices_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "finance_payments" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_payments_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hasanat_batches" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hasanat_batches_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hasanat_denoms" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hasanat_denoms_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hasanat_distributions" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hasanat_distributions_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hasanat_redemptions" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hasanat_redemptions_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_logs" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_logs_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "message_templates" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "message_templates_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mujtahid_reps" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mujtahid_reps_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mujtahids" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mujtahids_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "objects" (
	"key" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "obligation_collections" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "obligation_collections_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "obligation_distributions" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "obligation_distributions_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "obligation_types" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "obligation_types_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_activity_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_email" text NOT NULL,
	"action" text NOT NULL,
	"details" jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"sync_tls_on_create" boolean DEFAULT true NOT NULL,
	"tls_extra_sans" text DEFAULT '' NOT NULL,
	"certbot_email" text DEFAULT '' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" timestamp,
	"role" text DEFAULT 'admin' NOT NULL,
	"permissions" jsonb DEFAULT '{"workspaces":false,"onboard":false}'::jsonb NOT NULL,
	"session_version" integer DEFAULT 0 NOT NULL,
	"disabled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_users_role_check" CHECK ("role" IN ('super_user', 'admin'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "questions" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "questions_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saved_reports" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb NOT NULL,
	"last_run_at" timestamp NOT NULL,
	"created_by" text NOT NULL,
	"created_by_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_reports_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"deleted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "students" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"deleted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "students_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teachers" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"deleted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "teachers_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_users" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"login_email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"role" text DEFAULT 'assistant_teacher' NOT NULL,
	"contact_id" text,
	"email_verified_at" timestamp,
	"pending_login_email" text,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"deleted_by" text,
	"profile_json" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tests" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tests_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_activity_logs" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_activity_logs_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wakala_types" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"custom_data" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wakala_types_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"subdomain" text NOT NULL,
	"madrasa_name" text NOT NULL,
	"tagline" text,
	"country" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_entries" ADD CONSTRAINT "accounting_entries_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_fiscal_years" ADD CONSTRAINT "accounting_fiscal_years_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_results" ADD CONSTRAINT "assessment_results_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log_entries" ADD CONSTRAINT "audit_log_entries_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_user_id_tenant_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_google_sync_credentials" ADD CONSTRAINT "contact_google_sync_credentials_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_tabs" ADD CONSTRAINT "custom_tabs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_invoices" ADD CONSTRAINT "finance_invoices_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_payments" ADD CONSTRAINT "finance_payments_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hasanat_batches" ADD CONSTRAINT "hasanat_batches_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hasanat_denoms" ADD CONSTRAINT "hasanat_denoms_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hasanat_distributions" ADD CONSTRAINT "hasanat_distributions_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hasanat_redemptions" ADD CONSTRAINT "hasanat_redemptions_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_logs" ADD CONSTRAINT "message_logs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_templates" ADD CONSTRAINT "message_templates_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mujtahid_reps" ADD CONSTRAINT "mujtahid_reps_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mujtahids" ADD CONSTRAINT "mujtahids_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligation_collections" ADD CONSTRAINT "obligation_collections_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligation_distributions" ADD CONSTRAINT "obligation_distributions_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obligation_types" ADD CONSTRAINT "obligation_types_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_activity_logs" ADD CONSTRAINT "platform_activity_logs_user_id_platform_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."platform_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk" FOREIGN KEY ("workspace_subdomain","contact_id") REFERENCES "public"."contacts"("workspace_subdomain","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_activity_logs" ADD CONSTRAINT "user_activity_logs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wakala_types" ADD CONSTRAINT "wakala_types_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_accounts_workspace_subdomain_idx" ON "accounting_accounts" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_accounts_custom_data_gin_idx" ON "accounting_accounts" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_subdomain_idx" ON "accounting_entries" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_entries_custom_data_gin_idx" ON "accounting_entries" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_fiscal_years_workspace_subdomain_idx" ON "accounting_fiscal_years" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_fiscal_years_custom_data_gin_idx" ON "accounting_fiscal_years" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_results_workspace_subdomain_idx" ON "assessment_results" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "assessment_results_custom_data_gin_idx" ON "assessment_results" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_workspace_subdomain_idx" ON "attendance" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_custom_data_gin_idx" ON "attendance" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_entries_workspace_subdomain_idx" ON "audit_log_entries" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_log_entries_custom_data_gin_idx" ON "audit_log_entries" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_workspace_changed_idx" ON "audit_logs" USING btree ("workspace_subdomain","changed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_table_record_idx" ON "audit_logs" USING btree ("table_name","record_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_artifacts_kind_expires_idx" ON "auth_artifacts" USING btree ("kind","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_artifacts_lookup_key_uidx" ON "auth_artifacts" USING btree ("lookup_key") WHERE "lookup_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_artifacts_scope_key_idx" ON "auth_artifacts" USING btree ("scope_key") WHERE "scope_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_activity_logs_created_at_idx" ON "platform_activity_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "background_jobs_tenant_user_idx" ON "background_jobs" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "background_jobs_status_idx" ON "background_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_workspace_subdomain_idx" ON "contacts" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_workspace_deleted_idx" ON "contacts" USING btree ("workspace_subdomain","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_custom_data_gin_idx" ON "contacts" USING gin ("custom_data");--> statement-breakpoint
CREATE UNIQUE INDEX "custom_tabs_workspace_module_key_idx" ON "custom_tabs" USING btree ("workspace_subdomain","module_id","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "custom_tabs_workspace_idx" ON "custom_tabs" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrollments_workspace_subdomain_idx" ON "enrollments" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrollments_custom_data_gin_idx" ON "enrollments" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exam_results_workspace_subdomain_idx" ON "exam_results" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exam_results_custom_data_gin_idx" ON "exam_results" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exams_workspace_subdomain_idx" ON "exams" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exams_custom_data_gin_idx" ON "exams" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_invoices_workspace_subdomain_idx" ON "finance_invoices" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_invoices_custom_data_gin_idx" ON "finance_invoices" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_payments_workspace_subdomain_idx" ON "finance_payments" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_payments_custom_data_gin_idx" ON "finance_payments" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_batches_workspace_subdomain_idx" ON "hasanat_batches" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_batches_custom_data_gin_idx" ON "hasanat_batches" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_denoms_workspace_subdomain_idx" ON "hasanat_denoms" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_denoms_custom_data_gin_idx" ON "hasanat_denoms" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_distributions_workspace_subdomain_idx" ON "hasanat_distributions" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_distributions_custom_data_gin_idx" ON "hasanat_distributions" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_redemptions_workspace_subdomain_idx" ON "hasanat_redemptions" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hasanat_redemptions_custom_data_gin_idx" ON "hasanat_redemptions" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_logs_workspace_subdomain_idx" ON "message_logs" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_logs_custom_data_gin_idx" ON "message_logs" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_templates_workspace_subdomain_idx" ON "message_templates" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_templates_custom_data_gin_idx" ON "message_templates" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mujtahid_reps_workspace_subdomain_idx" ON "mujtahid_reps" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mujtahid_reps_custom_data_gin_idx" ON "mujtahid_reps" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mujtahids_workspace_subdomain_idx" ON "mujtahids" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "mujtahids_custom_data_gin_idx" ON "mujtahids" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligation_collections_workspace_subdomain_idx" ON "obligation_collections" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligation_collections_custom_data_gin_idx" ON "obligation_collections" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligation_distributions_workspace_subdomain_idx" ON "obligation_distributions" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligation_distributions_custom_data_gin_idx" ON "obligation_distributions" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligation_types_workspace_subdomain_idx" ON "obligation_types" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "obligation_types_custom_data_gin_idx" ON "obligation_types" USING gin ("custom_data");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_users_email_idx" ON "platform_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_users_single_super_user_idx" ON "platform_users" USING btree ("role") WHERE "role" = 'super_user';--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "questions_workspace_subdomain_idx" ON "questions" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "questions_custom_data_gin_idx" ON "questions" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_reports_workspace_category_creator_idx" ON "saved_reports" USING btree ("workspace_subdomain","category","created_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_workspace_subdomain_idx" ON "sessions" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_workspace_deleted_idx" ON "sessions" USING btree ("workspace_subdomain","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_custom_data_gin_idx" ON "sessions" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_workspace_subdomain_idx" ON "students" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_workspace_deleted_idx" ON "students" USING btree ("workspace_subdomain","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "students_custom_data_gin_idx" ON "students" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teachers_workspace_subdomain_idx" ON "teachers" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teachers_workspace_deleted_idx" ON "teachers" USING btree ("workspace_subdomain","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teachers_custom_data_gin_idx" ON "teachers" USING gin ("custom_data");--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_users_workspace_login_email_active_idx" ON "tenant_users" USING btree ("workspace_subdomain","login_email") WHERE "tenant_users"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_users_workspace_idx" ON "tenant_users" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_users_workspace_deleted_idx" ON "tenant_users" USING btree ("workspace_subdomain","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tests_workspace_subdomain_idx" ON "tests" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tests_custom_data_gin_idx" ON "tests" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_activity_logs_workspace_subdomain_idx" ON "user_activity_logs" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_activity_logs_custom_data_gin_idx" ON "user_activity_logs" USING gin ("custom_data");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wakala_types_workspace_subdomain_idx" ON "wakala_types" USING btree ("workspace_subdomain");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wakala_types_custom_data_gin_idx" ON "wakala_types" USING gin ("custom_data");--> statement-breakpoint
CREATE UNIQUE INDEX "workspaces_subdomain_idx" ON "workspaces" USING btree ("subdomain");--> statement-breakpoint
-- Tenant RLS: ENABLE + exact-match policy (or app.rls_bypass) on all workspace_subdomain tables.
-- FORCE on tables that always write through withTenantTransaction.
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name = 'workspace_subdomain'
          AND c.table_name NOT IN ('tenant_users')
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON %I FOR ALL USING (
                current_setting(''app.rls_bypass'', true) = ''on''
                OR workspace_subdomain = NULLIF(current_setting(''app.current_tenant'', true), '''')
            ) WITH CHECK (
                current_setting(''app.rls_bypass'', true) = ''on''
                OR workspace_subdomain = NULLIF(current_setting(''app.current_tenant'', true), '''')
            );',
            tbl
        );
    END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "message_templates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_logs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "custom_tabs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "students" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teachers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saved_reports" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contact_google_sync_credentials" FORCE ROW LEVEL SECURITY;
