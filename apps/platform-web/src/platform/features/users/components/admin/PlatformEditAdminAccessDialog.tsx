import { translateValidationMessage } from "@/lib/forms/translateValidationMessage";
import React, { useState } from "react";
import { Shield } from "lucide-react";
import type { PlatformAdminPermissions, PlatformUserProfile } from "@mms/contracts";
import {
  normalizePlatformAdminPermissions,
  platformUpdateAdminPermissionsBodySchema,
} from "@mms/contracts";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { Field, Input } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import { useUpdatePlatformAdminPermissions } from "@/platform/features/users/hooks/usePlatformAdmins";
import { PlatformAdminPermissionsFields } from "@/platform/features/users/components/admin/PlatformAdminPermissionsFields";

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
  // Reset the editor during render whenever the dialog opens or its target changes.
  const [prevTarget, setPrevTarget] = useState({ open, admin });
  if (prevTarget.open !== open || prevTarget.admin !== admin) {
    setPrevTarget({ open, admin });
    if (open) {
      setPermissions(normalizePlatformAdminPermissions(admin.permissions));
      setPassword("");
      setError(null);
    }
  }

  const initialPermissions = normalizePlatformAdminPermissions(admin.permissions);
  const isDirty = JSON.stringify(permissions) !== JSON.stringify(initialPermissions);

  const handleSave = async (): Promise<void> => {
    setError(null);
    if (!password.trim()) {
      setError(t("platform.validationConfirmPlatformPassword"));
      return;
    }
    const parsed = platformUpdateAdminPermissionsBodySchema.safeParse({
      permissions,
      password,
    });
    if (!parsed.success) {
      setError(translateValidationMessage(parsed.error.issues[0]?.message, t));
      return;
    }
    try {
      await updatePermissions.mutateAsync({
        adminId: admin.id,
        permissions: parsed.data.permissions,
        password: parsed.data.password,
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
      isDirty={isDirty}
      dir="ltr"
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
