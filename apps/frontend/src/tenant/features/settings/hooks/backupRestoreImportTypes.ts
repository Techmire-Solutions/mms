import type { useTranslation } from "@/hooks/useTranslation";
import type { BackupCredentials } from "@mms/shared";

export type TranslateFn = ReturnType<typeof useTranslation>["t"];

export interface UseBackupRestoreImportOptions {
  subdomain: string | null | undefined;
  adminEmail: string;
  storagePrefix: string;
  t: TranslateFn;
  errorDescription: (message: string) => string;
  downloadSafetyBackup: (credentials: BackupCredentials) => Promise<void>;
}
