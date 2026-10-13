import React, { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import type { PlatformAdminPermissions, PlatformUserProfile } from "@mms/shared";
import { normalizePlatformAdminPermissions } from "@mms/shared";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormField";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { useUpdatePlatformAdminPermissions } from "@/platform/hooks/usePlatformAdmins";
import { PlatformAdminPermissionsFields } from "@/platform/components/PlatformAdminPermissionsFields";

interface PlatformEditAdminAccessDialogProps {
  admin: PlatformUserProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlatformEditAdminAccessDialog({
  admin,
  open,
  onOpenChange,
}: PlatformEditAdminAccessDialogProps): React.JSX.Element {
  const { t } = useTranslation();
  const updatePermissions = useUpdatePlatformAdminPermissions();
  const [permissions, setPermissions] = useState<PlatformAdminPermissions>(() =>
    normalizePlatformAdminPermissions(admin.permissions),
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPermissions(normalizePlatformAdminPermissions(admin.permissions));
      setPassword("");
      setError(null);
    }
  }, [open, admin]);

  const handleSave = async (): Promise<void> => {
    setError(null);
    if (!password.trim()) {
      setError(t("platform.validationConfirmPlatformPassword"));
      return;
    }
    try {
      await updatePermissions.mutateAsync({
        adminId: admin.id,
        permissions,
        password,
      });
      onOpenChange(false);
    } catch (err) {
      setError(getPlatformErrorMessage(err, t));
    }
  };

  return (
    <FormModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={t("platform.editAdminAccessTitle")}
      subtitle={`${admin.name} · ${admin.email}`}
      icon={Shield}
      size="sm"
      error={error ?? undefined}
      cancelLabel={t("common.cancel")}
      saveLabel={t("platform.editAdminAccessSave")}
      onSave={handleSave}
      saving={updatePermissions.isPending}
      dir="ltr"
      lang="en"
      formId="platform-edit-admin-access-form"
    >
      <form
        id="platform-edit-admin-access-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!updatePermissions.isPending) {
            void handleSave();
          }
        }}
        className="space-y-3"
      >
        <PlatformAdminPermissionsFields
          value={permissions}
          onChange={setPermissions}
          disabled={updatePermissions.isPending}
        />
        <Field id="edit-admin-step-up" label={t("platform.confirmPlatformPassword")} required>
          <Input
            id="edit-admin-step-up"
            name="platformPassword"
            type="password"
            autoComplete="current-password"
            placeholder={t("platform.confirmPlatformPasswordHint")}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            className="h-11 text-sm"
            disabled={updatePermissions.isPending}
          />
        </Field>
      </form>
    </FormModal>
  );
}
