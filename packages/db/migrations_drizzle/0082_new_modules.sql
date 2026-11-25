-- Inventory Items
CREATE TABLE IF NOT EXISTS "inventory_items" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "name" text NOT NULL,
  "item_type" varchar(30) NOT NULL,
  "language" varchar(100),
  "total_stock" integer NOT NULL DEFAULT 0,
  "remaining_stock" integer NOT NULL DEFAULT 0,
  "purchase_cost" numeric(15, 2) NOT NULL DEFAULT '0.00',
  "selling_price" numeric(15, 2) NOT NULL DEFAULT '0.00',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "inventory_items_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Inventory Sales
CREATE TABLE IF NOT EXISTS "inventory_sales" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "item_id" text NOT NULL,
  "student_id" text,
  "buyer_name" text,
  "qty" integer NOT NULL DEFAULT 1,
  "total_price" numeric(15, 2) NOT NULL DEFAULT '0.00',
  "sale_date" timestamp with time zone NOT NULL DEFAULT now(),
  "status" varchar(20) NOT NULL DEFAULT 'completed',
  "sold_by" text,
  CONSTRAINT "inventory_sales_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Ecommerce Orders
CREATE TABLE IF NOT EXISTS "ecommerce_orders" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "buyer_name" text NOT NULL,
  "buyer_contact" text,
  "order_date" timestamp with time zone NOT NULL DEFAULT now(),
  "total_amount" numeric(15, 2) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'pending',
  CONSTRAINT "ecommerce_orders_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Ijara Orders
CREATE TABLE IF NOT EXISTS "ijara_orders" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "asset_name" text NOT NULL,
  "renter_name" text NOT NULL,
  "start_date" timestamp with time zone NOT NULL,
  "end_date" timestamp with time zone,
  "rent_amount" numeric(15, 2) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'active',
  CONSTRAINT "ijara_orders_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Charity Fidya Records
CREATE TABLE IF NOT EXISTS "charity_fidya_records" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "donor_name" text NOT NULL,
  "amount" numeric(15, 2) NOT NULL,
  "purpose" text,
  "distribution_status" varchar(30) NOT NULL DEFAULT 'received',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "charity_fidya_records_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Orphan Profiles
CREATE TABLE IF NOT EXISTS "orphan_profiles" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "name" text NOT NULL,
  "date_of_birth" date,
  "gender" varchar(10),
  "sponsor_contact_id" text,
  "monthly_allowance" numeric(15, 2) NOT NULL DEFAULT '0.00',
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "orphan_profiles_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Fatwa Tickets
CREATE TABLE IF NOT EXISTS "fatwa_tickets" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "inquirer_name" text NOT NULL,
  "inquirer_contact" text,
  "question_text" text NOT NULL,
  "answer_text" text,
  "assigned_mufti_id" text,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "fatwa_tickets_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Fundraising Campaigns
CREATE TABLE IF NOT EXISTS "fundraising_campaigns" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "campaign_name" text NOT NULL,
  "target_amount" numeric(15, 2),
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "fundraising_campaigns_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Fundraising Coupons
CREATE TABLE IF NOT EXISTS "fundraising_coupons" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "campaign_id" text NOT NULL,
  "buyer_name" text,
  "buyer_contact" text,
  "price" numeric(15, 2) NOT NULL,
  "is_winner" boolean NOT NULL DEFAULT false,
  CONSTRAINT "fundraising_coupons_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Esale Sawab Requests
CREATE TABLE IF NOT EXISTS "esale_sawab_requests" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "requestor_name" text NOT NULL,
  "deceased_name" text NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "esale_sawab_requests_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Workshop Events
CREATE TABLE IF NOT EXISTS "workshop_events" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "start_date" timestamp with time zone,
  "end_date" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "workshop_events_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Workshop Participants
CREATE TABLE IF NOT EXISTS "workshop_participants" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "workshop_id" text NOT NULL,
  "contact_id" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'registered',
  CONSTRAINT "workshop_participants_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Workshop Scores
CREATE TABLE IF NOT EXISTS "workshop_scores" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "workshop_id" text NOT NULL,
  "participant_id" text NOT NULL,
  "criterion_name" text NOT NULL,
  "score" numeric(15, 2) NOT NULL,
  "max_score" numeric(15, 2) NOT NULL,
  "remarks" text,
  CONSTRAINT "workshop_scores_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Competition Events
CREATE TABLE IF NOT EXISTS "competition_events" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "title" text NOT NULL,
  "event_date" timestamp with time zone,
  CONSTRAINT "competition_events_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Competition Participants
CREATE TABLE IF NOT EXISTS "competition_participants" (
  "id" text NOT NULL,
  "workspace_subdomain" text NOT NULL,
  "competition_id" text NOT NULL,
  "student_id" text NOT NULL,
  "rank" integer,
  "score" numeric(15, 2),
  CONSTRAINT "competition_participants_workspace_subdomain_id_pk" PRIMARY KEY("workspace_subdomain", "id")
);

