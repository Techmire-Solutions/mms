CREATE TABLE IF NOT EXISTS "accounting_posting_periods" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL REFERENCES "workspaces"("subdomain") ON DELETE CASCADE,
  "fiscal_year_id" text NOT NULL,
  "label" varchar(120) NOT NULL,
  "start_date" varchar(10) NOT NULL,
  "end_date" varchar(10) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'open',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("workspace_subdomain", "id"),
  FOREIGN KEY ("workspace_subdomain", "fiscal_year_id") REFERENCES "accounting_fiscal_years"("workspace_subdomain", "id") ON DELETE CASCADE,
  CONSTRAINT "accounting_posting_periods_dates_check" CHECK ("start_date" ~ '^\d{4}-\d{2}-\d{2}$' AND "end_date" ~ '^\d{4}-\d{2}-\d{2}$' AND "start_date" <= "end_date"),
  CONSTRAINT "accounting_posting_periods_status_check" CHECK ("status" IN ('open', 'closed'))
);
CREATE UNIQUE INDEX IF NOT EXISTS "accounting_posting_periods_year_start_uidx" ON "accounting_posting_periods" ("workspace_subdomain", "fiscal_year_id", "start_date");
CREATE INDEX IF NOT EXISTS "accounting_posting_periods_workspace_date_idx" ON "accounting_posting_periods" ("workspace_subdomain", "start_date", "end_date");
--> statement-breakpoint

ALTER TABLE "accounting_posting_periods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "accounting_posting_periods" FORCE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_policy" ON "accounting_posting_periods" FOR ALL
  USING (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR "workspace_subdomain" = NULLIF(current_setting('app.current_tenant', true), ''));
--> statement-breakpoint

INSERT INTO "accounting_posting_periods" ("id", "workspace_subdomain", "fiscal_year_id", "label", "start_date", "end_date", "status")
SELECT fy.id || '-' || to_char(month_start, 'YYYY-MM'), fy.workspace_subdomain, fy.id,
       to_char(month_start, 'YYYY-MM'),
       greatest(month_start::date, fy.start_date::date)::text,
       least((month_start + interval '1 month - 1 day')::date, fy.end_date::date)::text,
       CASE WHEN fy.status = 'closed' THEN 'closed' ELSE 'open' END
FROM accounting_fiscal_years fy
CROSS JOIN LATERAL generate_series(date_trunc('month', fy.start_date::date), fy.end_date::date, interval '1 month') month_start
WHERE fy.deleted_at IS NULL
ON CONFLICT (workspace_subdomain, id) DO NOTHING;
