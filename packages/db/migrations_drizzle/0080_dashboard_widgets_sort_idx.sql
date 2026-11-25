CREATE INDEX IF NOT EXISTS "dashboard_widgets_workspace_sort_idx" ON "dashboard_widgets" USING btree ("workspace_subdomain","sort_order","id");
