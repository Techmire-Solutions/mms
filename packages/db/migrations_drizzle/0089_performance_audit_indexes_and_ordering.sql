-- Performance audit indexes: composite ordering, tenant lookup, and entity filter indexes

-- Tenant users active name sorting index
CREATE INDEX IF NOT EXISTS "tenant_users_workspace_name_active_idx" ON "tenant_users" USING btree ("workspace_subdomain", "name") WHERE "deleted_at" IS NULL;

-- System activity and audit log ordering indexes
CREATE INDEX IF NOT EXISTS "user_activity_logs_workspace_ts_desc_idx" ON "user_activity_logs" USING btree ("workspace_subdomain", "ts" DESC);
CREATE INDEX IF NOT EXISTS "audit_log_entries_workspace_at_desc_idx" ON "audit_log_entries" USING btree ("workspace_subdomain", "at" DESC);

-- Inventory entity filter indexes
CREATE INDEX IF NOT EXISTS "inventory_items_workspace_type_idx" ON "inventory_items" USING btree ("workspace_subdomain", "item_type");
CREATE INDEX IF NOT EXISTS "inventory_items_workspace_name_idx" ON "inventory_items" USING btree ("workspace_subdomain", "name");
CREATE INDEX IF NOT EXISTS "ecommerce_orders_workspace_status_date_idx" ON "ecommerce_orders" USING btree ("workspace_subdomain", "status", "order_date" DESC);

-- Charity entity filter indexes
CREATE INDEX IF NOT EXISTS "charity_fidya_workspace_status_idx" ON "charity_fidya_records" USING btree ("workspace_subdomain", "distribution_status");
CREATE INDEX IF NOT EXISTS "fundraising_campaigns_workspace_status_idx" ON "fundraising_campaigns" USING btree ("workspace_subdomain", "status");

-- Workshops event date index
CREATE INDEX IF NOT EXISTS "workshop_events_workspace_start_date_idx" ON "workshop_events" USING btree ("workspace_subdomain", "start_date");
