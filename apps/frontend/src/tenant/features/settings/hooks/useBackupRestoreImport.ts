import { useState } from "react";
import { summarizeWorkspaceBackup, type PendingDecrypt, type PendingRestore } from "@mms/shared";
import { notify } from "@/lib/notify";
import type { UseBackupRestoreImportOptions } from "./backupRestoreImportTypes";
import { useBackupRestoreImportActions } from "./useBackupRestoreImportActions";
import { compareBackupSubdomains } from "./backupRestoreUtils";

export function useBackupRestoreImport({
  subdomain,
  adminEmail,
  storagePrefix,
  t,
  errorDescription,
  downloadSafetyBackup,
}: UseBackupRestoreImportOptions) {
  const [pendingDecrypt, setPendingDecrypt] = useState<PendingDecrypt | null>(null);
  const [decryptLoading, setDecryptLoading] = useState(false);
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<PendingRestore | null>(null);
  const [clearHistoryOpen, setClearHistoryOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [safetyStep, setSafetyStep] = useState(false);
  const [safetyReady, setSafetyReady] = useState(false);

  const queuePlaintextRestore = (
    jsonText: string,
    meta?: { fileName?: string; backupId?: string },
  ): void => {
    const preview = summarizeWorkspaceBackup(jsonText, storagePrefix);
    if (!preview.ok) {
      notify.error(t("backup.restoreFailed"), { description: t(preview.errorKey) });
      return;
    }
    const compare = compareBackupSubdomains(preview.summary.subdomain, subdomain);
    if (compare === "unidentified") {
      notify.error(t("backup.restoreFailed"), {
        description: t("backup.workspaceUnidentified"),
      });
      return;
    }
    if (compare === "mismatch") {
      notify.error(t("backup.restoreFailed"), {
        description: t("backup.workspaceMismatch"),
      });
      return;
    }
    setPendingRestore({
      jsonText,
      summary: preview.summary,
      fileName: meta?.fileName,
      backupId: meta?.backupId,
    });
    setSafetyReady(false);
  };

  const actions = useBackupRestoreImportActions({
    subdomain,
    adminEmail,
    t,
    errorDescription,
    downloadSafetyBackup,
    pendingDecrypt,
    setPendingDecrypt,
    setDecryptLoading,
    setRestoreId,
    setPendingRestore,
    setClearHistoryOpen,
    setSelectedFileName,
    setSafetyStep,
    setSafetyReady,
    safetyReady,
    queuePlaintextRestore,
  });

  return {
    pendingDecrypt,
    setPendingDecrypt,
    decryptLoading,
    restoreId,
    pendingRestore,
    clearHistoryOpen,
    setClearHistoryOpen,
    dragActive,
    setDragActive,
    selectedFileName,
    safetyStep,
    safetyReady,
    ...actions,
  };
}
