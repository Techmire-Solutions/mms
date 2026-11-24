SET LOCAL lock_timeout = '2s';--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "admin_name" varchar(300);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "admin_email" varchar(255);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "admin_gender" varchar(20);