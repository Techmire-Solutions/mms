/**
 * Composition adapter for the faculty module.
 *
 * Binds the module's kernel ports to the app-only services it may not import:
 * the auth guard's soft-deleted-account probe, contacts reconciliation, users/IAM
 * reads, RBAC invalidation and the CSV-export job runner. Called once at module
 * load from `routes/index.ts`, before background job runners register.
 */
import { configureFacultyPorts } from "@mms/mod-faculty/backend/deps";
import { facultyRepository } from "@mms/mod-faculty/backend/repository";
import {
  reconcileContactSystemTags,
  reconcileDesignationContacts,
  reconcileFacultyContactsByFacultyIds,
} from "@mms/mod-contacts/backend/use-cases";
import { loadContactsSummaryByIdsForTenant } from "@mms/mod-contacts/backend/services";
import {
  findTenantUserRowByContactId,
  listAllTenantUsersByWorkspace,
  upsertTenantUserRow,
} from "@mms/mod-iam/backend/tenant/repository";
import {
  getUserModulePreferencesByWorkspace,
  upsertUserModulePreferences,
} from "@mms/mod-iam/backend/tenant/repository";
import { getTenantUsersSettings } from "@mms/mod-iam/backend/tenant/services/usersSettingsService";
import { resolveCurrentTenantRole } from "../../lib/currentTenantRole.js";
import { tenantUserHasPermission } from "../../lib/tenantRoleCatalog.js";
import { invalidateTenantRbac } from "../../services/rbacService.js";
import { registerModuleCsvExportJobRunner } from "../../lib/registerModuleCsvExportJobRunner.js";
import { configureAccountDeletionGuard } from "../../middleware/accountDeletionGuard.js";

export function configureFacultyAccountDeletionGuard(): void {
  configureFacultyPorts({
    reconcileFacultyContactsByFacultyIds,
    reconcileContactSystemTags,
    reconcileDesignationContacts,
    loadContactsSummaryByIdsForTenant,
    findTenantUserRowByContactId,
    upsertTenantUserRow,
    listAllTenantUsersByWorkspace,
    getTenantUsersSettings,
    resolveCurrentTenantRole,
    tenantUserHasPermission,
    getUserModulePreferencesByWorkspace,
    upsertUserModulePreferences,
    invalidateTenantRbac,
    registerModuleCsvExportJobRunner: (options) =>
      registerModuleCsvExportJobRunner(
        options as Parameters<typeof registerModuleCsvExportJobRunner>[0],
      ),
  });
  configureAccountDeletionGuard((tenant: string, userId: string) =>
    facultyRepository.isDeletedByUserId(tenant, userId),
  );
}
