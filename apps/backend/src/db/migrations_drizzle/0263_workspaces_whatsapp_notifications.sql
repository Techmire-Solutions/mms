SET LOCAL lock_timeout = '2s';
--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "whatsapp_notifications" boolean;
