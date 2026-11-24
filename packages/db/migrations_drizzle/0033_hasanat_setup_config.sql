CREATE TABLE IF NOT EXISTS "hasanat_field_configs" (
	"workspace_subdomain" text PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hasanat_module_preferences" (
	"workspace_subdomain" text PRIMARY KEY NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hasanat_distribution_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hasanat_distribution_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hasanat_redemption_user_column_prefs" (
	"workspace_subdomain" text NOT NULL,
	"user_id" text NOT NULL,
	"preferences" jsonb NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hasanat_redemption_user_column_prefs_workspace_subdomain_user_id_pk" PRIMARY KEY("workspace_subdomain","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hasanat_field_configs" ADD CONSTRAINT "hasanat_field_configs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hasanat_module_preferences" ADD CONSTRAINT "hasanat_module_preferences_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hasanat_distribution_user_column_prefs" ADD CONSTRAINT "hasanat_distribution_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hasanat_distribution_user_column_prefs" ADD CONSTRAINT "hasanat_distribution_user_column_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hasanat_redemption_user_column_prefs" ADD CONSTRAINT "hasanat_redemption_user_column_prefs_workspace_subdomain_workspaces_subdomain_fk" FOREIGN KEY ("workspace_subdomain") REFERENCES "public"."workspaces"("subdomain") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hasanat_redemption_user_column_prefs" ADD CONSTRAINT "hasanat_redemption_user_column_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."tenant_users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "hasanat_field_configs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hasanat_module_preferences" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hasanat_distribution_user_column_prefs" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "hasanat_redemption_user_column_prefs" ENABLE ROW LEVEL SECURITY;
