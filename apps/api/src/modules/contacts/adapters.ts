/**
 * Composition adapter for the contacts module.
 *
 * Binds the module's kernel deps to the app-only services it may not import
 * (job worker, storage/artifacts, auth user list, workspace branding, tenant
 * role catalog, CSV-export route factory, prepared statements, platform activity
 * log). Called once at app module load, before background job runners register.
 */
import { configureContactsKernelDeps } from "@mms/mod-contacts/backend/deps";
import { getLinkedContactId } from "../../services/auth/userService.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  hasBackgroundJobRunner,
  registerBackgroundJobRunner,
} from "../../services/backgroundJobWorkerService.js";
import { resolveTenantExportKey, uploadStreamToStorage } from "../../config/storage.js";
import { saveStreamedExportArtifact } from "../../services/exportArtifactService.js";
import { tenantUserHasPermission } from "../../lib/tenantRoleCatalog.js";
import { getWorkspaceBranding } from "../../db/repositories/workspaceRepository.js";
import { registerModuleCsvExportRoutes } from "../../lib/registerModuleCsvExportRoutes.js";
import { insertPlatformActivityLog } from "../../db/repositories/platformActivityLogsRepository.js";
import { getPreparedContactById } from "@mms/mod-students/backend/repository";
import { deleteObject, getObject, saveObject } from "../../db/documentStore.js";

export function configureContactsKernelAdapters(): void {
  configureContactsKernelDeps({
    getLinkedContactId,
    enqueueBackgroundJob,
    getUserBackgroundJob,
    hasBackgroundJobRunner,
    registerBackgroundJobRunner,
    resolveTenantExportKey,
    uploadStreamToStorage,
    saveStreamedExportArtifact,
    tenantUserHasPermission,
    getWorkspaceBranding,
    registerCsvExportRoutes: registerModuleCsvExportRoutes,
    insertPlatformActivityLog,
    getPreparedContactById,
    getObject,
    saveObject,
    deleteObject,
  });
}
