import React from "react";
import { Trash2 } from "lucide-react";
import { SettingsAdminOnlyNotice } from "@/tenant/features/settings/components/SettingsAdminOnlyNotice";
import BackupRestoreConfirmModal from "@/tenant/features/settings/components/BackupRestoreConfirmModal";
import BackupCredentialsModal from "@/tenant/features/settings/components/BackupCredentialsModal";
import { ConfirmAlertDialog } from "@/components/app/ConfirmAlertDialog";
import BackupExportSection from "@/tenant/features/settings/components/backup/BackupExportSection";
import BackupHistorySection from "@/tenant/features/settings/components/backup/BackupHistorySection";
import BackupImportSection from "@/tenant/features/settings/components/backup/BackupImportSection";
import { AuditIntegritySection } from "@/tenant/features/settings/components/backup/AuditIntegritySection";
import { SettingsPanel } from "@/components/app/SettingsShell";
import { useBackupRestore } from "@/tenant/features/settings/hooks/useBackupRestore";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { useTenant } from "@/lib/contexts/TenantContext";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import type { BackupCredentialsModalProps } from "@/tenant/features/settings/components/BackupCredentialsModal";

const BackupRestore = function BackupRestore(): React.JSX.Element {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const { subdomain } = useTenant();
  const { user } = useAuth();
  const isAdmin = can("settings.global.write");
  const adminEmail = user?.email ?? "";

  const backup = useBackupRestore({ subdomain, adminEmail });

  const credentialsModalProps = (() => {
    if (backup.exportModalOpen) {
      return {
        open: true,
        mode: "export",
        adminEmail,
        emailReadOnly: true,
        loading: backup.isCreating,
        onClose: () => backup.setExportModalOpen(false),
        onSubmit: (password: string, email: string) =>
          void backup.runEncryptedExport(password, email),
      };
    }
    if (backup.pendingDecrypt) {
      const decryptEmail =
        backup.pendingDecrypt.kind === "file"
          ? backup.pendingDecrypt.adminEmail
          : (backup.pendingDecrypt.backup.adminEmail ?? adminEmail);
      const decryptEmailReadOnly =
        backup.pendingDecrypt.kind === "file" || Boolean(backup.pendingDecrypt.backup.adminEmail);

      return {
        open: true,
        mode: "decrypt",
        adminEmail: decryptEmail,
        emailReadOnly: decryptEmailReadOnly,
        loading: backup.decryptLoading,
        onClose: () => backup.setPendingDecrypt(null),
        onSubmit: (password: string, email: string) =>
          void backup.handleDecryptSubmit(password, email),
      };
    }
    return null;
  })() as BackupCredentialsModalProps | null;

  if (!isAdmin) {
    return (
      <SettingsPanel width="medium" introKey="settings.introBackup">
        <SettingsAdminOnlyNotice titleKey="backup.adminOnlyTitle" descKey="backup.adminOnlyDesc" />
      </SettingsPanel>
    );
  }

  return (
    <SettingsPanel
      width="wide"
      introKey="settings.introBackup"
      footer={
        <div className="flex w-full flex-wrap items-center gap-3 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => backup.setClearHistoryOpen(true)}
            className="flex min-h-11 items-center gap-2 px-5 py-2.5 rounded-lg font-semibold"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>{t("backup.clearHistory")}</span>
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <BackupExportSection
          adminEmail={adminEmail}
          isCreating={backup.isCreating}
          lastExportStats={backup.lastExportStats}
          onStartExport={() => backup.setExportModalOpen(true)}
        />
        <BackupImportSection
          dragActive={backup.dragActive}
          selectedFileName={backup.selectedFileName}
          uploadLimitLabel={backup.uploadLimitLabel}
          onDragActiveChange={backup.setDragActive}
          onFileSelected={backup.processImportFile}
        />
      </div>

      <BackupHistorySection
        backups={backup.backups}
        restoreId={backup.restoreId}
        onRestore={backup.openHistoryRestore}
        onDownload={backup.handleDownloadBackup}
      />

      <AuditIntegritySection workspaceSubdomain={subdomain ?? ""} />

      {credentialsModalProps && <BackupCredentialsModal {...credentialsModalProps} />}

      <BackupRestoreConfirmModal
        open={backup.pendingRestore !== null}
        onClose={() => {
          // A wipe is in flight — dismissing would hide its outcome.
          if (backup.restoreId !== null || backup.safetyStep) return;
          backup.cancelRestore();
        }}
        summary={backup.pendingRestore?.summary ?? null}
        targetSubdomain={subdomain ?? ""}
        confirmPhrase={backup.confirmPhrase}
        restoring={backup.restoreId !== null}
        safetyStep={backup.safetyStep}
        safetyReady={backup.safetyReady}
        onCreateSafetyBackup={(password) => void backup.createSafetyBackup(password)}
        onConfirm={() => {
          if (backup.pendingRestore) void backup.beginRestore(backup.pendingRestore);
        }}
      />

      <ConfirmAlertDialog
        open={backup.clearHistoryOpen}
        onOpenChange={(open) => {
          if (!open) backup.setClearHistoryOpen(false);
        }}
        title={t("backup.clearHistoryConfirmTitle")}
        description={t("backup.clearHistoryConfirmDesc")}
        confirmLabel={t("backup.clearHistoryConfirmAction")}
        cancelLabel={t("backup.confirmCancel")}
        destructive
        onConfirm={backup.handleClearHistory}
      />
    </SettingsPanel>
  );
};

export default BackupRestore;
