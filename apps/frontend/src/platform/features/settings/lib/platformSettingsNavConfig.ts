import { Brain, Boxes, Database, Globe, Palette, Sparkles, type LucideIcon } from "lucide-react";
import type { AppTranslationKey } from "@mms/shared";

/** Platform settings sections — ids mirror the tenant `/settings` sections. */
export const PLATFORM_SETTINGS_SECTIONS = [
  "global",
  "branding",
  "theme",
  "modules",
  "llm",
  "backup",
] as const;

export type PlatformSettingsSection = (typeof PLATFORM_SETTINGS_SECTIONS)[number];

export interface PlatformSettingsNavItem {
  id: PlatformSettingsSection;
  labelKey: AppTranslationKey;
  icon: LucideIcon;
}

/** Sidebar order for `/platform/settings`. */
export const PLATFORM_SETTINGS_NAV: PlatformSettingsNavItem[] = [
  { id: "global", labelKey: "platform.settingsTabGlobal", icon: Globe },
  { id: "branding", labelKey: "platform.settingsTabBranding", icon: Palette },
  { id: "theme", labelKey: "platform.settingsTabTheme", icon: Sparkles },
  { id: "modules", labelKey: "platform.settingsTabModules", icon: Boxes },
  { id: "llm", labelKey: "platform.settingsTabLlm", icon: Brain },
  { id: "backup", labelKey: "platform.settingsTabBackup", icon: Database },
];

const SECTION_IDS = new Set<string>(PLATFORM_SETTINGS_SECTIONS);
const LEGACY_SECTION_ALIASES: Record<string, PlatformSettingsSection> = {
  notifications: "global",
  security: "global",
};

export function isPlatformSettingsSection(value: unknown): value is PlatformSettingsSection {
  return typeof value === "string" && SECTION_IDS.has(value);
}

/** Parses `?section=` (including legacy notifications/security deep links). */
export function parsePlatformSettingsSection(raw: string | null): PlatformSettingsSection {
  if (isPlatformSettingsSection(raw)) return raw;
  if (raw && LEGACY_SECTION_ALIASES[raw]) return LEGACY_SECTION_ALIASES[raw];
  return "global";
}
