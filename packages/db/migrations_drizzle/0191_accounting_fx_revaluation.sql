-- Migration 0191: IAS 21 period-end FX revaluation runs (FORCE ROW LEVEL SECURITY).

CREATE TABLE IF NOT EXISTS "accounting_fx_revaluation_runs" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "revaluation_date" varchar(10) NOT NULL,
  "functional_currency" varchar(3) NOT NULL,
  "total_unrealized" numeric(19, 4) NOT NULL,
  "entry_id" text,
  "reversal_entry_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text,
  PRIMARY KEY ("workspace_subdomain", "id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_fx_revaluation_runs_date_uidx"
  ON "accounting_fx_revaluation_runs" ("workspace_subdomain", "revaluation_date");

CREATE TABLE IF NOT EXISTS "accounting_fx_revaluation_lines" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "run_id" text NOT NULL,
  "account_id" text NOT NULL,
  "currency" varchar(3) NOT NULL,
  "open_txn" numeric(19, 4) NOT NULL,
  "closing_rate" numeric(20, 10) NOT NULL,
  "carrying_func" numeric(19, 4) NOT NULL,
  "revalued_func" numeric(19, 4) NOT NULL,
  "unrealized" numeric(19, 4) NOT NULL,
  PRIMARY KEY ("workspace_subdomain", "run_id", "id"),
  CONSTRAINT "accounting_fx_revaluation_lines_run_fk"
    FOREIGN KEY ("workspace_subdomain", "run_id")
    REFERENCES "accounting_fx_revaluation_runs"("workspace_subdomain", "id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "accounting_fx_revaluation_lines_run_idx"
  ON "accounting_fx_revaluation_lines" ("workspace_subdomain", "run_id");

ALTER TABLE "accounting_fx_revaluation_runs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_fx_revaluation_runs" FORCE ROW LEVEL SECURITY;
ALTER TABLE "accounting_fx_revaluation_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_fx_revaluation_lines" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_fx_revaluation_runs";
CREATE POLICY tenant_isolation_policy ON "accounting_fx_revaluation_runs" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_fx_revaluation_lines";
CREATE POLICY tenant_isolation_policy ON "accounting_fx_revaluation_lines" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);
