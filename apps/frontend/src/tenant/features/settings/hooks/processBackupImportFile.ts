import {
  BACKUP_UPLOAD_MAX_BYTES,
  formatBackupSize,
  parseEncryptedBackupFile,
  type AppTranslationKey,
  type PendingDecrypt,
} from "@mms/shared";
import { notify } from "@/lib/notify";
import type { TranslateFn } from "./backupRestoreImportTypes";
import { compareBackupSubdomains } from "./backupRestoreUtils";

export function processBackupImportFile(
  file: File,
  adminEmail: string,
  targetSubdomain: string | null | undefined,
  t: TranslateFn,
  setPendingDecrypt: (pending: PendingDecrypt) => void,
): void {
  const fail = (key: AppTranslationKey, params?: Record<string, string | number>) => {
    notify.error(t("backup.restoreFailed"), { description: t(key, params) });
  };

  const lower = file.name.toLowerCase();
  const isEncryptedExt = lower.endsWith(".mmsbak");
  if (!isEncryptedExt) {
    fail("backup.encryptedRequired");
    return;
  }

  if (file.size > BACKUP_UPLOAD_MAX_BYTES) {
    fail("backup.fileTooLarge", { max: formatBackupSize(BACKUP_UPLOAD_MAX_BYTES) });
    return;
  }

  const reader = new FileReader();
  reader.onload = (loadEvent) => {
    const text = loadEvent.target?.result;
    if (typeof text !== "string") {
      fail("backup.invalidFormat");
      return;
    }

    const encryptedFile = parseEncryptedBackupFile(text);
    if (encryptedFile) {
      // The wrapper names its source workspace — reject early, before asking for a password.
      const compare = compareBackupSubdomains(encryptedFile.subdomain, targetSubdomain);
      if (compare === "unidentified") {
        fail("backup.workspaceUnidentified");
        return;
      }
      if (compare === "mismatch") {
        fail("backup.workspaceMismatch");
        return;
      }
      setPendingDecrypt({
        kind: "file",
        encryptedText: text,
        fileName: file.name,
        adminEmail: encryptedFile.adminEmail || adminEmail,
      });
      return;
    }

    fail("backup.invalidFormat");
  };
  reader.onerror = () => fail("backup.invalidFormat");
  reader.readAsText(file);
}
