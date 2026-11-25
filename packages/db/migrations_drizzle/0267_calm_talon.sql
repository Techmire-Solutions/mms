-- 0267_calm_talon.sql
-- Server-owned obligation receipt numbering. Replaces client-side receipt number
-- generation (the browser derived the next number from the list it happened to
-- hold, so two clients minted the same receipt number). Counters are seeded
-- lazily from existing receipt numbers on first allocation, so no backfill is
-- needed here.
SET LOCAL lock_timeout = '2s';--> statement-breakpoint
CREATE TABLE "obligation_receipt_counters" (
	"workspace_subdomain" text NOT NULL,
	"format_key" varchar(24) NOT NULL,
	"period_year" integer NOT NULL,
	"last_value" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "obligation_receipt_counters_workspace_subdomain_format_key_period_year_pk" PRIMARY KEY("workspace_subdomain","format_key","period_year"),
	CONSTRAINT "obligation_receipt_counters_last_value_check" CHECK ("obligation_receipt_counters"."last_value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "obligation_receipt_counters" ADD CONSTRAINT "obligation_receipt_counters_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "obligation_receipt_counters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "obligation_receipt_counters" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_isolation_policy" ON "obligation_receipt_counters" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
