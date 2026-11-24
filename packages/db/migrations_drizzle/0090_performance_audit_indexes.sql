-- Performance audit indexes: foreign key lookups, composite ordering, and entity filter predicates

-- Contact relationships inferred link index
CREATE INDEX IF NOT EXISTS "contact_relationships_workspace_inferred_idx" ON "contact_relationships" USING btree ("workspace_subdomain", "inferred_from_contact_id");

-- Question citations book index
CREATE INDEX IF NOT EXISTS "question_citations_workspace_book_idx" ON "question_citations" USING btree ("workspace_subdomain", "book_id");

-- Finance payments user lookup and date ordering indexes
CREATE INDEX IF NOT EXISTS "finance_payments_workspace_received_by_idx" ON "finance_payments" USING btree ("workspace_subdomain", "received_by_user_id");
CREATE INDEX IF NOT EXISTS "finance_payments_workspace_date_active_idx" ON "finance_payments" USING btree ("workspace_subdomain", "date" DESC) WHERE "deleted_at" IS NULL;

-- Hasanat user attribution indexes
CREATE INDEX IF NOT EXISTS "hasanat_batches_workspace_added_by_idx" ON "hasanat_batches" USING btree ("workspace_subdomain", "added_by_user_id");
CREATE INDEX IF NOT EXISTS "hasanat_dist_workspace_issued_by_idx" ON "hasanat_distributions" USING btree ("workspace_subdomain", "issued_by_user_id");
CREATE INDEX IF NOT EXISTS "hasanat_redemp_workspace_approved_by_idx" ON "hasanat_redemptions" USING btree ("workspace_subdomain", "approved_by_user_id");

-- System audit log and background job module indexes
CREATE INDEX IF NOT EXISTS "audit_log_entries_workspace_entity_idx" ON "audit_log_entries" USING btree ("workspace_subdomain", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "background_jobs_tenant_module_idx" ON "background_jobs" USING btree ("tenant_id", "module_id");

-- Obligations active date sorting index
CREATE INDEX IF NOT EXISTS "obligation_collections_workspace_date_active_idx" ON "obligation_collections" USING btree ("workspace_subdomain", "received_date" DESC) WHERE "deleted_at" IS NULL;

-- Sessions active start date sorting index
CREATE INDEX IF NOT EXISTS "sessions_workspace_start_date_active_idx" ON "sessions" USING btree ("workspace_subdomain", "start_date") WHERE "deleted_at" IS NULL;

-- Assessment results test lookup active index
CREATE INDEX IF NOT EXISTS "assessment_results_workspace_test_active_idx" ON "assessment_results" USING btree ("workspace_subdomain", "test_id") WHERE "deleted_at" IS NULL;
