SET LOCAL lock_timeout = '2s';
--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "consolidation_prefs" jsonb;