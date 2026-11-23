import React, { useState } from "react";
import { Database, Download, FileUp, HardDriveDownload, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionCard } from "@/components/app/SectionCard";
import { SettingsPanel } from "@/components/app/SettingsShell";
import { Alert } from "@/components/app/Alert";
import { Field } from "@/components/app/FormPrimitives";
import { PasswordInput } from "@/components/app/PasswordInput";
import { Badge, Button, Input, ToggleRow } from "@shared/ui";
import { usePlatformAuth } from "@/platform/features/auth/lib/PlatformAuthContext";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import {
  useExportPlatformBackup,
  useImportPlatformBackup,
} from "@/platform/features/settings/hooks/usePlatformBackup";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import type { PlatformConfigBackupApplyResult } from "@mms/shared";

const HISTORY_KEY = "mms_platform_backup_history";

interface BackupHistoryEntry {
  id: string;
  fileName: string;
  createdAt: string;
}

function readHistory(): BackupHistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed) ? (parsed as BackupHistoryEntry[]).slice(0, 10) : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: BackupHistoryEntry[]): void {
  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, 10)));
  } catch {
    // Non-fatal
  }
}

function downloadTextFile(fileName: string, contents: string): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Encrypted platform-configuration export/import (super-user + password step-up). */
export default function PlatformBackupSettingsPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const { platformUser } = usePlatformAuth();
  const { isSuperUser } = usePlatformPermissions();
  const exportBackup = useExportPlatformBackup();
  const importBackup = useImportPlatformBackup();

  const adminEmail = platformUser?.email ?? "";
  const [password, setPassword] = useState("");
  const [importPassword, setImportPassword] = useState("");
  const [fileText, setFileText] = useState("");
  const [fileName, setFileName] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [history, setHistory] = useState<BackupHistoryEntry[]>(readHistory);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlatformConfigBackupApplyResult | null>(null);

  if (!isSuperUser) {
    return (
      <SettingsPanel width="medium" introKey="platform.settings.introBackup">
        <Alert
          tone="warning"
          density="compact"
          role="status"
          icon={ShieldAlert}
          description={t("platform.settings.superUserOnly")}
        />
      </SettingsPanel>
    );
  }

  const handleExport = async (): Promise<void> => {
    setError(null);
    try {
      const response = await exportBackup.mutateAsync({ email: adminEmail, password });
      downloadTextFile(response.fileName, response.file);
      const next = [
        { id: `${Date.now()}`, fileName: response.fileName, createdAt: new Date().toISOString() },
        ...history,
      ].slice(0, 10);
      setHistory(next);
      writeHistory(next);
      setPassword("");
    } catch (exportError) {
      setError(getPlatformErrorMessage(exportError, t, undefined, "platform.loadFailed"));
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setFileText(await file.text());
    setResult(null);
  };

  const handleImport = async (): Promise<void> => {
    setError(null);
    setResult(null);
    try {
      const applyResult = await importBackup.mutateAsync({
        file: fileText,
        email: adminEmail,
        password: importPassword,
        dryRun,
      });
      setResult(applyResult);
      if (!dryRun) setImportPassword("");
    } catch (importError) {
      setError(getPlatformErrorMessage(importError, t, undefined, "platform.loadFailed"));
    }
  };

  return (
    <SettingsPanel width="medium" introKey="platform.settings.introBackup">
      <SectionCard
        title={t("platform.settings.backupExportTitle")}
        subtitle={t("platform.settings.backupExportDesc")}
        icon={HardDriveDownload}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="platform-backup-email" label={t("backup.adminEmailLabel")}>
            <Input
              id="platform-backup-email"
              value={adminEmail}
              readOnly
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-backup-password" label={t("backup.adminPasswordLabel")}>
            <PasswordInput
              id="platform-backup-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void handleExport()}
            disabled={!password || exportBackup.isPending}
            className="min-h-11 rounded-xl px-5 font-semibold"
          >
            <Download className="me-2 h-4 w-4" aria-hidden />
            {exportBackup.isPending
              ? t("common.loading")
              : t("platform.settings.backupExportAction")}
          </Button>
          <span className="text-2xs text-muted-foreground">
            {t("platform.settings.backupSecretNote")}
          </span>
        </div>
      </SectionCard>

      <SectionCard
        title={t("platform.settings.backupImportTitle")}
        subtitle={t("platform.settings.backupImportDesc")}
        icon={FileUp}
      >
        <div className="space-y-4">
          <Field
            id="platform-backup-file"
            label={t("platform.settings.backupFile")}
            hint={fileName || undefined}
          >
            <Input
              id="platform-backup-file"
              type="file"
              accept=".json,application/json"
              onChange={(event) => void handleFileChange(event)}
              className="h-10 rounded-xl"
            />
          </Field>
          <Field id="platform-backup-import-password" label={t("backup.adminPasswordLabel")}>
            <PasswordInput
              id="platform-backup-import-password"
              value={importPassword}
              onChange={(event) => setImportPassword(event.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <ToggleRow
            id="platform-backup-dry-run"
            variant="bordered"
            label={t("platform.settings.backupDryRun")}
            description={t("platform.settings.backupDryRunDesc")}
            checked={dryRun}
            onCheckedChange={setDryRun}
          />
          <Button
            type="button"
            onClick={() => void handleImport()}
            disabled={!fileText || !importPassword || importBackup.isPending}
            className="min-h-11 rounded-xl px-5 font-semibold"
          >
            {importBackup.isPending
              ? t("common.loading")
              : t("platform.settings.backupImportAction")}
          </Button>
        </div>
      </SectionCard>

      {result ? (
        <Alert
          tone="success"
          density="compact"
          role="status"
          title={t("platform.settings.backupResultTitle")}
          description={
            <span className="space-y-1">
              <span className="block">
                {t("platform.settings.backupApplied", {
                  settings: String(result.applied.settings),
                  branding: String(result.applied.branding),
                })}
              </span>
              <span className="block">
                {t("platform.settings.backupNotApplied", {
                  workspaces: result.notApplied.workspaces,
                  admins: result.notApplied.admins,
                })}
              </span>
              {result.warnings.map((warning) => (
                <span key={warning} className="block text-2xs">
                  {warning}
                </span>
              ))}
            </span>
          }
        />
      ) : null}

      {error ? (
        <Alert tone="destructive" density="compact" role="alert" description={error} />
      ) : null}

      <SectionCard
        title={t("platform.settings.backupHistoryTitle")}
        subtitle={t("platform.settings.backupHistoryDesc")}
        icon={Database}
      >
        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("backup.historyEmpty")}</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {history.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="truncate text-xs font-medium">{entry.fileName}</span>
                <Badge as="span" tone="muted" size="sm">
                  {new Date(entry.createdAt).toLocaleString("en")}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </SettingsPanel>
  );
}
