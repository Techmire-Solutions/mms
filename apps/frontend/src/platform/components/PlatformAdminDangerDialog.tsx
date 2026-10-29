import React, { useState } from "react";
import type { PlatformUserProfile } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { TypedConfirmDialog } from "@shared/ui";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import {
  useDeletePlatformAdmin,
  useSetPlatformAdminDisabled,
} from "@/platform/hooks/usePlatformAdmins";

type AdminDangerMode = "disable" | "enable" | "delete";

interface PlatformAdminDangerDialogProps {
  admin: PlatformUserProfile;
  mode: AdminDangerMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlatformAdminDangerDialog({
  admin,
  mode,
  open,
  onOpenChange,
}: PlatformAdminDangerDialogProps): React.JSX.Element {
  const { t } = useTranslation();
  const setDisabled = useSetPlatformAdminDisabled();
  const deleteAdmin = useDeletePlatformAdmin();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Reset the step-up form during render whenever the dialog target changes.
  const [prevTarget, setPrevTarget] = useState({ open, mode, adminId: admin.id });
  if (prevTarget.open !== open || prevTarget.mode !== mode || prevTarget.adminId !== admin.id) {
    setPrevTarget({ open, mode, adminId: admin.id });
    if (open) {
      setPassword("");
      setError(null);
    }
  }

  const pending = setDisabled.isPending || deleteAdmin.isPending;

  const titleKey =
    mode === "delete"
      ? "platform.deleteAdminTitle"
      : mode === "disable"
        ? "platform.disableAdminTitle"
        : "platform.enableAdminTitle";
  const descKey =
    mode === "delete"
      ? "platform.deleteAdminDesc"
      : mode === "disable"
        ? "platform.disableAdminDesc"
        : "platform.enableAdminDesc";
  const saveKey =
    mode === "delete"
      ? "platform.deleteAdminConfirm"
      : mode === "disable"
        ? "platform.disableAdminConfirm"
        : "platform.enableAdminConfirm";

  const handleConfirm = async (): Promise<void> => {
    if (!password.trim()) return;
    setError(null);
    try {
      if (mode === "delete") {
        await deleteAdmin.mutateAsync({ adminId: admin.id, password });
      } else {
        await setDisabled.mutateAsync({
          adminId: admin.id,
          disabled: mode === "disable",
          password,
        });
      }
      onOpenChange(false);
    } catch (err) {
      setError(getPlatformErrorMessage(err, t));
    }
  };

  return (
    <TypedConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(titleKey)}
      description={`${t(descKey)} (${admin.name} · ${admin.email})`}
      password={password}
      onPasswordChange={setPassword}
      passwordInputId={`platform-admin-danger-password-${admin.id}`}
      passwordInputName="adminDangerPassword"
      passwordLabel={t("platform.adminPasswordConfirm")}
      error={error}
      pending={pending}
      confirmButtonLabel={t(saveKey)}
      confirmVariant={mode === "delete" || mode === "disable" ? "destructive" : "default"}
      destructiveTitle={mode === "delete" || mode === "disable"}
      onConfirm={handleConfirm}
    />
  );
}
