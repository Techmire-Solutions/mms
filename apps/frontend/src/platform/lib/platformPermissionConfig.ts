import { Building2, UserPlus, Settings, ShieldCheck, Server, type LucideIcon } from "lucide-react";
import type { AppTranslationKey, PlatformAdminPermissionKey } from "@mms/shared";

export const PLATFORM_PERMISSION_CONFIG: {
  key: PlatformAdminPermissionKey;
  labelKey: AppTranslationKey;
  descriptionKey: AppTranslationKey;
  icon: LucideIcon;
  name: string;
}[] = [
  {
    key: "workspaces",
    labelKey: "platform.permWorkspaces",
    descriptionKey: "platform.permWorkspacesDesc",
    icon: Building2,
    name: "permWorkspaces",
  },
  {
    key: "onboard",
    labelKey: "platform.permOnboard",
    descriptionKey: "platform.permOnboardDesc",
    icon: UserPlus,
    name: "permOnboard",
  },
  {
    key: "settings",
    labelKey: "platform.permSettings",
    descriptionKey: "platform.permSettingsDesc",
    icon: Settings,
    name: "permSettings",
  },
  {
    key: "admins",
    labelKey: "platform.permAdmins",
    descriptionKey: "platform.permAdminsDesc",
    icon: ShieldCheck,
    name: "permAdmins",
  },
  {
    key: "system",
    labelKey: "platform.permSystem",
    descriptionKey: "platform.permSystemDesc",
    icon: Server,
    name: "permSystem",
  },
];
