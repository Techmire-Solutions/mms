import { configureUploadsRootResolver } from "@mms/be-core/db-sync/backupAssetService";
import { resolveUploadsRoot } from "../config/uploadConfig.js";

configureUploadsRootResolver(resolveUploadsRoot);

export * from "@mms/be-core/db-sync/backupAssetService";
