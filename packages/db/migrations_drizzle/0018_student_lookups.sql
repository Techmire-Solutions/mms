-- Students Setup lookup options (statuses, genderFilters, discountTypes) — typed tenant store.
CREATE TABLE IF NOT EXISTS "student_lookups" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"meta" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_lookups_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain","id")
);--> statement-breakpoint
ALTER TABLE "student_lookups" ADD CONSTRAINT "student_lookups_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_lookups_workspace_kind_sort_idx" ON "student_lookups" USING btree ("workspace_subdomain","kind","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_lookups_workspace_kind_idx" ON "student_lookups" USING btree ("workspace_subdomain","kind");--> statement-breakpoint
ALTER TABLE "student_lookups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS tenant_isolation_policy ON "student_lookups";--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "student_lookups" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
) WITH CHECK (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = NULLIF(current_setting('app.current_tenant', true), '')
);--> statement-breakpoint
ALTER TABLE "student_lookups" FORCE ROW LEVEL SECURITY;
