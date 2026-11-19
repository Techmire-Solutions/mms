-- 0268_robust_mikhail_rasputin.sql
-- Server-owned fee invoice numbering. Replaces the `LIKE … ORDER BY DESC LIMIT 100`
-- scan allocator, which raced under concurrency and honoured only the prefix while
-- the Setup screen exposed digits/year/delimiter/start/rollover. Counters are seeded
-- lazily from existing invoice numbers on first allocation, so no backfill is needed.
SET LOCAL lock_timeout = '2s';--> statement-breakpoint
CREATE TABLE "finance_invoice_counters" (
	"workspace_subdomain" text NOT NULL,
	"format_key" varchar(24) NOT NULL,
	"period_year" integer NOT NULL,
	"last_value" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_invoice_counters_workspace_subdomain_format_key_period_year_pk" PRIMARY KEY("workspace_subdomain","format_key","period_year"),
	CONSTRAINT "finance_invoice_counters_last_value_check" CHECK ("finance_invoice_counters"."last_value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "finance_invoice_counters" ADD CONSTRAINT "finance_invoice_counters_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "finance_invoice_counters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "finance_invoice_counters" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "finance_invoice_counters" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
