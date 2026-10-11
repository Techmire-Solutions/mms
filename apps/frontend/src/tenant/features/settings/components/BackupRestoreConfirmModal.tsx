import React, { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { formatDateTime, type WorkspaceBackupSummary } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCallout } from "@/components/ui/SettingsShell";
import { compareBackupSubdomains } from "../hooks/backupRestoreUtils";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { BackupSummaryPreview } from "./BackupSummaryPreview";

export interface BackupRestoreConfirmModalProps {
  open: boolean;
  onClose: () => void;
  summary: WorkspaceBackupSummary | null;
  targetSubdomain: string;
  confirmPhrase: string;
  restoring?: boolean;
  /** Safety backup is being created. */
  safetyStep?: boolean;
  /** Safety backup finished downloading — unlocks step 2. */
  safetyReady?: boolean;
  onCreateSafetyBackup: (password: string) => void;
  onConfirm: () => void;
}

function formatExportedAt(iso: string | null): string | null {
  if (!iso) return null;
  const formatted = formatDateTime(iso);
  return formatted === "—" ? iso : formatted;
}

const BackupRestoreConfirmModal = function BackupRestoreConfirmModal({
  open,
  onClose,
  summary,
  targetSubdomain,
  confirmPhrase,
  restoring = false,
  safetyStep = false,
  safetyReady = false,
  onCreateSafetyBackup,
  onConfirm,
}: BackupRestoreConfirmModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setTyped("");
      setPassword("");
    }
  }, [open]);

  const phraseOk = typed.trim().toLowerCase() === confirmPhrase.trim().toLowerCase();
  const workspaceMatches = compareBackupSubdomains(summary?.subdomain, targetSubdomain) === "match";
  const busy = restoring || safetyStep;
  const exportedLabel = (() => formatExportedAt(summary?.exportedAt ?? null))();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("backup.confirmRestoreTitle")}
      subtitle={t("backup.confirmRestoreDesc")}
      icon={AlertTriangle}
      size="md"
      footer={
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={busy}
            className="min-h-11 px-4"
          >
            {t("backup.confirmCancel")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!phraseOk || !workspaceMatches || !safetyReady || busy}
            onClick={onConfirm}
            className="min-h-11 px-5 shadow-sm"
          >
            {restoring ? t("backup.restoring") : t("backup.confirmRestoreAction")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <SettingsCallout variant="warning">
          <span className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <span>{t("backup.restoreWarning")}</span>
          </span>
        </SettingsCallout>

        {summary ? (
          <BackupSummaryPreview
            summary={summary}
            targetSubdomain={targetSubdomain}
            exportedLabel={exportedLabel}
          />
        ) : null}

        {summary && !workspaceMatches ? (
          <SettingsCallout variant="warning">{t("backup.workspaceMismatch")}</SettingsCallout>
        ) : null}

        <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/10 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {t("backup.safetyBackupStepTitle")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t("backup.safetyBackupNote")}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">{t("backup.stepUpNote")}</p>

          <Label htmlFor="backup-restore-password">{t("backup.adminPasswordLabel")}</Label>
          <PasswordInput
            id="backup-restore-password"
            name="backup-restore-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && password && workspaceMatches && !busy && !safetyReady) {
                event.preventDefault();
                onCreateSafetyBackup(password);
              }
            }}
            autoComplete="current-password"
            disabled={busy || safetyReady}
          />

          {safetyReady ? (
            <p className="flex items-center gap-2 pt-1 text-xs font-semibold text-success">
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              {t("backup.safetyBackupDone")}
            </p>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="mt-1 min-h-11 w-full font-semibold"
              disabled={!password || !workspaceMatches || busy}
              onClick={() => onCreateSafetyBackup(password)}
            >
              {safetyStep ? t("backup.safetyBackupCreating") : t("backup.safetyBackupAction")}
            </Button>
          )}
        </div>

        <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/10 p-4">
          <p className="text-sm font-semibold text-foreground">{t("backup.restoreStepTitle")}</p>
          {!safetyReady ? (
            <p className="text-xs text-warning">{t("backup.safetyBackupRequired")}</p>
          ) : null}
          <Label htmlFor="backup-confirm-phrase">
            {t("backup.confirmTypeLabel", { phrase: confirmPhrase })}
          </Label>
          <Input
            id="backup-confirm-phrase"
            name="backup-confirm-phrase"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder={t("backup.confirmTypePlaceholder")}
            autoComplete="off"
            disabled={busy || !safetyReady}
          />
        </div>
      </div>
    </Modal>
  );
};

export default BackupRestoreConfirmModal;
