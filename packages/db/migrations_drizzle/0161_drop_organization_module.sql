-- MMS Forward-only Migration: 0161_drop_organization_module.sql
-- Removes Organization module tables and position FKs from faculty_assignments / task_assignees.

ALTER TABLE "faculty_assignments" DROP CONSTRAINT IF EXISTS "faculty_assignments_position_fk";
ALTER TABLE "task_assignees" DROP CONSTRAINT IF EXISTS "task_assignees_position_fk";
ALTER TABLE "task_assignees" DROP CONSTRAINT IF EXISTS "task_assignees_workspace_subdomain_position_id_organization_positions_workspace_subdomain_id_fk";

DROP INDEX IF EXISTS "faculty_assignments_position_primary_active_idx";
DROP INDEX IF EXISTS "faculty_assignments_position_active_idx";

ALTER TABLE "faculty_assignments" DROP COLUMN IF EXISTS "position_id";
ALTER TABLE "task_assignees" DROP COLUMN IF EXISTS "position_id";

DROP TRIGGER IF EXISTS trg_organization_positions_forbid_hard_delete ON "organization_positions";
DROP TRIGGER IF EXISTS trg_organization_locations_forbid_hard_delete ON "organization_locations";

DROP POLICY IF EXISTS "tenant_isolation_policy" ON "organization_positions";
DROP POLICY IF EXISTS "platform_superadmin_policy" ON "organization_positions";
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "organization_positions";
DROP POLICY IF EXISTS "tenant_isolation_policy" ON "organization_locations";
DROP POLICY IF EXISTS "platform_superadmin_policy" ON "organization_locations";
DROP POLICY IF EXISTS "tenant_soft_delete_isolation" ON "organization_locations";

DROP TABLE IF EXISTS "organization_positions";
DROP TABLE IF EXISTS "organization_locations";
