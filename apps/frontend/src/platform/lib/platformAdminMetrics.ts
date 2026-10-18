import type { PlatformUserProfile } from "@mms/shared";

export function getPlatformAdminMetrics(admins: readonly PlatformUserProfile[]) {
  const total = admins.length;
  const disabled = admins.filter((admin) => Boolean(admin.disabledAt)).length;
  const superUsers = admins.filter((admin) => admin.role === "super_user").length;
  const verified = admins.filter((admin) => Boolean(admin.emailVerifiedAt)).length;
  return {
    total,
    disabled,
    active: total - disabled,
    superUsers,
    standardAdmins: total - superUsers,
    verified,
    verifiedPct: total > 0 ? Math.round((verified / total) * 100) : 0,
  };
}
