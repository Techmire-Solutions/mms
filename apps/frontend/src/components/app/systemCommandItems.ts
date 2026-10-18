import type React from "react";
import { UserCog, Settings, User } from "lucide-react";
import { ROUTES } from "@/lib/config/routes";

export interface CommandItem {
  id: string;
  labelKey: string;
  fallbackLabel: string;
  categoryKey: string;
  fallbackCategory: string;
  path: string;
  icon: React.ElementType;
  keywords: string[];
}

export const SYSTEM_COMMAND_ITEMS: CommandItem[] = [
  {
    id: "users",
    labelKey: "nav.users",
    fallbackLabel: "Users",
    categoryKey: "nav.system",
    fallbackCategory: "System",
    path: ROUTES.users,
    icon: UserCog,
    keywords: ["users", "admins", "staff", "permissions", "roles"],
  },
  {
    id: "settings",
    labelKey: "nav.settings",
    fallbackLabel: "Settings",
    categoryKey: "nav.system",
    fallbackCategory: "System",
    path: ROUTES.settings,
    icon: Settings,
    keywords: ["settings", "branding", "theme", "backup", "configuration"],
  },
  {
    id: "profile",
    labelKey: "account.title",
    fallbackLabel: "Account Profile",
    categoryKey: "nav.system",
    fallbackCategory: "System",
    path: ROUTES.profile,
    icon: User,
    keywords: ["profile", "account", "password", "security", "me"],
  },
];
