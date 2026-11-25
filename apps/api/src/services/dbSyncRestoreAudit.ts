import { configureRestoreDataSynchronizer } from "@mms/be-core/db-sync/restoreAudit";
import { synchronizeData } from "./dbSyncService.js";

configureRestoreDataSynchronizer(synchronizeData);

export * from "@mms/be-core/db-sync/restoreAudit";
