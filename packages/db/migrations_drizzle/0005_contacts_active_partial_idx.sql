-- Hot active Contacts lists/metrics — partial index matching tenant_users pattern.
CREATE INDEX IF NOT EXISTS "contacts_workspace_active_idx" ON "contacts" USING btree ("workspace_subdomain") WHERE "deleted_at" IS NULL;
