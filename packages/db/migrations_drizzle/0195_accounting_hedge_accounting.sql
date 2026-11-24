-- Migration 0195: IFRS 9 hedge accounting — FX forward hedge relationships and their valuations (FORCE RLS).

CREATE TABLE IF NOT EXISTS "accounting_hedge_relationships" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "name" varchar(150) NOT NULL,
  "hedge_type" varchar(20) NOT NULL,
  "direction" varchar(4) NOT NULL,
  "currency" varchar(3) NOT NULL,
  "notional" numeric(19, 4) NOT NULL,
  "contract_rate" numeric(20, 10) NOT NULL,
  "designation_rate" numeric(20, 10) NOT NULL,
  "designation_date" varchar(10) NOT NULL,
  "maturity_date" varchar(10) NOT NULL,
  "hedged_item" text NOT NULL,
  "risk_management_objective" text NOT NULL,
  "instrument_account_id" text NOT NULL,
  "reserve_account_id" text,
  "pnl_account_id" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "settled_reserve" numeric(19, 4) NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "accounting_hedge_relationships_type" CHECK ("hedge_type" IN ('cash_flow', 'fair_value')),
  CONSTRAINT "accounting_hedge_relationships_direction" CHECK ("direction" IN ('buy', 'sell')),
  CONSTRAINT "accounting_hedge_relationships_status"
    CHECK ("status" IN ('active', 'settled', 'reclassified', 'discontinued')),
  CONSTRAINT "accounting_hedge_relationships_notional" CHECK ("notional" > 0)
);

CREATE INDEX IF NOT EXISTS "accounting_hedge_relationships_status_idx"
  ON "accounting_hedge_relationships" ("workspace_subdomain", "status");

CREATE TABLE IF NOT EXISTS "accounting_hedge_valuations" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "relationship_id" text NOT NULL,
  "valuation_date" varchar(10) NOT NULL,
  "kind" varchar(20) NOT NULL,
  "rate" numeric(20, 10) NOT NULL,
  "instrument_value" numeric(19, 4) NOT NULL,
  "hedged_change" numeric(19, 4) NOT NULL,
  "effective" numeric(19, 4) NOT NULL,
  "ineffective" numeric(19, 4) NOT NULL,
  "entry_id" text,
  "reversal_entry_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text,
  PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "accounting_hedge_valuations_kind" CHECK ("kind" IN ('valuation', 'settlement', 'reclassification')),
  CONSTRAINT "accounting_hedge_valuations_relationship_fk"
    FOREIGN KEY ("workspace_subdomain", "relationship_id")
    REFERENCES "accounting_hedge_relationships"("workspace_subdomain", "id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_hedge_valuations_date_uidx"
  ON "accounting_hedge_valuations" ("workspace_subdomain", "relationship_id", "valuation_date", "kind");

ALTER TABLE "accounting_hedge_relationships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_hedge_relationships" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_hedge_relationships";
CREATE POLICY tenant_isolation_policy ON "accounting_hedge_relationships" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);

ALTER TABLE "accounting_hedge_valuations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_hedge_valuations" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_hedge_valuations";
CREATE POLICY tenant_isolation_policy ON "accounting_hedge_valuations" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);
