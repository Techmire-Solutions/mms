import { useState } from "react";
import {
  appendBackupHistory,
  BACKUP_HISTORY_MAX_BYTES,
  buildBackupFileName,
  createBackupHistoryEntry,
  formatBackupSize,
  type WorkspaceBackupRecord,
} from "@mms/shared";
import { exportEncryptedTenantBackup, saveCollection } from "@/lib/db";
import { verifyAdminBackupPassword } from "@/lib/backupAuth";
import { triggerFileDownload } from "@/lib/download";
import { notify } from "@/lib/notify";
import type { useTranslation } from "@/hooks/useTranslation";
import type { WorkspaceExportStats } from "./backupRestoreTypes";

type TranslateFn = ReturnType<typeof useTranslation>["t"];

interface UseBackupRestoreExportOptions {
  subdomain: string | null | undefined;
  tenantLabel: string;
  backups: WorkspaceBackupRecord[];
  t: TranslateFn;
  errorDescription: (message: string) => string;
}

export function useBackupRestoreExport({
  subdomain,
  tenantLabel,
  backups,
  t,
  errorDescription,
}: UseBackupRestoreExportOptions) {
  const [isCreating, setIsCreating] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [lastExportStats, setLastExportStats] = useState<WorkspaceExportStats | null>(null);

  const downloadSafetyBackup = async (credentials: {
    adminEmail: string;
    password: string;
  }): Promise<void> => {
    const { encrypted } = await exportEncryptedTenantBackup(credentials, tenantLabel);
    // The restore gate trusts this file — never hand back an empty undo copy.
    if (!encrypted) {
      throw new Error("backup.emptyBackup");
    }
    triggerFileDownload(
      new Blob([encrypted], { type: "application/json" }),
      buildBackupFileName(new Date(), {
        tenantSlug: subdomain,
        suffix: "pre_restore",
        encrypted: true,
      }),
    );
  };

  const runEncryptedExport = async (password: string, email: string): Promise<void> => {
    setIsCreating(true);
    try {
      const verified = await verifyAdminBackupPassword(email, password);
      if (!verified.ok) {
        notify.error(t("backup.createFailed"), { description: t(verified.errorKey) });
        return;
      }

      const credentials = { adminEmail: email.trim().toLowerCase(), password };
      const { encrypted, stats } = await exportEncryptedTenantBackup(credentials, tenantLabel);

      const now = new Date();
      const fileName = buildBackupFileName(now, { tenantSlug: subdomain, encrypted: true });
      triggerFileDownload(new Blob([encrypted], { type: "application/json" }), fileName);

      setLastExportStats({
        collections: stats.collectionCount,
        objects: stats.objectCount,
        size: formatBackupSize(encrypted.length),
      });

      saveCollection(
        "backups",
        appendBackupHistory(
          backups,
          createBackupHistoryEntry(encrypted, now, t("backup.fullBackupName"), stats, {
            fileName,
            encrypted: true,
            adminEmail: credentials.adminEmail,
            maxInlineBytes: BACKUP_HISTORY_MAX_BYTES,
          }),
        ),
      );
      setExportModalOpen(false);
      notify.success(t("backup.createSuccess"), { description: t("backup.createSuccessDesc") });
    } catch (createError) {
      const backupError = createError as Error;
      notify.error(t("backup.createFailed"), {
        description: errorDescription(backupError.message),
      });
    } finally {
      setIsCreating(false);
    }
  };

  return {
    isCreating,
    exportModalOpen,
    setExportModalOpen,
    lastExportStats,
    downloadSafetyBackup,
    runEncryptedExport,
  };
}
