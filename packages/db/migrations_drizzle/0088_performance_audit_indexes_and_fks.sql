-- Performance audit indexes: foreign key B-Trees and composite filter/sorting predicates

-- Charity foreign key indexes
CREATE INDEX IF NOT EXISTS "orphan_profiles_workspace_sponsor_idx" ON "orphan_profiles" USING btree ("workspace_subdomain", "sponsor_contact_id");
CREATE INDEX IF NOT EXISTS "fatwa_tickets_workspace_mufti_idx" ON "fatwa_tickets" USING btree ("workspace_subdomain", "assigned_mufti_id");
CREATE INDEX IF NOT EXISTS "fundraising_coupons_workspace_campaign_idx" ON "fundraising_coupons" USING btree ("workspace_subdomain", "campaign_id");

-- Workshops foreign key indexes
CREATE INDEX IF NOT EXISTS "workshop_participants_workspace_workshop_idx" ON "workshop_participants" USING btree ("workspace_subdomain", "workshop_id");
CREATE INDEX IF NOT EXISTS "workshop_participants_workspace_contact_idx" ON "workshop_participants" USING btree ("workspace_subdomain", "contact_id");
CREATE INDEX IF NOT EXISTS "workshop_scores_workspace_workshop_idx" ON "workshop_scores" USING btree ("workspace_subdomain", "workshop_id");
CREATE INDEX IF NOT EXISTS "workshop_scores_workspace_participant_idx" ON "workshop_scores" USING btree ("workspace_subdomain", "participant_id");
CREATE INDEX IF NOT EXISTS "competition_participants_workspace_comp_idx" ON "competition_participants" USING btree ("workspace_subdomain", "competition_id");
CREATE INDEX IF NOT EXISTS "competition_participants_workspace_student_idx" ON "competition_participants" USING btree ("workspace_subdomain", "student_id");

-- Inventory foreign key indexes
CREATE INDEX IF NOT EXISTS "inventory_sales_workspace_item_idx" ON "inventory_sales" USING btree ("workspace_subdomain", "item_id");
CREATE INDEX IF NOT EXISTS "inventory_sales_workspace_student_idx" ON "inventory_sales" USING btree ("workspace_subdomain", "student_id");

-- Question Bank assessment answers foreign key index
CREATE INDEX IF NOT EXISTS "assessment_answers_workspace_question_idx" ON "assessment_answers" USING btree ("workspace_subdomain", "question_id");

-- Accounting entries composite fiscal year + date sort index
CREATE INDEX IF NOT EXISTS "accounting_entries_workspace_fiscal_date_active_idx" ON "accounting_entries" USING btree ("workspace_subdomain", "fiscal_year", "date" DESC) WHERE "deleted_at" IS NULL;

-- Finance invoices composite status + due date sort index
CREATE INDEX IF NOT EXISTS "finance_invoices_workspace_status_due_active_idx" ON "finance_invoices" USING btree ("workspace_subdomain", "status", "due_date") WHERE "deleted_at" IS NULL;

-- Message logs composite channel + status + sentAt sort index
CREATE INDEX IF NOT EXISTS "message_logs_workspace_channel_status_sent_active_idx" ON "message_logs" USING btree ("workspace_subdomain", "channel", "status", "sent_at" DESC) WHERE "deleted_at" IS NULL;
