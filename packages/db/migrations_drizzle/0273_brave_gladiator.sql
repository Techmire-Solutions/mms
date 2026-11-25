SET LOCAL lock_timeout = '2s';
--> statement-breakpoint
ALTER TABLE "platform_user_permissions" DROP CONSTRAINT "platform_user_perms_key_check";
--> statement-breakpoint
ALTER TABLE "platform_user_permissions" ADD CONSTRAINT "platform_user_perms_key_check"
  CHECK ("permission_key" IN ('workspaces','onboard','settings','admins','system','contacts','messaging'));
--> statement-breakpoint
CREATE TABLE "platform_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(160) NOT NULL,
	"email" varchar(320),
	"phone" varchar(32),
	"kind" varchar(32) NOT NULL,
	"workspace_id" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "platform_message_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"channel" varchar(16) NOT NULL,
	"subject" varchar(200),
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" varchar(16) NOT NULL,
	"subject" varchar(200),
	"body" text NOT NULL,
	"status" varchar(24) DEFAULT 'queued' NOT NULL,
	"recipient_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scheduled_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "platform_contacts_kind_idx" ON "platform_contacts" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "platform_contacts_workspace_idx" ON "platform_contacts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "platform_message_templates_channel_idx" ON "platform_message_templates" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "platform_messages_channel_idx" ON "platform_messages" USING btree ("channel");--> statement-breakpoint
CREATE INDEX "platform_messages_status_idx" ON "platform_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "platform_messages_created_idx" ON "platform_messages" USING btree ("created_at");