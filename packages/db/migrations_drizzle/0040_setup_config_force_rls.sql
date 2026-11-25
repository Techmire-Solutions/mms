-- 0040_setup_config_force_rls.sql
-- Retrofit FORCE ROW LEVEL SECURITY + tenant_isolation_policy on setup-config tables
-- created by 0033 (hasanat), 0034 (attendance), 0035 (accounting). Those migrations only
-- ran ENABLE ROW LEVEL SECURITY with no policy and no FORCE, so the table owner (app role)
-- bypassed RLS entirely — no tenant isolation. 0036/0037 ship RLS in-place; this migration
-- closes the gap for the already-applied 0033-0035 tables. Idempotent (DROP POLICY IF EXISTS).
ALTER TABLE "hasanat_field_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_field_configs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "hasanat_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "hasanat_field_configs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "hasanat_module_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_module_preferences";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "hasanat_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "hasanat_module_preferences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "hasanat_distribution_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_distribution_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "hasanat_distribution_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "hasanat_distribution_user_column_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "hasanat_redemption_user_column_prefs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "hasanat_redemption_user_column_prefs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "hasanat_redemption_user_column_prefs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "hasanat_redemption_user_column_prefs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "attendance_field_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "attendance_field_configs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "attendance_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "attendance_field_configs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "attendance_module_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "attendance_module_preferences";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "attendance_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "attendance_module_preferences" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "accounting_field_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_field_configs";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "accounting_field_configs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "accounting_field_configs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

ALTER TABLE "accounting_module_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_module_preferences";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "accounting_module_preferences" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "accounting_module_preferences" FORCE ROW LEVEL SECURITY;