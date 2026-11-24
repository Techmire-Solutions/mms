CREATE TABLE IF NOT EXISTS "contact_bank_details" (
	"id" text NOT NULL,
	"workspace_subdomain" text NOT NULL,
	"contact_id" text NOT NULL,
	"bank_name" varchar(255) NOT NULL,
	"account_title" varchar(255) NOT NULL,
	"account_number" varchar(100) NOT NULL,
	"iban" varchar(100),
	"swift_code" varchar(50),
	"branch_name" varchar(255),
	"branch_code" varchar(50),
	"routing_number" varchar(50),
	"currency" varchar(10) DEFAULT 'PKR',
	"is_primary" boolean DEFAULT false NOT NULL,
	"label" varchar(100),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contact_bank_details_workspace_subdomain_contact_id_id_pk" PRIMARY KEY("workspace_subdomain","contact_id","id")
);
--> statement-breakpoint
ALTER TABLE "contact_bank_details" ADD CONSTRAINT "contact_bank_details_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_bank_details" ADD CONSTRAINT "contact_bank_details_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk" FOREIGN KEY ("workspace_subdomain","contact_id") REFERENCES "public"."contacts"("workspace_subdomain","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_bank_details_workspace_contact_idx" ON "contact_bank_details" USING btree ("workspace_subdomain","contact_id");
--> statement-breakpoint
ALTER TABLE "contact_bank_details" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "contact_bank_details" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY tenant_isolation_policy ON "contact_bank_details" FOR ALL USING (
  current_setting('app.rls_bypass', true) = 'on'
  OR workspace_subdomain = current_setting('app.current_tenant', true)
);
