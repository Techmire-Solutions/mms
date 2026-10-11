import {
  BACKUP_UPLOAD_MAX_BYTES,
  DEFAULT_BACKUP_HISTORY,
  formatBackupSize,
  isBackupErrorKey,
  type WorkspaceBackupRecord,
} from "@mms/shared";
import { getWorkspaceLocalStoragePrefix } from "@/lib/db";
import { useTranslation } from "@/hooks/useTranslation";
import { useLiveCollection } from "@/hooks/useLiveCollection";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useBackupRestoreExport } from "@/tenant/features/settings/hooks/useBackupRestoreExport";
import { useBackupRestoreImport } from "@/tenant/features/settings/hooks/useBackupRestoreImport";

import type { UseBackupRestoreOptions } from "@/tenant/features/settings/hooks/backupRestoreTypes";

export type { UseBackupRestoreOptions } from "@/tenant/features/settings/hooks/backupRestoreTypes";

export function useBackupRestore({ subdomain, adminEmail }: UseBackupRestoreOptions) {
  const { t } = useTranslation();
  const branding = useBranding();
  const backups = useLiveCollection<WorkspaceBackupRecord>("backups", DEFAULT_BACKUP_HISTORY);

  const confirmPhrase = subdomain ?? "RESTORE";
  const storagePrefix = getWorkspaceLocalStoragePrefix();
  const tenantLabel = branding.madrasaName?.trim() || subdomain || "workspace";

  const errorDescription = (message: string): string =>
    isBackupErrorKey(message) ? t(message) : message;

  const exportActions = useBackupRestoreExport({
    subdomain,
    tenantLabel,
    backups,
    t,
    errorDescription,
  });

  const importActions = useBackupRestoreImport({
    subdomain,
    adminEmail,
    storagePrefix,
    t,
    errorDescription,
    downloadSafetyBackup: exportActions.downloadSafetyBackup,
  });

  const workspaceNote = t("backup.workspaceScopeNote", { prefix: storagePrefix });
  const tips = [
    t("backup.tipRegular"),
    t("backup.tipOffsite"),
    t("backup.tipVerify"),
    t("backup.tipHistoryLimit"),
    t("backup.tipScope"),
  ];

  return {
    backups,
    historyCount: backups.length,
    uploadLimitLabel: formatBackupSize(BACKUP_UPLOAD_MAX_BYTES),
    workspaceNote,
    tips,
    isCreating: exportActions.isCreating,
    exportModalOpen: exportActions.exportModalOpen,
    setExportModalOpen: exportActions.setExportModalOpen,
    pendingDecrypt: importActions.pendingDecrypt,
    setPendingDecrypt: importActions.setPendingDecrypt,
    decryptLoading: importActions.decryptLoading,
    restoreId: importActions.restoreId,
    pendingRestore: importActions.pendingRestore,
    clearHistoryOpen: importActions.clearHistoryOpen,
    setClearHistoryOpen: importActions.setClearHistoryOpen,
    dragActive: importActions.dragActive,
    setDragActive: importActions.setDragActive,
    selectedFileName: importActions.selectedFileName,
    lastExportStats: exportActions.lastExportStats,
    safetyStep: importActions.safetyStep,
    safetyReady: importActions.safetyReady,
    confirmPhrase,
    runEncryptedExport: exportActions.runEncryptedExport,
    handleDecryptSubmit: importActions.handleDecryptSubmit,
    processImportFile: importActions.processImportFile,
    openHistoryRestore: importActions.openHistoryRestore,
    handleDownloadBackup: importActions.handleDownloadBackup,
    handleClearHistory: importActions.handleClearHistory,
    createSafetyBackup: importActions.createSafetyBackup,
    beginRestore: importActions.beginRestore,
    cancelRestore: importActions.cancelRestore,
  };
}
