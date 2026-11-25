-- 0128_accounting_voucher_counters.sql
-- Server-owned journal voucher numbering. Replaces client-side ref generation
-- and the read-max-then-insert allocator, which raced under concurrency, read a
-- replica, and sorted refs as text (JE-9999 > JE-10000). Counters are seeded
-- lazily from existing refs on first allocation, so no backfill is needed here.
CREATE TABLE IF NOT EXISTS "accounting_voucher_numbering" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "auto_generate" boolean NOT NULL DEFAULT true,
  "prefix" varchar(10) NOT NULL DEFAULT 'JE',
  "delimiter" varchar(1) NOT NULL DEFAULT '-',
  "year_format" varchar(4) NOT NULL DEFAULT 'NONE',
  "sequence_digits" integer NOT NULL DEFAULT 4,
  "starting_sequence" integer NOT NULL DEFAULT 1,
  "rollover_policy" varchar(16) NOT NULL DEFAULT 'never',
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain"),
  CONSTRAINT "accounting_voucher_numbering_prefix_check" CHECK ("prefix" ~ '^[A-Za-z0-9]{0,10}$'),
  CONSTRAINT "accounting_voucher_numbering_delimiter_check" CHECK ("delimiter" IN ('', '-', '/', '.')),
  CONSTRAINT "accounting_voucher_numbering_year_format_check" CHECK ("year_format" IN ('YYYY', 'YY', 'NONE')),
  CONSTRAINT "accounting_voucher_numbering_digits_check" CHECK ("sequence_digits" BETWEEN 2 AND 8),
  CONSTRAINT "accounting_voucher_numbering_start_check" CHECK ("starting_sequence" BETWEEN 1 AND 99999999),
  CONSTRAINT "accounting_voucher_numbering_rollover_check" CHECK ("rollover_policy" IN ('annual_calendar', 'annual_fiscal', 'never')),
  -- A sequence that restarts each period must print the period, or it reissues old refs.
  CONSTRAINT "accounting_voucher_numbering_rollover_year_check" CHECK ("rollover_policy" = 'never' OR "year_format" <> 'NONE')
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "accounting_voucher_counters" (
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "format_key" varchar(24) NOT NULL,
  "period_year" integer NOT NULL,
  "last_value" integer NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "format_key", "period_year"),
  CONSTRAINT "accounting_voucher_counters_last_value_check" CHECK ("last_value" >= 0)
);
--> statement-breakpoint

ALTER TABLE "accounting_voucher_numbering" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_voucher_numbering" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy" ON "accounting_voucher_numbering" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
--> statement-breakpoint

ALTER TABLE "accounting_voucher_counters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_voucher_counters" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy" ON "accounting_voucher_counters" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
