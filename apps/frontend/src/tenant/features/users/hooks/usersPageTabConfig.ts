import { Users as UsersIcon, Activity } from "lucide-react";
import { USERS_MODULE_MANIFEST, type AppTranslationKey } from "@mms/shared";
import type { LucideIcon } from "lucide-react";

export const SETUP_TAB_LABEL_KEYS: Record<
  (typeof USERS_MODULE_MANIFEST.setupSubTabs)[number],
  AppTranslationKey
> = {
  permissions: "users.permissions",
  preferences: "users.setup.preferences",
};

export interface UserConfigTabItem {
  id: (typeof USERS_MODULE_MANIFEST.setupSubTabs)[number];
  label: string;
}

export interface UserSubTabItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export function getUsersConfigTabs(
  canAccessRoles: boolean,
  t: (key: AppTranslationKey) => string,
): UserConfigTabItem[] {
  const tabs = canAccessRoles
    ? USERS_MODULE_MANIFEST.setupSubTabs
    : USERS_MODULE_MANIFEST.setupSubTabs.filter((id) => id !== "permissions");

  return tabs.map((id) => ({
    id,
    label: t(SETUP_TAB_LABEL_KEYS[id]),
  }));
}

export function getUsersSubTabs(t: (key: AppTranslationKey) => string): UserSubTabItem[] {
  return [
    { id: "users", label: t("users.list"), icon: UsersIcon },
    { id: "activity", label: t("users.activity"), icon: Activity },
  ];
}
