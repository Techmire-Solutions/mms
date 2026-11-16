-- MMS Forward-only Migration: 0262_easy_leech.sql
--
-- Reconciles a pre-existing schema.ts ↔ database drift and adds the bank-statement
-- hardening columns:
--
--   * Drift: CHECK/FK/index definitions in schema.ts had evolved past the applied
--     migrations (e.g. `attendance_status_check` gained 'half_day' in 0224), and two
--     constraints (`hasanat_denoms_points_max_chk`, `exam_eligibility_overrides_reason_check`)
--     were removed from schema.ts. This migration syncs the database to schema.ts.
--   * Part B: `accounting_bank_statements.currency` (nullable = functional currency, backfilled
--     from the account's `account_currency`) and `accounting_bank_reconciliations.statement_id`
--     plus its composite FK (server-derived; legacy rows stay NULL and are unconstrained).
--
-- REVIEWED EXCEPTION (metadata repair): the committed meta/*_snapshot.json chain was malformed
-- (hasanat_student_awards missing name/schema, 0000 prevId null, duplicate snapshot ids, and
-- schema "public" vs ""), which blocked `drizzle-kit generate`. Those snapshot files were repaired
-- to the serialization the current toolchain emits. The snapshots are diff metadata, not applied
-- DDL — no .sql migration was rewritten — so this is a metadata repair, not a retcon of applied
-- history. This migration and its snapshot are append-only (new files).
SET LOCAL lock_timeout = '2s';

ALTER TABLE "attendance" DROP CONSTRAINT "attendance_status_check";--> statement-breakpoint
ALTER TABLE "attendance_leaves" DROP CONSTRAINT "attendance_leaves_status_check";--> statement-breakpoint
ALTER TABLE "attendance_leaves" DROP CONSTRAINT "attendance_leaves_type_check";--> statement-breakpoint
ALTER TABLE "attendance_leaves" DROP CONSTRAINT "attendance_leaves_approved_reviewed_check";--> statement-breakpoint
ALTER TABLE "accounting_accounts" DROP CONSTRAINT "accounting_accounts_parent_not_self_chk";--> statement-breakpoint
ALTER TABLE "exam_results" DROP CONSTRAINT "exam_results_moderation_reason_check";--> statement-breakpoint
ALTER TABLE "questions" DROP CONSTRAINT "questions_status_check";--> statement-breakpoint
ALTER TABLE "tests" DROP CONSTRAINT "tests_published_pair_check";--> statement-breakpoint
ALTER TABLE "hasanat_denoms" DROP CONSTRAINT "hasanat_denoms_points_max_chk";--> statement-breakpoint
ALTER TABLE "workshop_events" DROP CONSTRAINT "workshop_events_deadline_check";--> statement-breakpoint
ALTER TABLE "workshop_events" DROP CONSTRAINT "workshop_events_criteria_check";--> statement-breakpoint
ALTER TABLE "workshop_module_preferences" DROP CONSTRAINT "workshop_module_preferences_range_check";--> statement-breakpoint
ALTER TABLE "exam_eligibility_overrides" DROP CONSTRAINT "exam_eligibility_overrides_reason_check";--> statement-breakpoint
ALTER TABLE "question_attachments" DROP CONSTRAINT "question_attachments_kind_check";--> statement-breakpoint
ALTER TABLE "finance_invoices" DROP CONSTRAINT "finance_invoices_enrollment_fk";
--> statement-breakpoint
ALTER TABLE "accounting_accounts" DROP CONSTRAINT "accounting_accounts_parent_fk";
--> statement-breakpoint
ALTER TABLE "attendance_day_submissions" DROP CONSTRAINT "attendance_day_submissions_workspace_fk";
--> statement-breakpoint
ALTER TABLE "attendance_absence_alerts" DROP CONSTRAINT "attendance_absence_alerts_workspace_fk";
--> statement-breakpoint
ALTER TABLE "exam_eligibility_overrides" DROP CONSTRAINT "exam_eligibility_overrides_workspace_fk";
--> statement-breakpoint
ALTER TABLE "hasanat_student_awards" DROP CONSTRAINT "hasanat_student_awards_student_fk";
--> statement-breakpoint
DROP INDEX "registration_applications_waitlist_expiry_idx";--> statement-breakpoint
DROP INDEX "questions_ws_updated_active_idx";--> statement-breakpoint
DROP INDEX "questions_ws_active_status_updated_idx";--> statement-breakpoint
DROP INDEX "hasanat_dist_ws_updated_active_idx";--> statement-breakpoint
DROP INDEX "hasanat_dist_ws_status_updated_active_idx";--> statement-breakpoint
DROP INDEX "hasanat_dist_ws_student_issued_active_idx";--> statement-breakpoint
DROP INDEX "hasanat_redemp_ws_dist_created_idx";--> statement-breakpoint
DROP INDEX "hasanat_redemp_ws_created_idx";--> statement-breakpoint
DROP INDEX "workshop_events_program_idx";--> statement-breakpoint
DROP INDEX "workshop_events_subject_idx";--> statement-breakpoint
DROP INDEX "tenant_notifications_workspace_dedupe_uidx";--> statement-breakpoint
ALTER TABLE "workshop_events" ALTER COLUMN "status" SET DEFAULT 'open';--> statement-breakpoint
ALTER TABLE "accounting_bank_reconciliations" ADD COLUMN "statement_id" text;--> statement-breakpoint
ALTER TABLE "accounting_bank_statements" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_workspace_subdomain_parent_account_id_accounting_accounts_workspace_subdomain_id_fk" FOREIGN KEY ("workspace_subdomain","parent_account_id") REFERENCES "public"."accounting_accounts"("workspace_subdomain","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounting_bank_reconciliations" ADD CONSTRAINT "accounting_bank_reconciliations_workspace_subdomain_statement_id_statement_line_id_accounting_bank_statement_lines_workspace_subdomain_statement_id_id_fk" FOREIGN KEY ("workspace_subdomain","statement_id","statement_line_id") REFERENCES "public"."accounting_bank_statement_lines"("workspace_subdomain","statement_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_day_submissions" ADD CONSTRAINT "attendance_day_submissions_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_absence_alerts" ADD CONSTRAINT "attendance_absence_alerts_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_eligibility_overrides" ADD CONSTRAINT "exam_eligibility_overrides_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hasanat_student_awards" ADD CONSTRAINT "hasanat_student_awards_workspace_subdomain_student_id_students_workspace_subdomain_id_fk" FOREIGN KEY ("workspace_subdomain","student_id") REFERENCES "public"."students"("workspace_subdomain","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "questions_ws_updated_active_idx" ON "questions" USING btree ("workspace_subdomain","updated_at" DESC NULLS LAST) WHERE "questions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "questions_ws_active_status_updated_idx" ON "questions" USING btree ("workspace_subdomain","status","updated_at" DESC NULLS LAST) WHERE "questions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "hasanat_dist_ws_updated_active_idx" ON "hasanat_distributions" USING btree ("workspace_subdomain","updated_at" DESC NULLS LAST) WHERE "hasanat_distributions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "hasanat_dist_ws_status_updated_active_idx" ON "hasanat_distributions" USING btree ("workspace_subdomain","status","updated_at" DESC NULLS LAST) WHERE "hasanat_distributions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "hasanat_dist_ws_student_issued_active_idx" ON "hasanat_distributions" USING btree ("workspace_subdomain","recipient_student_id","issued_date" DESC NULLS LAST) WHERE "hasanat_distributions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "hasanat_redemp_ws_dist_created_idx" ON "hasanat_redemptions" USING btree ("workspace_subdomain","distribution_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "hasanat_redemp_ws_created_idx" ON "hasanat_redemptions" USING btree ("workspace_subdomain","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "workshop_events_program_idx" ON "workshop_events" USING btree ("workspace_subdomain","program_id") WHERE "workshop_events"."program_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "workshop_events_subject_idx" ON "workshop_events" USING btree ("workspace_subdomain","subject_id") WHERE "workshop_events"."subject_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "tenant_notifications_workspace_dedupe_uidx" ON "tenant_notifications" USING btree ("workspace_subdomain","dedupe_key") WHERE "tenant_notifications"."dedupe_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_status_check" CHECK ("attendance"."status" IN ('present', 'absent', 'late', 'half_day', 'excused'));--> statement-breakpoint
ALTER TABLE "attendance_leaves" ADD CONSTRAINT "attendance_leaves_status_check" CHECK ("attendance_leaves"."status" IN ('pending', 'approved', 'rejected', 'cancelled'));--> statement-breakpoint
ALTER TABLE "attendance_leaves" ADD CONSTRAINT "attendance_leaves_type_check" CHECK ("attendance_leaves"."leave_type" IN ('medical', 'personal', 'family', 'other'));--> statement-breakpoint
ALTER TABLE "attendance_leaves" ADD CONSTRAINT "attendance_leaves_approved_reviewed_check" CHECK ("attendance_leaves"."status" <> 'approved' OR "attendance_leaves"."reviewed_at" IS NOT NULL);--> statement-breakpoint
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_parent_not_self_chk" CHECK ("accounting_accounts"."parent_account_id" is null or "accounting_accounts"."parent_account_id" <> "accounting_accounts"."id");--> statement-breakpoint
ALTER TABLE "accounting_bank_statements" ADD CONSTRAINT "accounting_bank_statements_currency_iso" CHECK ("accounting_bank_statements"."currency" IS NULL OR "accounting_bank_statements"."currency" ~ '^[A-Z]{3}$');--> statement-breakpoint
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_moderation_reason_check" CHECK ("exam_results"."grace_marks" = 0 OR btrim(coalesce("exam_results"."moderation_reason", '')) <> '');--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_status_check" CHECK ("questions"."status" IN ('draft', 'under_review', 'approved', 'retired'));--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_published_pair_check" CHECK (("tests"."published_at" is null) = ("tests"."published_by" is null));--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_deadline_check" CHECK ("workshop_events"."registration_deadline" IS NULL
          OR coalesce("workshop_events"."end_date", "workshop_events"."start_date") IS NULL
          OR "workshop_events"."registration_deadline" <= coalesce("workshop_events"."end_date", "workshop_events"."start_date"));--> statement-breakpoint
ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_criteria_check" CHECK (("workshop_events"."min_attendance_pct" IS NULL OR "workshop_events"."min_attendance_pct" BETWEEN 0 AND 100)
          AND ("workshop_events"."min_score_pct" IS NULL OR "workshop_events"."min_score_pct" BETWEEN 0 AND 100));--> statement-breakpoint
ALTER TABLE "workshop_module_preferences" ADD CONSTRAINT "workshop_module_preferences_range_check" CHECK (("workshop_module_preferences"."default_min_attendance_pct" IS NULL
            OR "workshop_module_preferences"."default_min_attendance_pct" BETWEEN 0 AND 100)
          AND ("workshop_module_preferences"."default_min_score_pct" IS NULL
            OR "workshop_module_preferences"."default_min_score_pct" BETWEEN 0 AND 100));--> statement-breakpoint
ALTER TABLE "question_attachments" ADD CONSTRAINT "question_attachments_kind_check" CHECK ("question_attachments"."kind" IN ('stem', 'option'));--> statement-breakpoint
--> statement-breakpoint
UPDATE "accounting_bank_statements" s
SET "currency" = a."account_currency"
FROM "accounting_accounts" a
WHERE a."workspace_subdomain" = s."workspace_subdomain"
  AND a."id" = s."account_id"
  AND a."account_currency" IS NOT NULL
  AND s."currency" IS NULL;
