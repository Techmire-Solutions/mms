SET LOCAL lock_timeout = '2s';--> statement-breakpoint
CREATE TABLE "platform_branding" (
	"id" text PRIMARY KEY DEFAULT 'global' NOT NULL,
	"product_name" varchar(60) DEFAULT '' NOT NULL,
	"console_title" varchar(60) DEFAULT '' NOT NULL,
	"tagline" varchar(120) DEFAULT '' NOT NULL,
	"primary_color" varchar(16) DEFAULT '#d99b00' NOT NULL,
	"secondary_color" varchar(16) DEFAULT '#5c3412' NOT NULL,
	"corner_style" varchar(32) DEFAULT 'rounded' NOT NULL,
	"logo_url" text DEFAULT '' NOT NULL,
	"favicon_url" text DEFAULT '' NOT NULL,
	"footer_text" varchar(120) DEFAULT '' NOT NULL,
	"email" varchar(255) DEFAULT '' NOT NULL,
	"phone" varchar(40) DEFAULT '' NOT NULL,
	"website" varchar(255) DEFAULT '' NOT NULL,
	"legal_name" varchar(60) DEFAULT '' NOT NULL,
	"registration_number" varchar(80) DEFAULT '' NOT NULL,
	"address_line_1" varchar(200) DEFAULT '' NOT NULL,
	"address_line_2" varchar(200) DEFAULT '' NOT NULL,
	"city" varchar(100) DEFAULT '' NOT NULL,
	"region" varchar(100) DEFAULT '' NOT NULL,
	"postal_code" varchar(40) DEFAULT '' NOT NULL,
	"country" varchar(100) DEFAULT '' NOT NULL,
	"social_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_branding" ADD CONSTRAINT "platform_branding_global_id_check" CHECK ("id" = 'global');
--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "whatsapp_notifications" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "timezone" text DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "date_format" varchar(16) DEFAULT 'DD/MM/YYYY' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "theme_mode" varchar(16) DEFAULT 'system' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "default_enabled_modules" jsonb;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "disabled_modules" jsonb;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "llm_provider" varchar(32) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "llm_api_key" text;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "llm_configs" jsonb;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "idle_session_minutes" integer;