-- Foreign Keys
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inventory_sales" ADD CONSTRAINT "inventory_sales_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inventory_sales" ADD CONSTRAINT "inventory_sales_workspace_subdomain_item_id_inventory_items_workspace_subdomain_id_fk" FOREIGN KEY("workspace_subdomain", "item_id") REFERENCES "public"."inventory_items"("workspace_subdomain", "id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inventory_sales" ADD CONSTRAINT "inventory_sales_workspace_subdomain_student_id_students_workspace_subdomain_id_fk" FOREIGN KEY("workspace_subdomain", "student_id") REFERENCES "public"."students"("workspace_subdomain", "id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "ecommerce_orders" ADD CONSTRAINT "ecommerce_orders_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "ijara_orders" ADD CONSTRAINT "ijara_orders_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "charity_fidya_records" ADD CONSTRAINT "charity_fidya_records_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "orphan_profiles" ADD CONSTRAINT "orphan_profiles_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "orphan_profiles" ADD CONSTRAINT "orphan_profiles_workspace_subdomain_sponsor_contact_id_contacts_workspace_subdomain_id_fk" FOREIGN KEY("workspace_subdomain", "sponsor_contact_id") REFERENCES "public"."contacts"("workspace_subdomain", "id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "fatwa_tickets" ADD CONSTRAINT "fatwa_tickets_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "fatwa_tickets" ADD CONSTRAINT "fatwa_tickets_workspace_subdomain_assigned_mufti_id_tenant_users_workspace_subdomain_id_uniq_fk" FOREIGN KEY("workspace_subdomain", "assigned_mufti_id") REFERENCES "public"."tenant_users"("workspace_subdomain", "id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "fundraising_campaigns" ADD CONSTRAINT "fundraising_campaigns_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "fundraising_coupons" ADD CONSTRAINT "fundraising_coupons_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "fundraising_coupons" ADD CONSTRAINT "fundraising_coupons_workspace_subdomain_campaign_id_fundraising_campaigns_workspace_subdomain_id_fk" FOREIGN KEY("workspace_subdomain", "campaign_id") REFERENCES "public"."fundraising_campaigns"("workspace_subdomain", "id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "esale_sawab_requests" ADD CONSTRAINT "esale_sawab_requests_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "workshop_events" ADD CONSTRAINT "workshop_events_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workshop_participants" ADD CONSTRAINT "workshop_participants_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workshop_participants" ADD CONSTRAINT "workshop_participants_workspace_subdomain_workshop_id_workshop_events_workspace_subdomain_id_fk" FOREIGN KEY("workspace_subdomain", "workshop_id") REFERENCES "public"."workshop_events"("workspace_subdomain", "id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workshop_participants" ADD CONSTRAINT "workshop_participants_workspace_subdomain_contact_id_contacts_workspace_subdomain_id_fk" FOREIGN KEY("workspace_subdomain", "contact_id") REFERENCES "public"."contacts"("workspace_subdomain", "id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workshop_scores" ADD CONSTRAINT "workshop_scores_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workshop_scores" ADD CONSTRAINT "workshop_scores_workspace_subdomain_workshop_id_workshop_events_workspace_subdomain_id_fk" FOREIGN KEY("workspace_subdomain", "workshop_id") REFERENCES "public"."workshop_events"("workspace_subdomain", "id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workshop_scores" ADD CONSTRAINT "workshop_scores_workspace_subdomain_participant_id_workshop_participants_workspace_subdomain_id_fk" FOREIGN KEY("workspace_subdomain", "participant_id") REFERENCES "public"."workshop_participants"("workspace_subdomain", "id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "competition_events" ADD CONSTRAINT "competition_events_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_workspace_subdomain_competition_id_competition_events_workspace_subdomain_id_fk" FOREIGN KEY("workspace_subdomain", "competition_id") REFERENCES "public"."competition_events"("workspace_subdomain", "id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "competition_participants" ADD CONSTRAINT "competition_participants_workspace_subdomain_student_id_students_workspace_subdomain_id_fk" FOREIGN KEY("workspace_subdomain", "student_id") REFERENCES "public"."students"("workspace_subdomain", "id") ON DELETE cascade ON UPDATE no action;

-- Force RLS on all tables
ALTER TABLE "inventory_items" FORCE ROW LEVEL SECURITY;
ALTER TABLE "inventory_sales" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ecommerce_orders" FORCE ROW LEVEL SECURITY;
ALTER TABLE "ijara_orders" FORCE ROW LEVEL SECURITY;
ALTER TABLE "charity_fidya_records" FORCE ROW LEVEL SECURITY;
ALTER TABLE "orphan_profiles" FORCE ROW LEVEL SECURITY;
ALTER TABLE "fatwa_tickets" FORCE ROW LEVEL SECURITY;
ALTER TABLE "fundraising_campaigns" FORCE ROW LEVEL SECURITY;
ALTER TABLE "fundraising_coupons" FORCE ROW LEVEL SECURITY;
ALTER TABLE "esale_sawab_requests" FORCE ROW LEVEL SECURITY;
ALTER TABLE "workshop_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "workshop_participants" FORCE ROW LEVEL SECURITY;
ALTER TABLE "workshop_scores" FORCE ROW LEVEL SECURITY;
ALTER TABLE "competition_events" FORCE ROW LEVEL SECURITY;
ALTER TABLE "competition_participants" FORCE ROW LEVEL SECURITY;

-- Tenant Isolation Policies
CREATE POLICY tenant_isolation_policy ON "inventory_items" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "inventory_sales" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "ecommerce_orders" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "ijara_orders" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "charity_fidya_records" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "orphan_profiles" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "fatwa_tickets" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "fundraising_campaigns" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "fundraising_coupons" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "esale_sawab_requests" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "workshop_events" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "workshop_participants" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "workshop_scores" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "competition_events" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
CREATE POLICY tenant_isolation_policy ON "competition_participants" FOR ALL USING (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true)) WITH CHECK (current_setting('app.rls_bypass', true) = 'on' OR workspace_subdomain = current_setting('app.current_tenant', true));
