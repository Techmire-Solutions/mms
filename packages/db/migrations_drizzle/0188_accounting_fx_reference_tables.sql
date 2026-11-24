-- Migration 0188: IAS 21 multi-currency reference tables.
-- Tenant tables get FORCE ROW LEVEL SECURITY; fx_reference_rates is platform-wide
-- feed data (no tenant column, read by every tenant).

CREATE TABLE IF NOT EXISTS "accounting_currency_settings" (
  "workspace_subdomain" text PRIMARY KEY REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "functional_currency" varchar(3) NOT NULL,
  "presentation_currency" varchar(3) NOT NULL,
  "locked_at" timestamp with time zone,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_by" text,
  CONSTRAINT "accounting_currency_settings_functional_iso" CHECK ("functional_currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "accounting_currency_settings_presentation_iso" CHECK ("presentation_currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE IF NOT EXISTS "accounting_enabled_currencies" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "currency" varchar(3) NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "currency"),
  CONSTRAINT "accounting_enabled_currencies_iso" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE IF NOT EXISTS "accounting_exchange_rates" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "from_currency" varchar(3) NOT NULL,
  "to_currency" varchar(3) NOT NULL,
  "rate_date" varchar(10) NOT NULL,
  "rate_type" varchar(16) NOT NULL,
  "rate" numeric(20, 10) NOT NULL,
  "source" varchar(40) NOT NULL DEFAULT 'manual',
  "override_reason" text NOT NULL DEFAULT '',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_by" text,
  PRIMARY KEY ("workspace_subdomain", "id"),
  CONSTRAINT "accounting_exchange_rates_positive" CHECK ("rate" > 0),
  CONSTRAINT "accounting_exchange_rates_distinct" CHECK ("from_currency" <> "to_currency")
);

CREATE UNIQUE INDEX IF NOT EXISTS "accounting_exchange_rates_key_uidx"
  ON "accounting_exchange_rates" ("workspace_subdomain", "from_currency", "to_currency", "rate_date", "rate_type");
CREATE INDEX IF NOT EXISTS "accounting_exchange_rates_lookup_idx"
  ON "accounting_exchange_rates" ("workspace_subdomain", "from_currency", "to_currency", "rate_type", "rate_date" DESC);

CREATE TABLE IF NOT EXISTS "fx_reference_rates" (
  "provider" varchar(40) NOT NULL,
  "base_currency" varchar(3) NOT NULL,
  "quote_currency" varchar(3) NOT NULL,
  "rate_date" varchar(10) NOT NULL,
  "rate" numeric(20, 10) NOT NULL,
  "fetched_at" timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY ("provider", "base_currency", "quote_currency", "rate_date"),
  CONSTRAINT "fx_reference_rates_positive" CHECK ("rate" > 0)
);

CREATE INDEX IF NOT EXISTS "fx_reference_rates_lookup_idx"
  ON "fx_reference_rates" ("base_currency", "quote_currency", "rate_date" DESC);

ALTER TABLE "accounting_currency_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_currency_settings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "accounting_enabled_currencies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_enabled_currencies" FORCE ROW LEVEL SECURITY;
ALTER TABLE "accounting_exchange_rates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_exchange_rates" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_currency_settings";
CREATE POLICY tenant_isolation_policy ON "accounting_currency_settings" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_enabled_currencies";
CREATE POLICY tenant_isolation_policy ON "accounting_enabled_currencies" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);

DROP POLICY IF EXISTS tenant_isolation_policy ON "accounting_exchange_rates";
CREATE POLICY tenant_isolation_policy ON "accounting_exchange_rates" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);
