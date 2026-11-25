-- Close the Tenant RLS Coverage gap (Open Gaps Register, found 2026-09-15):
-- 17 tenant tables had no ENABLE ROW LEVEL SECURITY anywhere in the migration set,
-- so their tenant_isolation_policy was inert: 15 carried FORCE only
-- (0082_new_modules.sql); audit_trail_events / audit_verification_runs
-- (0102_modern_audit_trail.sql) had neither. FORCE alone does not enable policies.
-- custom_tabs (0000_init) was a checker false positive — dropped by
-- 0043_drop_custom_fields_and_tabs.sql, so no live database has it.
-- Pattern: 0076_force_rls_all_tables.sql.

ALTER TABLE "inventory_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_items" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "inventory_items";
CREATE POLICY tenant_isolation_policy ON "inventory_items" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "inventory_sales" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_sales" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "inventory_sales";
CREATE POLICY tenant_isolation_policy ON "inventory_sales" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "ecommerce_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ecommerce_orders" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "ecommerce_orders";
CREATE POLICY tenant_isolation_policy ON "ecommerce_orders" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "ijara_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ijara_orders" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "ijara_orders";
CREATE POLICY tenant_isolation_policy ON "ijara_orders" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "charity_fidya_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "charity_fidya_records" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "charity_fidya_records";
CREATE POLICY tenant_isolation_policy ON "charity_fidya_records" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "orphan_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orphan_profiles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "orphan_profiles";
CREATE POLICY tenant_isolation_policy ON "orphan_profiles" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "fatwa_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fatwa_tickets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "fatwa_tickets";
CREATE POLICY tenant_isolation_policy ON "fatwa_tickets" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "fundraising_campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fundraising_campaigns" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "fundraising_campaigns";
CREATE POLICY tenant_isolation_policy ON "fundraising_campaigns" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "fundraising_coupons" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "fundraising_coupons" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "fundraising_coupons";
CREATE POLICY tenant_isolation_policy ON "fundraising_coupons" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "esale_sawab_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "esale_sawab_requests" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "esale_sawab_requests";
CREATE POLICY tenant_isolation_policy ON "esale_sawab_requests" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "workshop_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workshop_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "workshop_events";
CREATE POLICY tenant_isolation_policy ON "workshop_events" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "workshop_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workshop_participants" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "workshop_participants";
CREATE POLICY tenant_isolation_policy ON "workshop_participants" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "workshop_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "workshop_scores" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "workshop_scores";
CREATE POLICY tenant_isolation_policy ON "workshop_scores" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "competition_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competition_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "competition_events";
CREATE POLICY tenant_isolation_policy ON "competition_events" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "competition_participants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "competition_participants" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "competition_participants";
CREATE POLICY tenant_isolation_policy ON "competition_participants" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

-- Modern audit trail (0102): tenant-sharded hash-chain tables. DML grants for
-- UPDATE/DELETE/TRUNCATE are already revoked (INSERT-only ledger); ENABLE+FORCE
-- adds the tenant isolation gate for the same workspace_subdomain scope every
-- other audit table (audit_logs, audit_log_entries) already carries via 0076.
ALTER TABLE "audit_trail_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_trail_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "audit_trail_events";
CREATE POLICY tenant_isolation_policy ON "audit_trail_events" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);

ALTER TABLE "audit_verification_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_verification_runs" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "audit_verification_runs";
CREATE POLICY tenant_isolation_policy ON "audit_verification_runs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);
