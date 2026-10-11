import { type BackupCredentials, type PendingDecrypt, type PendingRestore } from "@mms/shared";
import { verifyAdminBackupPassword } from "@/lib/backupAuth";
import { importDatabase } from "@/lib/db";
import { notify } from "@/lib/notify";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { useBackupRestoreDecryptActions } from "./useBackupRestoreDecryptActions";

export interface UseBackupRestoreImportActionsOptions {
  subdomain: string | null | undefined;
  adminEmail: string;
  t: TranslationFunction;
  errorDescription: (message: string) => string;
  downloadSafetyBackup: (credentials: BackupCredentials) => Promise<void>;
  pendingDecrypt: PendingDecrypt | null;
  setPendingDecrypt: (value: PendingDecrypt | null) => void;
  setDecryptLoading: (value: boolean) => void;
  setRestoreId: (value: string | null) => void;
  setPendingRestore: (value: PendingRestore | null) => void;
  setClearHistoryOpen: (value: boolean) => void;
  setSelectedFileName: (value: string | null) => void;
  setSafetyStep: (value: boolean) => void;
  setSafetyReady: (value: boolean) => void;
  safetyReady: boolean;
  queuePlaintextRestore: (
    jsonText: string,
    meta?: { fileName?: string; backupId?: string },
  ) => void;
}

export function useBackupRestoreImportActions({
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
}: UseBackupRestoreImportActionsOptions) {
  /**
   * Step 1 of restore: re-authenticate the signed-in admin, then download an encrypted
   * safety copy of the current workspace. Only a completed download unlocks the wipe.
   */
  const createSafetyBackup = async (password: string): Promise<void> => {
    setSafetyStep(true);
    try {
      const verified = await verifyAdminBackupPassword(adminEmail, password);
      if (!verified.ok) {
        notify.error(t("backup.restoreFailed"), { description: t(verified.errorKey) });
        return;
      }
      await downloadSafetyBackup({ adminEmail: adminEmail.trim().toLowerCase(), password });
      setSafetyReady(true);
      notify.success(t("backup.safetyBackupReady"), {
        description: t("backup.safetyBackupReadyDesc"),
      });
    } catch (err) {
      const error = err as Error;
      notify.error(t("backup.restoreFailed"), { description: errorDescription(error.message) });
    } finally {
      setSafetyStep(false);
    }
  };

  const beginRestore = async (payload: PendingRestore): Promise<void> => {
    if (!safetyReady) {
      notify.error(t("backup.restoreFailed"), {
        description: t("backup.safetyBackupRequired"),
      });
      return;
    }
    setRestoreId(payload.backupId ?? "active");
    try {
      await importDatabase(payload.jsonText);
      notify.success(t("backup.restoreSuccess"), { description: t("backup.restoreSuccessDesc") });
      setPendingRestore(null);
      setSelectedFileName(null);
      // A full restore can change the signed-in admin's role/soft-delete status,
      // enabled modules, and branding — none of which are TanStack Queries
      // (session + public settings live in AuthContext). Only a full re-bootstrap
      // reapplies all of them, so we reload rather than just invalidate the cache.
      // Defer briefly so the success confirmation above is visible before reload.
      setTimeout(() => window.location.reload(), 1200);
    } catch (err) {
      const error = err as Error;
      notify.error(t("backup.restoreFailed"), { description: errorDescription(error.message) });
      setRestoreId(null);
    }
  };

  const cancelRestore = (): void => {
    setPendingRestore(null);
    setSelectedFileName(null);
    setSafetyReady(false);
  };

  const decryptActions = useBackupRestoreDecryptActions({
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
  });

  return {
    ...decryptActions,
    createSafetyBackup,
    beginRestore,
    cancelRestore,
  };
}
