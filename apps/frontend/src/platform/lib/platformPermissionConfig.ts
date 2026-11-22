import { Building2, UserPlus, Settings, ShieldCheck, Server, type LucideIcon } from "lucide-react";
import type { AppTranslationKey, PlatformAdminPermissionKey } from "@mms/shared";

export interface PlatformPermissionConfigEntry {
  labelKey: AppTranslationKey;
  descriptionKey: AppTranslationKey;
  icon: LucideIcon;
}

/** Typed entry iteration preserving the declaration order. */
export function platformPermissionEntries(): [
  PlatformAdminPermissionKey,
  PlatformPermissionConfigEntry,
][] {
  return Object.entries(PLATFORM_PERMISSION_CONFIG) as [
    PlatformAdminPermissionKey,
    PlatformPermissionConfigEntry,
  ][];
}

export const PLATFORM_PERMISSION_CONFIG: Record<
  PlatformAdminPermissionKey,
  PlatformPermissionConfigEntry
> = {
  workspaces: {
    labelKey: "platform.permWorkspaces",
    descriptionKey: "platform.permWorkspacesDesc",
    icon: Building2,
  },
  onboard: {
    labelKey: "platform.permOnboard",
    descriptionKey: "platform.permOnboardDesc",
    icon: UserPlus,
  },
  settings: {
    labelKey: "platform.permSettings",
    descriptionKey: "platform.permSettingsDesc",
    icon: Settings,
  },
  admins: {
    labelKey: "platform.permAdmins",
    descriptionKey: "platform.permAdminsDesc",
    icon: ShieldCheck,
  },
  system: {
    labelKey: "platform.permSystem",
    descriptionKey: "platform.permSystemDesc",
    icon: Server,
  },
};
