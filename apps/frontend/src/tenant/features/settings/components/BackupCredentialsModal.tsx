import React, { useEffect, useState } from "react";
import { Lock, Mail } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { FormModal } from "@/components/app/FormModal";
import { Label } from "@/components/ui/label";
import { LeadingIconInput } from "@/components/app/LeadingIconInput";
import { PasswordInput } from "@/components/app/PasswordInput";
import { SettingsCallout } from "@/components/app/SettingsShell";

export interface BackupCredentialsModalProps {
  open: boolean;
  mode: "export" | "decrypt";
  adminEmail: string;
  emailReadOnly?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (password: string, email: string) => void;
}

export default function BackupCredentialsModal({
  open,
  mode,
  adminEmail,
  emailReadOnly = false,
  loading = false,
  onClose,
  onSubmit,
}: BackupCredentialsModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [email, setEmail] = useState(adminEmail);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (open) {
      setEmail(adminEmail);
      setPassword("");
    }
  }, [open, adminEmail]);

  const title = mode === "export" ? t("backup.encryptExportTitle") : t("backup.decryptTitle");
  const subtitle = mode === "export" ? t("backup.encryptExportDesc") : t("backup.decryptDesc");

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={Lock}
      size="sm"
      cancelLabel={t("backup.confirmCancel")}
      saveLabel={
        loading
          ? mode === "export"
            ? t("backup.creating")
            : t("backup.decrypting")
          : mode === "export"
            ? t("backup.createButton")
            : t("backup.decryptAction")
      }
      onSave={() => onSubmit(password, email)}
      saving={loading}
      saveDisabled={!password.trim() || !email.trim()}
      formId="backup-credentials-form"
    >
      <form
        id="backup-credentials-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (password.trim() && email.trim() && !loading) {
            onSubmit(password, email);
          }
        }}
        className="space-y-4"
      >
        <SettingsCallout>{t("backup.encryptNote")}</SettingsCallout>
        <div className="space-y-2">
          <Label htmlFor="backup-admin-email">{t("backup.adminEmailLabel")}</Label>
          <LeadingIconInput
            id="backup-admin-email"
            name="backupAdminEmail"
            type="email"
            icon={Mail}
            value={email}
            readOnly={emailReadOnly}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            disabled={loading || emailReadOnly}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="backup-admin-password">{t("backup.adminPasswordLabel")}</Label>
          <PasswordInput
            id="backup-admin-password"
            name="backupAdminPassword"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            disabled={loading}
          />
        </div>
      </form>
    </FormModal>
  );
}
