-- 0041_column_prefs_tables.sql
-- Typed per-user column-prefs tables for modules still on the `objects` document-store KV:
-- accounting (accounts/journal), examinations (exam/results), question bank, attendance, and
-- the missing finance payments table (the existing `finance_user_column_prefs` serves invoices).
-- Mirrors the contact/session pattern: composite PK (workspace_subdomain, user_id), no FK on
-- user_id, FORCE ROW LEVEL SECURITY + tenant_isolation_policy. Idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).

CREATE TABLE IF NOT EXISTS "attendance_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "attendance_user_column_prefs" ADD CONSTRAINT "attendance_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attendance_user_column_prefs_workspace_idx" ON "attendance_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "attendance_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "attendance_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "attendance_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "attendance_user_column_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "accounting_account_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_account_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "accounting_account_user_column_prefs" ADD CONSTRAINT "accounting_account_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_account_user_column_prefs_workspace_idx" ON "accounting_account_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "accounting_account_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_account_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "accounting_account_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "accounting_account_user_column_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "accounting_journal_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounting_journal_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "accounting_journal_user_column_prefs" ADD CONSTRAINT "accounting_journal_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounting_journal_user_column_prefs_workspace_idx" ON "accounting_journal_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "accounting_journal_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_journal_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "accounting_journal_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "accounting_journal_user_column_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "finance_payment_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "finance_payment_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "finance_payment_user_column_prefs" ADD CONSTRAINT "finance_payment_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "finance_payment_user_column_prefs_workspace_idx" ON "finance_payment_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "finance_payment_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "finance_payment_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "finance_payment_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "finance_payment_user_column_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "examination_exam_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "examination_exam_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "examination_exam_user_column_prefs" ADD CONSTRAINT "examination_exam_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "examination_exam_user_column_prefs_workspace_idx" ON "examination_exam_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "examination_exam_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "examination_exam_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "examination_exam_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "examination_exam_user_column_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "examination_results_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "examination_results_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "examination_results_user_column_prefs" ADD CONSTRAINT "examination_results_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "examination_results_user_column_prefs_workspace_idx" ON "examination_results_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "examination_results_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "examination_results_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "examination_results_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "examination_results_user_column_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "question_bank_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "question_bank_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);--> statement-breakpoint
ALTER TABLE "question_bank_user_column_prefs" ADD CONSTRAINT "question_bank_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "question_bank_user_column_prefs_workspace_idx" ON "question_bank_user_column_prefs" USING btree ("workspace_subdomain");--> statement-breakpoint
ALTER TABLE "question_bank_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "question_bank_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "question_bank_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "question_bank_user_column_prefs" FORCE ROW LEVEL SECURITY;