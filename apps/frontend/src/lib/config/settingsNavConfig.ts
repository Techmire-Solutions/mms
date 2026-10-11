import { Brain, Boxes, Database, Globe, Palette, Sparkles, type LucideIcon } from "lucide-react";
import type { AppTranslationKey, Permission } from "@mms/shared";
import { SETTINGS_SECTIONS, type SettingsSection } from "@/lib/config/routes";

export interface SettingsNavItem {
  id: SettingsSection;
  labelKey: AppTranslationKey;
  icon: LucideIcon;
  /** Unset = visible to any authenticated tenant user. */
  requiredPermission?: Permission;
}

/** Sidebar order for `/settings` — keep ids aligned with {@link SETTINGS_SECTIONS}. */
export const SETTINGS_NAV: SettingsNavItem[] = [
  { id: "global", labelKey: "settings.global", icon: Globe },
  {
    id: "branding",
    labelKey: "settings.branding",
    icon: Palette,
    requiredPermission: "settings.branding.write",
  },
  { id: "theme", labelKey: "settings.theme", icon: Sparkles },
  { id: "llm", labelKey: "settings.llm", icon: Brain, requiredPermission: "settings.global.write" },
  {
    id: "modules",
    labelKey: "settings.modules",
    icon: Boxes,
    requiredPermission: "settings.global.write",
  },
  {
    id: "backup",
    labelKey: "settings.backup",
    icon: Database,
    requiredPermission: "settings.global.write",
  },
];

const navIds = new Set(SETTINGS_NAV.map((item) => item.id));
if (SETTINGS_SECTIONS.some((id) => !navIds.has(id))) {
  throw new Error("SETTINGS_NAV is missing one or more SETTINGS_SECTIONS entries");
}
