-- 0256_accounting_rls_gap.sql
-- Forward-only. Closes the last accounting tenant tables that carried no row-level
-- security policy — see docs/accounting-security-multitenancy-compliance-audit-2026-11-13.md.
--
-- Why this exists
-- ---------------
-- Every accounting table is tenant-keyed and FORCE-RLS protected except these five
-- ledger-ops tables (posting rules, opening balances, bank statements/lines and
-- reconciliation matches). Their repository queries all filter by
-- `workspace_subdomain` today, so there is no leak right now — but the database is
-- the backstop that protects every other accounting table, and these are exactly the
-- tables a future report or raw-SQL path would read without an application predicate.
-- The policy mirrors 0125: bypass only when the transaction explicitly sets
-- `app.rls_bypass` (migrations, purge, global admin), otherwise the tenant GUC.

SET LOCAL lock_timeout = '2s';

ALTER TABLE "accounting_posting_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_posting_rules" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_posting_rules";
CREATE POLICY "tenant_isolation_policy" ON "accounting_posting_rules" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
--> statement-breakpoint

ALTER TABLE "accounting_opening_balances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_opening_balances" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_opening_balances";
CREATE POLICY "tenant_isolation_policy" ON "accounting_opening_balances" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
--> statement-breakpoint

ALTER TABLE "accounting_bank_statements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_bank_statements" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_bank_statements";
CREATE POLICY "tenant_isolation_policy" ON "accounting_bank_statements" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
--> statement-breakpoint

ALTER TABLE "accounting_bank_statement_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_bank_statement_lines" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_bank_statement_lines";
CREATE POLICY "tenant_isolation_policy" ON "accounting_bank_statement_lines" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
--> statement-breakpoint

ALTER TABLE "accounting_bank_reconciliations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_bank_reconciliations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_bank_reconciliations";
CREATE POLICY "tenant_isolation_policy" ON "accounting_bank_reconciliations" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
