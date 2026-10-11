import {
  buildBackupFileName,
  decryptWorkspaceBackup,
  DEFAULT_BACKUP_HISTORY,
  isEncryptedBackupPayload,
  type PendingDecrypt,
  type WorkspaceBackupRecord,
} from "@mms/shared";
import { saveCollection } from "@/lib/db";
import { triggerFileDownload } from "@/lib/download";
import { notify } from "@/lib/notify";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { processBackupImportFile } from "./processBackupImportFile";

export interface UseBackupRestoreDecryptActionsOptions {
  subdomain: string | null | undefined;
  adminEmail: string;
  t: TranslationFunction;
  errorDescription: (message: string) => string;
  pendingDecrypt: PendingDecrypt | null;
  setPendingDecrypt: (value: PendingDecrypt | null) => void;
  setDecryptLoading: (value: boolean) => void;
  setClearHistoryOpen: (value: boolean) => void;
  setSelectedFileName: (value: string | null) => void;
  queuePlaintextRestore: (
    jsonText: string,
    meta?: { fileName?: string; backupId?: string },
  ) => void;
}

export function useBackupRestoreDecryptActions({
  subdomain,
  adminEmail,
  t,
  errorDescription,
  pendingDecrypt,
  setPendingDecrypt,
  setDecryptLoading,
  setClearHistoryOpen,
  setSelectedFileName,
  queuePlaintextRestore,
}: UseBackupRestoreDecryptActionsOptions) {
  const handleDecryptSubmit = async (password: string, email: string): Promise<void> => {
    if (!pendingDecrypt) return;
    setDecryptLoading(true);
    try {
      const credentials = { adminEmail: email.trim().toLowerCase(), password };
      const encryptedText =
        pendingDecrypt.kind === "file"
          ? pendingDecrypt.encryptedText
          : (pendingDecrypt.backup.data ?? "");
      const result = await decryptWorkspaceBackup(encryptedText, credentials);
      if (!result.ok) {
        notify.error(t("backup.restoreFailed"), { description: t(result.errorKey) });
        return;
      }
      const plaintext = result.plaintext;
      const fileName =
        pendingDecrypt.kind === "file"
          ? pendingDecrypt.fileName
          : (pendingDecrypt.backup.fileName ?? pendingDecrypt.backup.name);

      if (pendingDecrypt.kind !== "history") {
        setSelectedFileName(fileName);
      }

      const backupId = pendingDecrypt.kind === "history" ? pendingDecrypt.backup.id : undefined;

      queuePlaintextRestore(plaintext, { fileName, backupId });
      setPendingDecrypt(null);
    } catch (err) {
      const error = err as Error;
      notify.error(t("backup.restoreFailed"), { description: errorDescription(error.message) });
    } finally {
      setDecryptLoading(false);
    }
  };

  const processImportFile = (file: File | undefined): void => {
    if (!file) return;
    processBackupImportFile(file, adminEmail, subdomain, t, setPendingDecrypt);
  };

  const openHistoryRestore = (backup: WorkspaceBackupRecord): void => {
    if (!backup.data) {
      notify.error(t("backup.noData"), { description: t("backup.noDataDesc") });
      return;
    }
    if (backup.encrypted || isEncryptedBackupPayload(backup.data)) {
      setPendingDecrypt({ kind: "history", backup });
      return;
    }
    notify.error(t("backup.restoreFailed"), {
      description: t("backup.encryptedRequired"),
    });
  };

  const handleDownloadBackup = (backup: WorkspaceBackupRecord): void => {
    if (!backup.data) {
      notify.error(t("backup.noData"), { description: t("backup.noDataDesc") });
      return;
    }
    const fileName =
      backup.fileName ??
      buildBackupFileName(new Date(backup.date), {
        tenantSlug: subdomain,
        encrypted: backup.encrypted ?? isEncryptedBackupPayload(backup.data),
      });
    triggerFileDownload(new Blob([backup.data], { type: "application/json" }), fileName);
  };

  const handleClearHistory = (): void => {
    saveCollection("backups", DEFAULT_BACKUP_HISTORY);
    setClearHistoryOpen(false);
    notify.success(t("settings.backupResetToast"), {
      description: t("settings.backupResetToastDesc"),
    });
  };

  return {
    handleDecryptSubmit,
    processImportFile,
    openHistoryRestore,
    handleDownloadBackup,
    handleClearHistory,
  };
}
