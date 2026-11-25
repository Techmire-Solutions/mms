import type React from "react";
import { UserCog, Settings, User } from "lucide-react";
import type { AppTranslationKey } from "@mms/contracts";
import { ROUTES } from "@mms/fe-core/config/routes";

export interface CommandItem {
  id: string;
  labelKey: AppTranslationKey;
  categoryKey: AppTranslationKey;
  path: string;
  icon: React.ElementType;
  keywords: string[];
}

export const SYSTEM_COMMAND_ITEMS: CommandItem[] = [
  {
    id: "users",
    labelKey: "nav.users",
    categoryKey: "nav.system",
    path: ROUTES.users,
    icon: UserCog,
    keywords: ["users", "admins", "staff", "permissions", "roles"],
  },
  {
    id: "settings",
    labelKey: "nav.settings",
    categoryKey: "nav.system",
    path: ROUTES.settings,
    icon: Settings,
    keywords: ["settings", "branding", "theme", "backup", "configuration"],
  },
  {
    id: "profile",
    labelKey: "account.title",
    categoryKey: "nav.system",
    path: ROUTES.profile,
    icon: User,
    keywords: ["profile", "account", "password", "security", "me"],
  },
];
