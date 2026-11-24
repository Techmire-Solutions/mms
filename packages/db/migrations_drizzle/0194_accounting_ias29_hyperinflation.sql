-- Migration 0194: IAS 29 hyperinflation — settings, general price index, restatement runs (FORCE RLS).

CREATE TABLE IF NOT EXISTS "accounting_hyperinflation_settings" (
  "workspace_subdomain" text PRIMARY KEY REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "enabled" boolean NOT NULL DEFAULT false,
  "net_monetary_account_id" text,
  "applies_from" varchar(10),
  "index_name" text NOT NULL DEFAULT '',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text
);

CREATE TABLE IF NOT EXISTS "accounting_price_indices" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "index_date" varchar(10) NOT NULL,
  "value" numeric(18, 6) NOT NULL,
  "source" text NOT NULL DEFAULT '',
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text,
  PRIMARY KEY ("workspace_subdomain", "index_date"),
  CONSTRAINT "accounting_price_indices_positive" CHECK ("value" > 0)
);

CREATE TABLE IF NOT EXISTS "accounting_ias29_runs" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "restatement_date" varchar(10) NOT NULL,
  "closing_index" numeric(18, 6) NOT NULL,
  "net_monetary_result" numeric(19, 4) NOT NULL,
  "entry_id" text,
  "reversal_entry_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text,
  PRIMARY KEY ("workspace_subdomain", "id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_ias29_runs_date_uidx"
  ON "accounting_ias29_runs" ("workspace_subdomain", "restatement_date");

CREATE TABLE IF NOT EXISTS "accounting_ias29_lines" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "run_id" text NOT NULL,
  "account_id" text NOT NULL,
  "carrying" numeric(19, 4) NOT NULL,
  "restated" numeric(19, 4) NOT NULL,
  "adjustment" numeric(19, 4) NOT NULL,
  PRIMARY KEY ("workspace_subdomain", "run_id", "id"),
  CONSTRAINT "accounting_ias29_lines_run_fk"
    FOREIGN KEY ("workspace_subdomain", "run_id")
    REFERENCES "accounting_ias29_runs"("workspace_subdomain", "id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "accounting_ias29_lines_run_idx"
  ON "accounting_ias29_lines" ("workspace_subdomain", "run_id");

ALTER TABLE "accounting_hyperinflation_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_hyperinflation_settings" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_hyperinflation_settings";
CREATE POLICY tenant_isolation_policy ON "accounting_hyperinflation_settings" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);

ALTER TABLE "accounting_price_indices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_price_indices" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_price_indices";
CREATE POLICY tenant_isolation_policy ON "accounting_price_indices" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);

ALTER TABLE "accounting_ias29_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_ias29_runs" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_ias29_runs";
CREATE POLICY tenant_isolation_policy ON "accounting_ias29_runs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);

ALTER TABLE "accounting_ias29_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_ias29_lines" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_ias29_lines";
CREATE POLICY tenant_isolation_policy ON "accounting_ias29_lines" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);
