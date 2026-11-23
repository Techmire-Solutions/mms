import { useDeferredValue, useMemo, useState } from "react";
import {
  normalizePlatformAdminPermissions,
  type PlatformAdminPermissionKey,
  type PlatformAdminPermissions,
  type PlatformUserProfile,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";
import {
  usePlatformAdmins,
  useUpdatePlatformAdminPermissions,
} from "@/platform/features/users/hooks/usePlatformAdmins";

export type PendingPermissionToggle = {
  admin: PlatformUserProfile;
  permissions: PlatformAdminPermissions;
};

export function usePlatformPermissionMatrix() {
  const { t } = useTranslation();
  const { isSuperUser, platformUser: currentUser } = usePlatformPermissions();
  const query = usePlatformAdmins();
  const { data: admins, isLoading } = query;
  const updatePermissions = useUpdatePlatformAdminPermissions();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [pendingToggle, setPendingToggle] = useState<PendingPermissionToggle | null>(null);
  const [stepUpPassword, setStepUpPassword] = useState("");
  const [stepUpError, setStepUpError] = useState<string | null>(null);

  const filteredAdmins = useMemo(() => {
    if (!admins) return [];
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter(
      (a) => a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q),
    );
  }, [admins, deferredSearch]);

  const handleToggle = (admin: PlatformUserProfile, capKey: PlatformAdminPermissionKey) => {
    if (
      updatePermissions.isPending ||
      !isSuperUser ||
      admin.role === "super_user" ||
      admin.id === currentUser?.id
    ) {
      return;
    }
    const currentPerms = normalizePlatformAdminPermissions(admin.permissions);
    const nextPerms: PlatformAdminPermissions = {
      ...currentPerms,
      [capKey]: !currentPerms[capKey],
    };
    setStepUpPassword("");
    setStepUpError(null);
    setPendingToggle({ admin, permissions: nextPerms });
  };

  const cancelStepUp = () => {
    setPendingToggle(null);
    setStepUpPassword("");
    setStepUpError(null);
  };

  const confirmStepUp = async (): Promise<void> => {
    if (!pendingToggle || updatePermissions.isPending) return;
    if (!stepUpPassword.trim()) {
      setStepUpError(t("platform.validationConfirmPlatformPassword"));
      return;
    }
    try {
      await updatePermissions.mutateAsync({
        adminId: pendingToggle.admin.id,
        permissions: pendingToggle.permissions,
        password: stepUpPassword,
      });
      cancelStepUp();
    } catch (err) {
      setStepUpError(getPlatformErrorMessage(err, t, undefined, "platform.loadFailed"));
    }
  };

  return {
    filteredAdmins,
    isLoading,
    isError: query.isError,
    retry: query.refetch,
    isSuperUser,
    currentUser,
    search,
    setSearch,
    handleToggle,
    busy: updatePermissions.isPending,
    pendingToggle,
    stepUpPassword,
    setStepUpPassword,
    stepUpError,
    cancelStepUp,
    confirmStepUp,
  };
}
