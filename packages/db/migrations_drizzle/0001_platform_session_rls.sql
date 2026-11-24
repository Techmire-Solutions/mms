ALTER TABLE "platform_users" ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_users_single_super_user_idx" ON "platform_users" USING btree ("role") WHERE "role" = 'super_user';--> statement-breakpoint
-- Idempotent tenant RLS restore for DBs that applied a pre-RLS 0000_init squash.
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN
        SELECT c.table_name
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.column_name = 'workspace_subdomain'
          AND c.table_name NOT IN ('tenant_users')
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', tbl);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON %I;', tbl);
        EXECUTE format(
            'CREATE POLICY tenant_isolation_policy ON %I FOR ALL USING (
                current_setting(''app.rls_bypass'', true) = ''on''
                OR workspace_subdomain = NULLIF(current_setting(''app.current_tenant'', true), '''')
            ) WITH CHECK (
                current_setting(''app.rls_bypass'', true) = ''on''
                OR workspace_subdomain = NULLIF(current_setting(''app.current_tenant'', true), '''')
            );',
            tbl
        );
    END LOOP;
END $$;
--> statement-breakpoint
ALTER TABLE "message_templates" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "message_logs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "custom_tabs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "students" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teachers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saved_reports" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "contact_google_sync_credentials" FORCE ROW LEVEL SECURITY;
